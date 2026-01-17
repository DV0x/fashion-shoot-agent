#!/usr/bin/env npx tsx
/**
 * resize-frames.ts
 *
 * Resize/crop frames to a target aspect ratio.
 * Useful for converting frames to 16:9 (landscape/YouTube) or 9:16 (portrait/TikTok/Reels).
 *
 * Usage:
 *   npx tsx resize-frames.ts \
 *     --input-dir outputs/frames/ \
 *     --output-dir outputs/frames/ \
 *     --aspect-ratio 16:9
 *
 * Aspect ratios:
 *   - 16:9  (landscape - YouTube, desktop)
 *   - 9:16  (portrait - TikTok, Reels, Stories)
 *   - 4:3   (classic)
 *   - 3:4   (portrait classic)
 *   - 1:1   (square - Instagram)
 */

import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync, renameSync } from "fs";
import * as path from "path";
import { parseArgs } from "util";

/**
 * Emit progress as SSE event to stdout (forwarded to client by generate.ts handler)
 */
function emitProgress(message: string): void {
  console.log(`data: ${JSON.stringify({ type: "script_status", message })}\n`);
}

// Supported aspect ratios
const ASPECT_RATIOS: Record<string, number> = {
  "16:9": 16 / 9,
  "9:16": 9 / 16,
  "4:3": 4 / 3,
  "3:4": 3 / 4,
  "1:1": 1,
  "3:2": 3 / 2,
  "2:3": 2 / 3,
};

interface ResizeResult {
  inputPath: string;
  outputPath: string;
  originalWidth: number;
  originalHeight: number;
  newWidth: number;
  newHeight: number;
  cropX: number;
  cropY: number;
}

/**
 * Calculate crop dimensions to achieve target aspect ratio
 * Crops from center to maintain subject focus
 */
function calculateCropDimensions(
  width: number,
  height: number,
  targetRatio: number
): { cropWidth: number; cropHeight: number; x: number; y: number } {
  const currentRatio = width / height;

  let cropWidth: number;
  let cropHeight: number;

  if (currentRatio > targetRatio) {
    // Image is wider than target - crop horizontally
    cropHeight = height;
    cropWidth = Math.round(height * targetRatio);
  } else {
    // Image is taller than target - crop vertically
    cropWidth = width;
    cropHeight = Math.round(width / targetRatio);
  }

  // Center the crop
  const x = Math.round((width - cropWidth) / 2);
  const y = Math.round((height - cropHeight) / 2);

  return { cropWidth, cropHeight, x, y };
}

/**
 * Resize a single frame to target aspect ratio
 * Supports in-place updates by using temp file when input === output
 */
async function resizeFrame(
  inputPath: string,
  outputPath: string,
  targetRatio: number,
  outputFormat: "png" | "jpeg" | "webp"
): Promise<ResizeResult> {
  // Get original dimensions
  const metadata = await sharp(inputPath).metadata();
  const { width: originalWidth, height: originalHeight } = metadata;

  if (!originalWidth || !originalHeight) {
    throw new Error(`Could not read dimensions from ${inputPath}`);
  }

  // Calculate crop
  const { cropWidth, cropHeight, x, y } = calculateCropDimensions(
    originalWidth,
    originalHeight,
    targetRatio
  );

  // Check if we need to use a temp file (same input/output path)
  const isSameFile = path.resolve(inputPath) === path.resolve(outputPath);
  const actualOutputPath = isSameFile
    ? path.join(path.dirname(outputPath), `.${path.basename(outputPath)}.tmp`)
    : outputPath;

  // Perform crop
  await sharp(inputPath)
    .extract({
      left: x,
      top: y,
      width: cropWidth,
      height: cropHeight,
    })
    .toFormat(outputFormat)
    .toFile(actualOutputPath);

  // If using temp file, rename to final path (atomic operation)
  if (isSameFile) {
    renameSync(actualOutputPath, outputPath);
  }

  return {
    inputPath,
    outputPath,
    originalWidth,
    originalHeight,
    newWidth: cropWidth,
    newHeight: cropHeight,
    cropX: x,
    cropY: y,
  };
}

/**
 * Find all image files in a directory
 */
function findImageFiles(dir: string): string[] {
  const extensions = [".png", ".jpg", ".jpeg", ".webp"];
  const files = readdirSync(dir);

  return files
    .filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return extensions.includes(ext);
    })
    .map((file) => path.join(dir, file))
    .sort();
}

// Parse command line arguments
function parseArguments() {
  const { values } = parseArgs({
    options: {
      "input-dir": { type: "string", short: "i" },
      "output-dir": { type: "string", short: "o" },
      "aspect-ratio": { type: "string", short: "a" },
      format: { type: "string", short: "f" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
resize-frames.ts - Resize frames to a target aspect ratio

Crops from center to maintain subject focus. Useful for converting
frames to different formats (YouTube 16:9, TikTok 9:16, etc.)

Usage:
  npx tsx resize-frames.ts [options]

Options:
  -i, --input-dir     Input directory containing frames (required)
  -o, --output-dir    Output directory (defaults to input-dir, overwrites)
  -a, --aspect-ratio  Target aspect ratio (required)
                      Supported: 16:9, 9:16, 4:3, 3:4, 1:1, 3:2, 2:3
  -f, --format        Output format: png, jpeg, webp (default: png)
  -h, --help          Show this help message

Examples:
  # Convert to 16:9 (landscape) for YouTube
  npx tsx resize-frames.ts \\
    --input-dir outputs/frames/ \\
    --aspect-ratio 16:9

  # Convert to 9:16 (portrait) for TikTok/Reels
  npx tsx resize-frames.ts \\
    --input-dir outputs/frames/ \\
    --aspect-ratio 9:16

  # Convert to square for Instagram
  npx tsx resize-frames.ts \\
    --input-dir outputs/frames/ \\
    --output-dir outputs/frames-square/ \\
    --aspect-ratio 1:1
`);
    process.exit(0);
  }

  if (!values["input-dir"]) {
    console.error("Error: --input-dir is required");
    process.exit(1);
  }

  if (!values["aspect-ratio"]) {
    console.error("Error: --aspect-ratio is required");
    console.error("Supported ratios:", Object.keys(ASPECT_RATIOS).join(", "));
    process.exit(1);
  }

  const aspectRatio = values["aspect-ratio"];
  if (!ASPECT_RATIOS[aspectRatio]) {
    console.error(`Error: Unsupported aspect ratio "${aspectRatio}"`);
    console.error("Supported ratios:", Object.keys(ASPECT_RATIOS).join(", "));
    process.exit(1);
  }

  return {
    inputDir: values["input-dir"],
    outputDir: values["output-dir"] || values["input-dir"],
    aspectRatio,
    targetRatio: ASPECT_RATIOS[aspectRatio],
    outputFormat: (values.format || "png") as "png" | "jpeg" | "webp",
  };
}

// Main
async function main() {
  try {
    const args = parseArguments();

    // Validate input directory exists
    if (!existsSync(args.inputDir)) {
      throw new Error(`Input directory not found: ${args.inputDir}`);
    }

    // Create output directory if needed
    if (args.outputDir !== args.inputDir && !existsSync(args.outputDir)) {
      mkdirSync(args.outputDir, { recursive: true });
      emitProgress(`[Resize] Created output directory`);
    }

    // Find all image files
    const imageFiles = findImageFiles(args.inputDir);
    if (imageFiles.length === 0) {
      throw new Error(`No image files found in ${args.inputDir}`);
    }

    emitProgress(`[Resize] Resizing ${imageFiles.length} frames to ${args.aspectRatio}`);

    const results: ResizeResult[] = [];

    for (const inputPath of imageFiles) {
      const filename = path.basename(inputPath);
      const ext = path.extname(filename);
      const basename = path.basename(filename, ext);
      const outputFilename = `${basename}.${args.outputFormat}`;
      const outputPath = path.join(args.outputDir, outputFilename);

      emitProgress(`[Resize] Processing: ${filename}`);

      const result = await resizeFrame(
        inputPath,
        outputPath,
        args.targetRatio,
        args.outputFormat
      );

      emitProgress(`[Resize] ${result.originalWidth}x${result.originalHeight} → ${result.newWidth}x${result.newHeight}`);

      results.push(result);
    }

    emitProgress(`[Resize] Successfully resized ${results.length} frames to ${args.aspectRatio}`);

    // Output JSON result to stdout (for pipeline integration)
    console.log(
      JSON.stringify(
        {
          success: true,
          aspectRatio: args.aspectRatio,
          framesCount: results.length,
          frames: results.map((r) => ({
            inputPath: r.inputPath,
            outputPath: r.outputPath,
            originalSize: `${r.originalWidth}x${r.originalHeight}`,
            newSize: `${r.newWidth}x${r.newHeight}`,
          })),
        },
        null,
        2
      )
    );
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
