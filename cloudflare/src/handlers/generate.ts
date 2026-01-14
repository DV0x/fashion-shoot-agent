/**
 * Generate Handler - Main agent orchestration via Sandbox container
 *
 * KEY ARCHITECTURE NOTES:
 * 1. getSandbox(env.Sandbox, sessionId) returns a persistent Durable Object stub
 * 2. The same sessionId = same container instance with persistent state
 * 3. Bucket mounts persist across requests to the same sandbox instance
 * 4. Must handle "already mounted" errors gracefully for session continuations
 */

import type { Env } from "../index";
import { getSandbox, parseSSEStream, InvalidMountConfigError, type ExecEvent } from "@cloudflare/sandbox";

interface GenerateRequest {
  prompt: string;
  sessionId?: string;
  inputImages?: string[];
}

/**
 * Create or update session in D1 using INSERT OR REPLACE
 * This avoids UNIQUE constraint issues with concurrent requests
 */
async function ensureSession(env: Env, sessionId: string): Promise<void> {
  // Check if session exists first
  const existing = await env.DB.prepare(`
    SELECT id FROM sessions WHERE id = ?
  `).bind(sessionId).first();

  if (existing) {
    // Update existing session
    await env.DB.prepare(`
      UPDATE sessions
      SET status = 'active', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(sessionId).run();
  } else {
    // Create new session
    await env.DB.prepare(`
      INSERT INTO sessions (id, status, pipeline_stage)
      VALUES (?, 'active', 'init')
    `).bind(sessionId).run();
  }
}

/**
 * Mount R2 bucket idempotently - handles already-mounted case gracefully
 *
 * The Sandbox SDK tracks mounts internally. When the same sessionId is used,
 * the sandbox instance persists and the bucket remains mounted.
 */
async function mountBucketSafe(
  sandbox: ReturnType<typeof getSandbox>,
  bucketName: string,
  mountPath: string,
  options: Parameters<typeof sandbox.mountBucket>[2]
): Promise<void> {
  try {
    await sandbox.mountBucket(bucketName, mountPath, options);
  } catch (error: any) {
    // Check if this is an "already mounted" error
    if (error?.message?.includes("already in use")) {
      console.log(`[mount] Bucket already mounted at ${mountPath}, continuing...`);
      return;
    }
    // Re-throw other mount errors
    throw error;
  }
}

/**
 * Update session status
 */
async function updateSession(
  env: Env,
  sessionId: string,
  updates: { status?: string; pipeline_stage?: string; error_message?: string }
): Promise<void> {
  const sets: string[] = ["updated_at = CURRENT_TIMESTAMP"];
  const values: any[] = [];

  if (updates.status) {
    sets.push("status = ?");
    values.push(updates.status);
  }
  if (updates.pipeline_stage) {
    sets.push("pipeline_stage = ?");
    values.push(updates.pipeline_stage);
  }
  if (updates.error_message) {
    sets.push("error_message = ?");
    values.push(updates.error_message);
  }

  values.push(sessionId);

  await env.DB.prepare(`
    UPDATE sessions SET ${sets.join(", ")} WHERE id = ?
  `).bind(...values).run();
}

/**
 * Handle non-streaming generate request
 */
export async function handleGenerate(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as GenerateRequest;
    const { prompt, sessionId: reqSessionId, inputImages } = body;

    if (!prompt) {
      return Response.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const sessionId = reqSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create or update session in D1 (idempotent)
    await ensureSession(env, sessionId);

    // Get sandbox instance - same sessionId = same persistent container
    const sandbox = getSandbox(env.Sandbox, sessionId);

    // Ensure mount point exists (idempotent - mkdir -p is safe to repeat)
    await sandbox.exec(`mkdir -p /storage`);

    // Mount R2 bucket (idempotent - handles already-mounted case)
    await mountBucketSafe(sandbox, "fashion-shoot-storage", "/storage", {
      endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      provider: "r2",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Create output directories (idempotent)
    await sandbox.exec(`mkdir -p /storage/outputs/${sessionId}/{frames,videos,final}`);

    // Build full prompt with image references
    let fullPrompt = prompt;
    if (inputImages && inputImages.length > 0) {
      const inputFlags = inputImages.map(img => `--input "${img}"`).join(" ");
      fullPrompt = `${prompt}

## Reference Image File Paths (use ALL of these with --input flags in generate-image.ts)
${inputImages.map((img, i) => `- Reference ${i + 1}: ${img}`).join("\n")}

CRITICAL: Pass ALL reference images using multiple --input flags.

Example command:
npx tsx scripts/generate-image.ts --prompt "..." ${inputFlags} --output outputs/hero.png --aspect-ratio 3:2 --resolution 2K`;
    }

    // Run agent (blocking for non-streaming)
    const result = await sandbox.exec("npx tsx /workspace/agent-runner.ts", {
      env: {
        PROMPT: fullPrompt,
        SESSION_ID: sessionId,
        ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
        FAL_KEY: env.FAL_KEY,
        KLING_ACCESS_KEY: env.KLING_ACCESS_KEY,
        KLING_SECRET_KEY: env.KLING_SECRET_KEY,
        HOME: "/root",
        CI: "true",
        CLAUDE_CODE_SKIP_EULA: "true",
        CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "true",
        TERM: "dumb",
        NO_COLOR: "1",
      },
      timeout: 600000, // 10 minutes
    });

    // Parse result
    let agentResult: any;
    try {
      // Find JSON in stdout
      const jsonMatch = result.stdout.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        agentResult = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse agent result:", e);
    }

    // Update session status
    await updateSession(env, sessionId, {
      status: agentResult?.success ? "completed" : "error",
      pipeline_stage: agentResult?.checkpoint?.stage || "unknown",
      error_message: agentResult?.error,
    });

    return Response.json({
      success: agentResult?.success || false,
      sessionId,
      response: agentResult?.response || result.stdout,
      checkpoint: agentResult?.checkpoint,
      awaitingInput: !!agentResult?.checkpoint,
    });
  } catch (error: any) {
    console.error("Generate error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Handle streaming generate request via SSE
 */
export async function handleGenerateStream(
  request: Request,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as GenerateRequest;
    const { prompt, sessionId: reqSessionId, inputImages } = body;

    if (!prompt) {
      return Response.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    const sessionId = reqSessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    // Create transform stream for SSE - return immediately to avoid timeout
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process everything in background to avoid Worker timeout
    ctx.waitUntil((async () => {
      let lastCheckpoint: any = null;

      try {
        // Send session init immediately
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "session_init", sessionId })}\n\n`)
        );

        // Send status update
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Initializing container..." })}\n\n`)
        );

        // Create or update session in D1 (idempotent)
        await ensureSession(env, sessionId);

        // Get sandbox instance - same sessionId = same persistent container
        const sandbox = getSandbox(env.Sandbox, sessionId);

        // Ensure mount point exists and mount R2 (idempotent)
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Mounting storage..." })}\n\n`)
        );
        await sandbox.exec(`mkdir -p /storage`);

        // Mount R2 bucket (idempotent - handles already-mounted case)
        await mountBucketSafe(sandbox, "fashion-shoot-storage", "/storage", {
          endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          provider: "r2",
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
        });

        // Create output directories (idempotent)
        await sandbox.exec(`mkdir -p /storage/outputs/${sessionId}/{frames,videos,final}`);

        // Build full prompt with image references
        let fullPrompt = prompt;
        if (inputImages && inputImages.length > 0) {
          const inputFlags = inputImages.map(img => `--input "${img}"`).join(" ");
          fullPrompt = `${prompt}

## Reference Image File Paths (use ALL of these with --input flags in generate-image.ts)
${inputImages.map((img, i) => `- Reference ${i + 1}: ${img}`).join("\n")}

CRITICAL: Pass ALL reference images using multiple --input flags.

Example command:
npx tsx scripts/generate-image.ts --prompt "..." ${inputFlags} --output outputs/hero.png --aspect-ratio 3:2 --resolution 2K`;
        }

        // Send status update
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Starting agent..." })}\n\n`)
        );

        // Run agent with execStream (non-blocking)
        const execStream = await sandbox.execStream("npx tsx /workspace/agent-runner.ts", {
          env: {
            PROMPT: fullPrompt,
            SESSION_ID: sessionId,
            ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
            FAL_KEY: env.FAL_KEY,
            KLING_ACCESS_KEY: env.KLING_ACCESS_KEY,
            KLING_SECRET_KEY: env.KLING_SECRET_KEY,
            HOME: "/root",
            CI: "true",
            CLAUDE_CODE_SKIP_EULA: "true",
            CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "true",
            TERM: "dumb",
            NO_COLOR: "1",
          },
          timeout: 600000, // 10 minutes
        });

        // Track if we're in "thinking" mode (tool execution)
        let isThinking = false;
        let lastResponse = "";

        for await (const event of parseSSEStream<ExecEvent>(execStream)) {
          // Translate container events to frontend-compatible SSE events
          // DO NOT forward raw stdout/stderr - translate them instead

          if (event.type === "stderr") {
            const data = event.data as string;

            // Parse JSON events from agent-runner
            try {
              const parsed = JSON.parse(data.trim());

              if (parsed.t === "token") {
                lastResponse += parsed.d;
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ type: "text_delta", text: parsed.d })}\n\n`)
                );
              } else if (parsed.t === "thinking") {
                isThinking = true;
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({ type: "message_type_hint", messageType: "thinking" })}\n\n`)
                );
              } else if (parsed.t === "tool") {
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "system",
                    subtype: "tool_call",
                    data: { tool_name: parsed.d }
                  })}\n\n`)
                );
              } else if (parsed.t === "tool_done") {
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "system",
                    subtype: "tool_result"
                  })}\n\n`)
                );
              } else if (parsed.t === "assistant") {
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "assistant_message",
                    messageType: isThinking ? "thinking" : "response"
                  })}\n\n`)
                );
                isThinking = false;
                lastResponse = "";
              }
            } catch {
              // Not JSON - log agent messages
              if (data.includes("[agent]")) {
                console.log("[agent]", data);
              }
            }
          }
          // Checkpoint detection from stdout
          else if (event.type === "stdout") {
            const data = event.data as string;

            // Look for checkpoint markers
            if (data.includes("[checkpoint]")) {
              try {
                const checkpointMatch = data.match(/\[checkpoint\]\s*(\{[\s\S]*?\})/);
                if (checkpointMatch) {
                  lastCheckpoint = JSON.parse(checkpointMatch[1]);
                  await writer.write(
                    encoder.encode(`data: ${JSON.stringify({ type: "checkpoint", checkpoint: lastCheckpoint })}\n\n`)
                  );
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
            // Final JSON result - parse and use response
            else if (data.includes('"success"') && data.includes('"response"')) {
              try {
                const result = JSON.parse(data);
                if (result.response && result.response !== lastResponse) {
                  // If response differs from streamed content, update it
                  // This ensures we have the complete response
                  console.log("[stdout] Final response received");
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
          // Container start event
          else if (event.type === "start") {
            console.log("[container] Agent started");
          }
          // Handle complete
          else if (event.type === "complete") {
            const exitCode = (event as any).exitCode ?? 0;

            // Update session in D1
            await updateSession(env, sessionId, {
              status: exitCode === 0 ? "completed" : "error",
              pipeline_stage: lastCheckpoint?.stage || "unknown",
            });

            // Send complete event
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: "complete",
                sessionId,
                exitCode,
                checkpoint: lastCheckpoint,
                awaitingInput: !!lastCheckpoint,
              })}\n\n`)
            );
          }
        }
      } catch (error: any) {
        console.error("Stream processing error:", error);
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`)
        );

        // Update session as error
        await updateSession(env, sessionId, {
          status: "error",
          error_message: error.message,
        });
      } finally {
        await writer.close();
      }
    })());

    // Return SSE stream immediately
    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  } catch (error: any) {
    console.error("Generate stream error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
