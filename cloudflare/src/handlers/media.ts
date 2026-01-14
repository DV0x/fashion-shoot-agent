/**
 * Media Handler - Serve files from R2 bucket
 */

import type { Env } from "../index";

// MIME type mapping
const mimeTypes: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".json": "application/json",
  ".txt": "text/plain",
};

function getMimeType(key: string): string {
  const ext = key.substring(key.lastIndexOf(".")).toLowerCase();
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Parse Range header into R2 range format
 */
function parseRangeHeader(rangeHeader: string, fileSize: number): { offset: number; length: number } | null {
  const match = rangeHeader.match(/bytes=(\d*)-(\d*)/);
  if (!match) return null;

  const start = match[1] ? parseInt(match[1], 10) : 0;
  const end = match[2] ? parseInt(match[2], 10) : fileSize - 1;

  if (start > end || start >= fileSize) return null;

  return { offset: start, length: Math.min(end - start + 1, fileSize - start) };
}

/**
 * Handle media file requests from R2
 */
export async function handleMedia(
  request: Request,
  env: Env,
  key: string
): Promise<Response> {
  // Handle range requests for video streaming
  const rangeHeader = request.headers.get("Range");

  try {
    // First get object metadata to know size for range parsing
    const headObject = await env.STORAGE.head(key);
    if (!headObject) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Parse range if present
    const range = rangeHeader ? parseRangeHeader(rangeHeader, headObject.size) : null;

    // Get object with optional range
    const object = await env.STORAGE.get(key, range ? { range } : undefined);

    if (!object) {
      return new Response(JSON.stringify({ error: "File not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const headers = new Headers();
    headers.set("Content-Type", getMimeType(key));
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("ETag", object.etag);

    // Handle range requests for video
    if (range) {
      const { offset, length } = range;
      headers.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${headObject.size}`);
      headers.set("Content-Length", String(length));
      headers.set("Accept-Ranges", "bytes");

      return new Response(object.body, {
        status: 206,
        headers,
      });
    }

    // Full file response
    headers.set("Content-Length", String(object.size));
    headers.set("Accept-Ranges", "bytes");

    return new Response(object.body, {
      status: 200,
      headers,
    });
  } catch (error: any) {
    console.error("R2 get error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
