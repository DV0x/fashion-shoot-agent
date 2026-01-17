/**
 * Fashion Shoot Agent - Cloudflare Worker Entry Point
 * Routes requests to handlers and serves static assets
 */

import { proxyToSandbox, Sandbox as BaseSandbox } from "@cloudflare/sandbox";

/**
 * Custom Sandbox class with extended idle timeout
 *
 * sleepAfter = '1h' keeps the container alive for 1 hour of inactivity.
 * This preserves SDK context between user interactions during the pipeline.
 * Without this, container would sleep after ~30 seconds, losing all state.
 */
export class Sandbox extends BaseSandbox {
  override sleepAfter: string | number = '1h';  // 1 hour idle timeout (default is much shorter)
}

// Import handlers (to be created)
import { handleGenerate, handleGenerateStream } from "./handlers/generate";
import { handleUpload } from "./handlers/upload";
import { handleSessions, handleSessionById, handleSessionPipeline, handleSessionAssets, handleContinueStream } from "./handlers/sessions";
import { handleMedia } from "./handlers/media";

export interface Env {
  // Durable Object for container orchestration
  Sandbox: DurableObjectNamespace<Sandbox>;

  // D1 database for sessions
  DB: D1Database;

  // R2 bucket for file storage
  STORAGE: R2Bucket;

  // Static assets (React frontend)
  ASSETS: Fetcher;

  // API Keys (secrets)
  ANTHROPIC_API_KEY: string;
  FAL_KEY: string;
  KLING_ACCESS_KEY: string;
  KLING_SECRET_KEY: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;

  // Environment variables
  CF_ACCOUNT_ID: string;
  ENVIRONMENT: string;
}

// CORS headers for API responses
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-ID",
};

// Add CORS headers to response
function withCors(response: Response): Response {
  const newHeaders = new Headers(response.headers);
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

// JSON response helper
function jsonResponse(data: any, status = 200): Response {
  return withCors(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// Error response helper
function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ success: false, error: message }, status);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // Handle sandbox proxy (for container communication)
      const proxyResponse = await proxyToSandbox(request, env);
      if (proxyResponse) return proxyResponse;

      // CORS preflight
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      // ============================================
      // API Routes
      // ============================================

      if (path.startsWith("/api/")) {
        const apiPath = path.replace("/api", "");

        // Health check
        if (apiPath === "/health" && request.method === "GET") {
          return jsonResponse({
            status: "healthy",
            agent: "fashion-shoot-agent",
            timestamp: new Date().toISOString(),
            environment: env.ENVIRONMENT,
            config: {
              hasAnthropicKey: !!env.ANTHROPIC_API_KEY,
              hasFalKey: !!env.FAL_KEY,
              hasKlingKey: !!env.KLING_ACCESS_KEY,
            },
          });
        }

        // File upload
        if (apiPath === "/upload" && request.method === "POST") {
          return withCors(await handleUpload(request, env));
        }

        // Generate (non-streaming)
        if (apiPath === "/generate" && request.method === "POST") {
          return withCors(await handleGenerate(request, env, ctx));
        }

        // Generate (streaming SSE)
        if (apiPath === "/generate-stream" && request.method === "POST") {
          return withCors(await handleGenerateStream(request, env, ctx));
        }

        // List sessions
        if (apiPath === "/sessions" && request.method === "GET") {
          return withCors(await handleSessions(request, env));
        }

        // Session routes with ID
        const sessionMatch = apiPath.match(/^\/sessions\/([^\/]+)(\/.*)?$/);
        if (sessionMatch) {
          const sessionId = sessionMatch[1];
          const subPath = sessionMatch[2] || "";

          // Get session by ID
          if (subPath === "" && request.method === "GET") {
            return withCors(await handleSessionById(sessionId, env));
          }

          // Get pipeline status
          if (subPath === "/pipeline" && request.method === "GET") {
            return withCors(await handleSessionPipeline(sessionId, env));
          }

          // Get session assets
          if (subPath === "/assets" && request.method === "GET") {
            return withCors(await handleSessionAssets(sessionId, env));
          }

          // Continue session (streaming)
          if (subPath === "/continue-stream" && request.method === "POST") {
            return withCors(await handleContinueStream(request, sessionId, env, ctx));
          }
        }

        // Media files (from R2)
        if (apiPath.startsWith("/media/")) {
          return withCors(await handleMedia(request, env, apiPath.replace("/media/", "")));
        }

        // 404 for unknown API routes
        return errorResponse("API endpoint not found", 404);
      }

      // ============================================
      // Static file routes (R2)
      // ============================================

      // Serve outputs from R2
      if (path.startsWith("/outputs/")) {
        const key = path.replace("/outputs/", "");
        return withCors(await handleMedia(request, env, `outputs/${key}`));
      }

      // Serve uploads from R2
      if (path.startsWith("/uploads/")) {
        const key = path.replace("/uploads/", "");
        return withCors(await handleMedia(request, env, `uploads/${key}`));
      }

      // ============================================
      // Static Assets (React Frontend)
      // ============================================

      return env.ASSETS.fetch(request);

    } catch (error: any) {
      console.error("Worker error:", error);
      return errorResponse(error.message || "Internal server error", 500);
    }
  },
};
