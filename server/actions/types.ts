// server/actions/types.ts
// Action Instance Pattern - Type Definitions

export type PipelineStage =
  | "hero"
  | "contact-sheet"
  | "frames"
  | "resize"
  | "clips"
  | "final";

export type ParamType = "enum" | "text" | "boolean" | "number";

export interface ParamOption {
  value: string;
  label: string;
}

export interface ParamSchema {
  type: ParamType;
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  // For enum type
  options?: ParamOption[];
  // For number type
  min?: number;
  max?: number;
  step?: number;
  // For text type
  placeholder?: string;
  multiline?: boolean;
  // Display hints
  locked?: boolean;
  advanced?: boolean;
}

export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  stage: PipelineStage;
  parameters: Record<string, ParamSchema>;
}

export interface ActionInstance {
  instanceId: string;
  sessionId: string;
  templateId: string;
  label: string;
  params: Record<string, unknown>;
  timestamp: Date;
  status?: "pending" | "executing" | "completed" | "error";
}

export interface ActionResult {
  success: boolean;
  artifact?: string;
  artifacts?: string[];
  message?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  duration?: number;
}

export interface ScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  artifacts?: string[];
}

export interface ActionContext {
  sessionId: string;
  cwd: string;
  outputDir: string;
  referenceImages: string[];
  getAsset(type: "hero" | "contactSheet" | "frames" | "videos"): string | string[] | null;
  getPipelineStage(): PipelineStage;
  emitProgress(stage: string, message: string, progress?: number): void;
  runScript(scriptName: string, args: string[]): Promise<ScriptResult>;
  buildPrompt(templateName: string, variables: Record<string, string>): string;
}

export interface ActionExecutor {
  template: ActionTemplate;
  execute: (
    params: Record<string, unknown>,
    context: ActionContext
  ) => Promise<ActionResult>;
}

// WebSocket message types - Client to Server

export interface ExecuteActionMessage {
  type: "execute_action";
  sessionId: string;
  instanceId: string;
  params: Record<string, unknown>;
  originalParams: Record<string, unknown>;
}

export interface CancelActionMessage {
  type: "cancel_action";
  sessionId: string;
  instanceId: string;
}

export interface ContinueMessage {
  type: "continue";
  sessionId: string;
  content?: string;
}

// WebSocket message types - Server to Client

export interface ActionInstanceMessage {
  type: "action_instance";
  sessionId: string;
  instance: ActionInstance;
  template: ActionTemplate;
}

export interface ActionStartMessage {
  type: "action_start";
  sessionId: string;
  instanceId: string;
  templateId: string;
  label: string;
}

export interface ActionProgressMessage {
  type: "action_progress";
  sessionId: string;
  instanceId: string;
  stage: string;
  message: string;
  progress?: number;
  retryAttempt?: number;
}

export interface ActionCompleteMessage {
  type: "action_complete";
  sessionId: string;
  instanceId: string;
  result: {
    success: true;
    artifact?: string;
    artifacts?: string[];
    message?: string;
    duration?: number;
  };
}

export interface ActionErrorMessage {
  type: "action_error";
  sessionId: string;
  instanceId: string;
  error: {
    code: string;
    message: string;
    retryable: boolean;
    autoRetried: boolean;
  };
}

export interface AwaitingContinuationMessage {
  type: "awaiting_continuation";
  sessionId: string;
  instanceId: string;
}

// Pending continuation storage

export interface PendingContinuation {
  sessionId: string;
  action: ActionInstance;
  result: ActionResult;
  userParamChanges?: Record<string, { from: unknown; to: unknown }>;
  timestamp: Date;
}
