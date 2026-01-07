#!/usr/bin/env npx tsx
/**
 * apply-speed-curve.ts
 *
 * Apply easing-based speed curves to a video.
 * Compresses a 5-second video into a shorter duration with smooth slow-fast-slow motion.
 *
 * Usage:
 *   npx tsx apply-speed-curve.ts \
 *     --input video.mp4 \
 *     --output output.mp4 \
 *     --output-duration 1.5 \
 *     --easing easeInOutSine
 *
 * The "magic" of easy-peasy-ease: speed curves make cuts invisible by
 * slowing down at the end of each clip, so hard cuts happen during slow-motion.
 */

import { existsSync, mkdirSync, rmSync } from "fs";
import * as path from "path";
import { parseArgs } from "util";

// Shared libraries
import {
  getEasingFunction,
  listEasingNames,
  createBezierEasing,
  type EasingFunction,
} from "./lib/easing-functions.js";
import {
  getVideoMetadata,
  encodeFramesToVideo,
  extractFramesAtTimestamps,
} from "./lib/video-utils.js";
import {
  calculateSourceTimestamps,
  getSampleTimestamps,
} from "./lib/timestamp-calc.js";

// =============================================================================
// CONFIGURATION
// =============================================================================

const DEFAULT_OUTPUT_FPS = 60;
const DEFAULT_OUTPUT_DURATION = 1.5; // seconds
const DEFAULT_EASING = "easeInOutSine";
const DEFAULT_BITRATE = "25M"; // 25 Mbps for high quality

// =============================================================================
// TYPES
// =============================================================================

interface SpeedCurveOptions {
  input: string;
  output: string;
  outputDuration: number;
  outputFps: number;
  easing: string | [number, number, number, number];
  bitrate: string;
  keepTempFrames: boolean;
}

interface SpeedCurveResult {
  input: string;
  output: string;
  inputDuration: number;
  outputDuration: number;
  outputFps: number;
  easing: string;
  totalFrames: number;
  compressionRatio: number;
}

// =============================================================================
// MAIN SPEED CURVE FUNCTION
// =============================================================================

/**
 * Apply speed curve to a video
 */
async function applySpeedCurve(
  options: SpeedCurveOptions
): Promise<SpeedCurveResult> {
  const {
    input,
    output,
    outputDuration,
    outputFps,
    easing,
    bitrate,
    keepTempFrames,
  } = options;

  // Validate input exists
  if (!existsSync(input)) {
    throw new Error(`Input file not found: ${input}`);
  }

  // Get video metadata
  console.error(`Analyzing input video: ${input}`);
  const metadata = getVideoMetadata(input);
  console.error(
    `  Duration: ${metadata.duration.toFixed(2)}s, Resolution: ${metadata.width}x${metadata.height}, FPS: ${metadata.fps.toFixed(2)}`
  );

  // Resolve easing function
  let easingFunc: EasingFunction;
  let easingName: string;

  if (Array.isArray(easing)) {
    const [p1x, p1y, p2x, p2y] = easing;
    easingFunc = createBezierEasing(p1x, p1y, p2x, p2y);
    easingName = `bezier(${easing.join(",")})`;
  } else {
    easingFunc = getEasingFunction(easing);
    easingName = easing;
  }

  console.error(`  Easing: ${easingName}`);
  console.error(
    `  Output: ${outputDuration}s at ${outputFps}fps (${Math.round(outputDuration * outputFps)} frames)`
  );

  // Calculate source timestamps using shared library
  const { timestamps, totalFrames, compressionRatio } = calculateSourceTimestamps({
    easingFunc,
    inputDuration: metadata.duration,
    outputDuration,
    outputFps,
    inputFps: metadata.fps,
  });

  // Log sample timestamps to show the easing effect
  console.error(`  Sample timestamps (showing easing effect):`);
  const samples = getSampleTimestamps(timestamps);
  samples.forEach(({ progress, timestamp }) => {
    console.error(`    ${(progress * 100).toFixed(0)}% output → ${timestamp.toFixed(3)}s source`);
  });

  // Create temp directory for frames
  const tempDir = path.join(path.dirname(output), `.temp_frames_${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    // Extract frames at calculated timestamps
    console.error(`Extracting ${timestamps.length} frames...`);
    await extractFramesAtTimestamps({
      inputPath: input,
      tempDir,
      timestamps,
      width: metadata.width,
      height: metadata.height,
      frameOffset: 0,
      scaleWithPadding: false,
      onProgress: (extracted, total) => {
        const percent = Math.round((extracted / total) * 100);
        console.error(`  Progress: ${extracted}/${total} frames (${percent}%)`);
      },
    });

    // Ensure output directory exists
    const outputDir = path.dirname(output);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Encode frames to video
    const inputPattern = path.join(tempDir, "frame_%06d.png");
    encodeFramesToVideo({
      inputPattern,
      outputPath: output,
      fps: outputFps,
      bitrate,
    });

    console.error(`Output saved to: ${output}`);

    return {
      input,
      output,
      inputDuration: metadata.duration,
      outputDuration,
      outputFps,
      easing: easingName,
      totalFrames,
      compressionRatio,
    };
  } finally {
    // Cleanup temp directory
    if (!keepTempFrames && existsSync(tempDir)) {
      console.error(`Cleaning up temp frames...`);
      rmSync(tempDir, { recursive: true, force: true });
    } else if (keepTempFrames) {
      console.error(`Temp frames kept at: ${tempDir}`);
    }
  }
}

// =============================================================================
// CLI
// =============================================================================

function parseArguments(): SpeedCurveOptions {
  const { values } = parseArgs({
    options: {
      input: { type: "string", short: "i" },
      output: { type: "string", short: "o" },
      "output-duration": { type: "string", short: "d" },
      "output-fps": { type: "string", short: "f" },
      easing: { type: "string", short: "e" },
      bezier: { type: "string", short: "b" },
      bitrate: { type: "string" },
      "keep-temp": { type: "boolean" },
      "list-easings": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  // Show help
  if (values.help) {
    console.log(`
apply-speed-curve.ts - Apply easing-based speed curves to video

Usage:
  npx tsx apply-speed-curve.ts --input video.mp4 --output out.mp4 [options]

Options:
  -i, --input <path>          Input video file (required)
  -o, --output <path>         Output video file (required)
  -d, --output-duration <s>   Output duration in seconds (default: ${DEFAULT_OUTPUT_DURATION})
  -f, --output-fps <n>        Output frame rate (default: ${DEFAULT_OUTPUT_FPS})
  -e, --easing <name>         Easing function name (default: ${DEFAULT_EASING})
  -b, --bezier <p1x,p1y,p2x,p2y>  Custom bezier curve control points
      --bitrate <rate>        Output bitrate (default: ${DEFAULT_BITRATE})
      --keep-temp             Keep temporary frame files
      --list-easings          List all available easing functions
  -h, --help                  Show this help message

Examples:
  # Basic usage with default easing
  npx tsx apply-speed-curve.ts -i input.mp4 -o output.mp4

  # Dramatic swoop (easy-peasy-ease style)
  npx tsx apply-speed-curve.ts -i input.mp4 -o output.mp4 --bezier 0.85,0,0.15,1

  # Longer output with elastic easing
  npx tsx apply-speed-curve.ts -i input.mp4 -o output.mp4 -d 2.0 -e easeInOutElastic

Easing functions control the speed curve:
  - easeInOutSine: Gentle slow-fast-slow (recommended default)
  - dramaticSwoop: Extreme slow-fast-slow (bezier 0.85,0,0.15,1)
  - easeInOutCubic: Moderate acceleration
  - easeInOutExpo: Very dramatic speed change
`);
    process.exit(0);
  }

  // List easings
  if (values["list-easings"]) {
    console.log("Available easing functions:\n");
    const names = listEasingNames();
    names.forEach((name) => console.log(`  ${name}`));
    console.log(`\nOr use --bezier for custom cubic-bezier curves.`);
    process.exit(0);
  }

  // Validate required arguments
  if (!values.input) {
    console.error("Error: --input is required");
    process.exit(1);
  }
  if (!values.output) {
    console.error("Error: --output is required");
    process.exit(1);
  }

  // Parse bezier or easing
  let easing: string | [number, number, number, number] =
    values.easing || DEFAULT_EASING;
  if (values.bezier) {
    const parts = values.bezier.split(",").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      console.error(
        "Error: --bezier must be 4 comma-separated numbers (p1x,p1y,p2x,p2y)"
      );
      process.exit(1);
    }
    easing = parts as [number, number, number, number];
  }

  return {
    input: values.input,
    output: values.output,
    outputDuration: parseFloat(
      values["output-duration"] || String(DEFAULT_OUTPUT_DURATION)
    ),
    outputFps: parseInt(values["output-fps"] || String(DEFAULT_OUTPUT_FPS), 10),
    easing,
    bitrate: values.bitrate || DEFAULT_BITRATE,
    keepTempFrames: values["keep-temp"] || false,
  };
}

async function main() {
  try {
    const options = parseArguments();
    const result = await applySpeedCurve(options);

    // Output result as JSON to stdout
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
