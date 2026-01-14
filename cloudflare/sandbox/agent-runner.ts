/**
 * Fashion Shoot Agent - Agent Runner
 * Runs inside Cloudflare Sandbox container, orchestrates Claude Agent SDK
 *
 * CRITICAL PATTERNS:
 * 1. Use async generator for prompt (keeps stream alive during tool execution)
 * 2. Use permissionMode: 'default' + canUseTool (NOT bypassPermissions)
 * 3. Set settingSources: ['project'] to enable skill loading
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./orchestrator-prompt";

// Environment variables
const PROMPT = process.env.PROMPT || "";
const SESSION_ID = process.env.SESSION_ID || `session_${Date.now()}`;
const IS_CONTINUE = process.env.CONTINUE === "true";

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
 */
function detectCheckpoint(toolName: string, toolInput: any, toolResponse: any): void {
  if (toolName !== "Bash" && toolName !== "TaskOutput") return;

  const output = typeof toolResponse === "string" ? toolResponse : JSON.stringify(toolResponse);
  const command = toolName === "Bash" ? (toolInput?.command || "") : "";

  // Detect hero.png creation
  if (command.includes("generate-image.ts") && output.includes("outputs/hero.png")) {
    emitCheckpoint({
      stage: "hero",
      status: "complete",
      artifact: "outputs/hero.png",
      message: 'Hero image ready. Reply "continue" or describe changes.',
    });
    return;
  }

  // Detect contact sheet creation
  if (command.includes("generate-image.ts") && output.includes("outputs/contact-sheet.png")) {
    emitCheckpoint({
      stage: "contact-sheet",
      status: "complete",
      artifact: "outputs/contact-sheet.png",
      message: 'Contact sheet ready. Reply "continue" or describe changes.',
    });
    return;
  }

  // Detect frames creation (from crop-frames.ts)
  if (command.includes("crop-frames.ts") && output.includes("frame-6.png")) {
    emitCheckpoint({
      stage: "frames",
      status: "complete",
      artifacts: [
        "outputs/frames/frame-1.png",
        "outputs/frames/frame-2.png",
        "outputs/frames/frame-3.png",
        "outputs/frames/frame-4.png",
        "outputs/frames/frame-5.png",
        "outputs/frames/frame-6.png",
      ],
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
        "outputs/frames/frame-1.png",
        "outputs/frames/frame-2.png",
        "outputs/frames/frame-3.png",
        "outputs/frames/frame-4.png",
        "outputs/frames/frame-5.png",
        "outputs/frames/frame-6.png",
      ],
      message: `Frames resized to ${aspectRatio}. Reply "continue" to generate videos.`,
    });
    return;
  }

  // Detect final video (BEFORE clips check)
  if (output.includes("fashion-video.mp4") && !output.includes("Error")) {
    emitCheckpoint({
      stage: "complete",
      status: "complete",
      artifact: "outputs/final/fashion-video.mp4",
      message: "Fashion video complete!",
      isFinal: true,
    });
    return;
  }

  // Detect clips creation
  if (command.includes("generate-video.ts") && output.includes("video-5.mp4")) {
    emitCheckpoint({
      stage: "clips",
      status: "complete",
      artifacts: [
        "outputs/videos/video-1.mp4",
        "outputs/videos/video-2.mp4",
        "outputs/videos/video-3.mp4",
        "outputs/videos/video-4.mp4",
        "outputs/videos/video-5.mp4",
      ],
      message: "5 clips ready. Choose speed or regenerate any clip.",
    });
    return;
  }
}

/**
 * Emit checkpoint via console (Worker captures this from stdout)
 */
function emitCheckpoint(checkpoint: any): void {
  console.log(`[checkpoint] ${JSON.stringify(checkpoint)}`);
}

/**
 * Create hooks for tool events and checkpoint detection
 * Emits markers for Worker to translate into proper SSE events
 */
function createHooks() {
  return {
    // PreToolUse: Emit [tool] marker when tool is about to run
    PreToolUse: [
      {
        hooks: [
          async (input: any, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
            // Emit tool start marker for activity indicator
            console.error(JSON.stringify({ t: "tool", d: input.tool_name }));
            return { continue: true };
          },
        ],
      },
    ],
    // PostToolUse: Emit [tool_done] and detect checkpoints
    PostToolUse: [
      {
        hooks: [
          async (input: any, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
            // Emit tool complete marker
            console.error(JSON.stringify({ t: "tool_done" }));
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

  console.error(`[agent] Starting session: ${SESSION_ID}`);
  console.error(`[agent] Prompt: ${PROMPT.substring(0, 100)}${PROMPT.length > 100 ? "..." : ""}`);
  console.error(`[agent] Continue mode: ${IS_CONTINUE}`);

  const abortController = new AbortController();
  const messages: any[] = [];

  try {
    const promptGenerator = createPromptGenerator(PROMPT, abortController.signal);

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

      // Stream tokens via stderr as they arrive (captured by Worker -> SSE -> Frontend)
      // SDK yields various message types - handle each appropriately
      const msgType = message.type;

      if (msgType === "stream_event") {
        // Real-time streaming events (with includePartialMessages: true)
        const event = message as any;
        if (event.event?.type === "content_block_delta") {
          const delta = event.event?.delta;
          if (delta?.type === "text_delta" && delta?.text) {
            console.error(JSON.stringify({ t: "token", d: delta.text }));
          }
        } else if (event.event?.type === "content_block_start") {
          // Detect tool_use block start = thinking mode
          if (event.event?.content_block?.type === "tool_use") {
            console.error(JSON.stringify({ t: "thinking" }));
          }
        }
      } else if (msgType === "assistant") {
        // Complete assistant message
        const content = (message as any).message?.content;
        if (Array.isArray(content)) {
          // Check if message has tool_use (thinking) or just text (response)
          const hasToolUse = content.some((c: any) => c.type === "tool_use");
          const text = content.find((c: any) => c.type === "text")?.text;

          if (text) {
            // If we haven't streamed this text yet, output it now
            // This handles cases where streaming didn't work
            if (!hasToolUse) {
              // Only output full text for non-thinking messages
              // Thinking messages get streamed token by token
            }
          }

          // Signal message complete
          console.error(JSON.stringify({ t: "assistant" }));
        }
      } else if (msgType === "result") {
        // Query complete
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

    // Output final result as JSON (Worker parses this from stdout)
    console.log(
      JSON.stringify({
        success: true,
        sessionId: SESSION_ID,
        response,
        messageCount: messages.length,
      })
    );
  } catch (error: any) {
    abortController.abort();
    console.error(`[agent] Error: ${error.message}`);
    console.log(
      JSON.stringify({
        success: false,
        sessionId: SESSION_ID,
        error: error.message,
      })
    );
    process.exit(1);
  }
}

// Run
main();
