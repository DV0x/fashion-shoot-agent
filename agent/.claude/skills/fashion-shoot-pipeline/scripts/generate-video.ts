#!/usr/bin/env npx tsx
/**
 * generate-video.ts
 *
 * Generate videos from images using FAL.ai Kling 2.6 Pro API.
 *
 * Usage:
 *   npx tsx generate-video.ts \
 *     --input frame.png \
 *     --prompt "Camera slowly pushes in..." \
 *     --output video.mp4 \
 *     --duration 5
 */

// Load environment variables from .env file
import "dotenv/config";

import { fal } from "@fal-ai/client";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import { parseArgs } from "util";

// Types
type Duration = "5" | "10";

interface GenerateVideoOptions {
  inputImage: string;
  prompt: string;
  outputPath: string;
  duration?: Duration;
  negativePrompt?: string;
  generateAudio?: boolean;
}

interface FalVideoResult {
  video: {
    url: string;
  };
}

// Configure FAL client
function configureFal(): void {
  const apiKey = process.env.FAL_KEY;
  if (!apiKey) {
    throw new Error("FAL_KEY environment variable is required");
  }
  fal.config({ credentials: apiKey });
}

// Upload local file to FAL storage
async function uploadToFalStorage(filePath: string): Promise<string> {
  if (!existsSync(filePath)) {
    throw new Error(`Input file not found: ${filePath}`);
  }

  const buffer = await readFile(filePath);
  const fileName = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase();

  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
  };

  const mimeType = mimeTypes[ext] || "image/png";
  const file = new File([buffer], fileName, { type: mimeType });

  console.error(`Uploading ${fileName} to FAL storage...`);
  const url = await fal.storage.upload(file);
  console.error(`Uploaded: ${url}`);

  return url;
}

// Download video from URL to local file
async function downloadVideo(url: string, outputPath: string): Promise<void> {
  console.error(`Downloading video to ${outputPath}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download video: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(outputPath, buffer);

  console.error(`Saved: ${outputPath}`);
}

// Generate video using FAL.ai Kling 2.6 Pro
async function generateVideo(options: GenerateVideoOptions): Promise<string> {
  const {
    inputImage,
    prompt,
    outputPath,
    duration = "5",
    negativePrompt = "blur, distort, and low quality",
    generateAudio = false, // Disable audio by default for fashion videos
  } = options;

  configureFal();

  const modelId = "fal-ai/kling-video/v2.6/pro/image-to-video";

  console.error(`Using model: ${modelId}`);
  console.error(`Prompt: ${prompt.substring(0, 100)}...`);
  console.error(`Duration: ${duration}s`);
  console.error(`Audio: ${generateAudio ? "enabled" : "disabled"}`);

  // Upload input image
  const imageUrl = await uploadToFalStorage(inputImage);

  // Build input payload
  const input = {
    prompt,
    image_url: imageUrl,
    duration,
    negative_prompt: negativePrompt,
    generate_audio: generateAudio,
  };

  // Call FAL.ai API
  console.error("Generating video (this may take a few minutes)...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.subscribe(modelId, {
    input: input as any,
    logs: true,
    pollInterval: 5000, // Poll every 5 seconds
    onQueueUpdate: (update) => {
      if (update.status === "IN_QUEUE") {
        console.error(`[FAL] In queue...`);
      } else if (update.status === "IN_PROGRESS" && update.logs) {
        update.logs.forEach((log) => {
          console.error(`[FAL] ${log.message}`);
        });
      }
    },
  }) as { data: FalVideoResult; requestId: string };

  if (!result.data.video || !result.data.video.url) {
    throw new Error("No video returned from FAL.ai");
  }

  // Download video
  const videoUrl = result.data.video.url;
  await downloadVideo(videoUrl, outputPath);

  // Return the output path
  return outputPath;
}

// Parse command line arguments
function parseArguments() {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      prompt: { type: "string", short: "p" },
      output: { type: "string", short: "o" },
      duration: { type: "string", short: "d" },
      "negative-prompt": { type: "string", short: "n" },
      audio: { type: "boolean", short: "a" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
generate-video.ts - Generate videos from images using FAL.ai Kling 2.6 Pro

Usage:
  npx tsx generate-video.ts [options]

Options:
  -i, --input           Input image file path (required)
  -p, --prompt          Camera movement/action prompt (required)
  -o, --output          Output video file path (required)
  -d, --duration        Duration: 5 or 10 seconds (default: 5)
  -n, --negative-prompt What to avoid (default: "blur, distort, and low quality")
  -a, --audio           Enable audio generation (default: false)
  -h, --help            Show this help message

Examples:
  # Basic video generation (no audio)
  npx tsx generate-video.ts \\
    --input frame-1.png \\
    --prompt "Camera slowly pushes in, model maintains eye contact" \\
    --output video-1.mp4

  # 10-second video with audio
  npx tsx generate-video.ts \\
    --input frame-2.png \\
    --prompt "Model says 'Welcome to the collection'" \\
    --output video-2.mp4 \\
    --duration 10 \\
    --audio
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
    prompt: values.prompt,
    outputPath: values.output,
    duration: duration as Duration,
    negativePrompt: values["negative-prompt"],
    generateAudio: values.audio ?? false,
  };
}

// Main
async function main() {
  try {
    const args = parseArguments();

    const outputPath = await generateVideo({
      inputImage: args.inputImage,
      prompt: args.prompt,
      outputPath: args.outputPath,
      duration: args.duration,
      negativePrompt: args.negativePrompt,
      generateAudio: args.generateAudio,
    });

    // Output result path to stdout (for pipeline integration)
    console.log(outputPath);

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
