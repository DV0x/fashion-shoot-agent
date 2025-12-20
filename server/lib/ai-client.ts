import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { SessionManager } from './session-manager.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './orchestrator-prompt.js';

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
      model: 'claude-sonnet-4-20250514',
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
      abortController
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
      }

      abortController.abort();
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
