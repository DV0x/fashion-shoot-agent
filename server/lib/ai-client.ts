

import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import { SessionManager } from './session-manager.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './orchestrator-prompt.js';

// Progress data structure (for pipeline tracking without forced stops)
export interface ProgressData {
  stage: string;  // Dynamic stage names from workflow config
  status: 'complete' | 'error';
  artifact?: string;
  artifacts?: string[];
  type?: 'image' | 'image-grid' | 'video' | 'video-grid';
  message: string;
  isFinal?: boolean;
}

// Legacy alias for backwards compatibility
export type CheckpointData = ProgressData;

// Event emitter for real-time progress notifications
// Emits 'progress' events for pipeline tracking (no forced stops)
export const progressEmitter = new EventEmitter();

// Legacy alias for backwards compatibility
export const checkpointEmitter = progressEmitter;

/**
 * Parse script output for artifact events
 * Scripts emit JSON events like:
 * - {"type":"artifact","path":"outputs/hero.png","artifactType":"image"}
 * - {"type":"artifacts","paths":["outputs/frames/frame-1.png",...],"artifactType":"image-grid"}
 *
 * Works with both direct Bash output and TaskOutput (background task) results
 */
function parseArtifactEvents(toolName: string, toolResponse: any): ProgressData[] {
  console.log(`🔧 [TOOL] ${toolName} completed`);

  if (toolName !== 'Bash' && toolName !== 'TaskOutput') return [];

  // Get output string from response
  let output: string;
  if (typeof toolResponse === 'string') {
    output = toolResponse;
  } else if (toolResponse?.stdout) {
    output = toolResponse.stdout;
  } else {
    output = JSON.stringify(toolResponse);
  }

  // Unescape if TaskOutput returned escaped JSON (has \" instead of ")
  if (output.includes('\\"')) {
    output = output.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }

  console.log(`📝 [OUTPUT] ...${output.substring(Math.max(0, output.length - 500))}`);

  const events: ProgressData[] = [];

  // Parse each line looking for artifact JSON
  for (const line of output.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;

    try {
      const parsed = JSON.parse(trimmed);

      if (parsed.type === 'artifact' && parsed.path) {
        console.log(`🎨 [ARTIFACT] Found: ${parsed.path} (${parsed.artifactType})`);
        events.push({
          stage: parsed.artifactType || 'unknown',
          status: 'complete',
          artifact: parsed.path,
          type: parsed.artifactType,
          message: `${parsed.artifactType || 'Artifact'} ready: ${parsed.path}`,
          isFinal: parsed.artifactType === 'video' && parsed.path.includes('final/')
        });
      } else if (parsed.type === 'artifacts' && parsed.paths?.length) {
        console.log(`🎨 [ARTIFACTS] Found: ${parsed.paths.length} files (${parsed.artifactType})`);
        events.push({
          stage: parsed.artifactType || 'unknown',
          status: 'complete',
          artifacts: parsed.paths,
          type: parsed.artifactType,
          message: `${parsed.paths.length} ${parsed.artifactType || 'files'} ready`
        });
      }
    } catch {
      // Not valid JSON, skip
    }
  }

  return events;
}

/**
 * Create PostToolUse hooks for artifact detection
 * Parses script stdout for artifact events and emits progress
 * The agent decides when to pause naturally via its responses
 * @param sessionId - The session ID for emitting progress events
 */
function createProgressHooks(sessionId: string) {
  return {
    PostToolUse: [{
      hooks: [async (input: any, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
        // Parse script output for artifact events
        const artifactEvents = parseArtifactEvents(
          input.tool_name,
          input.tool_response
        );

        // Emit each artifact as a progress event
        for (const progress of artifactEvents) {
          console.log(`📊 PROGRESS: ${progress.stage} - ${progress.message}`);
          progressEmitter.emit('progress', { sessionId, progress });
        }

        // Always continue - agent decides when to pause via its response
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
  private activeGenerations: Map<string, AbortController> = new Map(); // sessionId -> AbortController

  constructor(sessionManager?: SessionManager) {
    // Ensure cwd points to agent directory where .claude/ is located
    const projectRoot = process.cwd().endsWith('/server')
      ? resolve(process.cwd(), '..', 'agent')
      : resolve(process.cwd(), 'agent');

    this.defaultOptions = {
      cwd: projectRoot,
      model: 'claude-sonnet-4-20250514',
      maxTurns: 100,  // Full pipeline needs ~50-80 turns (hero + contact + 6 frames + 6 videos + stitch)
      settingSources: ['project'],  // Use project settings only (not user settings)
      permissionMode: 'default',    // Don't block on permission prompts in headless server
      canUseTool: async (_toolName: string, input: Record<string, unknown>) => ({
        behavior: 'allow' as const,
        updatedInput: input
      }),
      allowedTools: [
        "Read",
        "Write",
        "Edit",       // Added: file editing
        "Glob",
        "Grep",       // Added: content search
        "Bash",
        "Task",
        "Skill",
        "TodoWrite",  // Added: task tracking
        "WebFetch"    // Added: web content fetching
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
   * @param metadata - Optional metadata including systemPrompt and autonomousMode
   * @param imagePaths - Optional image paths for multimodal input
   */
  async *queryWithSession(
    prompt: string,
    sessionId?: string,
    metadata?: { systemPrompt?: string; autonomousMode?: boolean },
    imagePaths?: string[]
  ) {
    const session = await this.sessionManager.getOrCreateSession(sessionId);
    const resumeOptions = this.sessionManager.getResumeOptions(session.id);
    const abortController = new AbortController();

    // Store AbortController for potential cancellation
    this.activeGenerations.set(session.id, abortController);

    // Check if autonomous mode is enabled (from metadata or session)
    const isAutonomous = metadata?.autonomousMode || this.sessionManager.isAutonomousMode(session.id);

    // Build system prompt with optional autonomous mode injection
    let systemPrompt = metadata?.systemPrompt || this.defaultOptions.systemPrompt;
    if (isAutonomous && systemPrompt) {
      systemPrompt = `${systemPrompt}\n\n## AUTONOMOUS MODE ACTIVE\nThe user has requested autonomous execution. Run the entire pipeline to completion without pausing for feedback. Make sensible creative decisions on their behalf. Only stop for errors or when the final video is complete.`;
    }

    const queryOptions = {
      ...this.defaultOptions,
      ...resumeOptions,
      systemPrompt,  // Use dynamic or default system prompt (with autonomous injection if enabled)
      includePartialMessages: true,  // Enable real-time token streaming
      abortController,
      hooks: createProgressHooks(session.id)
    };

    console.log(`🔄 Query with session ${session.id}`, {
      hasResume: !!resumeOptions.resume,
      turnCount: session.turnCount,
      imageCount: imagePaths?.length || 0,
      autonomousMode: isAutonomous
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
