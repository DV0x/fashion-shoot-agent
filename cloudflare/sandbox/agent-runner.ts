/**
 * Fashion Shoot Agent - Agent Runner
 * Runs inside Cloudflare Sandbox container, orchestrates Claude Agent SDK
 *
 * CRITICAL PATTERNS:
 * 1. Use async generator for prompt (keeps stream alive during tool execution)
 * 2. Use permissionMode: 'default' + canUseTool (NOT bypassPermissions)
 * 3. Set settingSources: ['project'] to enable skill loading
 */

// Debug: Log immediately on script start
console.error("[agent-runner] Script starting...");

import { query } from "@anthropic-ai/claude-agent-sdk";
console.error("[agent-runner] SDK imported");

import { ORCHESTRATOR_SYSTEM_PROMPT } from "./orchestrator-prompt";
console.error("[agent-runner] Prompt imported");

// Environment variables
const PROMPT = process.env.PROMPT || "";
const SESSION_ID = process.env.SESSION_ID || `session_${Date.now()}`;
const IS_CONTINUE = process.env.CONTINUE === "true";
const PIPELINE_STAGE = process.env.PIPELINE_STAGE || "init";

// Debug: Log env vars
console.error(`[agent-runner] ENV: SESSION_ID=${SESSION_ID}, CONTINUE=${IS_CONTINUE}, STAGE=${PIPELINE_STAGE}`);
console.error(`[agent-runner] PROMPT length: ${PROMPT.length}`);
console.error(`[agent-runner] ANTHROPIC_API_KEY set: ${!!process.env.ANTHROPIC_API_KEY}`);

/**
 * Build the effective prompt for the SDK
 * When continuing after a container restart, inject context about current stage
 */
function buildEffectivePrompt(): string {
  // If not continuing, or at init stage, use prompt as-is
  if (!IS_CONTINUE || PIPELINE_STAGE === "init") {
    return PROMPT;
  }

  // Context reconstruction for continuation after container restart
  // The agent can check R2-mounted outputs to see completed work
  return `CONTINUATION: You are resuming a fashion shoot pipeline at the "${PIPELINE_STAGE}" stage.

Check /workspace/agent/outputs/ to see what work has been completed:
- outputs/hero.png = Hero image complete
- outputs/contact-sheet.png = Contact sheet complete
- outputs/frames/frame-*.png = Frames extracted
- outputs/videos/video-*.mp4 = Video clips generated
- outputs/final/fashion-video.mp4 = Final video complete

Resume from where you left off based on what files exist.

User request: ${PROMPT}`;
}

/**
 * Async generator for SDK prompt
 * CRITICAL: Generator must stay alive during tool execution
 */
async function* createPromptGenerator(prompt: string, signal: AbortSignal) {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: prompt },
    parent_tool_use_id: null,
  };

  // Keep generator alive until query completes
  await new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve());
  });
}

/**
 * Detect checkpoints from tool execution
 * Emits checkpoint markers via console for Worker to capture
 * Artifact paths include session prefix for correct R2 URL serving
 */
function detectCheckpoint(toolName: string, toolInput: any, toolResponse: any): void {
  if (toolName !== "Bash" && toolName !== "TaskOutput") return;

  const output = typeof toolResponse === "string" ? toolResponse : JSON.stringify(toolResponse);
  const command = toolName === "Bash" ? (toolInput?.command || "") : "";

  // Session prefix for artifact paths (R2 serves at /outputs/{sessionId}/...)
  const sessionPrefix = `outputs/${SESSION_ID}`;

  // Detect hero.png creation
  if (command.includes("generate-image.ts") && output.includes("outputs/hero.png")) {
    emitCheckpoint({
      stage: "hero",
      status: "complete",
      artifact: `${sessionPrefix}/hero.png`,
      type: "image",
      message: 'Hero image ready. Reply "continue" or describe changes.',
    });
    return;
  }

  // Detect contact sheet creation
  if (command.includes("generate-image.ts") && output.includes("outputs/contact-sheet.png")) {
    emitCheckpoint({
      stage: "contact-sheet",
      status: "complete",
      artifact: `${sessionPrefix}/contact-sheet.png`,
      type: "image",
      message: 'Contact sheet ready. Reply "continue" or describe changes.',
    });
    return;
  }

  // Detect frames creation (from crop-frames.ts or crop-frames-ffmpeg.ts)
  if ((command.includes("crop-frames.ts") || command.includes("crop-frames-ffmpeg.ts")) && output.includes("frame-6.png")) {
    emitCheckpoint({
      stage: "frames",
      status: "complete",
      artifacts: [
        `${sessionPrefix}/frames/frame-1.png`,
        `${sessionPrefix}/frames/frame-2.png`,
        `${sessionPrefix}/frames/frame-3.png`,
        `${sessionPrefix}/frames/frame-4.png`,
        `${sessionPrefix}/frames/frame-5.png`,
        `${sessionPrefix}/frames/frame-6.png`,
      ],
      type: "image",
      message: '6 frames ready. Reply "continue" or request modifications.',
    });
    return;
  }

  // Detect frames resize
  if (command.includes("resize-frames.ts") && output.includes('"success"')) {
    const aspectMatch = command.match(/--aspect-ratio\s+(\S+)/);
    const aspectRatio = aspectMatch ? aspectMatch[1] : "new aspect ratio";
    emitCheckpoint({
      stage: "frames",
      status: "complete",
      artifacts: [
        `${sessionPrefix}/frames/frame-1.png`,
        `${sessionPrefix}/frames/frame-2.png`,
        `${sessionPrefix}/frames/frame-3.png`,
        `${sessionPrefix}/frames/frame-4.png`,
        `${sessionPrefix}/frames/frame-5.png`,
        `${sessionPrefix}/frames/frame-6.png`,
      ],
      type: "image",
      message: `Frames resized to ${aspectRatio}. Reply "continue" to generate videos.`,
    });
    return;
  }

  // Detect clips creation (MUST be checked BEFORE complete to avoid false positives)
  // Only triggers when generate-video.ts creates video-5.mp4 (the 5th clip)
  if (command.includes("generate-video.ts") && output.includes("video-5.mp4")) {
    emitCheckpoint({
      stage: "clips",
      status: "complete",
      artifacts: [
        `${sessionPrefix}/videos/video-1.mp4`,
        `${sessionPrefix}/videos/video-2.mp4`,
        `${sessionPrefix}/videos/video-3.mp4`,
        `${sessionPrefix}/videos/video-4.mp4`,
        `${sessionPrefix}/videos/video-5.mp4`,
      ],
      type: "video",
      message: "5 clips ready. Choose speed or regenerate any clip.",
    });
    return;
  }

  // Detect final video (AFTER clips check)
  // Only triggers when stitch-videos-eased.ts creates the final video
  if (command.includes("stitch-videos-eased.ts") && output.includes("fashion-video.mp4") && !output.includes("Error")) {
    emitCheckpoint({
      stage: "complete",
      status: "complete",
      artifact: `${sessionPrefix}/final/fashion-video.mp4`,
      type: "video",
      message: "Fashion video complete!",
      isFinal: true,
    });
    return;
  }
}

/**
 * Emit SSE event to stdout (Worker forwards directly to client)
 * Format: data: {json}\n\n
 */
function emitSSE(event: object): void {
  console.log(`data: ${JSON.stringify(event)}\n`);
}

/**
 * Emit checkpoint via SSE (Worker forwards directly to client)
 */
function emitCheckpoint(checkpoint: any): void {
  emitSSE({
    type: "checkpoint",
    checkpoint,
    sessionId: SESSION_ID,
    awaitingInput: true,
  });
}

/**
 * Create hooks for tool events and checkpoint detection
 * Emits SSE events directly to stdout (Worker forwards to client)
 */
function createHooks() {
  return {
    // PreToolUse: Emit tool_call SSE event with details
    PreToolUse: [
      {
        hooks: [
          async (input: any, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
            const toolName = input.tool_name;
            const toolInput = input.tool_input || {};

            // Build detail string for observability
            let detail = "";
            if (toolName === "Bash" && toolInput.command) {
              // Show first 100 chars of command
              detail = toolInput.command.substring(0, 100);
              if (toolInput.command.length > 100) detail += "...";
            } else if (toolName === "Read" && toolInput.file_path) {
              detail = toolInput.file_path;
            } else if (toolName === "Skill" && toolInput.skill) {
              detail = toolInput.skill;
            }

            // Log to stderr for wrangler tail visibility
            console.error(`[tool] ${toolName}${detail ? `: ${detail}` : ""}`);

            emitSSE({
              type: "system",
              subtype: "tool_call",
              data: { tool_name: toolName, detail },
            });
            return { continue: true };
          },
        ],
      },
    ],
    // PostToolUse: Emit tool_result and detect checkpoints
    PostToolUse: [
      {
        hooks: [
          async (input: any, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
            const toolName = input.tool_name;
            const toolResponse = input.tool_response;

            // Build summary for observability
            let summary = "";
            if (toolName === "Bash") {
              const output = typeof toolResponse === "string" ? toolResponse : JSON.stringify(toolResponse);
              // Show last 200 chars (usually contains result)
              if (output.length > 200) {
                summary = "..." + output.substring(output.length - 200);
              } else {
                summary = output;
              }
            }

            // Log to stderr for wrangler tail visibility
            if (summary) {
              console.error(`[tool:done] ${toolName}: ${summary.substring(0, 100)}${summary.length > 100 ? "..." : ""}`);
            } else {
              console.error(`[tool:done] ${toolName}`);
            }

            emitSSE({
              type: "system",
              subtype: "tool_result",
              data: { tool_name: toolName, summary },
            });

            // Detect and emit checkpoints
            detectCheckpoint(input.tool_name, input.tool_input, input.tool_response);
            return { continue: true };
          },
        ],
      },
    ],
  };
}

/**
 * Main entry point
 */
async function main() {
  if (!PROMPT) {
    console.error("[agent] Error: PROMPT environment variable is required");
    process.exit(1);
  }

  // Build effective prompt (adds context for continuation after restart)
  const effectivePrompt = buildEffectivePrompt();

  console.error(`[agent] Starting session: ${SESSION_ID}`);
  console.error(`[agent] Pipeline stage: ${PIPELINE_STAGE}`);
  console.error(`[agent] Continue mode: ${IS_CONTINUE}`);
  console.error(`[agent] Prompt: ${effectivePrompt.substring(0, 100)}${effectivePrompt.length > 100 ? "..." : ""}`);

  const abortController = new AbortController();
  const messages: any[] = [];

  try {
    console.error("[agent] Creating prompt generator...");
    const promptGenerator = createPromptGenerator(effectivePrompt, abortController.signal);

    console.error("[agent] Starting SDK query...");
    for await (const message of query({
      prompt: promptGenerator as any,  // Type cast needed due to SDK type changes
      options: {
        cwd: "/workspace/agent",
        systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
        settingSources: ["project"], // CRITICAL: Enables skill loading
        model: "claude-sonnet-4-20250514",
        maxTurns: 100,

        // CRITICAL: Enable real-time token streaming (like local server)
        includePartialMessages: true,

        // CRITICAL: Use default + canUseTool, NOT bypassPermissions
        permissionMode: "default",
        canUseTool: async (_tool, input) => ({ behavior: "allow" as const, updatedInput: input }),

        // Continue from previous conversation if same container session
        ...(IS_CONTINUE ? { continue: true } : {}),

        allowedTools: [
          "Task",
          "Skill",
          "TodoWrite",
          "Read",
          "Write",
          "Edit",
          "Glob",
          "Grep",
          "Bash",
          "WebFetch",
        ],

        hooks: createHooks(),
      },
    })) {
      messages.push(message);

      // Stream SSE events directly to stdout (Worker forwards to client)
      // SDK yields various message types - handle each appropriately
      const msgType = message.type;

      if (msgType === "stream_event") {
        // Real-time streaming events (with includePartialMessages: true)
        const event = message as any;
        if (event.event?.type === "content_block_delta") {
          const delta = event.event?.delta;
          if (delta?.type === "text_delta" && delta?.text) {
            emitSSE({ type: "text_delta", text: delta.text });
          }
        } else if (event.event?.type === "content_block_start") {
          // Detect tool_use block start = thinking mode
          if (event.event?.content_block?.type === "tool_use") {
            emitSSE({ type: "message_type_hint", messageType: "thinking" });
          }
        }
      } else if (msgType === "assistant") {
        // Complete assistant message
        const content = (message as any).message?.content;
        if (Array.isArray(content)) {
          // Check if message has tool_use (thinking) or just text (response)
          const hasToolUse = content.some((c: any) => c.type === "tool_use");

          // Emit message type hint for proper classification
          emitSSE({
            type: "message_type_hint",
            messageType: hasToolUse ? "thinking" : "response",
          });
        }
      } else if (msgType === "result") {
        // Query complete
        emitSSE({ type: "done", sessionId: SESSION_ID });
        abortController.abort();
        break;
      }
    }

    // Extract final response
    const assistantMessages = messages
      .filter((m) => m.type === "assistant")
      .map((m) => {
        const content = (m as any).message?.content;
        if (Array.isArray(content)) {
          return content.find((c: any) => c.type === "text")?.text || "";
        }
        return "";
      })
      .filter((t) => t.length > 0);

    const response = assistantMessages[assistantMessages.length - 1] || "";

    // Emit final result as SSE event
    emitSSE({
      type: "result",
      success: true,
      sessionId: SESSION_ID,
      response,
      messageCount: messages.length,
    });
  } catch (error: any) {
    abortController.abort();
    // Emit error as SSE event
    emitSSE({
      type: "error",
      success: false,
      sessionId: SESSION_ID,
      error: error.message,
    });
    process.exit(1);
  }
}

// Run
main();
