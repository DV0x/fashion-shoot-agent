import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import multer from 'multer';
import { aiClient, sessionManager, progressEmitter, type ProgressData, type CheckpointData } from './lib/ai-client.js';
import { SDKInstrumentor } from './lib/instrumentor.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './lib/orchestrator-prompt.js';
import { WebSocketHandler, type WSServerMessage } from './lib/websocket-handler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3002;

// Create HTTP server for both Express and WebSocket
const httpServer = createServer(app);

// Initialize WebSocket handler
const wsHandler = new WebSocketHandler(httpServer);

app.use(cors());
app.use(express.json());

// Serve generated assets from agent/outputs
app.use('/outputs', express.static(path.join(__dirname, '../agent/outputs')));

// Serve uploaded files
const uploadsDir = path.join(__dirname, '../uploads');
app.use('/uploads', express.static(uploadsDir));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (_req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
    }
  }
});

// Store detected checkpoints per session (from PostToolUse hooks)
const detectedCheckpoints = new Map<string, CheckpointData>();

// Listen for progress events from PostToolUse hooks
// Progress events track pipeline stages without forcing stops
// The agent now decides naturally when to pause via its response
progressEmitter.on('progress', ({ sessionId, progress }: { sessionId: string; progress: ProgressData }) => {
  console.log(`📊 [PROGRESS] Stage completed:`);
  console.log(`   Session ID: ${sessionId}`);
  console.log(`   Stage: ${progress.stage}`);
  console.log(`   Artifact: ${progress.artifact || 'none'}`);
  console.log(`   Artifacts: ${progress.artifacts?.join(', ') || 'none'}`);
  console.log(`   Is Final: ${progress.isFinal || false}`);

  // Store for reference (can be used by endpoints)
  detectedCheckpoints.set(sessionId, progress);

  // Check if session is in autonomous mode
  const isAutonomous = sessionManager.isAutonomousMode(sessionId);

  const progressMessage = {
    type: 'progress' as const,
    sessionId,
    progress,
    // Only signal awaitingInput on final completion, never in autonomous mode
    awaitingInput: progress.isFinal && !isAutonomous
  };

  console.log(`📊 [PROGRESS] WS subscribers: ${wsHandler.getSessionSubscriberCount(sessionId)}, Autonomous: ${isAutonomous}`);

  // Broadcast to WebSocket subscribers
  wsHandler.broadcastToSession(sessionId, progressMessage as WSServerMessage);
});

/**
 * Parse checkpoint marker from agent response (fallback method)
 * Returns null if no checkpoint found
 */
function parseCheckpoint(responseText: string): CheckpointData | null {
  const checkpointRegex = /---CHECKPOINT---([\s\S]*?)---END CHECKPOINT---/;
  const match = responseText.match(checkpointRegex);

  if (!match) {
    return null;
  }

  const checkpointContent = match[1].trim();
  const lines = checkpointContent.split('\n');
  const data: Record<string, string> = {};

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > -1) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      data[key] = value;
    }
  }

  // Parse artifacts list if present
  let artifacts: string[] | undefined;
  if (data.artifacts) {
    artifacts = data.artifacts.split(',').map(s => s.trim());
  }

  return {
    stage: data.stage as CheckpointData['stage'],
    status: (data.status || 'complete') as CheckpointData['status'],
    artifact: data.artifact,
    artifacts,
    message: data.message || ''
  };
}

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    agent: 'fashion-shoot-agent',
    timestamp: new Date().toISOString(),
    config: {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY,
      hasFalKey: !!process.env.FAL_KEY,
      port: PORT
    }
  });
});

// Workflows endpoint removed - using static ORCHESTRATOR_SYSTEM_PROMPT

// Upload multiple images (subject + reference images)
app.post('/upload', upload.array('images', 10), (req, res) => {
  const files = req.files as Express.Multer.File[];

  if (!files || files.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No files uploaded'
    });
  }

  const uploadedFiles = files.map(file => ({
    originalName: file.originalname,
    filename: file.filename,
    path: file.path,
    size: file.size,
    mimetype: file.mimetype,
    url: `/uploads/${file.filename}`
  }));

  console.log(`📤 Uploaded ${files.length} file(s):`, uploadedFiles.map(f => f.originalName).join(', '));

  res.json({
    success: true,
    count: uploadedFiles.length,
    files: uploadedFiles
  });
});

// List sessions
app.get('/sessions', (_req, res) => {
  const sessions = sessionManager.getActiveSessions();
  res.json({
    success: true,
    count: sessions.length,
    sessions: sessions.map(s => ({
      id: s.id,
      sdkSessionId: s.sdkSessionId,
      createdAt: s.createdAt,
      lastAccessedAt: s.lastAccessedAt,
      metadata: s.metadata,
      turnCount: s.turnCount
    }))
  });
});

// Get session info
app.get('/sessions/:id', (req, res) => {
  const stats = sessionManager.getSessionStats(req.params.id);
  if (!stats) {
    return res.status(404).json({ success: false, error: 'Session not found' });
  }
  res.json({ success: true, session: stats });
});

// Get pipeline status for a session
app.get('/sessions/:id/pipeline', (req, res) => {
  const pipelineStatus = sessionManager.getPipelineStatus(req.params.id);
  if (!pipelineStatus) {
    return res.status(404).json({ success: false, error: 'Session or pipeline not found' });
  }
  res.json({
    success: true,
    sessionId: req.params.id,
    pipeline: pipelineStatus
  });
});

// Get assets for a session
app.get('/sessions/:id/assets', (req, res) => {
  const assets = sessionManager.getSessionAssets(req.params.id);
  if (!assets) {
    return res.status(404).json({ success: false, error: 'Session or assets not found' });
  }
  res.json({
    success: true,
    sessionId: req.params.id,
    outputDir: sessionManager.getSessionOutputDir(req.params.id),
    assets
  });
});

// Cancel active generation for a session
app.post('/sessions/:id/cancel', (req, res) => {
  const sessionId = req.params.id;
  console.log(`🛑 Cancel request for session: ${sessionId}`);

  const cancelled = aiClient.cancelGeneration(sessionId);

  if (cancelled) {
    // Broadcast to WebSocket subscribers
    wsHandler.broadcastToSession(sessionId, { type: 'cancelled', sessionId });

    res.json({ success: true, message: 'Generation cancelled' });
  } else {
    res.status(404).json({ success: false, error: 'No active generation for this session' });
  }
});

// ============================================
// WebSocket Event Handlers
// ============================================

/**
 * Handle WebSocket 'chat' event - Start new generation via WebSocket
 */
wsHandler.on('chat', async ({ clientId, sessionId, content, images }) => {
  console.log(`🔌 [WS] Chat from ${clientId}: ${content.substring(0, 50)}...`);

  // Check for /yolo command in prompt
  const isYoloMode = /^\/yolo\b/i.test(content.trim()) || /\byolo\b/i.test(content.toLowerCase());
  const cleanPrompt = content.replace(/^\/yolo\s*/i, '').trim();

  const campaignSessionId = sessionId || `session_${Date.now()}`;
  const instrumentor = new SDKInstrumentor(campaignSessionId, cleanPrompt);

  // Auto-subscribe client to session
  wsHandler.autoSubscribeClient(clientId, campaignSessionId);

  // Send session init
  wsHandler.broadcastToSession(campaignSessionId, {
    type: 'session_init',
    sessionId: campaignSessionId
  });

  try {
    await sessionManager.getOrCreateSession(campaignSessionId);
    await sessionManager.createSessionDirectories(campaignSessionId);

    if (isYoloMode) {
      await sessionManager.setAutonomousMode(campaignSessionId, true);
    }

    if (images && images.length > 0) {
      await sessionManager.addInputImages(campaignSessionId, images);
    }

    // Build prompt with image paths
    let fullPrompt = cleanPrompt;
    if (images && images.length > 0) {
      const inputFlags = images.map((img: string) => `--input "${img}"`).join(' ');
      fullPrompt = `${cleanPrompt}

## Reference Image File Paths (use ALL of these with --input flags in generate-image.ts)
${images.map((img: string, i: number) => `- Reference ${i + 1}: ${img}`).join('\n')}

CRITICAL: You MUST pass ALL reference images using multiple --input flags to preserve subject appearance AND include all referenced items.

Example command with ALL ${images.length} reference images:
npx tsx scripts/generate-image.ts --prompt "..." ${inputFlags} --output outputs/hero.png --aspect-ratio 3:2 --resolution 2K`;
    }

    const assistantMessages: string[] = [];

    let toolInputBuffer: Record<number, string> = {};  // Accumulate tool input JSON per block index
    let toolStartTimes: Record<number, number> = {};  // Track tool execution start times
    let hintSent = false;

    for await (const result of aiClient.queryWithSession(fullPrompt, campaignSessionId, { systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT, autonomousMode: isYoloMode })) {
      const { message } = result;
      instrumentor.processMessage(message);

      // Stream to WebSocket - Phase 7 block-level events
      if (message.type === 'stream_event') {
        const event = (message as any).event;

        switch (event?.type) {
          case 'content_block_start': {
            const blockType = event.content_block?.type;
            const blockIndex = event.index;

            const blockStartEvent = {
              type: 'block_start',
              blockIndex,
              blockType: blockType || 'text',
              toolName: blockType === 'tool_use' ? event.content_block?.name : undefined,
              toolId: blockType === 'tool_use' ? event.content_block?.id : undefined,
            };
            wsHandler.broadcastToSession(campaignSessionId, blockStartEvent as WSServerMessage);

            if (blockType === 'tool_use') {
              toolInputBuffer[blockIndex] = '';
              toolStartTimes[blockIndex] = Date.now();
              if (!hintSent) {
                wsHandler.broadcastToSession(campaignSessionId, { type: 'message_type_hint', messageType: 'thinking' });
                hintSent = true;
              }
            }
            break;
          }

          case 'content_block_delta': {
            const blockIndex = event.index;
            const deltaText = event.delta?.text;
            const inputJsonDelta = event.delta?.partial_json;

            if (deltaText || inputJsonDelta) {
              const blockDeltaEvent = {
                type: 'block_delta',
                blockIndex,
                text: deltaText || '',
                inputJsonDelta: inputJsonDelta || undefined,
              };
              wsHandler.broadcastToSession(campaignSessionId, blockDeltaEvent as WSServerMessage);

              if (inputJsonDelta && toolInputBuffer[blockIndex] !== undefined) {
                toolInputBuffer[blockIndex] += inputJsonDelta;
              }
            }
            break;
          }

          case 'content_block_stop': {
            const blockIndex = event.index;

            let parsedToolInput: Record<string, unknown> | undefined;
            let toolDuration: number | undefined;
            if (toolInputBuffer[blockIndex] !== undefined) {
              try {
                parsedToolInput = JSON.parse(toolInputBuffer[blockIndex]);
              } catch (e) {
                // JSON parsing failed
              }
              if (toolStartTimes[blockIndex]) {
                toolDuration = Date.now() - toolStartTimes[blockIndex];
              }
              delete toolInputBuffer[blockIndex];
              delete toolStartTimes[blockIndex];
            }

            const blockEndEvent = {
              type: 'block_end',
              blockIndex,
              toolInput: parsedToolInput,
              toolDuration,
            };
            wsHandler.broadcastToSession(campaignSessionId, blockEndEvent as WSServerMessage);
            break;
          }

          case 'message_start': {
            wsHandler.broadcastToSession(campaignSessionId, { type: 'message_start' } as WSServerMessage);
            break;
          }

          case 'message_stop': {
            wsHandler.broadcastToSession(campaignSessionId, { type: 'message_stop' } as WSServerMessage);
            break;
          }
        }
      } else if (message.type === 'assistant') {
        // Phase 7: Don't send assistant_message - block events already handle streaming
        // Just track the text for the final complete event
        const msgContent = (message as any).message?.content;
        if (Array.isArray(msgContent)) {
          const text = msgContent.find((c: any) => c.type === 'text')?.text || '';
          if (text) {
            assistantMessages.push(text);
          }
        }
        // Reset for next message
        hintSent = false;
      } else if (message.type === 'system') {
        wsHandler.broadcastToSession(campaignSessionId, { type: 'system', subtype: (message as any).subtype, data: message });
      } else if (message.type === 'result') {
        const fullResponse = assistantMessages.join('\n\n---\n\n');
        const hookCheckpoint = detectedCheckpoints.get(campaignSessionId);
        const parsedCheckpoint = parseCheckpoint(fullResponse);
        const checkpoint = hookCheckpoint || parsedCheckpoint;
        if (hookCheckpoint) detectedCheckpoints.delete(campaignSessionId);

        wsHandler.broadcastToSession(campaignSessionId, {
          type: 'complete',
          sessionId: campaignSessionId,
          response: assistantMessages[assistantMessages.length - 1] || '',
          checkpoint,
          awaitingInput: checkpoint !== null,
          sessionStats: sessionManager.getSessionStats(campaignSessionId),
          pipeline: sessionManager.getPipelineStatus(campaignSessionId),
          instrumentation: instrumentor.getCampaignReport()
        });
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      wsHandler.broadcastToSession(campaignSessionId, { type: 'cancelled', sessionId: campaignSessionId });
    } else {
      console.error('❌ [WS] Chat error:', error.message);
      wsHandler.broadcastToSession(campaignSessionId, { type: 'error', error: error.message });
    }
  }
});

/**
 * Handle WebSocket 'continue' event - Continue session via WebSocket
 */
wsHandler.on('continue', async ({ clientId, sessionId, content }) => {
  const prompt = content || 'continue';
  console.log(`🔌 [WS] Continue from ${clientId} for session ${sessionId}: ${prompt.substring(0, 50)}...`);

  const instrumentor = new SDKInstrumentor(sessionId, prompt);

  try {
    const assistantMessages: string[] = [];
    let toolInputBuffer: Record<number, string> = {};
    let toolStartTimes: Record<number, number> = {};
    let hintSent = false;

    for await (const result of aiClient.queryWithSession(prompt, sessionId, { systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT })) {
      const { message } = result;
      instrumentor.processMessage(message);

      // Stream to WebSocket - Phase 7 block-level events
      if (message.type === 'stream_event') {
        const event = (message as any).event;

        switch (event?.type) {
          case 'content_block_start': {
            const blockType = event.content_block?.type;
            const blockIndex = event.index;

            const blockStartEvent = {
              type: 'block_start',
              blockIndex,
              blockType: blockType || 'text',
              toolName: blockType === 'tool_use' ? event.content_block?.name : undefined,
              toolId: blockType === 'tool_use' ? event.content_block?.id : undefined,
            };
            wsHandler.broadcastToSession(sessionId, blockStartEvent as WSServerMessage);

            if (blockType === 'tool_use') {
              toolInputBuffer[blockIndex] = '';
              toolStartTimes[blockIndex] = Date.now();
              if (!hintSent) {
                wsHandler.broadcastToSession(sessionId, { type: 'message_type_hint', messageType: 'thinking' });
                hintSent = true;
              }
            }
            break;
          }

          case 'content_block_delta': {
            const blockIndex = event.index;
            const deltaText = event.delta?.text;
            const inputJsonDelta = event.delta?.partial_json;

            if (deltaText || inputJsonDelta) {
              const blockDeltaEvent = {
                type: 'block_delta',
                blockIndex,
                text: deltaText || '',
                inputJsonDelta: inputJsonDelta || undefined,
              };
              wsHandler.broadcastToSession(sessionId, blockDeltaEvent as WSServerMessage);

              if (inputJsonDelta && toolInputBuffer[blockIndex] !== undefined) {
                toolInputBuffer[blockIndex] += inputJsonDelta;
              }
            }
            break;
          }

          case 'content_block_stop': {
            const blockIndex = event.index;

            let parsedToolInput: Record<string, unknown> | undefined;
            let toolDuration: number | undefined;
            if (toolInputBuffer[blockIndex] !== undefined) {
              try {
                parsedToolInput = JSON.parse(toolInputBuffer[blockIndex]);
              } catch (e) {
                // JSON parsing failed
              }
              if (toolStartTimes[blockIndex]) {
                toolDuration = Date.now() - toolStartTimes[blockIndex];
              }
              delete toolInputBuffer[blockIndex];
              delete toolStartTimes[blockIndex];
            }

            const blockEndEvent = {
              type: 'block_end',
              blockIndex,
              toolInput: parsedToolInput,
              toolDuration,
            };
            wsHandler.broadcastToSession(sessionId, blockEndEvent as WSServerMessage);
            break;
          }

          case 'message_start': {
            wsHandler.broadcastToSession(sessionId, { type: 'message_start' } as WSServerMessage);
            break;
          }

          case 'message_stop': {
            wsHandler.broadcastToSession(sessionId, { type: 'message_stop' } as WSServerMessage);
            break;
          }
        }
      } else if (message.type === 'assistant') {
        // Phase 7: Don't send assistant_message - block events already handle streaming
        // Just track the text for the final complete event
        const msgContent = (message as any).message?.content;
        if (Array.isArray(msgContent)) {
          const text = msgContent.find((c: any) => c.type === 'text')?.text || '';
          if (text) {
            assistantMessages.push(text);
          }
        }
        // Reset for next message
        hintSent = false;
      } else if (message.type === 'system') {
        wsHandler.broadcastToSession(sessionId, { type: 'system', subtype: (message as any).subtype, data: message });
      } else if (message.type === 'result') {
        const fullResponse = assistantMessages.join('\n\n---\n\n');
        const hookCheckpoint = detectedCheckpoints.get(sessionId);
        const parsedCheckpoint = parseCheckpoint(fullResponse);
        const checkpoint = hookCheckpoint || parsedCheckpoint;
        if (hookCheckpoint) detectedCheckpoints.delete(sessionId);

        wsHandler.broadcastToSession(sessionId, {
          type: 'complete',
          sessionId,
          response: assistantMessages[assistantMessages.length - 1] || '',
          checkpoint,
          awaitingInput: checkpoint !== null,
          sessionStats: sessionManager.getSessionStats(sessionId),
          pipeline: sessionManager.getPipelineStatus(sessionId),
          instrumentation: instrumentor.getCampaignReport()
        });
      }
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      wsHandler.broadcastToSession(sessionId, { type: 'cancelled', sessionId });
    } else {
      console.error('❌ [WS] Continue error:', error.message);
      wsHandler.broadcastToSession(sessionId, { type: 'error', error: error.message });
    }
  }
});

/**
 * Handle WebSocket 'cancel' event - Cancel active generation
 */
wsHandler.on('cancel', async ({ clientId, sessionId }) => {
  console.log(`🔌 [WS] Cancel from ${clientId} for session ${sessionId}`);

  const cancelled = aiClient.cancelGeneration(sessionId);
  if (cancelled) {
    wsHandler.broadcastToSession(sessionId, { type: 'cancelled', sessionId });
  } else {
    wsHandler.sendToClientById(clientId, { type: 'error', error: 'No active generation to cancel' });
  }
});

/**
 * Handle WebSocket 'yolo' event - Enable autonomous mode
 */
wsHandler.on('yolo', async ({ clientId, sessionId }) => {
  console.log(`🔌 [WS] YOLO mode from ${clientId} for session ${sessionId}`);

  try {
    await sessionManager.setAutonomousMode(sessionId, true);
    wsHandler.sendToClientById(clientId, {
      type: 'system',
      subtype: 'yolo_enabled',
      data: { sessionId, message: 'Autonomous mode enabled' }
    });
  } catch (error: any) {
    wsHandler.sendToClientById(clientId, { type: 'error', error: error.message });
  }
});

// ============================================
// Server Startup
// ============================================

// Start HTTP server (serves both Express and WebSocket)
httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║         Fashion Shoot Agent Server             ║
╠════════════════════════════════════════════════╣
║  🎬 Server: http://localhost:${PORT}             ║
║  🔌 WebSocket: ws://localhost:${PORT}/ws         ║
║                                                ║
║  REST Endpoints:                               ║
║  GET  /health                - Health check    ║
║  POST /upload                - Upload images   ║
║  GET  /sessions              - List sessions   ║
║  GET  /sessions/:id          - Session info    ║
║  GET  /sessions/:id/pipeline - Pipeline status ║
║  GET  /sessions/:id/assets   - Get assets      ║
║  POST /sessions/:id/cancel   - Cancel          ║
║                                                ║
║  WebSocket Messages (client → server):         ║
║  { type: 'chat', content, images? }            ║
║  { type: 'continue', sessionId, content? }     ║
║  { type: 'cancel', sessionId }                 ║
║  { type: 'subscribe', sessionId }              ║
║  { type: 'yolo', sessionId }                   ║
╠════════════════════════════════════════════════╣
║  Environment:                                  ║
║  - Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}           ║
║  - FAL API: ${process.env.FAL_KEY ? '✅ Configured' : '❌ Missing'}                  ║
╚════════════════════════════════════════════════╝
  `);
});
