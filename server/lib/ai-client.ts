

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import { SessionManager } from './session-manager.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './orchestrator-prompt.js';

// Action proposal event (from action-proposer skill)
export interface ActionProposal {
  type: 'action_proposal';
  instanceId: string;
  templateId: string;
  label: string;
  params: Record<string, unknown>;
  timestamp: string;
}

// Event emitter for action proposals
// Server listens to this and forwards to frontend via WebSocket
export const actionEmitter = new EventEmitter();

// Scripts that should be blocked (must use action-proposer instead)
const BLOCKED_SCRIPTS = [
  'generate-image',
  'generate-video',
  'crop-frames',
  'crop-frames-ffmpeg',
  'resize-frames',
  'stitch-videos-eased',
  'apply-speed-curve',
];

/**
 * Check if a Bash command is trying to run a blocked script
 */
function isBlockedScript(command: string): boolean {
  return BLOCKED_SCRIPTS.some(script => command.includes(script));
}

/**
 * Parse action proposal from script output
 */
function parseActionProposal(output: string): ActionProposal | null {
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'action_proposal' && parsed.instanceId && parsed.templateId) {
        return parsed as ActionProposal;
      }
    } catch {
      // Not valid JSON, skip
    }
  }
  return null;
}

/**
 * Create hooks for the action-based workflow
 * - PreToolUse: Block direct script execution
 * - PostToolUse: Intercept action proposals from action-proposer skill
 */
function createActionHooks(sessionId: string) {
  return {
    PreToolUse: [{
      hooks: [async (input: any) => {
        // Only check Bash commands
        if (input.tool_name !== 'Bash') {
          return {}; // Allow by default (no explicit decision needed)
        }

        const command = input.tool_input?.command || '';

        // Block direct script execution
        if (isBlockedScript(command)) {
          console.log(`🚫 [BLOCKED] Direct script execution: ${command.substring(0, 100)}...`);
          return {
            decision: 'block' as const,
            message: `Direct script execution is not allowed. Use the action-proposer skill instead to propose this action for user approval.

Example:
npx tsx .claude/skills/action-proposer/propose-action.ts \\
  --templateId generate_hero \\
  --label "Your Action Label" \\
  --params '{"prompt": "...", "aspectRatio": "3:2"}'

The user will see an ActionCard with editable parameters and control execution.`
          };
        }

        return {}; // Allow by default
      }]
    }],

    PostToolUse: [{
      hooks: [async (input: any) => {
        // Only check Bash commands (where action-proposer runs)
        if (input.tool_name !== 'Bash') {
          return { continue: true as const };
        }

        // Get output string from response
        let output: string;
        if (typeof input.tool_response === 'string') {
          output = input.tool_response;
        } else if (input.tool_response?.stdout) {
          output = input.tool_response.stdout;
        } else {
          output = JSON.stringify(input.tool_response);
        }

        // Check for action proposal
        const proposal = parseActionProposal(output);
        if (proposal) {
          console.log(`📋 [ACTION PROPOSAL] ${proposal.templateId}: ${proposal.label}`);
          console.log(`   Instance: ${proposal.instanceId}`);

          // Emit proposal event - server will forward to frontend
          actionEmitter.emit('proposal', { sessionId, proposal });

          // Continue execution (Claude should stop after proposing)
          return { continue: true as const };
        }

        return { continue: true as const };
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
  private activeGenerations: Map<string, AbortController> = new Map(); // sessionId -> AbortController

  constructor(sessionManager?: SessionManager) {
    // Ensure cwd points to agent directory where .claude/ is located
    const projectRoot = process.cwd().endsWith('/server')
      ? resolve(process.cwd(), '..', 'agent')
      : resolve(process.cwd(), 'agent');

    this.defaultOptions = {
      cwd: projectRoot,
      model: 'claude-opus-4-5-20251101',
      maxTurns: 100,  // Full pipeline needs ~50-80 turns
      settingSources: ['project'],  // Use project settings only (not user settings)
      permissionMode: 'default',    // Don't block on permission prompts in headless server
      canUseTool: async (_toolName: string, input: Record<string, unknown>) => ({
        behavior: 'allow' as const,
        updatedInput: input
      }),
      allowedTools: [
        "Read",
        "Write",
        "Edit",
        "Glob",
        "Grep",
        "Bash",
        "Task",
        "Skill",
        "TodoWrite",
        "WebFetch"
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
   * @param prompt - The user prompt
   * @param sessionId - Optional session ID
   * @param metadata - Optional metadata including systemPrompt
   * @param imagePaths - Optional image paths for multimodal input
   */
  async *queryWithSession(
    prompt: string,
    sessionId?: string,
    metadata?: { systemPrompt?: string },
    imagePaths?: string[]
  ) {
    const session = await this.sessionManager.getOrCreateSession(sessionId);
    const resumeOptions = this.sessionManager.getResumeOptions(session.id);
    const abortController = new AbortController();

    // Store AbortController for potential cancellation
    this.activeGenerations.set(session.id, abortController);

    // Use custom or default system prompt
    const systemPrompt = metadata?.systemPrompt || this.defaultOptions.systemPrompt;

    const queryOptions = {
      ...this.defaultOptions,
      ...resumeOptions,
      systemPrompt,
      includePartialMessages: true,  // Enable real-time token streaming
      abortController,
      hooks: createActionHooks(session.id)
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
          this.activeGenerations.delete(session.id);
          abortController.abort();
          break;
        }
      }
    } catch (error) {
      this.activeGenerations.delete(session.id);
      abortController.abort();
      throw error;
    } finally {
      // Ensure cleanup even if iterator is broken
      this.activeGenerations.delete(session.id);
    }
  }

  /**
   * Cancel an active generation for a session
   * @param sessionId - The session ID to cancel
   * @returns true if generation was cancelled, false if no active generation
   */
  cancelGeneration(sessionId: string): boolean {
    const abortController = this.activeGenerations.get(sessionId);
    if (abortController) {
      console.log(`🛑 Cancelling generation for session: ${sessionId}`);
      abortController.abort();
      this.activeGenerations.delete(sessionId);
      return true;
    }
    return false;
  }

  /**
   * Check if a session has an active generation
   * @param sessionId - The session ID to check
   * @returns true if generation is active
   */
  isGenerating(sessionId: string): boolean {
    return this.activeGenerations.has(sessionId);
  }

  /**
   * Get all active generation session IDs
   */
  getActiveGenerations(): string[] {
    return Array.from(this.activeGenerations.keys());
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
