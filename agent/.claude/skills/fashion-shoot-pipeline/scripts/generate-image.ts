#!/usr/bin/env npx tsx
/**
 * generate-image.ts
 *
 * Generate images using FAL.ai Nano Banana Pro API.
 * Supports both text-to-image and image-to-image (with references).
 *
 * Usage:
 *   npx tsx generate-image.ts \
 *     --prompt "Editorial fashion photo..." \
 *     --input ref1.jpg --input ref2.jpg \
 *     --output hero.png \
 *     --aspect-ratio 3:2 \
 *     --resolution 2K
 */

// Load environment variables from .env file
import "dotenv/config";

import { fal } from "@fal-ai/client";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";
import * as path from "path";
import { parseArgs } from "util";

// Types
type AspectRatio = "21:9" | "16:9" | "3:2" | "4:3" | "5:4" | "1:1" | "4:5" | "3:4" | "2:3" | "9:16" | "auto";
type Resolution = "1K" | "2K" | "4K";
type OutputFormat = "jpeg" | "png" | "webp";

interface GenerateImageOptions {
  prompt: string;
  inputImages?: string[];
  outputPath: string;
  aspectRatio?: AspectRatio;
  resolution?: Resolution;
  outputFormat?: OutputFormat;
  numImages?: number;
}

interface FalImageResult {
  images: Array<{
    url: string;
    file_name: string;
    content_type: string;
  }>;
  description: string;
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

// Download image from URL to local file
async function downloadImage(url: string, outputPath: string): Promise<void> {
  console.error(`Downloading result to ${outputPath}...`);

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  await writeFile(outputPath, buffer);

  console.error(`Saved: ${outputPath}`);
}

// Generate image using FAL.ai
async function generateImage(options: GenerateImageOptions): Promise<string> {
  const {
    prompt,
    inputImages = [],
    outputPath,
    aspectRatio = "3:2",
    resolution = "1K",
    outputFormat = "png",
    numImages = 1,
  } = options;

  configureFal();

  // Determine which endpoint to use
  const hasInputImages = inputImages.length > 0;
  const modelId = hasInputImages
    ? "fal-ai/nano-banana-pro/edit"  // Image-to-image
    : "fal-ai/nano-banana-pro";       // Text-to-image

  console.error(`Using model: ${modelId}`);
  console.error(`Prompt: ${prompt.substring(0, 100)}...`);

  // Upload input images if provided
  let imageUrls: string[] = [];
  if (hasInputImages) {
    console.error(`Uploading ${inputImages.length} reference image(s)...`);
    imageUrls = await Promise.all(inputImages.map(uploadToFalStorage));
  }

  // Build input payload based on whether we have reference images
  const baseInput = {
    prompt,
    aspect_ratio: aspectRatio,
    resolution,
    output_format: outputFormat,
    num_images: numImages,
  };

  const input = hasInputImages
    ? { ...baseInput, image_urls: imageUrls }
    : baseInput;

  // Call FAL.ai API
  console.error("Generating image...");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await fal.subscribe(modelId, {
    input: input as any,
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS" && update.logs) {
        update.logs.forEach((log) => {
          console.error(`[FAL] ${log.message}`);
        });
      }
    },
  }) as { data: FalImageResult; requestId: string };

  if (!result.data.images || result.data.images.length === 0) {
    throw new Error("No images returned from FAL.ai");
  }

  // Download first image
  const imageUrl = result.data.images[0].url;
  await downloadImage(imageUrl, outputPath);

  // Return the output path
  return outputPath;
}

// Parse command line arguments
function parseArguments() {
  const { values } = parseArgs({
    options: {
      prompt: { type: "string", short: "p" },
      input: { type: "string", short: "i", multiple: true },
      output: { type: "string", short: "o" },
      "aspect-ratio": { type: "string", short: "a" },
      resolution: { type: "string", short: "r" },
      format: { type: "string", short: "f" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
generate-image.ts - Generate images using FAL.ai Nano Banana Pro

Usage:
  npx tsx generate-image.ts [options]

Options:
  -p, --prompt        Image generation prompt (required)
  -i, --input         Input reference image(s) (can be specified multiple times)
  -o, --output        Output file path (required)
  -a, --aspect-ratio  Aspect ratio: 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16 (default: 3:2)
  -r, --resolution    Resolution: 1K, 2K, 4K (default: 1K)
  -f, --format        Output format: jpeg, png, webp (default: png)
  -h, --help          Show this help message

Examples:
  # Text-to-image
  npx tsx generate-image.ts \\
    --prompt "Fashion editorial, model in red dress" \\
    --output hero.png \\
    --resolution 2K

  # Image-to-image with references
  npx tsx generate-image.ts \\
    --prompt "Fashion editorial combining these references" \\
    --input model.jpg --input outfit.jpg \\
    --output hero.png \\
    --aspect-ratio 3:2
`);
    process.exit(0);
  }

  if (!values.prompt) {
    console.error("Error: --prompt is required");
    process.exit(1);
  }

  if (!values.output) {
    console.error("Error: --output is required");
    process.exit(1);
  }

  return {
    prompt: values.prompt,
    inputImages: values.input || [],
    outputPath: values.output,
    aspectRatio: (values["aspect-ratio"] || "3:2") as AspectRatio,
    resolution: (values.resolution || "1K") as Resolution,
    outputFormat: (values.format || "png") as OutputFormat,
  };
}

// Main
async function main() {
  try {
    const args = parseArguments();

    const outputPath = await generateImage({
      prompt: args.prompt,
      inputImages: args.inputImages,
      outputPath: args.outputPath,
      aspectRatio: args.aspectRatio,
      resolution: args.resolution,
      outputFormat: args.outputFormat,
    });

    // Output result path to stdout (for pipeline integration)
    console.log(outputPath);

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
