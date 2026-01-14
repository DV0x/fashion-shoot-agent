/**
 * Sessions Handler - Manage session state via D1
 *
 * KEY ARCHITECTURE NOTES for handleContinueStream:
 * - getSandbox(env.Sandbox, sessionId) returns a PERSISTENT Durable Object stub
 * - The same sessionId = same container instance with state preserved
 * - Bucket mounts persist across requests - do NOT re-mount on continuation
 */

import type { Env } from "../index";
import { getSandbox, parseSSEStream, type ExecEvent } from "@cloudflare/sandbox";

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
 * Continue session with streaming response
 *
 * IMPORTANT: This is for CONTINUING an existing session.
 * The sandbox instance is persistent - the bucket is likely already mounted.
 * We use mountBucketSafe to handle both fresh and continuation cases.
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

    // Verify session exists in D1
    const session = await env.DB.prepare(`
      SELECT id, status FROM sessions WHERE id = ?
    `).bind(sessionId).first();

    if (!session) {
      return Response.json(
        { success: false, error: "Session not found" },
        { status: 404 }
      );
    }

    // Update session status to active
    await env.DB.prepare(`
      UPDATE sessions SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?
    `).bind(sessionId).run();

    // Get EXISTING sandbox instance for this session
    // Same sessionId = same persistent container with state preserved
    const sandbox = getSandbox(env.Sandbox, sessionId);

    // Ensure mount point exists (idempotent)
    await sandbox.exec(`mkdir -p /storage`);

    // Mount R2 bucket IDEMPOTENTLY - if already mounted, this continues gracefully
    // This is critical for session continuation where the bucket is already mounted
    await mountBucketSafe(sandbox, "fashion-shoot-storage", "/storage", {
      endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      provider: "r2",
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });

    // Run agent with execStream
    const execStream = await sandbox.execStream("npx tsx /workspace/agent-runner.ts", {
      env: {
        PROMPT: prompt,
        SESSION_ID: sessionId,
        CONTINUE: "true",
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

    // Create transform stream for SSE
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Process in background
    ctx.waitUntil((async () => {
      try {
        for await (const event of parseSSEStream<ExecEvent>(execStream)) {
          const sseEvent = {
            ...event,
            sessionId,
          };
          await writer.write(encoder.encode(`data: ${JSON.stringify(sseEvent)}\n\n`));
        }
      } catch (error: any) {
        console.error("Continue stream error:", error);
        await writer.write(
          encoder.encode(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`)
        );
      } finally {
        await writer.close();
      }
    })());

    // Return SSE stream
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
