#!/usr/bin/env npx tsx
/**
 * crop-frames.ts
 *
 * Programmatically crop a contact sheet grid into individual frames.
 * Uses sharp for fast, reliable image processing.
 *
 * Usage:
 *   npx tsx crop-frames.ts \
 *     --input outputs/contact-sheet.png \
 *     --output-dir outputs/frames/ \
 *     --rows 2 \
 *     --cols 3
 *
 * This will create:
 *   outputs/frames/frame-1.png (row 0, col 0)
 *   outputs/frames/frame-2.png (row 0, col 1)
 *   outputs/frames/frame-3.png (row 0, col 2)
 *   outputs/frames/frame-4.png (row 1, col 0)
 *   outputs/frames/frame-5.png (row 1, col 1)
 *   outputs/frames/frame-6.png (row 1, col 2)
 */

import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";
import { parseArgs } from "util";

// Types
interface CropFramesOptions {
  inputPath: string;
  outputDir: string;
  rows: number;
  cols: number;
  gutterX?: number; // Horizontal gutter (between columns)
  gutterY?: number; // Vertical gutter (between rows)
  outputFormat?: "png" | "jpeg" | "webp";
  prefix?: string;
}

interface CropResult {
  frameNumber: number;
  row: number;
  col: number;
  outputPath: string;
  width: number;
  height: number;
}

// Crop contact sheet into individual frames
async function cropFrames(options: CropFramesOptions): Promise<CropResult[]> {
  const {
    inputPath,
    outputDir,
    rows,
    cols,
    gutterX = 26,
    gutterY = 24,
    outputFormat = "png",
    prefix = "frame",
  } = options;

  // Validate input file exists
  if (!existsSync(inputPath)) {
    throw new Error(`Input file not found: ${inputPath}`);
  }

  // Create output directory if it doesn't exist
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.error(`Created output directory: ${outputDir}`);
  }

  // Load image and get dimensions
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error("Could not read image dimensions");
  }

  const { width, height } = metadata;
  console.error(`Input image: ${width} x ${height} pixels`);

  // Calculate cell dimensions (accounting for gutters between cells)
  // totalWidth = cols * cellWidth + (cols - 1) * gutterX
  // So: cellWidth = (totalWidth - (cols - 1) * gutterX) / cols
  const totalGutterWidth = (cols - 1) * gutterX;
  const totalGutterHeight = (rows - 1) * gutterY;
  const cellWidth = Math.floor((width - totalGutterWidth) / cols);
  const cellHeight = Math.floor((height - totalGutterHeight) / rows);
  console.error(`Grid: ${cols} cols x ${rows} rows`);
  console.error(`Gutter: ${gutterX}px horizontal, ${gutterY}px vertical`);
  console.error(`Cell size: ${cellWidth} x ${cellHeight} pixels`);

  const results: CropResult[] = [];
  let frameNumber = 1;

  // Iterate through grid (row by row, left to right)
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      // Position accounts for gutters: x = col * (cellWidth + gutterX)
      const x = col * (cellWidth + gutterX);
      const y = row * (cellHeight + gutterY);

      // Handle edge cases for last row/column (clamp to image bounds)
      const extractWidth = Math.min(cellWidth, width - x);
      const extractHeight = Math.min(cellHeight, height - y);

      const outputPath = path.join(outputDir, `${prefix}-${frameNumber}.${outputFormat}`);

      console.error(`Cropping frame ${frameNumber} (row ${row}, col ${col}): x=${x}, y=${y}, ${extractWidth}x${extractHeight}`);

      // Crop and save
      await sharp(inputPath)
        .extract({
          left: x,
          top: y,
          width: extractWidth,
          height: extractHeight,
        })
        .toFormat(outputFormat)
        .toFile(outputPath);

      results.push({
        frameNumber,
        row,
        col,
        outputPath,
        width: extractWidth,
        height: extractHeight,
      });

      console.error(`Saved: ${outputPath}`);
      frameNumber++;
    }
  }

  return results;
}

// Parse command line arguments
function parseArguments() {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      "output-dir": { type: "string", short: "o" },
      rows: { type: "string", short: "r" },
      cols: { type: "string", short: "c" },
      "gutter-x": { type: "string" },
      "gutter-y": { type: "string" },
      gutter: { type: "string", short: "g" }, // Sets both gutterX and gutterY
      format: { type: "string", short: "f" },
      prefix: { type: "string", short: "p" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
crop-frames.ts - Crop contact sheet grid into individual frames

Usage:
  npx tsx crop-frames.ts [options]

Options:
  -i, --input       Input contact sheet image path (required)
  -o, --output-dir  Output directory for cropped frames (required)
  -r, --rows        Number of rows in the grid (default: 2)
  -c, --cols        Number of columns in the grid (default: 3)
  -g, --gutter      Pixels between grid cells, sets both X and Y
      --gutter-x    Horizontal pixels between columns (default: 26)
      --gutter-y    Vertical pixels between rows (default: 24)
  -f, --format      Output format: png, jpeg, webp (default: png)
  -p, --prefix      Output filename prefix (default: "frame")
  -h, --help        Show this help message

Examples:
  # Standard 2x3 contact sheet (6 frames)
  npx tsx crop-frames.ts \\
    --input outputs/contact-sheet.png \\
    --output-dir outputs/frames/ \\
    --rows 2 \\
    --cols 3

  # Contact sheet with uniform gutters between cells
  npx tsx crop-frames.ts \\
    --input outputs/contact-sheet.png \\
    --output-dir outputs/frames/ \\
    --rows 2 \\
    --cols 3 \\
    --gutter 16

  # Contact sheet with different horizontal/vertical gutters
  npx tsx crop-frames.ts \\
    --input outputs/contact-sheet.png \\
    --output-dir outputs/frames/ \\
    --rows 2 \\
    --cols 3 \\
    --gutter-x 16 \\
    --gutter-y 15

  # Custom grid with JPEG output
  npx tsx crop-frames.ts \\
    --input grid.png \\
    --output-dir ./frames/ \\
    --rows 3 \\
    --cols 4 \\
    --format jpeg

Output:
  Creates frame-1.png through frame-N.png in the output directory.
  Frames are numbered left-to-right, top-to-bottom.

Frame Layout (2x3 grid):
  ┌─────────┬─────────┬─────────┐
  │ frame-1 │ frame-2 │ frame-3 │
  ├─────────┼─────────┼─────────┤
  │ frame-4 │ frame-5 │ frame-6 │
  └─────────┴─────────┴─────────┘
`);
    process.exit(0);
  }

  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }

  if (!values["output-dir"]) {
    console.error("Error: --output-dir is required");
    process.exit(1);
  }

  const rows = values.rows ? parseInt(values.rows, 10) : 2;
  const cols = values.cols ? parseInt(values.cols, 10) : 3;

  // Parse gutter values: --gutter-x and --gutter-y override --gutter
  // Defaults optimized for 2528×1696 contact sheets (2x3 grid)
  const baseGutter = values.gutter ? parseInt(values.gutter, 10) : null;
  const gutterX = values["gutter-x"] ? parseInt(values["gutter-x"], 10) : (baseGutter ?? 26);
  const gutterY = values["gutter-y"] ? parseInt(values["gutter-y"], 10) : (baseGutter ?? 24);

  if (isNaN(rows) || rows < 1) {
    console.error("Error: --rows must be a positive integer");
    process.exit(1);
  }

  if (isNaN(cols) || cols < 1) {
    console.error("Error: --cols must be a positive integer");
    process.exit(1);
  }

  if (isNaN(gutterX) || gutterX < 0) {
    console.error("Error: --gutter-x must be a non-negative integer");
    process.exit(1);
  }

  if (isNaN(gutterY) || gutterY < 0) {
    console.error("Error: --gutter-y must be a non-negative integer");
    process.exit(1);
  }

  return {
    inputPath: values.input,
    outputDir: values["output-dir"],
    rows,
    cols,
    gutterX,
    gutterY,
    outputFormat: (values.format || "png") as "png" | "jpeg" | "webp",
    prefix: values.prefix || "frame",
  };
}

// Main
async function main() {
  try {
    const args = parseArguments();

    console.error(`\nCropping contact sheet into ${args.rows * args.cols} frames...\n`);

    const results = await cropFrames({
      inputPath: args.inputPath,
      outputDir: args.outputDir,
      rows: args.rows,
      cols: args.cols,
      gutterX: args.gutterX,
      gutterY: args.gutterY,
      outputFormat: args.outputFormat,
      prefix: args.prefix,
    });

    console.error(`\nSuccessfully cropped ${results.length} frames.\n`);

    // Output JSON result to stdout (for pipeline integration)
    console.log(JSON.stringify({
      success: true,
      framesCount: results.length,
      frames: results.map(r => r.outputPath),
    }, null, 2));

  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
