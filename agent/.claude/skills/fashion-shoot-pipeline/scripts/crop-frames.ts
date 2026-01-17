#!/usr/bin/env npx tsx
/**
 * crop-frames.ts
 *
 * Crop a contact sheet grid into individual frames using variance-based detection.
 * Auto-detects grid structure by finding uniform (low-variance) gutter regions.
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

/**
 * Emit progress as SSE event to stdout (forwarded to client by generate.ts handler)
 */
function emitProgress(message: string): void {
  console.log(`data: ${JSON.stringify({ type: "script_status", message })}\n`);
}

// Types
interface CellBoundary {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface NormalizedDimensions {
  width: number;
  height: number;
}

interface GutterRegion {
  start: number;
  end: number;
  width: number;
  center: number;
}

interface GridInfo {
  rows: number;
  cols: number;
  cells: CellBoundary[]; // Per-cell boundaries, indexed by frame number (row-major order)
  // Kept for debugging/logging purposes
  detectedGutterX: number;
  detectedGutterY: number;
  verticalGutters?: GutterRegion[];
  horizontalGutters?: GutterRegion[];
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

// Calculate variance of pixel values in a region
function calculateVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const squaredDiffs = values.map((v) => (v - mean) ** 2);
  return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
}

// Calculate variance profile for an axis (used for adaptive threshold)
function calculateVarianceProfile(
  gray: Mat,
  axis: "vertical" | "horizontal"
): number[] {
  const size = axis === "vertical" ? gray.cols : gray.rows;
  const perpSize = axis === "vertical" ? gray.rows : gray.cols;

  // Sample lines from 10% to 90% in 5% steps
  const sampleLines: number[] = [];
  for (let pct = 10; pct <= 90; pct += 5) {
    sampleLines.push(Math.floor(perpSize * (pct / 100)));
  }

  const profile: number[] = [];

  for (let i = 0; i < size; i++) {
    const values: number[] = [];
    for (const samplePos of sampleLines) {
      if (axis === "vertical") {
        values.push(gray.ucharAt(samplePos, i));
      } else {
        values.push(gray.ucharAt(i, samplePos));
      }
    }
    profile.push(calculateVariance(values));
  }

  return profile;
}

// Find adaptive variance threshold
// True gutters have variance VERY close to zero (solid color across entire span)
// We find the minimum variance and set threshold as a small multiple of it
function findAdaptiveThreshold(variances: number[]): number {
  const sorted = [...variances].sort((a, b) => a - b);
  const minVar = sorted[0];
  const maxVar = sorted[sorted.length - 1];

  // Find the 1st percentile (very bottom) - this represents true uniform regions
  const p1Index = Math.max(1, Math.floor(sorted.length * 0.01));
  const p1Value = sorted[p1Index];

  // Strategy: True gutters should have variance very close to minimum
  // Set threshold at 10x the p1 value, but with bounds:
  // - Minimum 50 (to handle near-zero variances)
  // - Maximum 300 (conservative upper limit for true gutters)
  const multiplier = 10;
  const calculatedThreshold = p1Value * multiplier;

  const minThreshold = 50;
  const maxThreshold = 300;
  const threshold = Math.max(minThreshold, Math.min(maxThreshold, calculatedThreshold));

  console.error(`  Variance range: ${minVar.toFixed(1)} - ${maxVar.toFixed(1)}`);
  console.error(`  P1 (1st percentile): ${p1Value.toFixed(1)}`);
  console.error(`  Calculated: ${calculatedThreshold.toFixed(1)}, clamped to [${minThreshold}, ${maxThreshold}]`);
  console.error(`  Selected threshold: ${threshold.toFixed(1)}`);

  return threshold;
}

// Find uniform regions (gutters) by scanning for low-variance areas
// Works for any solid color: white, black, gray, etc.
// Key improvement: Gutters must be uniform across MOST of the perpendicular axis
function findUniformRegions(
  gray: Mat,
  axis: "vertical" | "horizontal",
  minWidth: number,
  varianceThreshold: number = 100
): GutterRegion[] {
  const regions: GutterRegion[] = [];
  const size = axis === "vertical" ? gray.cols : gray.rows;
  const perpSize = axis === "vertical" ? gray.rows : gray.cols;

  // Sample MANY lines across the perpendicular axis (every 5% from 10% to 90%)
  // A true gutter should be uniform across ALL these samples
  const sampleLines: number[] = [];
  for (let pct = 10; pct <= 90; pct += 5) {
    sampleLines.push(Math.floor(perpSize * (pct / 100)));
  }

  // Calculate variance profile across the axis
  // For each position, check if it's uniform across ALL sample lines
  const varianceProfile: number[] = [];

  for (let i = 0; i < size; i++) {
    const values: number[] = [];

    // Sample pixels along perpendicular axis at this position
    for (const samplePos of sampleLines) {
      if (axis === "vertical") {
        values.push(gray.ucharAt(samplePos, i));
      } else {
        values.push(gray.ucharAt(i, samplePos));
      }
    }

    varianceProfile.push(calculateVariance(values));
  }

  // Find continuous low-variance regions
  let inUniform = false;
  let uniformStart = 0;

  for (let i = 0; i < size; i++) {
    const isUniform = varianceProfile[i] < varianceThreshold;

    if (isUniform && !inUniform) {
      inUniform = true;
      uniformStart = i;
    } else if (!isUniform && inUniform) {
      inUniform = false;
      const width = i - uniformStart;
      if (width >= minWidth) {
        regions.push({
          start: uniformStart,
          end: i - 1,
          width,
          center: Math.round((uniformStart + i - 1) / 2),
        });
      }
    }
  }

  // Handle region extending to edge
  if (inUniform) {
    const width = size - uniformStart;
    if (width >= minWidth) {
      regions.push({
        start: uniformStart,
        end: size - 1,
        width,
        center: Math.round((uniformStart + size - 1) / 2),
      });
    }
  }

  return regions;
}

// Filter to get only internal gutters (not edge margins)
function getInternalGutters(
  regions: GutterRegion[],
  totalSize: number,
  expectedCount: number
): GutterRegion[] {
  // Edge threshold: regions starting within 5% of edges are margins, not gutters
  const edgeThreshold = totalSize * 0.05;

  const internal = regions.filter(
    (r) => r.start > edgeThreshold && r.end < totalSize - edgeThreshold
  );

  // If we have more than expected, select the most evenly spaced ones
  if (internal.length > expectedCount) {
    const centers = internal.map((r) => r.center);
    const selectedCenters = selectEvenlySpaced(centers, expectedCount);
    return internal.filter((r) => selectedCenters.includes(r.center));
  }

  return internal;
}

// Detect grid structure from image
async function detectGrid(
  imagePath: string,
  expectedRows: number,
  expectedCols: number
): Promise<GridInfo> {
  await waitForOpenCV();
  emitProgress("[Crop] OpenCV loaded");

  // Load image
  emitProgress("[Crop] Loading image...");
  const { mat, width, height } = await loadImageAsMat(imagePath);
  emitProgress(`[Crop] Image size: ${width}×${height}`);

  // Convert to grayscale
  const gray = new cv.Mat();
  cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);

  // === VARIANCE-BASED GUTTER DETECTION ===
  // Find uniform regions (gutters) by detecting low-variance areas
  // Works for white, black, gray, or any solid-color gutters
  emitProgress("[Crop] Detecting grid structure...");

  // Calculate expected cell size for adaptive min gutter width
  const expectedCellWidth = width / expectedCols;
  const expectedCellHeight = height / expectedRows;

  // Adaptive min gutter width: ~1% of expected cell size, minimum 3px
  const minGutterWidth = Math.max(3, Math.round(Math.min(expectedCellWidth, expectedCellHeight) * 0.01));
  console.error(`Adaptive minGutterWidth: ${minGutterWidth}px (based on cell size)`);

  // Calculate variance profiles for adaptive threshold
  console.error("\nCalculating adaptive thresholds...");
  const verticalVariances = calculateVarianceProfile(gray, "vertical");
  const horizontalVariances = calculateVarianceProfile(gray, "horizontal");

  // Find adaptive thresholds using Otsu's method
  console.error("Vertical axis:");
  const verticalThreshold = findAdaptiveThreshold(verticalVariances);
  console.error("Horizontal axis:");
  const horizontalThreshold = findAdaptiveThreshold(horizontalVariances);

  // Find all uniform regions using adaptive thresholds
  const allVerticalRegions = findUniformRegions(gray, "vertical", minGutterWidth, verticalThreshold);
  const allHorizontalRegions = findUniformRegions(gray, "horizontal", minGutterWidth, horizontalThreshold);

  console.error(`Found ${allVerticalRegions.length} vertical uniform regions`);
  for (const r of allVerticalRegions) {
    console.error(`  x=${r.start}-${r.end} (width=${r.width}, center=${r.center})`);
  }

  console.error(`Found ${allHorizontalRegions.length} horizontal uniform regions`);
  for (const r of allHorizontalRegions) {
    console.error(`  y=${r.start}-${r.end} (height=${r.width}, center=${r.center})`);
  }

  // Get internal gutters (excluding edge margins)
  const expectedVerticalGutters = expectedCols - 1;
  const expectedHorizontalGutters = expectedRows - 1;

  const verticalGutters = getInternalGutters(allVerticalRegions, width, expectedVerticalGutters);
  const horizontalGutters = getInternalGutters(allHorizontalRegions, height, expectedHorizontalGutters);

  console.error(`\nSelected ${verticalGutters.length} internal vertical gutters (expected ${expectedVerticalGutters}):`);
  for (const g of verticalGutters) {
    console.error(`  x=${g.start}-${g.end} (width=${g.width}, center=${g.center})`);
  }

  console.error(`Selected ${horizontalGutters.length} internal horizontal gutters (expected ${expectedHorizontalGutters}):`);
  for (const g of horizontalGutters) {
    console.error(`  y=${g.start}-${g.end} (height=${g.width}, center=${g.center})`);
  }

  // Find content boundaries (first/last non-uniform regions)
  const leftMargin = allVerticalRegions.find((r) => r.start < width * 0.05);
  const rightMargin = [...allVerticalRegions].reverse().find((r) => r.end > width * 0.95);
  const topMargin = allHorizontalRegions.find((r) => r.start < height * 0.05);
  const bottomMargin = [...allHorizontalRegions].reverse().find((r) => r.end > height * 0.95);

  const contentLeft = leftMargin ? leftMargin.end + 1 : 0;
  const contentRight = rightMargin ? rightMargin.start - 1 : width - 1;
  const contentTop = topMargin ? topMargin.end + 1 : 0;
  const contentBottom = bottomMargin ? bottomMargin.start - 1 : height - 1;

  console.error(`\nContent bounds: x=${contentLeft}-${contentRight}, y=${contentTop}-${contentBottom}`);

  // Analyze grid using actual gutter boundaries
  const gridInfo = analyzeGridWithGutters(
    verticalGutters,
    horizontalGutters,
    width,
    height,
    contentLeft,
    contentRight,
    contentTop,
    contentBottom,
    expectedRows,
    expectedCols
  );

  // Cleanup OpenCV matrices
  mat.delete();
  gray.delete();

  return gridInfo;
}

// Analyze grid using actual gutter boundaries (variance-based detection)
// Cell boundaries are calculated directly from gutter start/end positions
function analyzeGridWithGutters(
  verticalGutters: GutterRegion[],
  horizontalGutters: GutterRegion[],
  imageWidth: number,
  imageHeight: number,
  contentLeft: number,
  contentRight: number,
  contentTop: number,
  contentBottom: number,
  expectedRows: number,
  expectedCols: number
): GridInfo {
  // Sort gutters by position
  const sortedVertical = [...verticalGutters].sort((a, b) => a.start - b.start);
  const sortedHorizontal = [...horizontalGutters].sort((a, b) => a.start - b.start);

  // Adaptive safety margin: 15% of average gutter width, minimum 3px
  const avgVerticalGutterWidth = sortedVertical.length > 0
    ? sortedVertical.reduce((sum, g) => sum + g.width, 0) / sortedVertical.length
    : 10;
  const avgHorizontalGutterWidth = sortedHorizontal.length > 0
    ? sortedHorizontal.reduce((sum, g) => sum + g.width, 0) / sortedHorizontal.length
    : 10;

  const safetyMarginX = Math.max(3, Math.round(avgVerticalGutterWidth * 0.15));
  const safetyMarginY = Math.max(3, Math.round(avgHorizontalGutterWidth * 0.15));

  console.error(`\nAdaptive safety margins: X=${safetyMarginX}px (15% of ${avgVerticalGutterWidth.toFixed(0)}px), Y=${safetyMarginY}px (15% of ${avgHorizontalGutterWidth.toFixed(0)}px)`);

  console.error("\n--- Building Cell Boundaries ---");

  // Build column boundaries using actual gutter boundaries
  // Cell ends at gutter.start - margin, next cell starts at gutter.end + margin
  const colBoundaries: { start: number; end: number }[] = [];

  for (let col = 0; col < expectedCols; col++) {
    let start: number;
    let end: number;

    if (col === 0) {
      // First column: starts at content left edge
      start = contentLeft + safetyMarginX;
    } else {
      // Starts after previous gutter ends
      start = sortedVertical[col - 1].end + 1 + safetyMarginX;
    }

    if (col === expectedCols - 1) {
      // Last column: ends at content right edge
      end = contentRight - safetyMarginX;
    } else {
      // Ends before next gutter starts
      end = sortedVertical[col].start - 1 - safetyMarginX;
    }

    // Clamp to image bounds
    start = Math.max(0, start);
    end = Math.min(imageWidth - 1, end);

    colBoundaries.push({ start, end });
    console.error(`Column ${col}: x=${start} to ${end} (width=${end - start + 1})`);
  }

  // Build row boundaries using actual gutter boundaries
  const rowBoundaries: { start: number; end: number }[] = [];

  for (let row = 0; row < expectedRows; row++) {
    let start: number;
    let end: number;

    if (row === 0) {
      // First row: starts at content top edge
      start = contentTop + safetyMarginY;
    } else {
      // Starts after previous gutter ends
      start = sortedHorizontal[row - 1].end + 1 + safetyMarginY;
    }

    if (row === expectedRows - 1) {
      // Last row: ends at content bottom edge
      end = contentBottom - safetyMarginY;
    } else {
      // Ends before next gutter starts
      end = sortedHorizontal[row].start - 1 - safetyMarginY;
    }

    // Clamp to image bounds
    start = Math.max(0, start);
    end = Math.min(imageHeight - 1, end);

    rowBoundaries.push({ start, end });
    console.error(`Row ${row}: y=${start} to ${end} (height=${end - start + 1})`);
  }

  // Build per-cell boundaries (row-major order)
  const cells: CellBoundary[] = [];

  for (let row = 0; row < expectedRows; row++) {
    for (let col = 0; col < expectedCols; col++) {
      const x = colBoundaries[col].start;
      const y = rowBoundaries[row].start;
      const width = colBoundaries[col].end - colBoundaries[col].start + 1;
      const height = rowBoundaries[row].end - rowBoundaries[row].start + 1;

      cells.push({ x, y, width, height });

      const frameNum = row * expectedCols + col + 1;
      console.error(`Frame ${frameNum}: (${x}, ${y}) ${width}×${height}`);
    }
  }

  // Calculate average gutter dimensions for reporting
  const avgGutterX =
    sortedVertical.length > 0
      ? Math.round(sortedVertical.reduce((sum, g) => sum + g.width, 0) / sortedVertical.length)
      : 0;
  const avgGutterY =
    sortedHorizontal.length > 0
      ? Math.round(sortedHorizontal.reduce((sum, g) => sum + g.width, 0) / sortedHorizontal.length)
      : 0;

  console.error(`\nAverage gutter: ${avgGutterX}px horizontal, ${avgGutterY}px vertical`);

  return {
    rows: expectedRows,
    cols: expectedCols,
    cells,
    detectedGutterX: avgGutterX,
    detectedGutterY: avgGutterY,
    verticalGutters: sortedVertical,
    horizontalGutters: sortedHorizontal,
  };
}

// Crop frames using per-cell boundaries from grid info
async function cropFrames(
  imagePath: string,
  grid: GridInfo,
  outputDir: string,
  outputFormat: "png" | "jpeg" | "webp",
  prefix: string
): Promise<CropResult[]> {
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
    emitProgress(`[Crop] Created output directory`);
  }

  const results: CropResult[] = [];

  for (let row = 0; row < grid.rows; row++) {
    for (let col = 0; col < grid.cols; col++) {
      const frameIndex = row * grid.cols + col;
      const frameNumber = frameIndex + 1;
      const cell = grid.cells[frameIndex];
      const outputPath = path.join(outputDir, `${prefix}-${frameNumber}.${outputFormat}`);

      emitProgress(`[Crop] Cropping frame ${frameNumber}/${grid.rows * grid.cols}`);

      await sharp(imagePath)
        .extract({
          left: cell.x,
          top: cell.y,
          width: cell.width,
          height: cell.height,
        })
        .toFormat(outputFormat)
        .toFile(outputPath);

      results.push({
        frameNumber,
        row,
        col,
        outputPath,
        x: cell.x,
        y: cell.y,
        width: cell.width,
        height: cell.height,
      });

      emitProgress(`[Crop] Saved: ${path.basename(outputPath)}`);
    }
  }

  return results;
}

// Normalize all frames to uniform dimensions
// Scales to max width/height with padding to preserve aspect ratio
async function normalizeFrames(
  results: CropResult[],
  outputFormat: "png" | "jpeg" | "webp"
): Promise<NormalizedDimensions> {
  if (results.length === 0) {
    return { width: 0, height: 0 };
  }

  // Find max dimensions
  const maxWidth = Math.max(...results.map((r) => r.width));
  const maxHeight = Math.max(...results.map((r) => r.height));

  emitProgress(`[Crop] Normalizing frames to ${maxWidth}×${maxHeight}`);

  // Check if normalization is actually needed
  const needsNormalization = results.some(
    (r) => r.width !== maxWidth || r.height !== maxHeight
  );

  if (!needsNormalization) {
    emitProgress(`[Crop] All frames already uniform`);
    return { width: maxWidth, height: maxHeight };
  }

  // Normalize each frame
  for (const result of results) {
    if (result.width === maxWidth && result.height === maxHeight) {
      continue;
    }

    emitProgress(`[Crop] Normalizing frame-${result.frameNumber}`);

    // Read the current frame
    const inputBuffer = await sharp(result.outputPath).toBuffer();

    // Resize with padding (same as video-utils buildScaleFilter logic)
    // This preserves aspect ratio and adds black padding if needed
    await sharp(inputBuffer)
      .resize(maxWidth, maxHeight, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 1 }, // Black padding
      })
      .toFormat(outputFormat)
      .toFile(result.outputPath);

    // Update the result dimensions
    result.width = maxWidth;
    result.height = maxHeight;
  }

  emitProgress(`[Crop] Normalized ${results.length} frames to ${maxWidth}×${maxHeight}`);

  return { width: maxWidth, height: maxHeight };
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
      "no-normalize": { type: "boolean" },
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
      --no-normalize  Skip frame normalization (keep varying sizes)
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
  All frames are normalized to uniform dimensions (max width × max height).
  Use --no-normalize to keep original cropped sizes.

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
    normalize: !values["no-normalize"], // Default: true (normalize ON)
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

    emitProgress(`[Crop] Cropping contact sheet into ${args.rows * args.cols} frames`);

    // Detect grid structure
    const grid = await detectGrid(args.inputPath, args.rows, args.cols);
    emitProgress(`[Crop] Detected ${grid.cells.length} cells (${grid.cols}×${grid.rows})`);

    // Crop frames
    const results = await cropFrames(
      args.inputPath,
      grid,
      args.outputDir,
      args.outputFormat,
      args.prefix
    );

    emitProgress(`[Crop] Successfully cropped ${results.length} frames`);

    // Normalize frames to uniform dimensions (unless --no-normalize)
    let normalizedDimensions: NormalizedDimensions | null = null;
    if (args.normalize) {
      normalizedDimensions = await normalizeFrames(results, args.outputFormat);
    } else {
      emitProgress(`[Crop] Skipping normalization`);
    }

    // Output JSON result to stdout (for pipeline integration)
    console.log(
      JSON.stringify(
        {
          success: true,
          framesCount: results.length,
          normalized: args.normalize,
          normalizedDimensions: normalizedDimensions,
          grid: {
            rows: grid.rows,
            cols: grid.cols,
            detectedGutterX: grid.detectedGutterX,
            detectedGutterY: grid.detectedGutterY,
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
