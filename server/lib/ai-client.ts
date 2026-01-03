import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import { SessionManager } from './session-manager.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './orchestrator-prompt.js';

// Checkpoint data structure
export interface CheckpointData {
  stage: 'hero' | 'frames' | 'videos' | 'complete';
  status: 'complete' | 'error';
  artifact?: string;
  artifacts?: string[];
  message: string;
}

// Checkpoint event emitter for real-time notifications
export const checkpointEmitter = new EventEmitter();

/**
 * Detect checkpoint based on tool output
 * Triggers when specific artifacts are created
 */
function detectCheckpoint(toolName: string, toolInput: any, toolResponse: any): CheckpointData | null {
  // Only check Bash tool results
  if (toolName !== 'Bash') return null;

  const output = typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse);
  const command = toolInput?.command || '';

  // Detect hero.png creation (from generate-image.ts)
  if (command.includes('generate-image.ts') && output.includes('outputs/hero.png')) {
    return {
      stage: 'hero',
      status: 'complete',
      artifact: 'outputs/hero.png',
      message: 'Hero image ready. Reply "continue" or describe changes.'
    };
  }

  // Detect frames creation (from crop-frames.ts)
  if (command.includes('crop-frames.ts') && output.includes('frame-6.png')) {
    return {
      stage: 'frames',
      status: 'complete',
      artifacts: [
        'outputs/frames/frame-1.png',
        'outputs/frames/frame-2.png',
        'outputs/frames/frame-3.png',
        'outputs/frames/frame-4.png',
        'outputs/frames/frame-5.png',
        'outputs/frames/frame-6.png'
      ],
      message: '6 frames ready. Reply "continue" or request modifications.'
    };
  }

  // Detect frames resize (from resize-frames.ts)
  if (command.includes('resize-frames.ts') && output.includes('"success": true')) {
    // Extract aspect ratio from command if possible
    const aspectMatch = command.match(/--aspect-ratio\s+(\S+)/);
    const aspectRatio = aspectMatch ? aspectMatch[1] : 'new aspect ratio';

    return {
      stage: 'frames',
      status: 'complete',
      artifacts: [
        'outputs/frames/frame-1.png',
        'outputs/frames/frame-2.png',
        'outputs/frames/frame-3.png',
        'outputs/frames/frame-4.png',
        'outputs/frames/frame-5.png',
        'outputs/frames/frame-6.png'
      ],
      message: `Frames resized to ${aspectRatio}. Reply "continue" to generate videos or request changes.`
    };
  }

  // Detect final video creation (from stitch-videos.ts)
  if (command.includes('stitch-videos.ts') && output.includes('fashion-video.mp4')) {
    return {
      stage: 'complete',
      status: 'complete',
      artifact: 'outputs/final/fashion-video.mp4',
      message: 'Fashion video complete!'
    };
  }

  return null;
}

/**
 * Create PostToolUse hooks for checkpoint detection
 */
function createCheckpointHooks(sessionId: string) {
  return {
    PostToolUse: [{
      hooks: [async (input: any, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
        const checkpoint = detectCheckpoint(
          input.tool_name,
          input.tool_input,
          input.tool_response
        );

        if (checkpoint) {
          console.log(`⏸️  CHECKPOINT DETECTED: ${checkpoint.stage} - ${checkpoint.message}`);
          checkpointEmitter.emit('checkpoint', { sessionId, checkpoint });
        }

        return { continue: true };
      }]
    }]
  };
}

// Image content block for multimodal input
interface ImageContentBlock {
  type: 'image';
  source: {
    type: 'base64';
    media_type: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp';
    data: string;
  };
}

interface TextContentBlock {
  type: 'text';
  text: string;
}

type ContentBlock = TextContentBlock | ImageContentBlock;

/**
 * Load an image file and convert to base64
 */
function loadImageAsBase64(imagePath: string): ImageContentBlock | null {
  if (!existsSync(imagePath)) {
    console.error(`⚠️ Image not found: ${imagePath}`);
    return null;
  }

  const ext = imagePath.toLowerCase().split('.').pop();
  const mediaTypeMap: Record<string, ImageContentBlock['source']['media_type']> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };

  const mediaType = mediaTypeMap[ext || ''] || 'image/jpeg';

  try {
    const data = readFileSync(imagePath, 'base64');
    console.log(`📷 Loaded image: ${imagePath} (${mediaType})`);
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data
      }
    };
  } catch (error) {
    console.error(`⚠️ Failed to load image: ${imagePath}`, error);
    return null;
  }
}

/**
 * AIClient - Wrapper for Claude SDK
 * Handles SDK configuration, streaming, and session management
 */
export class AIClient {
  private defaultOptions: Partial<Options>;
  private sessionManager: SessionManager;

  constructor(sessionManager?: SessionManager) {
    // Ensure cwd points to agent directory where .claude/ is located
    const projectRoot = process.cwd().endsWith('/server')
      ? resolve(process.cwd(), '..', 'agent')
      : resolve(process.cwd(), 'agent');

    this.defaultOptions = {
      cwd: projectRoot,
      model: 'claude-opus-4-5-20251101',
      maxTurns: 100,  // Full pipeline needs ~50-80 turns (hero + contact + 6 frames + 6 videos + stitch)
      settingSources: ['user', 'project'],
      allowedTools: [
        "Read",
        "Write",
        "Glob",
        "Bash",
        "Task",
        "Skill"
      ],
      systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT
    };

    this.sessionManager = sessionManager || new SessionManager();
    console.log(`🎬 AI Client initialized with cwd: ${projectRoot}`);
  }

  /**
   * Create async generator for SDK prompt
   * Critical: Generator must stay alive during tool execution
   * Supports multimodal input (text + images)
   */
  private async *createPromptGenerator(prompt: string, imagePaths?: string[], signal?: AbortSignal) {
    // Build content array for multimodal input
    let content: string | ContentBlock[];

    if (imagePaths && imagePaths.length > 0) {
      const contentBlocks: ContentBlock[] = [
        { type: 'text', text: prompt }
      ];

      // Load and add images
      for (const imagePath of imagePaths) {
        const imageBlock = loadImageAsBase64(imagePath);
        if (imageBlock) {
          contentBlocks.push(imageBlock);
        }
      }

      content = contentBlocks;
      console.log(`📨 Sending prompt with ${imagePaths.length} image(s)`);
    } else {
      content = prompt;
    }

    yield {
      type: "user" as const,
      message: { role: "user" as const, content },
      parent_tool_use_id: null
    } as any;

    // Keep generator alive during tool execution
    if (signal) {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
    } else {
      await new Promise<void>(() => {});
    }
  }

  /**
   * Session-aware query with automatic session management
   * Supports multimodal input (text + images)
   */
  async *queryWithSession(prompt: string, sessionId?: string, metadata?: any, imagePaths?: string[]) {
    const session = await this.sessionManager.getOrCreateSession(sessionId, metadata);
    const resumeOptions = this.sessionManager.getResumeOptions(session.id);
    const abortController = new AbortController();

    const queryOptions = {
      ...this.defaultOptions,
      ...resumeOptions,
      includePartialMessages: true,  // Enable real-time token streaming
      abortController,
      hooks: createCheckpointHooks(session.id)
    };

    console.log(`🔄 Query with session ${session.id}`, {
      hasResume: !!resumeOptions.resume,
      turnCount: session.turnCount,
      imageCount: imagePaths?.length || 0
    });

    try {
      const promptGenerator = this.createPromptGenerator(prompt, imagePaths, abortController.signal);

      for await (const message of query({ prompt: promptGenerator, options: queryOptions })) {
        // Capture SDK session ID from init message
        if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
          await this.sessionManager.updateSdkSessionId(session.id, message.session_id);
        }

        await this.sessionManager.addMessage(session.id, message);
        yield { message, sessionId: session.id };

        // Abort the generator after receiving the result message
        // This allows the for-await loop to complete
        if (message.type === 'result') {
          abortController.abort();
          break;
        }
      }
    } catch (error) {
      abortController.abort();
      throw error;
    }
  }

  /**
   * Get session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Add MCP server to the client
   */
  addMcpServer(name: string, server: any) {
    if (!this.defaultOptions.mcpServers) {
      this.defaultOptions.mcpServers = {};
    }
    this.defaultOptions.mcpServers[name] = server;

    // Also add to allowed tools
    if (!this.defaultOptions.allowedTools) {
      this.defaultOptions.allowedTools = [];
    }

    console.log(`✅ Added MCP server: ${name}`);
  }
}

// Export singleton instances
export const sessionManager = new SessionManager();
export const aiClient = new AIClient(sessionManager);
