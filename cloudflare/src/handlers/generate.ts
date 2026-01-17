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

/**
 * Get or create a container session - handles SessionAlreadyExists gracefully
 *
 * When the same sessionId is used, the sandbox instance persists and the session
 * may already exist. This function handles that case by retrieving the existing session.
 */
async function getOrCreateContainerSession(
  sandbox: ReturnType<typeof getSandbox>,
  sessionId: string,
  env: Record<string, string>
) {
  const execSessionId = `exec-${sessionId}`;
  try {
    console.log(`[session] Creating session ${execSessionId}`);
    return await sandbox.createSession({ id: execSessionId, env });
  } catch (err: any) {
    if (err.message?.includes('SessionAlreadyExists') || err.message?.includes('already exists')) {
      console.log(`[session] Session exists, retrieving ${execSessionId}`);
      return await sandbox.getSession(execSessionId);
    }
    throw err;
  }
}

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

    // Ensure mount points exist
    await sandbox.exec(`mkdir -p /storage/uploads /workspace/agent/outputs`);

    // Mount uploads to /storage/uploads (for reference images)
    await mountBucketSafe(sandbox, "fashion-shoot-storage", "/storage/uploads", {
      endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      provider: "r2",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
      prefix: "/uploads",
    });

    // Mount outputs directly to agent's working directory with session isolation
    await mountBucketSafe(sandbox, "fashion-shoot-storage", "/workspace/agent/outputs", {
      endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      provider: "r2",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
      prefix: `/outputs/${sessionId}`,
    });

    // Create output subdirectories (idempotent)
    await sandbox.exec(`mkdir -p /workspace/agent/outputs/{frames,videos,final}`);

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

    // Create session with env vars - these persist for ALL commands in the session
    const session = await getOrCreateContainerSession(sandbox, sessionId, {
      // API keys - will be inherited by child processes
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      FAL_KEY: env.FAL_KEY,
      KLING_ACCESS_KEY: env.KLING_ACCESS_KEY,
      KLING_SECRET_KEY: env.KLING_SECRET_KEY,
      // Shell environment
      HOME: "/root",
      CI: "true",
      CLAUDE_CODE_SKIP_EULA: "true",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "true",
      TERM: "dumb",
      NO_COLOR: "1",
    });

    // Run agent (blocking for non-streaming) - only pass command-specific env vars
    const result = await session.exec("npx tsx /workspace/agent-runner.ts", {
      env: {
        PROMPT: fullPrompt,
        SESSION_ID: sessionId,
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
 * Lifecycle state for container management
 */
interface LifecycleState {
  pipelineCompleted: boolean;
  clientDisconnected: boolean;
  hadError: boolean;
}

/**
 * Handle container lifecycle based on what happened during execution
 *
 * Cost-optimized approach (avoids accumulating sleeping containers):
 * - Pipeline complete → Destroy (free resources immediately)
 * - User disconnected → Destroy (avoid hitting container limits)
 * - Error → Destroy (don't pay for broken state)
 * - Normal checkpoint → Keep active (user will continue soon)
 *
 * If user returns after disconnect, context reconstruction via D1 + R2 handles it.
 */
async function handleContainerLifecycle(
  sandbox: ReturnType<typeof getSandbox>,
  sessionId: string,
  state: LifecycleState
): Promise<void> {
  const { pipelineCompleted, clientDisconnected, hadError } = state;

  try {
    if (pipelineCompleted || clientDisconnected || hadError) {
      // Destroy in all these cases to free resources and avoid hitting limits
      const reason = pipelineCompleted ? "pipeline complete"
                   : clientDisconnected ? "client disconnected"
                   : "error occurred";
      await sandbox.destroy();
      console.log(`[lifecycle] Container DESTROYED (${reason}): ${sessionId}`);
    }
    // else: Normal checkpoint pause - container stays active, 1hr timeout applies
    else {
      console.log(`[lifecycle] Container stays ACTIVE (awaiting input): ${sessionId}`);
    }
  } catch (err) {
    console.error(`[lifecycle] Failed to destroy container:`, err);
  } finally {
    // Always dispose the RPC stub to prevent warnings
    try {
      (sandbox as any).dispose?.();
    } catch {}
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

      // Lifecycle state tracking
      let pipelineCompleted = false;
      let clientDisconnected = false;
      let hadError = false;
      let sandbox: ReturnType<typeof getSandbox> | null = null;

      // SSE heartbeat to prevent Cloudflare 100-second proxy timeout
      // Video generation can take 2-3 minutes per clip
      const heartbeatInterval = setInterval(async () => {
        try {
          await writer.write(encoder.encode(': heartbeat\n\n'));
        } catch {
          // Writer closed - client disconnected
          clientDisconnected = true;
        }
      }, 30000);  // Every 30 seconds

      try {
        // Send session init immediately
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "session_init", sessionId })}\n\n`)
        );

        // Send status update
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Initializing container..." })}\n\n`)
        );

        // Check if session already exists (for continuation detection)
        const existingSession = await env.DB.prepare(`
          SELECT id, pipeline_stage FROM sessions WHERE id = ?
        `).bind(sessionId).first<{ id: string; pipeline_stage: string }>();

        const isExistingSession = !!existingSession;
        const pipelineStage = existingSession?.pipeline_stage || "init";
        const isContinuation = isExistingSession && pipelineStage !== "init";

        console.log(`[session] Session ${sessionId}: existing=${isExistingSession}, stage=${pipelineStage}, continuation=${isContinuation}`);

        // Create or update session in D1 (idempotent)
        await ensureSession(env, sessionId);

        // Get sandbox instance - same sessionId = same persistent container
        sandbox = getSandbox(env.Sandbox, sessionId);

        // Ensure mount points exist
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Mounting storage..." })}\n\n`)
        );
        await sandbox.exec(`mkdir -p /storage/uploads /workspace/agent/outputs`);

        // Mount uploads to /storage/uploads (for reference images)
        await mountBucketSafe(sandbox, "fashion-shoot-storage", "/storage/uploads", {
          endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          provider: "r2",
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
          prefix: "/uploads", // Only mount uploads subdirectory
        });

        // Mount outputs directly to agent's working directory with session isolation
        // Agent writes to outputs/ -> goes directly to R2 at outputs/{sessionId}/
        await mountBucketSafe(sandbox, "fashion-shoot-storage", "/workspace/agent/outputs", {
          endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          provider: "r2",
          credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
          },
          prefix: `/outputs/${sessionId}`, // Session isolation - must start with /
        });

        // Create output subdirectories (idempotent)
        await sandbox.exec(`mkdir -p /workspace/agent/outputs/{frames,videos,final}`);

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

        // Create session with env vars - these persist for ALL commands in the session
        // including child processes spawned by Claude SDK's Bash tool
        const session = await getOrCreateContainerSession(sandbox, sessionId, {
          // API keys - will be inherited by child processes
          ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
          FAL_KEY: env.FAL_KEY,
          KLING_ACCESS_KEY: env.KLING_ACCESS_KEY,
          KLING_SECRET_KEY: env.KLING_SECRET_KEY,
          // Shell environment
          HOME: "/root",
          CI: "true",
          CLAUDE_CODE_SKIP_EULA: "true",
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "true",
          TERM: "dumb",
          NO_COLOR: "1",
        });

        // Run agent in the session - pass command-specific env vars
        // Include CONTINUE and PIPELINE_STAGE for existing sessions
        const execStream = await session.execStream("npx tsx /workspace/agent-runner.ts", {
          env: {
            PROMPT: fullPrompt,
            SESSION_ID: sessionId,
            ...(isContinuation ? {
              CONTINUE: "true",
              PIPELINE_STAGE: pipelineStage,
            } : {}),
          },
          timeout: 600000, // 10 minutes
        });

        for await (const event of parseSSEStream<ExecEvent>(execStream)) {
          // Check if client disconnected
          if (clientDisconnected) {
            console.log(`[lifecycle] Client disconnected, breaking stream loop: ${sessionId}`);
            break;
          }

          // Forward stdout SSE events directly from agent-runner
          // agent-runner.ts now emits SSE-formatted events to stdout

          if (event.type === "stdout") {
            const data = event.data as string;

            // Forward SSE events (lines starting with "data:")
            // agent-runner outputs: data: {"type":"text_delta",...}\n
            for (const line of data.split("\n")) {
              if (line.startsWith("data:")) {
                // Forward directly - already SSE formatted
                try {
                  await writer.write(encoder.encode(line + "\n\n"));
                } catch {
                  // Client disconnected
                  clientDisconnected = true;
                  console.log(`[lifecycle] Client disconnected during write: ${sessionId}`);
                  break;
                }

                // Track checkpoint for session update
                try {
                  const jsonStr = line.substring(5).trim(); // Remove "data:" prefix
                  const parsed = JSON.parse(jsonStr);
                  if (parsed.type === "checkpoint") {
                    lastCheckpoint = parsed.checkpoint;
                    // Check if pipeline is complete
                    if (parsed.checkpoint?.stage === "complete") {
                      pipelineCompleted = true;
                    }
                  }
                } catch {
                  // Ignore parse errors
                }
              }
            }
            if (clientDisconnected) break;
          }
          // Log stderr for debugging (agent logs, errors)
          else if (event.type === "stderr") {
            const data = event.data as string;
            if (data.includes("[agent]") || data.includes("[tool]")) {
              console.log(data);
            }
          }
          // Container start event
          else if (event.type === "start") {
            console.log("[container] Agent started");
          }
          // Handle complete
          else if (event.type === "complete") {
            const exitCode = (event as any).exitCode ?? 0;

            if (exitCode !== 0) {
              hadError = true;
            }

            // Update session in D1
            await updateSession(env, sessionId, {
              status: exitCode === 0 ? "completed" : "error",
              pipeline_stage: lastCheckpoint?.stage || "unknown",
            });

            // Send complete event (if client still connected)
            if (!clientDisconnected) {
              try {
                await writer.write(
                  encoder.encode(`data: ${JSON.stringify({
                    type: "complete",
                    sessionId,
                    exitCode,
                    checkpoint: lastCheckpoint,
                    awaitingInput: !!lastCheckpoint,
                  })}\n\n`)
                );
              } catch {
                clientDisconnected = true;
              }
            }
          }
        }
      } catch (error: any) {
        hadError = true;
        console.error("Stream processing error:", error);

        if (!clientDisconnected) {
          try {
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`)
            );
          } catch {
            clientDisconnected = true;
          }
        }

        // Update session as error
        await updateSession(env, sessionId, {
          status: "error",
          error_message: error.message,
        });
      } finally {
        clearInterval(heartbeatInterval);

        // Handle container lifecycle based on what happened
        if (sandbox) {
          await handleContainerLifecycle(sandbox, sessionId, {
            pipelineCompleted,
            clientDisconnected,
            hadError,
          });
        }

        try {
          await writer.close();
        } catch {
          // Writer already closed
        }
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
