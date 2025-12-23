import express from 'express';
import cors from 'cors';
import { aiClient, sessionManager } from './lib/ai-client.js';
import { SDKInstrumentor } from './lib/instrumentor.js';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

// Store active SSE connections for streaming
const sseConnections = new Map<string, express.Response[]>();

/**
 * Enhanced logging for SDK messages - matches SDK message structure from docs
 *
 * Message types:
 * - system (subtype: 'init') - Session initialization
 * - assistant - Claude's responses, contains tool_use blocks in message.message.content
 * - user - Tool results in message.message.content as tool_result blocks
 * - result (subtype: 'success'|'error_*') - Final result with costs
 * - stream_event - Real-time streaming (if includePartialMessages: true)
 */
function logSDKMessage(message: any, sessionId: string): void {
  const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
  const prefix = `[${timestamp}]`;

  switch (message.type) {
    case 'system':
      if (message.subtype === 'init') {
        console.log(`${prefix} 🚀 SESSION INIT`);
        console.log(`${prefix}    Session ID: ${message.session_id}`);
        console.log(`${prefix}    Model: ${message.model}`);
        console.log(`${prefix}    Tools: ${message.tools?.join(', ') || 'none'}`);
        if (message.mcp_servers?.length > 0) {
          console.log(`${prefix}    MCP Servers: ${message.mcp_servers.map((s: any) => s.name).join(', ')}`);
        }
      } else if (message.subtype === 'compact_boundary') {
        console.log(`${prefix} 📦 CONTEXT COMPACTED`);
      }
      break;

    case 'assistant':
      // Assistant messages contain Claude's response and tool_use blocks
      const assistantContent = message.message?.content;
      if (Array.isArray(assistantContent)) {
        for (const block of assistantContent) {
          if (block.type === 'text') {
            const text = block.text;
            console.log(`${prefix} 🤖 ASSISTANT TEXT:`);
            // Show meaningful preview
            const lines = text.substring(0, 600).split('\n').slice(0, 10);
            lines.forEach((line: string) => {
              if (line.trim()) {
                console.log(`${prefix}    ${line.substring(0, 120)}`);
              }
            });
            if (text.length > 600) {
              console.log(`${prefix}    ... (${text.length} chars total)`);
            }
          } else if (block.type === 'tool_use') {
            // Tool invocation from Claude
            console.log(`${prefix} 🔧 TOOL CALL: ${block.name}`);
            console.log(`${prefix}    Tool ID: ${block.id}`);
            if (block.input) {
              const inputStr = JSON.stringify(block.input, null, 2);
              const inputLines = inputStr.split('\n').slice(0, 6);
              inputLines.forEach((line: string) => {
                console.log(`${prefix}    ${line.substring(0, 100)}`);
              });
              if (inputStr.split('\n').length > 6) {
                console.log(`${prefix}    ...`);
              }
            }
          }
        }
      }
      // Log token usage from assistant message
      const usage = message.message?.usage;
      if (usage) {
        console.log(`${prefix} 📊 TOKENS: input=${usage.input_tokens || 0}, output=${usage.output_tokens || 0}, cache_read=${usage.cache_read_input_tokens || 0}, cache_write=${usage.cache_creation_input_tokens || 0}`);
      }
      break;

    case 'user':
      // User messages contain tool_result blocks
      const userContent = message.message?.content;
      if (Array.isArray(userContent)) {
        for (const block of userContent) {
          if (block.type === 'tool_result') {
            const resultContent = typeof block.content === 'string'
              ? block.content
              : JSON.stringify(block.content);
            const preview = resultContent.substring(0, 200);
            console.log(`${prefix} ✅ TOOL RESULT (${block.tool_use_id?.substring(0, 8)}...):`);
            console.log(`${prefix}    ${preview}${resultContent.length > 200 ? '...' : ''}`);
            if (block.is_error) {
              console.log(`${prefix}    ⚠️  Tool returned error`);
            }
          } else if (block.type === 'text') {
            console.log(`${prefix} 👤 USER INPUT: ${block.text?.substring(0, 100) || ''}`);
          } else if (block.type === 'image') {
            console.log(`${prefix} 🖼️  USER IMAGE: ${block.source?.media_type || 'unknown type'}`);
          }
        }
      }
      break;

    case 'result':
      // Final result message
      if (message.subtype === 'success') {
        console.log(`${prefix} ✨ SESSION COMPLETE`);
        console.log(`${prefix}    Duration: ${message.duration_ms}ms`);
        console.log(`${prefix}    Cost: $${(message.total_cost_usd || 0).toFixed(4)}`);
        console.log(`${prefix}    Turns: ${message.num_turns || 0}`);
        if (message.usage) {
          console.log(`${prefix}    Total tokens: input=${message.usage.input_tokens || 0}, output=${message.usage.output_tokens || 0}`);
        }
      } else {
        // Error cases: error_max_turns, error_during_execution, error_max_budget_usd
        console.log(`${prefix} ❌ SESSION ERROR: ${message.subtype}`);
        if (message.errors) {
          message.errors.forEach((err: string) => {
            console.log(`${prefix}    ${err}`);
          });
        }
      }
      break;

    case 'stream_event':
      // Real-time streaming events (only if includePartialMessages: true)
      const event = message.event;
      if (event?.type === 'content_block_delta' && event?.delta?.text) {
        process.stdout.write(event.delta.text);
      }
      break;

    default:
      console.log(`${prefix} 📨 ${message.type?.toUpperCase() || 'UNKNOWN'}: ${JSON.stringify(message).substring(0, 150)}`);
  }

  // Broadcast to SSE connections for real-time client updates
  broadcastToSSE(sessionId, message);
}

/**
 * Broadcast message to all SSE connections for a session
 */
function broadcastToSSE(sessionId: string, message: any): void {
  const connections = sseConnections.get(sessionId);
  if (connections && connections.length > 0) {
    const eventData = JSON.stringify({
      timestamp: new Date().toISOString(),
      type: message.type,
      subtype: message.subtype,
      data: message
    });

    connections.forEach(res => {
      res.write(`data: ${eventData}\n\n`);
    });
  }
}

// Health check
app.get('/health', (req, res) => {
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

// List sessions
app.get('/sessions', (req, res) => {
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
  const { prompt, sessionId, inputImages } = req.body;

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

  const campaignSessionId = sessionId || `session_${Date.now()}`;
  const instrumentor = new SDKInstrumentor(campaignSessionId, prompt);

  console.log('🎬 Starting generation');
  console.log('📝 Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

  // Create session and output directories
  let outputDir: string;
  try {
    await sessionManager.getOrCreateSession(campaignSessionId);
    outputDir = await sessionManager.createSessionDirectories(campaignSessionId);

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
    let fullPrompt = prompt;
    if (images.length > 0) {
      // Build --input flags for ALL images
      const inputFlags = images.map((img: string) => `--input "${img}"`).join(' ');

      fullPrompt = `${prompt}

## Reference Image File Paths (use ALL of these with --input flags in generate-image.ts)
${images.map((img: string, i: number) => `- Reference ${i + 1}: ${img}`).join('\n')}

CRITICAL: You MUST pass ALL reference images using multiple --input flags to preserve subject appearance AND include all referenced items (watch, jacket, etc.).

Example command with ALL ${images.length} reference images:
npx tsx scripts/generate-image.ts --prompt "..." ${inputFlags} --output outputs/hero.png --aspect-ratio 3:2 --resolution 2K`;
    }

    for await (const result of aiClient.queryWithSession(fullPrompt, campaignSessionId, undefined, images)) {
      const { message } = result;
      messages.push(message);
      instrumentor.processMessage(message);

      // Enhanced logging for all message types
      logSDKMessage(message, campaignSessionId);
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

    const sessionStats = sessionManager.getSessionStats(campaignSessionId);
    const campaignReport = instrumentor.getCampaignReport();
    const pipelineStatus = sessionManager.getPipelineStatus(campaignSessionId);

    res.json({
      success: true,
      sessionId: campaignSessionId,
      outputDir,
      response: assistantMessages[assistantMessages.length - 1] || '',
      fullResponse: assistantMessages.join('\n\n---\n\n'),
      sessionStats,
      pipeline: pipelineStatus,
      instrumentation: {
        ...campaignReport,
        costBreakdown: instrumentor.getCostBreakdown()
      }
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    await sessionManager.updatePipelineStage(campaignSessionId, 'error', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      sessionId: campaignSessionId,
      outputDir
    });
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

  try {
    const messages: any[] = [];
    const instrumentor = new SDKInstrumentor(sessionId, prompt);

    for await (const result of aiClient.queryWithSession(prompt, sessionId)) {
      const { message } = result;
      messages.push(message);
      instrumentor.processMessage(message);
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

    const sessionStats = sessionManager.getSessionStats(sessionId);

    res.json({
      success: true,
      sessionId,
      response: assistantMessages[assistantMessages.length - 1] || '',
      sessionStats,
      messageCount: messages.length
    });

  } catch (error: any) {
    console.error('❌ Continue error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════╗
║         Fashion Shoot Agent Server             ║
╠════════════════════════════════════════════════╣
║  🎬 Server: http://localhost:${PORT}             ║
║                                                ║
║  Endpoints:                                    ║
║  POST /generate                - Generate      ║
║  GET  /sessions                - List sessions ║
║  GET  /sessions/:id            - Session info  ║
║  GET  /sessions/:id/pipeline   - Pipeline status║
║  GET  /sessions/:id/assets     - Get assets    ║
║  POST /sessions/:id/continue   - Continue      ║
║  GET  /health                  - Health check  ║
╠════════════════════════════════════════════════╣
║  Environment:                                  ║
║  - Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}           ║
║  - FAL API: ${process.env.FAL_KEY ? '✅ Configured' : '❌ Missing'}                  ║
╚════════════════════════════════════════════════╝
  `);
});
