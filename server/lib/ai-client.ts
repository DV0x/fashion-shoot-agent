import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';
import { readFileSync, existsSync } from 'fs';
import { EventEmitter } from 'events';
import { SessionManager } from './session-manager.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './orchestrator-prompt.js';
import { createCheckpointDetector, type CheckpointDetector } from './checkpoint-detector.js';
import type { WorkflowConfig } from './prompt-generator.js';

// Checkpoint data structure
export interface CheckpointData {
  stage: string;  // Dynamic stage names from workflow config
  status: 'complete' | 'error';
  artifact?: string;
  artifacts?: string[];
  type?: 'image' | 'image-grid' | 'video' | 'video-grid';
  message: string;
  isFinal?: boolean;
}

// Checkpoint event emitter for real-time notifications
export const checkpointEmitter = new EventEmitter();

/**
 * Legacy checkpoint detection based on hardcoded patterns
 * Kept for backwards compatibility when no workflow config is provided
 * @deprecated Use config-driven checkpoint detection via CheckpointDetector
 */
function detectCheckpointLegacy(toolName: string, toolInput: any, toolResponse: any): CheckpointData | null {
  // Check Bash tool results AND TaskOutput results (for background tasks)
  if (toolName !== 'Bash' && toolName !== 'TaskOutput') return null;

  const output = typeof toolResponse === 'string' ? toolResponse : JSON.stringify(toolResponse);

  // For TaskOutput, we don't have the original command, so check output directly
  // For Bash, we have the command in toolInput
  const command = toolName === 'Bash' ? (toolInput?.command || '') : '';

  // Common checks for TaskOutput (background task) handling
  const isTaskOutput = toolName === 'TaskOutput';
  const hasSuccessStatus = output.includes('retrieval_status>success') || output.includes('"success"');
  const hasError = output.includes('Error');

  // DEBUG: Log tool executions for checkpoint detection
  console.log(`🔍 [CHECKPOINT DEBUG] Checking ${toolName}:`);
  if (command) {
    console.log(`   Command: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
  }
  console.log(`   Output preview: ${output.substring(0, 200)}${output.length > 200 ? '...' : ''}`);

  // Detect hero.png creation (from generate-image.ts)
  if (command.includes('generate-image.ts') && output.includes('outputs/hero.png')) {
    return {
      stage: 'hero',
      status: 'complete',
      artifact: 'outputs/hero.png',
      message: 'Hero image ready. Reply "continue" or describe changes.'
    };
  }

  // Detect individual frame regeneration (from generate-image.ts to outputs/frames/)
  // This triggers when user requests modifications to specific frames
  if (command.includes('generate-image.ts') && output.includes('outputs/frames/frame-')) {
    // Extract which frame(s) were regenerated from the output
    const frameMatches = output.match(/outputs\/frames\/frame-(\d+)\.png/g);
    const regeneratedFrames = frameMatches
      ? [...new Set(frameMatches)].sort()  // Dedupe and sort
      : [];

    const frameNumbers = regeneratedFrames.map(f => f.match(/frame-(\d+)/)?.[1]).filter(Boolean);
    const frameList = frameNumbers.length > 1
      ? `Frames ${frameNumbers.join(', ')} regenerated.`
      : `Frame ${frameNumbers[0]} regenerated.`;

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
      message: `${frameList} Reply "continue" or request more changes.`
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
  // Note: Check for 'success' patterns that work with both raw and JSON-stringified output
  // The output could be: "success": true OR \"success\": true OR success":true
  const hasResizeSuccess = /success["\\]*:\s*true/.test(output) || output.includes('framesCount');
  if (command.includes('resize-frames.ts') && hasResizeSuccess && !hasError) {
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

  // Detect final video creation (from stitch-videos-eased.ts OR raw ffmpeg OR TaskOutput from background task)
  // IMPORTANT: Check this BEFORE clips to prevent stitch output (which contains video-*.mp4 inputs)
  // from triggering clips checkpoint instead of complete
  const hasStitchScript = command.includes('stitch-videos-eased.ts');
  const hasFashionVideoInOutput = output.includes('fashion-video.mp4');
  const hasFFmpeg = command.includes('ffmpeg');
  const hasFashionVideoInCommand = command.includes('outputs/final/fashion-video.mp4');

  const isFinalVideoCreated =
    (hasStitchScript && hasFashionVideoInOutput) ||
    (hasFFmpeg && hasFashionVideoInCommand && !hasError) ||
    (isTaskOutput && hasFashionVideoInOutput && hasSuccessStatus && !hasError);

  if (isFinalVideoCreated) {
    console.log(`✅ [CHECKPOINT DEBUG] COMPLETE checkpoint detected!`);
    return {
      stage: 'complete',
      status: 'complete',
      artifact: 'outputs/final/fashion-video.mp4',
      message: 'Fashion video complete!'
    };
  }

  // Detect clips creation or regeneration (from generate-video.ts)
  // Triggers on:
  // 1. Initial generation: video-6.mp4 (last of 6 sequential clips)
  // 2. Clip regeneration: any single video-N.mp4 output
  // Also check TaskOutput in case video generation runs as background task (>2min timeout)
  const hasVideo6 = output.includes('video-6.mp4');
  const hasAnyVideo = /video-[1-6]\.mp4/.test(output);

  // Check if this is a single clip regeneration (only one video mentioned)
  const videoMatches = output.match(/video-[1-6]\.mp4/g);
  const isSingleClipRegen = videoMatches && videoMatches.length === 1;

  const isClipsCreated =
    (command.includes('generate-video.ts') && (hasVideo6 || isSingleClipRegen)) ||
    (isTaskOutput && hasAnyVideo && hasSuccessStatus && !hasError);

  if (isClipsCreated) {
    const regenClip = isSingleClipRegen ? videoMatches[0].match(/video-(\d)/)?.[1] : null;
    const message = regenClip
      ? `Clip ${regenClip} regenerated. Choose speed (1x, 1.25x, 1.5x, 2x), loop (yes/no), or regenerate more clips.`
      : '6 clips ready. Choose speed (1x, 1.25x, 1.5x, 2x), loop (yes/no), or regenerate any clip.';

    return {
      stage: 'clips',
      status: 'complete',
      artifacts: [
        'outputs/videos/video-1.mp4',
        'outputs/videos/video-2.mp4',
        'outputs/videos/video-3.mp4',
        'outputs/videos/video-4.mp4',
        'outputs/videos/video-5.mp4',
        'outputs/videos/video-6.mp4'
      ],
      message
    };
  }

  return null;
}

/**
 * Create PostToolUse hooks for checkpoint detection
 * @param sessionId - The session ID for emitting checkpoint events
 * @param detector - Optional config-driven checkpoint detector (uses legacy detection if not provided)
 */
function createCheckpointHooks(sessionId: string, detector?: CheckpointDetector | null) {
  return {
    PostToolUse: [{
      hooks: [async (input: any, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
        let checkpoint: CheckpointData | null = null;

        if (detector) {
          // Use config-driven detection
          checkpoint = detector.detect(
            input.tool_name,
            input.tool_input,
            input.tool_response
          );
        } else {
          // Fallback to legacy detection (for backwards compatibility)
          checkpoint = detectCheckpointLegacy(
            input.tool_name,
            input.tool_input,
            input.tool_response
          );
        }

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
   * @param prompt - The user prompt
   * @param sessionId - Optional session ID
   * @param metadata - Optional metadata including systemPrompt and workflowConfig
   * @param imagePaths - Optional image paths for multimodal input
   */
  async *queryWithSession(
    prompt: string,
    sessionId?: string,
    metadata?: { systemPrompt?: string; workflowConfig?: WorkflowConfig },
    imagePaths?: string[]
  ) {
    const session = await this.sessionManager.getOrCreateSession(sessionId);
    const resumeOptions = this.sessionManager.getResumeOptions(session.id);
    const abortController = new AbortController();

    // Create checkpoint detector from workflow config if provided
    const detector = metadata?.workflowConfig
      ? createCheckpointDetector(metadata.workflowConfig)
      : null;

    // Use provided system prompt or fall back to default
    const systemPrompt = metadata?.systemPrompt || this.defaultOptions.systemPrompt;

    const queryOptions = {
      ...this.defaultOptions,
      ...resumeOptions,
      systemPrompt,  // Use dynamic or default system prompt
      includePartialMessages: true,  // Enable real-time token streaming
      abortController,
      hooks: createCheckpointHooks(session.id, detector)
    };

    console.log(`🔄 Query with session ${session.id}`, {
      hasResume: !!resumeOptions.resume,
      turnCount: session.turnCount,
      imageCount: imagePaths?.length || 0,
      hasWorkflowConfig: !!metadata?.workflowConfig,
      workflowId: metadata?.workflowConfig?.id || 'default'
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
