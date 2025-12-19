import express from 'express';
import cors from 'cors';
import { aiClient, sessionManager } from './lib/ai-client.js';
import { SDKInstrumentor } from './lib/instrumentor.js';

const app = express();
const PORT = process.env.PORT || 3002;

app.use(cors());
app.use(express.json());

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

// Main generate endpoint
app.post('/generate', async (req, res) => {
  const { prompt, sessionId } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'Prompt is required',
      example: {
        prompt: "Create a fashion photoshoot with a model wearing a red dress"
      }
    });
  }

  const campaignSessionId = sessionId || `session-${Date.now()}`;
  const instrumentor = new SDKInstrumentor(campaignSessionId, prompt);

  console.log('🎬 Starting generation');
  console.log('📝 Prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));

  try {
    const messages: any[] = [];

    for await (const result of aiClient.queryWithSession(prompt, campaignSessionId)) {
      const { message } = result;
      messages.push(message);
      instrumentor.processMessage(message);

      // Log assistant messages
      if (message.type === 'assistant') {
        const content = message.message?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (block.type === 'text') {
              console.log('🤖', block.text.substring(0, 200) + (block.text.length > 200 ? '...' : ''));
            } else if (block.type === 'tool_use') {
              console.log(`🔧 Tool: ${block.name}`);
            }
          }
        }
      }
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

    res.json({
      success: true,
      sessionId: campaignSessionId,
      response: assistantMessages[assistantMessages.length - 1] || '',
      fullResponse: assistantMessages.join('\n\n---\n\n'),
      sessionStats,
      instrumentation: {
        ...campaignReport,
        costBreakdown: instrumentor.getCostBreakdown()
      }
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    res.status(500).json({
      success: false,
      error: error.message,
      sessionId: campaignSessionId
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
╔══════════════════════════════════════════════╗
║       Fashion Shoot Agent Server             ║
╠══════════════════════════════════════════════╣
║  🎬 Server: http://localhost:${PORT}           ║
║                                              ║
║  Endpoints:                                  ║
║  POST /generate              - Generate      ║
║  GET  /sessions              - List sessions ║
║  GET  /sessions/:id          - Session info  ║
║  POST /sessions/:id/continue - Continue      ║
║  GET  /health                - Health check  ║
╠══════════════════════════════════════════════╣
║  Environment:                                ║
║  - Anthropic API: ${process.env.ANTHROPIC_API_KEY ? '✅ Configured' : '❌ Missing'}         ║
║  - FAL API: ${process.env.FAL_KEY ? '✅ Configured' : '❌ Missing'}                ║
╚══════════════════════════════════════════════╝
  `);
});
