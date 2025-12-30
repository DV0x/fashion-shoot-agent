#!/usr/bin/env npx tsx
/**
 * crop-frames.ts
 *
 * Crop a contact sheet grid into individual frames using hybrid detection.
 * Auto-detects grid structure using OpenCV edge detection and projection profiles.
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

import cv, { Mat } from "@techstark/opencv-js";
import sharp from "sharp";
import { existsSync, mkdirSync } from "fs";
import * as path from "path";
import { parseArgs } from "util";

// Types
interface GridInfo {
  rows: number;
  cols: number;
  cellWidth: number;
  cellHeight: number;
  gutterX: number;
  gutterY: number;
  offsetX: number;
  offsetY: number;
}

interface CropResult {
  frameNumber: number;
  row: number;
  col: number;
  outputPath: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Wait for OpenCV to be ready
async function waitForOpenCV(): Promise<void> {
  return new Promise((resolve) => {
    if (cv.Mat) {
      resolve();
    } else {
      cv.onRuntimeInitialized = () => resolve();
    }
  });
}

// Load image as OpenCV Mat
async function loadImageAsMat(
  imagePath: string
): Promise<{ mat: Mat; width: number; height: number }> {
  const { data, info } = await sharp(imagePath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height } = info;
  const mat = new cv.Mat(height, width, cv.CV_8UC4);
  mat.data.set(data);

  return { mat, width, height };
}

// Create projection profile by summing pixel values along an axis
function createProjectionProfile(
  edges: Mat,
  axis: "horizontal" | "vertical"
): number[] {
  const profile: number[] = [];

  if (axis === "vertical") {
    for (let x = 0; x < edges.cols; x++) {
      let sum = 0;
      for (let y = 0; y < edges.rows; y++) {
        sum += edges.ucharAt(y, x);
      }
      profile.push(sum);
    }
  } else {
    for (let y = 0; y < edges.rows; y++) {
      let sum = 0;
      for (let x = 0; x < edges.cols; x++) {
        sum += edges.ucharAt(y, x);
      }
      profile.push(sum);
    }
  }

  return profile;
}

// Find peaks in a profile (local maxima above threshold)
function findPeaks(
  profile: number[],
  minDistance: number,
  threshold?: number
): number[] {
  const maxVal = Math.max(...profile);
  const thresh = threshold ?? maxVal * 0.3;
  const peaks: number[] = [];

  for (let i = 1; i < profile.length - 1; i++) {
    if (
      profile[i] > thresh &&
      profile[i] >= profile[i - 1] &&
      profile[i] >= profile[i + 1]
    ) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] >= minDistance) {
        peaks.push(i);
      } else if (profile[i] > profile[peaks[peaks.length - 1]]) {
        peaks[peaks.length - 1] = i;
      }
    }
  }

  return peaks;
}

// Cluster nearby peaks and return cluster centers
function clusterPeaks(peaks: number[], clusterRadius: number): number[] {
  if (peaks.length === 0) return [];

  const clusters: number[][] = [];
  let currentCluster: number[] = [peaks[0]];

  for (let i = 1; i < peaks.length; i++) {
    if (peaks[i] - peaks[i - 1] <= clusterRadius) {
      currentCluster.push(peaks[i]);
    } else {
      clusters.push(currentCluster);
      currentCluster = [peaks[i]];
    }
  }
  clusters.push(currentCluster);

  return clusters.map((cluster) => {
    const sum = cluster.reduce((a, b) => a + b, 0);
    return Math.round(sum / cluster.length);
  });
}

// Select N most evenly spaced values from an array
function selectEvenlySpaced(values: number[], count: number): number[] {
  if (values.length <= count) return values;

  const sorted = [...values].sort((a, b) => a - b);
  const idealSpacing = (sorted[sorted.length - 1] - sorted[0]) / (count + 1);

  const selected: number[] = [];
  let lastPos = sorted[0] - idealSpacing;

  for (const val of sorted) {
    if (val - lastPos >= idealSpacing * 0.7 && selected.length < count) {
      selected.push(val);
      lastPos = val;
    }
  }

  if (selected.length < count) {
    return sorted.slice(0, count);
  }

  return selected;
}

// Detect grid structure from image
async function detectGrid(
  imagePath: string,
  expectedRows: number,
  expectedCols: number
): Promise<GridInfo> {
  await waitForOpenCV();
  console.error("OpenCV loaded");

  // Load image
  console.error("Loading image...");
  const { mat, width, height } = await loadImageAsMat(imagePath);
  console.error(`Image size: ${width}×${height}`);

  // Convert to grayscale
  const gray = new cv.Mat();
  cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

  // Apply Gaussian blur
  const blurred = new cv.Mat();
  cv.GaussianBlur(gray, blurred, new cv.Size(3, 3), 0);

  // Canny edge detection
  console.error("Detecting edges...");
  const edges = new cv.Mat();
  cv.Canny(blurred, edges, 50, 150);

  // Create projection profiles
  console.error("Creating projection profiles...");
  const verticalProfile = createProjectionProfile(edges, "vertical");
  const horizontalProfile = createProjectionProfile(edges, "horizontal");

  // Find peaks
  const expectedCellWidth = width / expectedCols;
  const expectedCellHeight = height / expectedRows;
  const minDistanceX = expectedCellWidth * 0.5;
  const minDistanceY = expectedCellHeight * 0.5;

  let verticalPeaks = findPeaks(verticalProfile, minDistanceX);
  let horizontalPeaks = findPeaks(horizontalProfile, minDistanceY);

  verticalPeaks = clusterPeaks(verticalPeaks, 20);
  horizontalPeaks = clusterPeaks(horizontalPeaks, 20);

  console.error(`Found ${verticalPeaks.length} vertical peaks: ${verticalPeaks.join(", ")}`);
  console.error(`Found ${horizontalPeaks.length} horizontal peaks: ${horizontalPeaks.join(", ")}`);

  // Analyze grid structure
  const gridInfo = analyzeGridStructure(
    verticalPeaks,
    horizontalPeaks,
    width,
    height,
    expectedRows,
    expectedCols
  );

  // Cleanup OpenCV matrices
  mat.delete();
  gray.delete();
  blurred.delete();
  edges.delete();

  return gridInfo;
}

// Analyze detected peaks to determine grid structure
function analyzeGridStructure(
  verticalPeaks: number[],
  horizontalPeaks: number[],
  imageWidth: number,
  imageHeight: number,
  expectedRows: number,
  expectedCols: number
): GridInfo {
  const sortedVertical = [...verticalPeaks].sort((a, b) => a - b);
  const sortedHorizontal = [...horizontalPeaks].sort((a, b) => a - b);

  // Separate edge peaks from internal gutter peaks
  const edgeThresholdX = imageWidth * 0.05;
  const edgeThresholdY = imageHeight * 0.05;

  // Find edge peaks
  const leftEdge = sortedVertical.find((p) => p < edgeThresholdX) ?? 0;
  const rightEdge =
    [...sortedVertical].reverse().find((p) => p > imageWidth - edgeThresholdX) ??
    imageWidth;
  const topEdge = sortedHorizontal.find((p) => p < edgeThresholdY) ?? 0;
  const bottomEdge =
    [...sortedHorizontal].reverse().find((p) => p > imageHeight - edgeThresholdY) ??
    imageHeight;

  console.error(`Edges - Left: ${leftEdge}, Right: ${rightEdge}, Top: ${topEdge}, Bottom: ${bottomEdge}`);

  // Find internal gutters
  const innerVertical = sortedVertical.filter(
    (p) => p > edgeThresholdX && p < imageWidth - edgeThresholdX
  );
  const innerHorizontal = sortedHorizontal.filter(
    (p) => p > edgeThresholdY && p < imageHeight - edgeThresholdY
  );

  console.error(`Inner vertical gutters: ${innerVertical.join(", ")}`);
  console.error(`Inner horizontal gutters: ${innerHorizontal.join(", ")}`);

  // Select gutter positions
  const expectedInternalVertical = expectedCols - 1;
  const expectedInternalHorizontal = expectedRows - 1;

  const gutterXPositions =
    innerVertical.length >= expectedInternalVertical
      ? selectEvenlySpaced(innerVertical, expectedInternalVertical)
      : innerVertical;

  const gutterYPositions =
    innerHorizontal.length >= expectedInternalHorizontal
      ? selectEvenlySpaced(innerHorizontal, expectedInternalHorizontal)
      : innerHorizontal;

  console.error(`Selected vertical gutters: ${gutterXPositions.join(", ")}`);
  console.error(`Selected horizontal gutters: ${gutterYPositions.join(", ")}`);

  // Calculate gutter sizes
  let gutterWidth = 0;
  let gutterHeight = 0;

  if (gutterXPositions.length > 0) {
    const contentWidth = rightEdge - leftEdge;
    const expectedCellWidth = contentWidth / expectedCols;
    const firstCellEnd = gutterXPositions[0];
    const firstCellWidth = firstCellEnd - leftEdge;
    gutterWidth = Math.max(0, Math.round((expectedCellWidth - firstCellWidth) * 2));
  }

  if (gutterYPositions.length > 0) {
    const contentHeight = bottomEdge - topEdge;
    const expectedCellHeight = contentHeight / expectedRows;
    const firstCellEnd = gutterYPositions[0];
    const firstCellHeight = firstCellEnd - topEdge;
    gutterHeight = Math.max(0, Math.round((expectedCellHeight - firstCellHeight) * 2));
  }

  // Fallback: estimate from margins
  if (gutterWidth === 0) {
    gutterWidth = Math.round(leftEdge * 2);
  }
  if (gutterHeight === 0) {
    gutterHeight = Math.round(topEdge * 2);
  }

  console.error(`Estimated gutter: ${gutterWidth}px wide, ${gutterHeight}px tall`);

  // Calculate cell dimensions
  const totalContentWidth = rightEdge - leftEdge;
  const totalContentHeight = bottomEdge - topEdge;

  const cellWidth = Math.floor(
    (totalContentWidth - gutterWidth * (expectedCols - 1)) / expectedCols
  );
  const cellHeight = Math.floor(
    (totalContentHeight - gutterHeight * (expectedRows - 1)) / expectedRows
  );

  console.error(`Calculated cell size: ${cellWidth}×${cellHeight}`);

  return {
    rows: expectedRows,
    cols: expectedCols,
    cellWidth,
    cellHeight,
    gutterX: gutterWidth,
    gutterY: gutterHeight,
    offsetX: leftEdge,
    offsetY: topEdge,
  };
}

// Crop frames using detected grid info
async function cropFrames(
  imagePath: string,
  grid: GridInfo,
  outputDir: string,
  outputFormat: "png" | "jpeg" | "webp",
  prefix: string
): Promise<CropResult[]> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    console.error(`Created output directory: ${outputDir}`);
  }

  const results: CropResult[] = [];
  let frameNumber = 1;

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const x = grid.offsetX + col * (grid.cellWidth + grid.gutterX);
      const y = grid.offsetY + row * (grid.cellHeight + grid.gutterY);
      const outputPath = path.join(outputDir, `${prefix}-${frameNumber}.${outputFormat}`);

      console.error(
        `Cropping frame ${frameNumber} (row ${row}, col ${col}): x=${x}, y=${y}, ${grid.cellWidth}×${grid.cellHeight}`
      );

      await sharp(imagePath)
        .extract({
          left: x,
          top: y,
          width: grid.cellWidth,
          height: grid.cellHeight,
        })
        .toFormat(outputFormat)
        .toFile(outputPath);

      results.push({
        frameNumber,
        row,
        col,
        outputPath,
        x,
        y,
        width: grid.cellWidth,
        height: grid.cellHeight,
      });

      console.error(`  Saved: ${outputPath}`);
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
      format: { type: "string", short: "f" },
      prefix: { type: "string", short: "p" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
crop-frames.ts - Crop contact sheet grid into individual frames

Uses hybrid detection: OpenCV edge detection + projection profiles
to auto-detect grid structure. No manual gutter configuration needed.

Usage:
  npx tsx crop-frames.ts [options]

Options:
  -i, --input       Input contact sheet image path (required)
  -o, --output-dir  Output directory for cropped frames (required)
  -r, --rows        Number of rows in the grid (default: 2)
  -c, --cols        Number of columns in the grid (default: 3)
  -f, --format      Output format: png, jpeg, webp (default: png)
  -p, --prefix      Output filename prefix (default: "frame")
  -h, --help        Show this help message

Examples:
  # Standard 2x3 contact sheet (6 frames)
  npx tsx crop-frames.ts \\
    --input outputs/contact-sheet.png \\
    --output-dir outputs/frames/

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
  All frames have uniform dimensions.

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

  if (isNaN(rows) || rows < 1) {
    console.error("Error: --rows must be a positive integer");
    process.exit(1);
  }

  if (isNaN(cols) || cols < 1) {
    console.error("Error: --cols must be a positive integer");
    process.exit(1);
  }

  return {
    inputPath: values.input,
    outputDir: values["output-dir"],
    rows,
    cols,
    outputFormat: (values.format || "png") as "png" | "jpeg" | "webp",
    prefix: values.prefix || "frame",
  };
}

// Main
async function main() {
  try {
    const args = parseArguments();

    // Validate input file exists
    if (!existsSync(args.inputPath)) {
      throw new Error(`Input file not found: ${args.inputPath}`);
    }

    console.error(`\nCropping contact sheet into ${args.rows * args.cols} frames...\n`);

    // Detect grid structure
    console.error("--- Detecting Grid Structure ---\n");
    const grid = await detectGrid(args.inputPath, args.rows, args.cols);

    console.error("\nDetected grid parameters:");
    console.error(`  Cell size: ${grid.cellWidth}×${grid.cellHeight}`);
    console.error(`  Gutter: ${grid.gutterX}px horizontal, ${grid.gutterY}px vertical`);
    console.error(`  Offset: ${grid.offsetX}px left, ${grid.offsetY}px top`);

    // Crop frames
    console.error("\n--- Cropping Frames ---\n");
    const results = await cropFrames(
      args.inputPath,
      grid,
      args.outputDir,
      args.outputFormat,
      args.prefix
    );

    console.error(`\nSuccessfully cropped ${results.length} frames.\n`);

    // Output JSON result to stdout (for pipeline integration)
    console.log(
      JSON.stringify(
        {
          success: true,
          framesCount: results.length,
          grid: {
            cellWidth: grid.cellWidth,
            cellHeight: grid.cellHeight,
            gutterX: grid.gutterX,
            gutterY: grid.gutterY,
            offsetX: grid.offsetX,
            offsetY: grid.offsetY,
          },
          frames: results.map((r) => ({
            frameNumber: r.frameNumber,
            outputPath: r.outputPath,
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
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
