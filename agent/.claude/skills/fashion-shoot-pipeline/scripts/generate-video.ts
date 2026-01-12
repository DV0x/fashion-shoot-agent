#!/usr/bin/env npx tsx
/**
 * generate-video.ts
 *
 * Generate videos from images using Kling AI direct API.
 * Supports frame-pair interpolation with --input-tail for end frame.
 *
 * Usage:
 *   # Single frame video
 *   npx tsx generate-video.ts \
 *     --input frame.png \
 *     --prompt "Camera slowly pushes in..." \
 *     --output video.mp4
 *
 *   # Frame-pair interpolation (start + end frame)
 *   npx tsx generate-video.ts \
 *     --input frame-1.png \
 *     --input-tail frame-2.png \
 *     --prompt "The camera transitions smoothly..." \
 *     --output video.mp4
 */

// Load environment variables from .env file
import "dotenv/config";

import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { parseArgs } from "util";
import { createHmac } from "crypto";

// Types
type Duration = "5" | "10";

interface GenerateVideoOptions {
  inputImage: string;
  inputTailImage?: string;
  prompt: string;
  outputPath: string;
  duration?: Duration;
  negativePrompt?: string;
}

interface KlingTaskResponse {
  code: number;
  message: string;
  request_id: string;
  data: {
    task_id: string;
    task_status: string;
    task_status_msg?: string;
    task_result?: {
      videos: Array<{
        id: string;
        url: string;
        duration: string;
      }>;
    };
  };
}

const KLING_API_BASE = "https://api-singapore.klingai.com";

// Base64URL encode (JWT-safe base64)
function base64UrlEncode(data: string | Buffer): string {
  const base64 = Buffer.isBuffer(data)
    ? data.toString('base64')
    : Buffer.from(data).toString('base64');
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Generate JWT token for Kling API authentication
function generateJwtToken(): string {
  const accessKey = process.env.KLING_ACCESS_KEY;
  const secretKey = process.env.KLING_SECRET_KEY;

  if (!accessKey || !secretKey) {
    throw new Error(
      "KLING_ACCESS_KEY and KLING_SECRET_KEY environment variables are required"
    );
  }

  const now = Math.floor(Date.now() / 1000);

  // JWT Header
  const header = {
    alg: "HS256",
    typ: "JWT"
  };

  // JWT Payload
  const payload = {
    iss: accessKey,           // Issuer: Access Key
    exp: now + 1800,          // Expires in 30 minutes
    nbf: now - 5              // Not before: 5 seconds ago (clock skew buffer)
  };

  // Encode header and payload
  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));

  // Create signature
  const signatureInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac('sha256', secretKey)
    .update(signatureInput)
    .digest();
  const encodedSignature = base64UrlEncode(signature);

  // Return complete JWT
  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
}

// Encode image to Base64 (without data: prefix as required by Kling API)
async function encodeImageBase64(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const buffer = await readFile(filePath);
  // Return raw Base64 without "data:image/...;base64," prefix
  return buffer.toString("base64");
}

// Create video generation task
async function createVideoTask(options: GenerateVideoOptions): Promise<string> {
  const {
    inputImage,
    inputTailImage,
    prompt,
    duration = "5",
    negativePrompt = "blur, distort, and low quality",
  } = options;

  const jwtToken = generateJwtToken();

  console.error(`[Kling] Encoding start frame: ${inputImage}`);
  const imageBase64 = await encodeImageBase64(inputImage);

  // Build request body
  const requestBody: Record<string, unknown> = {
    model_name: "kling-v2-6",
    mode: "pro",
    duration,
    image: imageBase64,
    prompt,
    negative_prompt: negativePrompt,
  };

  // Add end frame if provided (for frame-pair interpolation)
  if (inputTailImage) {
    console.error(`[Kling] Encoding end frame: ${inputTailImage}`);
    const imageTailBase64 = await encodeImageBase64(inputTailImage);
    requestBody.image_tail = imageTailBase64;
    console.error(`[Kling] Frame-pair mode: ${inputImage} → ${inputTailImage}`);
  } else {
    console.error(`[Kling] Single-frame mode: ${inputImage}`);
  }

  console.error(`[Kling] Creating video task...`);
  console.error(`[Kling] Model: kling-v2-6, Mode: pro, Duration: ${duration}s`);
  console.error(`[Kling] Prompt: ${prompt.substring(0, 100)}...`);

  const response = await fetch(`${KLING_API_BASE}/v1/videos/image2video`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${jwtToken}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Kling API error (${response.status}): ${errorText}`);
  }

  const result = (await response.json()) as KlingTaskResponse;

  if (result.code !== 0) {
    throw new Error(`Kling API error: ${result.message}`);
  }

  console.error(`[Kling] Task created: ${result.data.task_id}`);
  return result.data.task_id;
}

// Poll for task completion
async function pollForCompletion(taskId: string): Promise<string> {
  const pollInterval = 5000; // 5 seconds
  const maxAttempts = 120; // 10 minutes max

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    // Generate fresh JWT for each poll (tokens expire in 30 min, but better to be safe)
    const jwtToken = generateJwtToken();

    const response = await fetch(
      `${KLING_API_BASE}/v1/videos/image2video/${taskId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jwtToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Kling API poll error (${response.status}): ${errorText}`);
    }

    const result = (await response.json()) as KlingTaskResponse;

    if (result.code !== 0) {
      throw new Error(`Kling API error: ${result.message}`);
    }

    const status = result.data.task_status;

    if (status === "succeed") {
      if (!result.data.task_result?.videos?.[0]?.url) {
        throw new Error("No video URL in successful response");
      }
      console.error(`[Kling] Task completed successfully!`);
      return result.data.task_result.videos[0].url;
    }

    if (status === "failed") {
      throw new Error(
        `Video generation failed: ${result.data.task_status_msg || "Unknown error"}`
      );
    }

    // Status is "submitted" or "processing"
    console.error(`[Kling] Status: ${status} (attempt ${attempt + 1}/${maxAttempts})...`);
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error("Video generation timed out after 10 minutes");
}

// Download video from URL to local file
async function downloadVideo(url: string, outputPath: string): Promise<void> {
  console.error(`[Kling] Downloading video to ${outputPath}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(outputPath, buffer);

  console.error(`[Kling] Saved: ${outputPath}`);
}

// Generate video using Kling AI
async function generateVideo(options: GenerateVideoOptions): Promise<string> {
  // Create task
  const taskId = await createVideoTask(options);

  // Poll for completion
  const videoUrl = await pollForCompletion(taskId);

  // Download video
  await downloadVideo(videoUrl, options.outputPath);

  return options.outputPath;
}

// Parse command line arguments
function parseArguments() {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      "input-tail": { type: "string", short: "t" },
      prompt: { type: "string", short: "p" },
      output: { type: "string", short: "o" },
      duration: { type: "string", short: "d" },
      "negative-prompt": { type: "string", short: "n" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
generate-video.ts - Generate videos using Kling AI direct API

Usage:
  npx tsx generate-video.ts [options]

Options:
  -i, --input           Start frame image path (required)
  -t, --input-tail      End frame image path (optional, for frame-pair interpolation)
  -p, --prompt          Movement/action prompt (required)
  -o, --output          Output video file path (required)
  -d, --duration        Duration: 5 or 10 seconds (default: 5)
  -n, --negative-prompt What to avoid (default: "blur, distort, and low quality")
  -h, --help            Show this help message

Environment:
  KLING_ACCESS_KEY      Kling AI Access Key (required)
  KLING_SECRET_KEY      Kling AI Secret Key (required)

Examples:
  # Single frame video
  npx tsx generate-video.ts \\
    --input frame-1.png \\
    --prompt "Camera slowly pushes in, model maintains eye contact" \\
    --output video-1.mp4

  # Frame-pair interpolation (start + end frame)
  npx tsx generate-video.ts \\
    --input frame-1.png \\
    --input-tail frame-2.png \\
    --prompt "The camera transitions smoothly between angles" \\
    --output video-1.mp4

Note:
  When using --input-tail for frame-pair mode, camera_control JSON parameter
  is not available. Describe camera movements in the prompt text instead.
`);
    process.exit(0);
  }

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  if (!values.prompt) {
    console.error("Error: --prompt is required");
    process.exit(1);
  }

  if (!values.output) {
    console.error("Error: --output is required");
    process.exit(1);
  }

  const duration = values.duration || "5";
  if (duration !== "5" && duration !== "10") {
    console.error("Error: --duration must be 5 or 10");
    process.exit(1);
  }

  return {
    inputImage: values.input,
    inputTailImage: values["input-tail"],
    prompt: values.prompt,
    outputPath: values.output,
    duration: duration as Duration,
    negativePrompt: values["negative-prompt"],
  };
}

// Main
async function main() {
  try {
    const args = parseArguments();

    const outputPath = await generateVideo({
      inputImage: args.inputImage,
      inputTailImage: args.inputTailImage,
      prompt: args.prompt,
      outputPath: args.outputPath,
      duration: args.duration,
      negativePrompt: args.negativePrompt,
    });

    // Output result path to stdout (for pipeline integration)
    console.log(outputPath);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
