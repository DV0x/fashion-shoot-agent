#!/usr/bin/env npx tsx
/**
 * crop-frames-ffmpeg.ts
 *
 * Simple, reliable contact sheet cropping using FFmpeg.
 * Uses pure math division - no gutter detection.
 *
 * Usage:
 *   npx tsx crop-frames-ffmpeg.ts --input contact-sheet.png --output-dir ./frames
 *   npx tsx crop-frames-ffmpeg.ts --input contact-sheet.png --output-dir ./frames --cols 3 --rows 2
 *   npx tsx crop-frames-ffmpeg.ts --input contact-sheet.png --output-dir ./frames --padding 10
 */

import { execSync } from 'child_process';
import { existsSync, mkdirSync } from 'fs';
import { basename, join } from 'path';

// Parse command line arguments
function parseArgs(): {
  input: string;
  outputDir: string;
  cols: number;
  rows: number;
  padding: number;
  normalize: boolean;
} {
  const args = process.argv.slice(2);
  let input = '';
  let outputDir = './frames';
  let cols = 3;
  let rows = 2;
  let padding = 0;
  let normalize = true;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--input':
      case '-i':
        input = args[++i];
        break;
      case '--output-dir':
      case '-o':
        outputDir = args[++i];
        break;
      case '--cols':
        cols = parseInt(args[++i], 10);
        break;
      case '--rows':
        rows = parseInt(args[++i], 10);
        break;
      case '--padding':
      case '-p':
        padding = parseInt(args[++i], 10);
        break;
      case '--no-normalize':
        normalize = false;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npx tsx crop-frames-ffmpeg.ts [options]

Options:
  --input, -i      Input contact sheet image (required)
  --output-dir, -o Output directory for frames (default: ./frames)
  --cols           Number of columns in grid (default: 3)
  --rows           Number of rows in grid (default: 2)
  --padding, -p    Pixels to trim from each frame edge (default: 0)
  --no-normalize   Skip normalizing frame dimensions
  --help, -h       Show this help message

Examples:
  npx tsx crop-frames-ffmpeg.ts --input contact-sheet.png --output-dir ./frames
  npx tsx crop-frames-ffmpeg.ts -i sheet.png -o ./out --cols 3 --rows 2 --padding 5
        `);
        process.exit(0);
    }
  }

  if (!input) {
    console.error('Error: --input is required');
    process.exit(1);
  }

  return { input, outputDir, cols, rows, padding, normalize };
}

// Get image dimensions using FFprobe
function getImageDimensions(imagePath: string): { width: number; height: number } {
  const result = execSync(
    `ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${imagePath}"`,
    { encoding: 'utf-8' }
  ).trim();

  const [width, height] = result.split(',').map(Number);
  return { width, height };
}

// Crop a single frame using FFmpeg
function cropFrame(
  input: string,
  output: string,
  width: number,
  height: number,
  x: number,
  y: number,
  padding: number
): void {
  // Apply padding (trim from edges)
  const cropW = width - (padding * 2);
  const cropH = height - (padding * 2);
  const cropX = x + padding;
  const cropY = y + padding;

  const cmd = `ffmpeg -y -i "${input}" -vf "crop=${cropW}:${cropH}:${cropX}:${cropY}" -update 1 "${output}" 2>/dev/null`;
  execSync(cmd);
}

// Find max dimensions across all frames
function findMaxDimensions(frames: string[]): { maxWidth: number; maxHeight: number } {
  let maxWidth = 0;
  let maxHeight = 0;

  for (const frame of frames) {
    const { width, height } = getImageDimensions(frame);
    maxWidth = Math.max(maxWidth, width);
    maxHeight = Math.max(maxHeight, height);
  }

  return { maxWidth, maxHeight };
}

// Normalize frame to target dimensions with padding
function normalizeFrame(input: string, output: string, targetWidth: number, targetHeight: number): void {
  // Scale to fit within target, then pad to exact dimensions
  const cmd = `ffmpeg -y -i "${input}" -vf "scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black" -update 1 "${output}" 2>/dev/null`;
  execSync(cmd);
}

// Main function
async function main() {
  const { input, outputDir, cols, rows, padding, normalize } = parseArgs();

  console.log(`\nCropping contact sheet using FFmpeg...`);
  console.log(`  Input: ${input}`);
  console.log(`  Output: ${outputDir}`);
  console.log(`  Grid: ${cols}x${rows} (${cols * rows} frames)`);
  if (padding > 0) console.log(`  Padding: ${padding}px`);

  // Check input exists
  if (!existsSync(input)) {
    console.error(`Error: Input file not found: ${input}`);
    process.exit(1);
  }

  // Create output directory
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Get image dimensions
  const { width, height } = getImageDimensions(input);
  console.log(`\n  Image dimensions: ${width}x${height}`);

  // Calculate frame dimensions
  const frameWidth = Math.floor(width / cols);
  const frameHeight = Math.floor(height / rows);
  console.log(`  Frame dimensions: ${frameWidth}x${frameHeight}`);

  // Crop each frame
  const totalFrames = cols * rows;
  const framePaths: string[] = [];

  console.log(`\n  Extracting ${totalFrames} frames...`);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const frameNum = row * cols + col + 1;
      const x = col * frameWidth;
      const y = row * frameHeight;
      const outputPath = join(outputDir, `frame-${frameNum}.png`);

      process.stdout.write(`    Frame ${frameNum}/${totalFrames}: (${x}, ${y}) ${frameWidth}x${frameHeight}`);

      cropFrame(input, outputPath, frameWidth, frameHeight, x, y, padding);
      framePaths.push(outputPath);

      console.log(' ✓');
    }
  }

  // Normalize dimensions if enabled
  if (normalize) {
    console.log(`\n  Normalizing frame dimensions...`);
    const { maxWidth, maxHeight } = findMaxDimensions(framePaths);

    // Only normalize if dimensions differ
    let needsNormalization = false;
    for (const frame of framePaths) {
      const { width: w, height: h } = getImageDimensions(frame);
      if (w !== maxWidth || h !== maxHeight) {
        needsNormalization = true;
        break;
      }
    }

    if (needsNormalization) {
      console.log(`    Target: ${maxWidth}x${maxHeight}`);
      for (let i = 0; i < framePaths.length; i++) {
        const frame = framePaths[i];
        process.stdout.write(`    Normalizing frame-${i + 1}.png...`);
        normalizeFrame(frame, frame, maxWidth, maxHeight);
        console.log(' ✓');
      }
    } else {
      console.log(`    All frames already uniform (${maxWidth}x${maxHeight})`);
    }
  }

  // Get final dimensions
  const finalDims = getImageDimensions(framePaths[0]);

  // Output JSON result
  const result = {
    success: true,
    framesCount: totalFrames,
    inputDimensions: { width, height },
    frameDimensions: { width: finalDims.width, height: finalDims.height },
    padding,
    normalized: normalize,
    frames: framePaths.map((p, i) => ({
      frame: i + 1,
      path: p,
      position: {
        col: i % cols,
        row: Math.floor(i / cols),
        x: (i % cols) * frameWidth,
        y: Math.floor(i / cols) * frameHeight
      }
    }))
  };

  console.log(`\n✅ Successfully extracted ${totalFrames} frames`);
  console.log(`   Final dimensions: ${finalDims.width}x${finalDims.height}\n`);
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
