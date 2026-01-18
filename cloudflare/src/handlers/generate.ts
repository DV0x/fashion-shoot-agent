/**
 * Generate Handler - Main agent orchestration via Sandbox container
 *
 * KEY ARCHITECTURE NOTES:
 * 1. getSandbox(env.Sandbox, sessionId) returns a persistent Durable Object stub
 * 2. The same sessionId = same container instance with persistent state
 * 3. Bucket mounts persist across requests to the same sandbox instance
 * 4. Must handle "already mounted" errors gracefully for session continuations
 * 5. Transient DO errors (platform updates, network issues) are retried automatically
 */

import type { Env } from "../index";
import { getSandbox, parseSSEStream, InvalidMountConfigError, type ExecEvent } from "@cloudflare/sandbox";

/**
 * Transient Durable Object errors that should trigger a retry
 * These errors occur during Cloudflare platform updates or network issues
 * and are recoverable by getting a fresh DO stub
 */
const TRANSIENT_DO_ERRORS = [
  "Network connection lost",
  "Durable Object reset because its code was updated",
  "The Durable Object's code has been updated",
  "ReadableStream received over RPC disconnected prematurely",
  "Cannot resolve Durable Object due to transient issue",
  "The Durable Object has been reset",
  "Durable Object storage operation exceeded timeout",
];

/**
 * Check if an error is a transient DO error that should be retried
 */
function isTransientDOError(error: any): boolean {
  const message = error?.message || String(error);
  return TRANSIENT_DO_ERRORS.some(pattern => message.includes(pattern));
}

/**
 * Retry configuration
 */
const RETRY_CONFIG = {
  maxRetries: 2,
  baseDelayMs: 1000,
  maxDelayMs: 5000,
};

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
 * Configuration for agent execution
 */
interface AgentExecutionConfig {
  sessionId: string;
  fullPrompt: string;
  isContinuation: boolean;
  pipelineStage: string;
}

/**
 * Setup sandbox with mounts and create session
 * Returns the sandbox and session for agent execution
 */
async function setupSandboxForExecution(
  env: Env,
  sessionId: string
): Promise<{ sandbox: ReturnType<typeof getSandbox>; setupComplete: boolean }> {
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

  return { sandbox, setupComplete: true };
}

/**
 * Execute agent and stream results
 * Returns an async generator that yields SSE events
 */
async function* executeAgentStream(
  env: Env,
  sandbox: ReturnType<typeof getSandbox>,
  config: AgentExecutionConfig
): AsyncGenerator<{ type: string; data: any }> {
  const { sessionId, fullPrompt, isContinuation, pipelineStage } = config;

  // Create session with env vars
  const session = await getOrCreateContainerSession(sandbox, sessionId, {
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
  });

  // Run agent in the session
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

  // Yield events from the stream
  for await (const event of parseSSEStream<ExecEvent>(execStream)) {
    yield { type: event.type, data: event };
  }
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

      // Build full prompt with image references (once, outside retry loop)
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

      // Retry loop for transient DO errors
      let retryCount = 0;
      let shouldRetry = true;

      while (shouldRetry && retryCount <= RETRY_CONFIG.maxRetries) {
        shouldRetry = false; // Reset for this attempt

        try {
          // Send session init on first attempt
          if (retryCount === 0) {
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ type: "session_init", sessionId })}\n\n`)
            );
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Initializing container..." })}\n\n`)
            );
          } else {
            // Notify client of retry
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: "status",
                message: `Recovering from transient error (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries + 1})...`
              })}\n\n`)
            );
            console.log(`[retry] Attempt ${retryCount + 1} for session ${sessionId}`);
          }

          // Check if session already exists (for continuation detection)
          const existingSession = await env.DB.prepare(`
            SELECT id, pipeline_stage FROM sessions WHERE id = ?
          `).bind(sessionId).first<{ id: string; pipeline_stage: string }>();

          const isExistingSession = !!existingSession;
          const pipelineStage = existingSession?.pipeline_stage || "init";
          // On retry, always treat as continuation since we may have partial progress
          const isContinuation = (isExistingSession && pipelineStage !== "init") || retryCount > 0;

          console.log(`[session] Session ${sessionId}: existing=${isExistingSession}, stage=${pipelineStage}, continuation=${isContinuation}, retry=${retryCount}`);

          // Create or update session in D1 (idempotent)
          await ensureSession(env, sessionId);

          // Setup sandbox with mounts
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Mounting storage..." })}\n\n`)
          );

          const { sandbox: newSandbox } = await setupSandboxForExecution(env, sessionId);
          sandbox = newSandbox;

          // Send status update
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Starting agent..." })}\n\n`)
          );

          // Execute agent and process stream
          const agentStream = executeAgentStream(env, sandbox, {
            sessionId,
            fullPrompt,
            isContinuation,
            pipelineStage,
          });

          for await (const { type: eventType, data: event } of agentStream) {
            // Check if client disconnected
            if (clientDisconnected) {
              console.log(`[lifecycle] Client disconnected, breaking stream loop: ${sessionId}`);
              break;
            }

            // Forward stdout SSE events directly from agent-runner
            if (eventType === "stdout") {
              const data = (event as any).data as string;

              // Forward SSE events (lines starting with "data:")
              for (const line of data.split("\n")) {
                if (line.startsWith("data:")) {
                  try {
                    await writer.write(encoder.encode(line + "\n\n"));
                  } catch {
                    clientDisconnected = true;
                    console.log(`[lifecycle] Client disconnected during write: ${sessionId}`);
                    break;
                  }

                  // Track checkpoint for session update
                  try {
                    const jsonStr = line.substring(5).trim();
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.type === "checkpoint") {
                      lastCheckpoint = parsed.checkpoint;
                      // Update D1 with checkpoint progress
                      await updateSession(env, sessionId, {
                        pipeline_stage: parsed.checkpoint?.stage || pipelineStage,
                      });
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
            // Log stderr for debugging
            else if (eventType === "stderr") {
              const data = (event as any).data as string;
              if (data.includes("[agent]") || data.includes("[tool]")) {
                console.log(data);
              }
            }
            // Container start event
            else if (eventType === "start") {
              console.log("[container] Agent started");
            }
            // Handle complete
            else if (eventType === "complete") {
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
          console.error(`[error] Stream processing error (attempt ${retryCount + 1}):`, error);

          // Check if this is a transient DO error that should be retried
          if (isTransientDOError(error) && retryCount < RETRY_CONFIG.maxRetries && !clientDisconnected) {
            retryCount++;
            shouldRetry = true;

            // Dispose old sandbox stub before retry
            try {
              (sandbox as any)?.dispose?.();
            } catch {}
            sandbox = null;

            // Calculate delay with exponential backoff
            const delay = Math.min(
              RETRY_CONFIG.baseDelayMs * Math.pow(2, retryCount - 1),
              RETRY_CONFIG.maxDelayMs
            );

            console.log(`[retry] Transient DO error detected, retrying in ${delay}ms...`);
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: "status",
                message: `Connection lost, retrying in ${delay / 1000}s...`
              })}\n\n`)
            );

            await new Promise(resolve => setTimeout(resolve, delay));
            continue; // Retry the loop
          }

          // Non-retryable error or max retries exceeded
          hadError = true;

          if (!clientDisconnected) {
            try {
              const errorMessage = retryCount >= RETRY_CONFIG.maxRetries
                ? `${error.message} (after ${retryCount + 1} attempts)`
                : error.message;
              await writer.write(
                encoder.encode(`data: ${JSON.stringify({ type: "error", error: errorMessage })}\n\n`)
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
        }
      } // End retry loop

      // Cleanup
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
