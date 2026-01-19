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

// Store active SSE connections for streaming
const sseConnections = new Map<string, express.Response[]>();

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

  // Send progress to all SSE connections for this session
  const connections = sseConnections.get(sessionId);
  console.log(`📊 [PROGRESS] SSE connections: ${connections?.length || 0}, WS subscribers: ${wsHandler.getSessionSubscriberCount(sessionId)}, Autonomous: ${isAutonomous}`);

  if (connections) {
    for (const res of connections) {
      res.write(`data: ${JSON.stringify(progressMessage)}\n\n`);
    }
  }

  // Also broadcast to WebSocket subscribers
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

/**
 * Broadcast SDK message to SSE connections for frontend real-time updates
 * Console logging is now handled by SDKInstrumentor
 */
function broadcastSDKMessage(message: any, sessionId: string): void {
  broadcastToSSE(sessionId, message);
}

/**
 * Broadcast message to all SSE and WebSocket connections for a session
 */
function broadcastToSSE(sessionId: string, message: any): void {
  const eventData = {
    timestamp: new Date().toISOString(),
    type: message.type,
    subtype: message.subtype,
    data: message
  };

  // Broadcast to SSE connections
  const connections = sseConnections.get(sessionId);
  if (connections && connections.length > 0) {
    const sseData = JSON.stringify(eventData);
    connections.forEach(res => {
      res.write(`data: ${sseData}\n\n`);
    });
  }

  // Broadcast to WebSocket subscribers
  wsHandler.broadcastToSession(sessionId, eventData as WSServerMessage);
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
    // Broadcast cancellation to SSE connections
    const connections = sseConnections.get(sessionId);
    if (connections) {
      for (const sseRes of connections) {
        sseRes.write(`data: ${JSON.stringify({ type: 'cancelled', sessionId })}\n\n`);
      }
    }

    // Broadcast to WebSocket subscribers
    wsHandler.broadcastToSession(sessionId, { type: 'cancelled', sessionId });

    res.json({ success: true, message: 'Generation cancelled' });
  } else {
    res.status(404).json({ success: false, error: 'No active generation for this session' });
  }
});

// SSE streaming endpoint - subscribe to session events in real-time
app.get('/sessions/:id/stream', (req, res) => {
  const sessionId = req.params.id;

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected', sessionId })}\n\n`);

  // Add this connection to the session's connection list
  if (!sseConnections.has(sessionId)) {
    sseConnections.set(sessionId, []);
  }
  sseConnections.get(sessionId)!.push(res);

  console.log(`📡 SSE client connected for session: ${sessionId}`);

  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() })}\n\n`);
  }, 30000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
    const connections = sseConnections.get(sessionId);
    if (connections) {
      const index = connections.indexOf(res);
      if (index > -1) {
        connections.splice(index, 1);
      }
      if (connections.length === 0) {
        sseConnections.delete(sessionId);
      }
    }
    console.log(`📡 SSE client disconnected from session: ${sessionId}`);
  });
});

// Main generate endpoint
app.post('/generate', async (req, res) => {
  const { prompt, sessionId, inputImages, autonomousMode } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required',
      example: {
        prompt: "Create a fashion photoshoot with a model wearing a red dress",
        inputImages: ["/path/to/model.jpg", "/path/to/outfit.jpg"]
      }
    });
  }

  // Check for /yolo command in prompt
  const isYoloMode = autonomousMode || /^\/yolo\b/i.test(prompt.trim()) || /\byolo\b/i.test(prompt.toLowerCase());
  const cleanPrompt = prompt.replace(/^\/yolo\s*/i, '').trim();

  const campaignSessionId = sessionId || `session_${Date.now()}`;
  const instrumentor = new SDKInstrumentor(campaignSessionId, cleanPrompt);

  console.log('🎬 Starting generation');
  console.log('📝 Prompt:', cleanPrompt.substring(0, 100) + (cleanPrompt.length > 100 ? '...' : ''));
  console.log('🚀 Autonomous mode:', isYoloMode);

  // Create session and output directories
  let outputDir: string;
  try {
    await sessionManager.getOrCreateSession(campaignSessionId);
    outputDir = await sessionManager.createSessionDirectories(campaignSessionId);

    // Set autonomous mode if /yolo was detected
    if (isYoloMode) {
      await sessionManager.setAutonomousMode(campaignSessionId, true);
    }

    // Store input images if provided
    if (inputImages && Array.isArray(inputImages)) {
      await sessionManager.addInputImages(campaignSessionId, inputImages);
    }
  } catch (dirError: any) {
    console.error('❌ Failed to create session directories:', dirError.message);
    return res.status(500).json({
      success: false,
      error: `Failed to create session directories: ${dirError.message}`,
      sessionId: campaignSessionId
    });
  }

  try {
    const messages: any[] = [];

    // Pass images to SDK: both as base64 (for visual analysis) AND as file paths (for scripts)
    const images = inputImages && Array.isArray(inputImages) ? inputImages : [];

    // Build prompt with file paths so agent can pass them to generate-image.ts --input
    let fullPrompt = cleanPrompt;
    if (images.length > 0) {
      // Build --input flags for ALL images
      const inputFlags = images.map((img: string) => `--input "${img}"`).join(' ');

      fullPrompt = `${cleanPrompt}

## Reference Image File Paths (use ALL of these with --input flags in generate-image.ts)
${images.map((img: string, i: number) => `- Reference ${i + 1}: ${img}`).join('\n')}

CRITICAL: You MUST pass ALL reference images using multiple --input flags to preserve subject appearance AND include all referenced items (watch, jacket, etc.).

Example command with ALL ${images.length} reference images:
npx tsx scripts/generate-image.ts --prompt "..." ${inputFlags} --output outputs/hero.png --aspect-ratio 3:2 --resolution 2K`;
    }

    // Don't pass images as base64 multimodal input - avoids 5MB size limit
    // Images are referenced by path in the prompt for generate-image.ts --input
    for await (const result of aiClient.queryWithSession(fullPrompt, campaignSessionId, { systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT, autonomousMode: isYoloMode })) {
      const { message } = result;
      messages.push(message);
      instrumentor.processMessage(message);

      // Broadcast to SSE for frontend updates
      broadcastSDKMessage(message, campaignSessionId);
    }

    // Extract assistant responses
    const assistantMessages = messages
      .filter(m => m.type === 'assistant')
      .map(m => {
        const content = m.message?.content;
        if (Array.isArray(content)) {
          return content.find((c: any) => c.type === 'text')?.text || '';
        }
        return '';
      })
      .filter(t => t.length > 0);

    const fullResponse = assistantMessages.join('\n\n---\n\n');

    // Get checkpoint: prefer hook-detected, fallback to parsing response
    const hookCheckpoint = detectedCheckpoints.get(campaignSessionId);
    const parsedCheckpoint = parseCheckpoint(fullResponse);
    const checkpoint = hookCheckpoint || parsedCheckpoint;
    const awaitingInput = checkpoint !== null;

    if (checkpoint) {
      console.log(`⏸️  CHECKPOINT: ${checkpoint.stage} - ${checkpoint.message}`);
      // Clear hook checkpoint after use
      if (hookCheckpoint) detectedCheckpoints.delete(campaignSessionId);
    }

    let sessionStats, campaignReport, pipelineStatus;
    try {
      sessionStats = sessionManager.getSessionStats(campaignSessionId);
      campaignReport = instrumentor.getCampaignReport();
      pipelineStatus = sessionManager.getPipelineStatus(campaignSessionId);
    } catch (statsError: any) {
      console.error('❌ Error getting stats:', statsError.message);
    }

    console.log('📤 Sending response to client...');

    const responseData = {
      success: true,
      sessionId: campaignSessionId,
      outputDir,
      response: assistantMessages[assistantMessages.length - 1] || '',
      fullResponse,
      checkpoint,           // Parsed checkpoint data (null if not at checkpoint)
      awaitingInput,        // true if waiting for user decision
      sessionStats: sessionStats || null,
      pipeline: pipelineStatus || null,
      instrumentation: campaignReport ? {
        ...campaignReport,
        costBreakdown: instrumentor.getCostBreakdown()
      } : null
    };

    console.log('📤 Response data prepared, sending...');
    res.json(responseData);
    console.log('✅ Response sent successfully');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    console.error('❌ Stack:', error.stack);
    try {
      await sessionManager.updatePipelineStage(campaignSessionId, 'error', error.message);
    } catch (e) {
      // ignore
    }
    res.status(500).json({
      success: false,
      error: error.message,
      sessionId: campaignSessionId,
      outputDir
    });
  }
});

// Streaming generate endpoint - streams tokens in real-time via SSE
app.post('/generate-stream', async (req, res) => {
  const { prompt, sessionId, inputImages, autonomousMode } = req.body;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  // Check for /yolo command in prompt
  const isYoloMode = autonomousMode || /^\/yolo\b/i.test(prompt.trim()) || /\byolo\b/i.test(prompt.toLowerCase());
  const cleanPrompt = prompt.replace(/^\/yolo\s*/i, '').trim();

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const campaignSessionId = sessionId || `session_${Date.now()}`;
  const instrumentor = new SDKInstrumentor(campaignSessionId, cleanPrompt);

  console.log('🎬 Starting streaming generation');
  console.log('📝 Prompt:', cleanPrompt.substring(0, 100) + (cleanPrompt.length > 100 ? '...' : ''));
  console.log('🚀 Autonomous mode:', isYoloMode);

  // Send session ID immediately
  res.write(`data: ${JSON.stringify({ type: 'session_init', sessionId: campaignSessionId })}\n\n`);

  let outputDir: string;
  try {
    await sessionManager.getOrCreateSession(campaignSessionId);
    outputDir = await sessionManager.createSessionDirectories(campaignSessionId);

    // Set autonomous mode if /yolo was detected
    if (isYoloMode) {
      await sessionManager.setAutonomousMode(campaignSessionId, true);
    }

    if (inputImages && Array.isArray(inputImages)) {
      await sessionManager.addInputImages(campaignSessionId, inputImages);
    }
  } catch (dirError: any) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: dirError.message })}\n\n`);
    res.end();
    return;
  }

  try {
    const images = inputImages && Array.isArray(inputImages) ? inputImages : [];
    let fullPrompt = cleanPrompt;

    if (images.length > 0) {
      const inputFlags = images.map((img: string) => `--input "${img}"`).join(' ');
      fullPrompt = `${cleanPrompt}

## Reference Image File Paths (use ALL of these with --input flags in generate-image.ts)
${images.map((img: string, i: number) => `- Reference ${i + 1}: ${img}`).join('\n')}

CRITICAL: You MUST pass ALL reference images using multiple --input flags to preserve subject appearance AND include all referenced items (watch, jacket, etc.).

Example command with ALL ${images.length} reference images:
npx tsx scripts/generate-image.ts --prompt "..." ${inputFlags} --output outputs/hero.png --aspect-ratio 3:2 --resolution 2K`;
    }

    const assistantMessages: string[] = [];
    let currentMessageHasToolUse = false;  // Track if current message will have tool_use
    let hintSent = false;  // Track if we've sent a hint for current message
    let toolInputBuffer: Record<number, string> = {};  // Accumulate tool input JSON per block index
    let toolStartTimes: Record<number, number> = {};  // Track tool execution start times

    // Don't pass images as base64 multimodal input - avoids 5MB size limit
    // Images are referenced by path in the prompt for generate-image.ts --input
    for await (const result of aiClient.queryWithSession(fullPrompt, campaignSessionId, { systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT, autonomousMode: isYoloMode })) {
      const { message } = result;
      instrumentor.processMessage(message);

      // Stream different message types
      if (message.type === 'stream_event') {
        const event = (message as any).event;

        // Block-level event handling for Phase 7
        switch (event?.type) {
          case 'content_block_start': {
            const blockType = event.content_block?.type; // 'text', 'thinking', 'tool_use'
            const blockIndex = event.index;

            // Emit block_start event with block metadata
            const blockStartEvent = {
              type: 'block_start',
              blockIndex,
              blockType: blockType || 'text',
              toolName: blockType === 'tool_use' ? event.content_block?.name : undefined,
              toolId: blockType === 'tool_use' ? event.content_block?.id : undefined,
            };
            res.write(`data: ${JSON.stringify(blockStartEvent)}\n\n`);
            wsHandler.broadcastToSession(campaignSessionId, blockStartEvent as WSServerMessage);

            // Initialize tool input buffer for tool_use blocks
            if (blockType === 'tool_use') {
              toolInputBuffer[blockIndex] = '';
              toolStartTimes[blockIndex] = Date.now();
              currentMessageHasToolUse = true;
              // Send hint immediately so frontend can switch to thinking mode
              if (!hintSent) {
                res.write(`data: ${JSON.stringify({ type: 'message_type_hint', messageType: 'thinking' })}\n\n`);
                hintSent = true;
              }
            }
            break;
          }

          case 'content_block_delta': {
            const blockIndex = event.index;
            const deltaText = event.delta?.text;
            const inputJsonDelta = event.delta?.partial_json;

            // Emit block_delta event
            if (deltaText || inputJsonDelta) {
              const blockDeltaEvent = {
                type: 'block_delta',
                blockIndex,
                text: deltaText || '',
                inputJsonDelta: inputJsonDelta || undefined,
              };
              res.write(`data: ${JSON.stringify(blockDeltaEvent)}\n\n`);
              wsHandler.broadcastToSession(campaignSessionId, blockDeltaEvent as WSServerMessage);

              // Accumulate tool input JSON
              if (inputJsonDelta && toolInputBuffer[blockIndex] !== undefined) {
                toolInputBuffer[blockIndex] += inputJsonDelta;
              }
            }

            // Also emit legacy text_delta for backwards compatibility
            if (deltaText) {
              res.write(`data: ${JSON.stringify({ type: 'text_delta', text: deltaText })}\n\n`);
            }
            break;
          }

          case 'content_block_stop': {
            const blockIndex = event.index;

            // Parse accumulated tool input JSON if this was a tool_use block
            let parsedToolInput: Record<string, unknown> | undefined;
            let toolDuration: number | undefined;
            if (toolInputBuffer[blockIndex] !== undefined) {
              try {
                parsedToolInput = JSON.parse(toolInputBuffer[blockIndex]);
              } catch (e) {
                // JSON parsing failed, leave as undefined
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
            res.write(`data: ${JSON.stringify(blockEndEvent)}\n\n`);
            wsHandler.broadcastToSession(campaignSessionId, blockEndEvent as WSServerMessage);
            break;
          }

          case 'message_start': {
            res.write(`data: ${JSON.stringify({ type: 'message_start' })}\n\n`);
            break;
          }

          case 'message_stop': {
            res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
            break;
          }
        }
      } else if (message.type === 'assistant') {
        // Full assistant message - extract text and confirm type
        const content = (message as any).message?.content;
        if (Array.isArray(content)) {
          const text = content.find((c: any) => c.type === 'text')?.text || '';
          const hasToolUse = content.some((c: any) => c.type === 'tool_use');
          // Messages with tool_use are "thinking" (intermediate), others are "response" (final)
          const messageType = hasToolUse ? 'thinking' : 'response';
          if (text) {
            assistantMessages.push(text);
            res.write(`data: ${JSON.stringify({ type: 'assistant_message', messageType, text })}\n\n`);
          }
        }
        // Reset for next message
        currentMessageHasToolUse = false;
        hintSent = false;
      } else if (message.type === 'system') {
        // System messages (tool calls, etc)
        res.write(`data: ${JSON.stringify({ type: 'system', subtype: (message as any).subtype, data: message })}\n\n`);
      } else if (message.type === 'result') {
        // Final result - prefer hook-detected checkpoint
        const fullResponse = assistantMessages.join('\n\n---\n\n');
        const hookCheckpoint = detectedCheckpoints.get(campaignSessionId);
        const parsedCheckpoint = parseCheckpoint(fullResponse);
        const checkpoint = hookCheckpoint || parsedCheckpoint;

        // DEBUG: Log checkpoint retrieval
        console.log(`📤 [COMPLETE DEBUG] Building complete event for session: ${campaignSessionId}`);
        console.log(`   hookCheckpoint: ${hookCheckpoint ? JSON.stringify(hookCheckpoint) : 'null'}`);
        console.log(`   parsedCheckpoint: ${parsedCheckpoint ? JSON.stringify(parsedCheckpoint) : 'null'}`);
        console.log(`   final checkpoint: ${checkpoint ? JSON.stringify(checkpoint) : 'null'}`);
        console.log(`   detectedCheckpoints map size: ${detectedCheckpoints.size}`);
        console.log(`   detectedCheckpoints keys: ${Array.from(detectedCheckpoints.keys()).join(', ')}`);

        if (hookCheckpoint) detectedCheckpoints.delete(campaignSessionId);

        const completeEvent = {
          type: 'complete',
          sessionId: campaignSessionId,
          outputDir,
          response: assistantMessages[assistantMessages.length - 1] || '',
          checkpoint,
          awaitingInput: checkpoint !== null,
          sessionStats: sessionManager.getSessionStats(campaignSessionId),
          pipeline: sessionManager.getPipelineStatus(campaignSessionId),
          instrumentation: instrumentor.getCampaignReport()
        };

        console.log(`📤 [COMPLETE DEBUG] Sending complete event with checkpoint stage: ${checkpoint?.stage || 'none'}`);
        res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
      }
    }

    res.end();
  } catch (error: any) {
    console.error('❌ Streaming error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// Continue session with new prompt
app.post('/sessions/:id/continue', async (req, res) => {
  const { prompt } = req.body;
  const sessionId = req.params.id;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  console.log(`🔄 Continuing session ${sessionId}`);
  console.log(`📝 User prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

  try {
    const messages: any[] = [];
    const instrumentor = new SDKInstrumentor(sessionId, prompt);

    for await (const result of aiClient.queryWithSession(prompt, sessionId, { systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT })) {
      const { message } = result;
      messages.push(message);
      instrumentor.processMessage(message);

      // Broadcast to SSE for frontend updates
      broadcastSDKMessage(message, sessionId);
    }

    const assistantMessages = messages
      .filter(m => m.type === 'assistant')
      .map(m => {
        const content = m.message?.content;
        if (Array.isArray(content)) {
          return content.find((c: any) => c.type === 'text')?.text || '';
        }
        return '';
      })
      .filter(t => t.length > 0);

    const fullResponse = assistantMessages.join('\n\n---\n\n');

    // Get checkpoint: prefer hook-detected, fallback to parsing response
    const hookCheckpoint = detectedCheckpoints.get(sessionId);
    const parsedCheckpoint = parseCheckpoint(fullResponse);
    const checkpoint = hookCheckpoint || parsedCheckpoint;
    const awaitingInput = checkpoint !== null;

    if (checkpoint) {
      console.log(`⏸️  CHECKPOINT: ${checkpoint.stage} - ${checkpoint.message}`);
      if (hookCheckpoint) detectedCheckpoints.delete(sessionId);
    }

    const sessionStats = sessionManager.getSessionStats(sessionId);
    const pipelineStatus = sessionManager.getPipelineStatus(sessionId);
    const assets = sessionManager.getSessionAssets(sessionId);

    res.json({
      success: true,
      sessionId,
      response: assistantMessages[assistantMessages.length - 1] || '',
      fullResponse,
      checkpoint,           // Parsed checkpoint data
      awaitingInput,        // true if waiting for user decision
      sessionStats,
      pipeline: pipelineStatus,
      assets,               // Current assets for display
      messageCount: messages.length
    });

  } catch (error: any) {
    console.error('❌ Continue error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Streaming continue endpoint - streams tokens in real-time via SSE
app.post('/sessions/:id/continue-stream', async (req, res) => {
  const { prompt } = req.body;
  const sessionId = req.params.id;

  if (!prompt) {
    return res.status(400).json({ success: false, error: 'Prompt is required' });
  }

  // Set up SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  console.log(`🔄 Streaming continue for session ${sessionId}`);
  console.log(`📝 User prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);

  const instrumentor = new SDKInstrumentor(sessionId, prompt);

  try {
    const assistantMessages: string[] = [];
    let currentMessageHasToolUse = false;  // Track if current message will have tool_use
    let hintSent = false;  // Track if we've sent a hint for current message
    let toolInputBuffer: Record<number, string> = {};  // Accumulate tool input JSON per block index
    let toolStartTimes: Record<number, number> = {};  // Track tool execution start times

    for await (const result of aiClient.queryWithSession(prompt, sessionId, { systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT })) {
      const { message } = result;
      instrumentor.processMessage(message);

      // Stream different message types (same pattern as /generate-stream)
      if (message.type === 'stream_event') {
        const event = (message as any).event;

        // Block-level event handling for Phase 7
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
            res.write(`data: ${JSON.stringify(blockStartEvent)}\n\n`);
            wsHandler.broadcastToSession(sessionId, blockStartEvent as WSServerMessage);

            if (blockType === 'tool_use') {
              toolInputBuffer[blockIndex] = '';
              toolStartTimes[blockIndex] = Date.now();
              currentMessageHasToolUse = true;
              if (!hintSent) {
                res.write(`data: ${JSON.stringify({ type: 'message_type_hint', messageType: 'thinking' })}\n\n`);
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
              res.write(`data: ${JSON.stringify(blockDeltaEvent)}\n\n`);
              wsHandler.broadcastToSession(sessionId, blockDeltaEvent as WSServerMessage);

              if (inputJsonDelta && toolInputBuffer[blockIndex] !== undefined) {
                toolInputBuffer[blockIndex] += inputJsonDelta;
              }
            }

            // Legacy text_delta for backwards compatibility
            if (deltaText) {
              res.write(`data: ${JSON.stringify({ type: 'text_delta', text: deltaText })}\n\n`);
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
            res.write(`data: ${JSON.stringify(blockEndEvent)}\n\n`);
            wsHandler.broadcastToSession(sessionId, blockEndEvent as WSServerMessage);
            break;
          }

          case 'message_start': {
            res.write(`data: ${JSON.stringify({ type: 'message_start' })}\n\n`);
            break;
          }

          case 'message_stop': {
            res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
            break;
          }
        }
      } else if (message.type === 'assistant') {
        // Full assistant message - extract text and confirm type
        const content = (message as any).message?.content;
        if (Array.isArray(content)) {
          const text = content.find((c: any) => c.type === 'text')?.text || '';
          const hasToolUse = content.some((c: any) => c.type === 'tool_use');
          // Messages with tool_use are "thinking" (intermediate), others are "response" (final)
          const messageType = hasToolUse ? 'thinking' : 'response';
          if (text) {
            assistantMessages.push(text);
            res.write(`data: ${JSON.stringify({ type: 'assistant_message', messageType, text })}\n\n`);
          }
        }
        // Reset for next message
        currentMessageHasToolUse = false;
        hintSent = false;
      } else if (message.type === 'system') {
        // System messages (tool calls, etc) - send for activity indicator
        res.write(`data: ${JSON.stringify({ type: 'system', subtype: (message as any).subtype, data: message })}\n\n`);
      } else if (message.type === 'result') {
        // Final result - prefer hook-detected checkpoint
        const fullResponse = assistantMessages.join('\n\n---\n\n');
        const hookCheckpoint = detectedCheckpoints.get(sessionId);
        const parsedCheckpoint = parseCheckpoint(fullResponse);
        const checkpoint = hookCheckpoint || parsedCheckpoint;

        // DEBUG: Log checkpoint retrieval (continue-stream)
        console.log(`📤 [CONTINUE COMPLETE DEBUG] Building complete event for session: ${sessionId}`);
        console.log(`   hookCheckpoint: ${hookCheckpoint ? JSON.stringify(hookCheckpoint) : 'null'}`);
        console.log(`   parsedCheckpoint: ${parsedCheckpoint ? JSON.stringify(parsedCheckpoint) : 'null'}`);
        console.log(`   final checkpoint: ${checkpoint ? JSON.stringify(checkpoint) : 'null'}`);
        console.log(`   detectedCheckpoints map size: ${detectedCheckpoints.size}`);
        console.log(`   detectedCheckpoints keys: ${Array.from(detectedCheckpoints.keys()).join(', ')}`);

        if (hookCheckpoint) detectedCheckpoints.delete(sessionId);

        if (checkpoint) {
          console.log(`⏸️  CHECKPOINT: ${checkpoint.stage} - ${checkpoint.message}`);
        }

        const completeEvent = {
          type: 'complete',
          sessionId,
          response: assistantMessages[assistantMessages.length - 1] || '',
          checkpoint,
          awaitingInput: checkpoint !== null,
          sessionStats: sessionManager.getSessionStats(sessionId),
          pipeline: sessionManager.getPipelineStatus(sessionId),
          instrumentation: instrumentor.getCampaignReport()
        };

        console.log(`📤 [CONTINUE COMPLETE DEBUG] Sending complete event with checkpoint stage: ${checkpoint?.stage || 'none'}`);
        res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
      }
    }

    res.end();
  } catch (error: any) {
    console.error('❌ Streaming continue error:', error.message);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
  }
});

// TEST ENDPOINT: Simulate clips checkpoint with 6 videos
// Usage: POST http://localhost:3002/test/clips-checkpoint
// Frontend: Type "/test-clips" in the chat input
app.post('/test/clips-checkpoint', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const testSessionId = 'test-clips-' + Date.now();

  // Send session init
  res.write(`data: ${JSON.stringify({ type: 'session_init', sessionId: testSessionId })}\n\n`);

  // Send a text message first
  setTimeout(() => {
    res.write(`data: ${JSON.stringify({ type: 'text_delta', text: 'Testing clips checkpoint...' })}\n\n`);
  }, 100);

  // Send assistant message
  setTimeout(() => {
    res.write(`data: ${JSON.stringify({ type: 'assistant_message', messageType: 'response', text: 'Testing clips checkpoint...' })}\n\n`);
  }, 200);

  // Send clips checkpoint event
  setTimeout(() => {
    const checkpointEvent = {
      type: 'checkpoint',
      checkpoint: {
        stage: 'clips',
        status: 'complete',
        artifacts: [
          'outputs/videos/video-1.mp4',
          'outputs/videos/video-2.mp4',
          'outputs/videos/video-3.mp4',
          'outputs/videos/video-4.mp4',
          'outputs/videos/video-5.mp4'
        ],
        message: '5 clips ready (frame pairs: 1→2, 2→3, 3→4, 4→5, 5→6). Choose speed or regenerate any clip.'
      }
    };
    console.log('[TEST] Sending clips checkpoint:', checkpointEvent.checkpoint);
    res.write(`data: ${JSON.stringify(checkpointEvent)}\n\n`);
  }, 300);

  // Send complete event
  setTimeout(() => {
    const completeEvent = {
      type: 'complete',
      sessionId: testSessionId,
      response: 'Clips ready for review!',
      awaitingInput: true,
      sessionStats: null,
      pipeline: null,
      instrumentation: { campaignId: testSessionId, totalCost_usd: 0, totalDuration_ms: 0 }
    };
    res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
    res.end();
  }, 400);
});

// TEST ENDPOINT: Simulate complete event with video checkpoint
// Usage: POST http://localhost:3002/test/video-complete
app.post('/test/video-complete', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');

  const testSessionId = 'test-video-' + Date.now();

  // Send session init
  res.write(`data: ${JSON.stringify({ type: 'session_init', sessionId: testSessionId })}\n\n`);

  // Send a text message first
  setTimeout(() => {
    res.write(`data: ${JSON.stringify({ type: 'text_delta', text: 'Testing video display...' })}\n\n`);
  }, 100);

  // Send assistant message
  setTimeout(() => {
    res.write(`data: ${JSON.stringify({ type: 'assistant_message', messageType: 'response', text: 'Testing video display...' })}\n\n`);
  }, 200);

  // Send complete event with video checkpoint
  setTimeout(() => {
    const completeEvent = {
      type: 'complete',
      sessionId: testSessionId,
      response: 'Your fashion video is complete!',
      checkpoint: {
        stage: 'complete',
        status: 'complete',
        artifact: 'outputs/final/fashion-video.mp4',
        message: 'Fashion video complete!'
      },
      awaitingInput: false,
      sessionStats: null,
      pipeline: null,
      instrumentation: { campaignId: testSessionId, totalCost_usd: 0, totalDuration_ms: 0 }
    };
    console.log('[TEST] Sending complete event with checkpoint:', completeEvent.checkpoint);
    res.write(`data: ${JSON.stringify(completeEvent)}\n\n`);
    res.end();
  }, 300);
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
║  POST /generate                - Generate      ║
║  POST /generate-stream         - Stream Gen   ║
║  GET  /sessions                - List sessions ║
║  GET  /sessions/:id            - Session info  ║
║  GET  /sessions/:id/pipeline   - Pipeline status║
║  GET  /sessions/:id/assets     - Get assets    ║
║  POST /sessions/:id/continue   - Continue      ║
║  POST /sessions/:id/continue-stream - Stream   ║
║  GET  /health                  - Health check  ║
║                                                ║
║  WebSocket Messages (client → server):         ║
║  { type: 'subscribe', sessionId }              ║
║  { type: 'chat', content, images? }            ║
║  { type: 'continue', sessionId, content? }     ║
║  { type: 'cancel', sessionId }                 ║
║  { type: 'yolo', sessionId }                   ║
╠════════════════════════════════════════════════╣
║  Environment:                                  ║
║  - Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}           ║
║  - FAL API: ${process.env.FAL_KEY ? '✅ Configured' : '❌ Missing'}                  ║
╚════════════════════════════════════════════════╝
  `);
});
