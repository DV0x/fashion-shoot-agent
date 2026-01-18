/**
 * Sessions Handler - Manage session state via D1
 *
 * KEY ARCHITECTURE NOTES for handleContinueStream:
 * - getSandbox(env.Sandbox, sessionId) returns a PERSISTENT Durable Object stub
 * - The same sessionId = same container instance with state preserved
 * - Bucket mounts persist across requests - do NOT re-mount on continuation
 * - Transient DO errors (platform updates, network issues) are retried automatically
 */

import type { Env } from "../index";
import { getSandbox, parseSSEStream, type ExecEvent } from "@cloudflare/sandbox";

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

/**
 * Mount R2 bucket idempotently - handles already-mounted case gracefully
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
 * List all active sessions
 */
export async function handleSessions(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const result = await env.DB.prepare(`
      SELECT id, created_at, updated_at, status, pipeline_stage, total_cost_usd, total_turns
      FROM sessions
      WHERE status IN ('active', 'completed')
      ORDER BY updated_at DESC
      LIMIT 50
    `).all();

    return Response.json({
      success: true,
      count: result.results.length,
      sessions: result.results,
    });
  } catch (error: any) {
    console.error("List sessions error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get session by ID
 */
export async function handleSessionById(
  sessionId: string,
  env: Env
): Promise<Response> {
  try {
    const session = await env.DB.prepare(`
      SELECT * FROM sessions WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return Response.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      session,
    });
  } catch (error: any) {
    console.error("Get session error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get pipeline status for a session
 */
export async function handleSessionPipeline(
  sessionId: string,
  env: Env
): Promise<Response> {
  try {
    // Get session
    const session = await env.DB.prepare(`
      SELECT id, pipeline_stage, status FROM sessions WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return Response.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Get latest checkpoint
    const checkpoint = await env.DB.prepare(`
      SELECT stage, status, artifact_keys, message, created_at
      FROM checkpoints
      WHERE session_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `).bind(sessionId).first();

    return Response.json({
      success: true,
      sessionId,
      pipeline: {
        stage: session.pipeline_stage,
        status: session.status,
        checkpoint: checkpoint || null,
      },
    });
  } catch (error: any) {
    console.error("Get pipeline error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get assets for a session
 */
export async function handleSessionAssets(
  sessionId: string,
  env: Env
): Promise<Response> {
  try {
    const assets = await env.DB.prepare(`
      SELECT asset_type, file_name, r2_key, file_size, mime_type, created_at
      FROM session_assets
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).bind(sessionId).all();

    // Group by type
    const grouped: Record<string, any[]> = {};
    for (const asset of assets.results) {
      const type = asset.asset_type as string;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        fileName: asset.file_name,
        url: `/${asset.r2_key}`,
        size: asset.file_size,
        mimeType: asset.mime_type,
        createdAt: asset.created_at,
      });
    }

    return Response.json({
      success: true,
      sessionId,
      assets: grouped,
    });
  } catch (error: any) {
    console.error("Get assets error:", error);
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
 * Setup sandbox with mounts for session continuation
 * Returns the sandbox instance ready for execution
 */
async function setupSandboxForContinuation(
  env: Env,
  sessionId: string
): Promise<ReturnType<typeof getSandbox>> {
  const sandbox = getSandbox(env.Sandbox, sessionId);

  // Ensure mount points exist (idempotent)
  await sandbox.exec(`mkdir -p /storage/uploads /workspace/agent/outputs`);

  // Mount R2 bucket IDEMPOTENTLY - if already mounted, this continues gracefully
  // Must match generate.ts mount configuration exactly for consistent behavior

  // Mount 1: Uploads directory (shared reference images)
  await mountBucketSafe(sandbox, "fashion-shoot-storage", "/storage/uploads", {
    endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    provider: "r2",
    credentials: {
      accessKeyId: env.AWS_ACCESS_KEY_ID,
      secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
    },
    prefix: "/uploads",
  });

  // Mount 2: Session-isolated outputs directly to agent's working directory
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

  return sandbox;
}

/**
 * Execute agent continuation and stream results
 * Returns an async generator that yields exec events
 */
async function* executeContinuationStream(
  env: Env,
  sandbox: ReturnType<typeof getSandbox>,
  sessionId: string,
  prompt: string,
  pipelineStage: string
): AsyncGenerator<ExecEvent> {
  // Create execution session with env vars - these persist for ALL commands in the session
  // including child processes spawned by Claude SDK's Bash tool
  const execSession = await getOrCreateContainerSession(sandbox, sessionId, {
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

  // Run agent in the session - pass command-specific env vars including pipeline stage
  const execStream = await execSession.execStream("npx tsx /workspace/agent-runner.ts", {
    env: {
      PROMPT: prompt,
      SESSION_ID: sessionId,
      CONTINUE: "true",
      PIPELINE_STAGE: pipelineStage,
    },
    timeout: 600000, // 10 minutes
  });

  // Yield events from the stream
  for await (const event of parseSSEStream<ExecEvent>(execStream)) {
    yield event;
  }
}

/**
 * Continue session with streaming response
 *
 * IMPORTANT: This is for CONTINUING an existing session.
 * The sandbox instance is persistent - the bucket is likely already mounted.
 * We use mountBucketSafe to handle both fresh and continuation cases.
 * Transient DO errors (platform updates, network issues) are retried automatically.
 */
export async function handleContinueStream(
  request: Request,
  sessionId: string,
  env: Env,
  ctx: ExecutionContext
): Promise<Response> {
  try {
    const body = await request.json() as { prompt?: string };
    const { prompt } = body;

    if (!prompt) {
      return Response.json(
        { success: false, error: "Prompt is required" },
        { status: 400 }
      );
    }

    // Verify session exists and get current pipeline stage from D1
    const dbSession = await env.DB.prepare(`
      SELECT id, status, pipeline_stage FROM sessions WHERE id = ?
    `).bind(sessionId).first<{ id: string; status: string; pipeline_stage: string }>();

    if (!dbSession) {
      return Response.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

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

      // Get the initial pipeline stage (may be updated on retry)
      let pipelineStage = dbSession.pipeline_stage || "init";

      // Retry loop for transient DO errors
      let retryCount = 0;
      let shouldRetry = true;

      while (shouldRetry && retryCount <= RETRY_CONFIG.maxRetries) {
        shouldRetry = false; // Reset for this attempt

        try {
          // Update session status to active
          await env.DB.prepare(`
            UPDATE sessions SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).bind(sessionId).run();

          // On retry, refresh pipeline stage from D1 (may have been updated before crash)
          if (retryCount > 0) {
            const refreshedSession = await env.DB.prepare(`
              SELECT pipeline_stage FROM sessions WHERE id = ?
            `).bind(sessionId).first<{ pipeline_stage: string }>();
            if (refreshedSession) {
              pipelineStage = refreshedSession.pipeline_stage || pipelineStage;
            }

            // Notify client of retry
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({
                type: "status",
                message: `Recovering from transient error (attempt ${retryCount + 1}/${RETRY_CONFIG.maxRetries + 1})...`
              })}\n\n`)
            );
            console.log(`[retry] Attempt ${retryCount + 1} for session ${sessionId}, stage: ${pipelineStage}`);
          } else {
            // First attempt - send status
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Resuming session..." })}\n\n`)
            );
          }

          // Setup sandbox with mounts
          sandbox = await setupSandboxForContinuation(env, sessionId);

          // Send status update
          await writer.write(
            encoder.encode(`data: ${JSON.stringify({ type: "status", message: "Starting agent..." })}\n\n`)
          );

          // Execute agent and process stream
          const agentStream = executeContinuationStream(env, sandbox, sessionId, prompt, pipelineStage);

          for await (const event of agentStream) {
            // Check if client disconnected
            if (clientDisconnected) {
              console.log(`[lifecycle] Client disconnected, breaking stream loop: ${sessionId}`);
              break;
            }

            // Forward stdout SSE events directly from agent-runner
            if (event.type === "stdout") {
              const data = event.data as string;

              // Forward SSE events (lines starting with "data:")
              for (const line of data.split("\n")) {
                if (line.startsWith("data:")) {
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
                    const jsonStr = line.substring(5).trim();
                    const parsed = JSON.parse(jsonStr);
                    if (parsed.type === "checkpoint") {
                      lastCheckpoint = parsed.checkpoint;
                      // Update D1 with checkpoint progress
                      await env.DB.prepare(`
                        UPDATE sessions SET pipeline_stage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
                      `).bind(parsed.checkpoint?.stage || pipelineStage, sessionId).run();
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
            // Log stderr for debugging
            else if (event.type === "stderr") {
              const data = event.data as string;
              if (data.includes("[agent]") || data.includes("[tool]")) {
                console.log(data);
              }
            }
            // Container lifecycle events
            else if (event.type === "start") {
              console.log("[container] Continue agent started");
            }
            else if (event.type === "complete") {
              const exitCode = (event as any).exitCode ?? 0;

              if (exitCode !== 0) {
                hadError = true;
              }

              // Update session in D1
              await env.DB.prepare(`
                UPDATE sessions SET
                  status = ?,
                  pipeline_stage = ?,
                  updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
              `).bind(
                exitCode === 0 ? "completed" : "error",
                lastCheckpoint?.stage || "unknown",
                sessionId
              ).run();

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
          console.error(`[error] Continue stream error (attempt ${retryCount + 1}):`, error);

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
          await env.DB.prepare(`
            UPDATE sessions SET status = 'error', error_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
          `).bind(error.message, sessionId).run();
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
    console.error("Continue stream error:", error);
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
