// API Types
export interface SessionStats {
  id: string;
  sdkSessionId?: string;
  duration: number;
  messageCount: number;
  turnCount: number;
  status: 'active' | 'completed' | 'error';
  lastActive: string;
  isFork: boolean;
}

export interface PipelineState {
  stage: PipelineStage;
  progress: number;
  assets: {
    hero?: string;
    contactSheet?: string;
    frames?: string[];
    videos?: string[];
    finalVideo?: string;
  };
}

export type PipelineStage =
  | 'idle'
  | 'analyzing'
  | 'generating-hero'
  | 'generating-contact'
  | 'isolating-frames'
  | 'generating-videos'
  | 'stitching'
  | 'completed'
  | 'error';

export interface Checkpoint {
  stage: 'hero' | 'contact-sheet' | 'frames' | 'clips' | 'complete';
  status: 'complete' | 'pending';
  artifact?: string;         // Single artifact (hero, contact-sheet, final video)
  artifacts?: string[];      // Multiple artifacts (frames, clips)
  message: string;
}

export interface UploadedFile {
  originalName: string;
  filename: string;
  path: string;
  size: number;
  mimetype: string;
  url: string;
}

// Generate API
export interface GenerateRequest {
  prompt: string;
  sessionId?: string;
  inputImages?: string[];
}

export interface GenerateResponse {
  success: boolean;
  sessionId: string;
  outputDir: string;
  response: string;
  fullResponse: string;
  sessionStats: SessionStats;
  pipeline: PipelineState;
  checkpoint?: Checkpoint;
  awaitingInput?: boolean;
  instrumentation: {
    campaignId: string;
    totalCost_usd: number;
    totalDuration_ms: number;
  };
}

// Upload API
export interface UploadResponse {
  success: boolean;
  count: number;
  files: UploadedFile[];
}

// SSE Events
export interface SSEEvent {
  type: 'connected' | 'heartbeat' | 'system' | 'assistant' | 'user' | 'result';
  data?: any;
}

// Chat Message Types
export type MessageRole = 'user' | 'assistant' | 'system';

export interface BaseMessage {
  id: string;
  role: MessageRole;
  timestamp: Date;
}

// Content Block Types for streaming
export interface ContentBlock {
  id: string;
  index: number;                 // SDK block index (0, 1, 2...)
  type: 'text' | 'thinking' | 'tool_use' | 'tool_result';
  content: string;               // Accumulated text for text/thinking blocks
  isStreaming: boolean;          // Currently receiving deltas
  isComplete: boolean;           // Block finished (content_block_stop received)

  // Tool-specific fields
  toolName?: string;             // Name of tool being called
  toolId?: string;               // SDK tool_use ID
  toolInput?: Record<string, unknown>;
  toolResult?: string;           // Result after execution
  toolDuration?: number;         // Execution time in ms
}

export interface TextMessage extends BaseMessage {
  type: 'text';
  content: string;
  isStreaming?: boolean;  // True while message is being streamed
}

export interface ThinkingMessage extends BaseMessage {
  type: 'thinking';
  content: string;
  blocks?: ContentBlock[];  // Full blocks for expanded view
  isCollapsed?: boolean;
}

export interface ImageMessage extends BaseMessage {
  type: 'image';
  src: string;
  caption?: string;
}

export interface ProgressMessage extends BaseMessage {
  type: 'progress';
  stage: string;
  current: number;
  total: number;
  label: string;
}

export interface VideoMessage extends BaseMessage {
  type: 'video';
  src: string;
  poster?: string;
  label?: string;  // e.g., "Clip 1", "Final Video"
}

export interface ToolUseMessage extends BaseMessage {
  type: 'tool_use';
  toolName: string;
  toolId: string;
  toolInput: Record<string, unknown>;
  isExpanded?: boolean;
}

export type ChatMessage =
  | TextMessage
  | ThinkingMessage
  | ImageMessage
  | ProgressMessage
  | VideoMessage
  | ToolUseMessage;

// Preset Types
export type PosePreset =
  | 'confident-standing'
  | 'seated-editorial'
  | 'leaning-casual'
  | 'editorial-drama'
  | 'relaxed-natural'
  | 'street-walk'
  | 'urban-lean'
  | 'custom';

export type BackgroundPreset =
  | 'studio-grey'
  | 'studio-white'
  | 'studio-black'
  | 'industrial'
  | 'warm-daylight'
  | 'color-gel'
  | 'outdoor-urban'
  | 'custom';

export interface PresetSelection {
  pose: PosePreset;
  background: BackgroundPreset;
  customPose?: string;
  customBackground?: string;
}
