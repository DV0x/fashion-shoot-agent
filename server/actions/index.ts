// server/actions/index.ts
// ActionsManager - Registry and execution of action templates

import { spawn } from "child_process";
import path from "path";
import {
  ActionTemplate,
  ActionInstance,
  ActionExecutor,
  ActionResult,
  ActionContext,
  ScriptResult,
  PipelineStage,
  PendingContinuation,
} from "./types.js";

export class ActionsManager {
  private templates: Map<string, ActionExecutor> = new Map();
  private instances: Map<string, ActionInstance> = new Map();
  private pendingContinuations: Map<string, PendingContinuation> = new Map();

  /**
   * Register an action executor (template + execution logic)
   */
  registerTemplate(executor: ActionExecutor): void {
    this.templates.set(executor.template.id, executor);
  }

  /**
   * Get a template by ID
   */
  getTemplate(id: string): ActionTemplate | undefined {
    return this.templates.get(id)?.template;
  }

  /**
   * Get all registered templates
   */
  getAllTemplates(): ActionTemplate[] {
    return Array.from(this.templates.values()).map((e) => e.template);
  }

  /**
   * Register a new action instance (proposed by agent)
   */
  registerInstance(instance: ActionInstance): void {
    this.instances.set(instance.instanceId, instance);
  }

  /**
   * Get an instance by ID
   */
  getInstance(instanceId: string): ActionInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Update instance status
   */
  updateInstanceStatus(
    instanceId: string,
    status: ActionInstance["status"]
  ): void {
    const instance = this.instances.get(instanceId);
    if (instance) {
      instance.status = status;
    }
  }

  /**
   * Remove an instance
   */
  removeInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  /**
   * Clear all instances for a session
   */
  clearSessionInstances(sessionId: string): void {
    for (const [id, instance] of this.instances) {
      if (instance.sessionId === sessionId) {
        this.instances.delete(id);
      }
    }
  }

  /**
   * Execute an action with the given parameters
   */
  async executeAction(
    instanceId: string,
    params: Record<string, unknown>,
    context: ActionContext
  ): Promise<ActionResult> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return {
        success: false,
        error: `Action instance not found: ${instanceId}`,
        errorCode: "INSTANCE_NOT_FOUND",
        retryable: false,
      };
    }

    const executor = this.templates.get(instance.templateId);
    if (!executor) {
      return {
        success: false,
        error: `Action template not found: ${instance.templateId}`,
        errorCode: "TEMPLATE_NOT_FOUND",
        retryable: false,
      };
    }

    // Update status to executing
    instance.status = "executing";

    const startTime = Date.now();

    try {
      const result = await executor.execute(params, context);
      result.duration = Date.now() - startTime;

      // Update status based on result
      instance.status = result.success ? "completed" : "error";

      return result;
    } catch (error) {
      instance.status = "error";
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: "EXECUTION_ERROR",
        retryable: true,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Store a pending continuation after action completes
   */
  setPendingContinuation(
    sessionId: string,
    continuation: PendingContinuation
  ): void {
    this.pendingContinuations.set(sessionId, continuation);
  }

  /**
   * Get pending continuation for a session
   */
  getPendingContinuation(sessionId: string): PendingContinuation | undefined {
    return this.pendingContinuations.get(sessionId);
  }

  /**
   * Clear pending continuation after it's been used
   */
  clearPendingContinuation(sessionId: string): void {
    this.pendingContinuations.delete(sessionId);
  }

  /**
   * Build continuation message for the agent
   */
  buildContinuationMessage(continuation: PendingContinuation): string {
    const { action, result, userParamChanges } = continuation;
    const template = this.getTemplate(action.templateId);

    const lines = [
      `[Action Completed: ${template?.name || action.templateId}]`,
      `Result: ${result.success ? "SUCCESS" : "FAILED"}`,
    ];

    if (result.artifact) {
      lines.push(`Artifact: ${result.artifact}`);
    }
    if (result.artifacts && result.artifacts.length > 0) {
      lines.push(`Artifacts: ${result.artifacts.join(", ")}`);
    }
    if (result.duration) {
      lines.push(`Duration: ${(result.duration / 1000).toFixed(1)}s`);
    }
    if (result.error) {
      lines.push(`Error: ${result.error}`);
    }

    if (userParamChanges && Object.keys(userParamChanges).length > 0) {
      lines.push("");
      lines.push("User Parameter Changes:");
      for (const [key, change] of Object.entries(userParamChanges)) {
        lines.push(`- ${key}: "${change.from}" → "${change.to}"`);
      }
    }

    lines.push("");
    lines.push("User wants to continue. Comment on result and suggest next step.");

    return lines.join("\n");
  }
}

/**
 * Create an ActionContext for executing actions
 */
export function createActionContext(options: {
  sessionId: string;
  cwd: string;
  outputDir: string;
  referenceImages: string[];
  assetGetter: (type: "hero" | "contactSheet" | "frames" | "videos") => string | string[] | null;
  stageGetter: () => PipelineStage;
  progressEmitter: (stage: string, message: string, progress?: number) => void;
}): ActionContext {
  const { sessionId, cwd, outputDir, referenceImages, assetGetter, stageGetter, progressEmitter } = options;

  return {
    sessionId,
    cwd,
    outputDir,
    referenceImages,
    getAsset: assetGetter,
    getPipelineStage: stageGetter,
    emitProgress: progressEmitter,

    async runScript(scriptName: string, args: string[]): Promise<ScriptResult> {
      return new Promise((resolve) => {
        // scriptName can be a full relative path like ".claude/skills/.../script.ts"
        // or just a script name to be resolved under scripts/
        const scriptPath = scriptName.includes("/")
          ? path.join(cwd, scriptName)
          : path.join(cwd, "scripts", `${scriptName}.ts`);

        console.log(`🔧 [SCRIPT] Running: npx tsx ${scriptPath}`);
        console.log(`   CWD: ${cwd}`);
        console.log(`   Args: ${args.join(' ')}`);

        const proc = spawn("npx", ["tsx", scriptPath, ...args], {
          cwd,
          env: { ...process.env },
        });

        let stdout = "";
        let stderr = "";
        const artifacts: string[] = [];

        proc.stdout.on("data", (data) => {
          const text = data.toString();
          stdout += text;

          // Parse artifact JSON from stdout
          const lines = text.split("\n");
          for (const line of lines) {
            try {
              const parsed = JSON.parse(line.trim());
              if (parsed.type === "artifact" && parsed.path) {
                artifacts.push(parsed.path);
              } else if (parsed.type === "artifacts" && parsed.paths) {
                artifacts.push(...parsed.paths);
              }
            } catch {
              // Not JSON, ignore
            }
          }
        });

        proc.stderr.on("data", (data) => {
          stderr += data.toString();
        });

        proc.on("close", (exitCode) => {
          console.log(`🔧 [SCRIPT] Completed with exit code: ${exitCode}`);
          console.log(`   Artifacts found: ${artifacts.length > 0 ? artifacts.join(', ') : '(none)'}`);
          if (stderr) {
            console.log(`   Stderr: ${stderr.substring(0, 500)}`);
          }
          resolve({
            stdout,
            stderr,
            exitCode: exitCode ?? 1,
            artifacts: artifacts.length > 0 ? artifacts : undefined,
          });
        });

        proc.on("error", (error) => {
          resolve({
            stdout,
            stderr: stderr + "\n" + error.message,
            exitCode: 1,
          });
        });
      });
    },

    buildPrompt(templateName: string, variables: Record<string, string>): string {
      // Simple template substitution
      let prompt = templateName;
      for (const [key, value] of Object.entries(variables)) {
        prompt = prompt.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
      }
      return prompt;
    },
  };
}

// Singleton instance
export const actionsManager = new ActionsManager();

// Import all executors
import { generateHeroExecutor } from "./generate-hero.js";
import { generateContactSheetExecutor } from "./generate-contact-sheet.js";
import { extractFramesExecutor } from "./extract-frames.js";
import { resizeFramesExecutor } from "./resize-frames.js";
import { generateVideoClipExecutor } from "./generate-video-clip.js";
import { generateAllClipsExecutor } from "./generate-all-clips.js";
import { stitchFinalExecutor } from "./stitch-final.js";

/**
 * Initialize the actions manager with all registered executors
 */
export function initializeActions(): void {
  // Hero generation
  actionsManager.registerTemplate(generateHeroExecutor);

  // Contact sheet generation
  actionsManager.registerTemplate(generateContactSheetExecutor);

  // Frame extraction and manipulation
  actionsManager.registerTemplate(extractFramesExecutor);
  actionsManager.registerTemplate(resizeFramesExecutor);

  // Video clip generation
  actionsManager.registerTemplate(generateVideoClipExecutor);
  actionsManager.registerTemplate(generateAllClipsExecutor);

  // Final video stitching
  actionsManager.registerTemplate(stitchFinalExecutor);
}

// Auto-initialize on import
initializeActions();

// Re-export types
export * from "./types.js";
