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

import { execSync, spawn } from "child_process";
import { existsSync, mkdirSync, rmSync, readdirSync } from "fs";
import * as path from "path";
import { parseArgs } from "util";
import {
  getEasingFunction,
  listEasingNames,
  createBezierEasing,
  type EasingFunction,
} from "./lib/easing-functions.js";

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

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

interface SpeedCurveOptions {
  input: string;
  output: string;
  outputDuration: number;
  outputFps: number;
  easing: string | [number, number, number, number]; // name or bezier control points
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
// VIDEO METADATA
// =============================================================================

/**
 * Get video metadata using ffprobe
 */
function getVideoMetadata(videoPath: string): VideoMetadata {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
  const result = execSync(cmd, { encoding: "utf-8" });
  const data = JSON.parse(result);

  const videoStream = data.streams.find((s: any) => s.codec_type === "video");
  if (!videoStream) {
    throw new Error(`No video stream found in ${videoPath}`);
  }

  // Parse frame rate (can be "24/1" or "23.976")
  let fps = 24;
  if (videoStream.r_frame_rate) {
    const [num, den] = videoStream.r_frame_rate.split("/").map(Number);
    fps = den ? num / den : num;
  }

  return {
    duration: parseFloat(data.format.duration),
    width: videoStream.width,
    height: videoStream.height,
    fps,
  };
}

// =============================================================================
// TIMESTAMP CALCULATION (THE CORE ALGORITHM)
// =============================================================================

/**
 * Calculate source timestamps based on easing function.
 *
 * This is the core algorithm from easy-peasy-ease:
 * For each output frame, calculate which source timestamp to sample.
 *
 * @param easingFunc - The easing function to apply
 * @param inputDuration - Duration of source video in seconds
 * @param outputDuration - Desired output duration in seconds
 * @param outputFps - Output frame rate
 * @returns Array of source timestamps in seconds
 */
function calculateSourceTimestamps(
  easingFunc: EasingFunction,
  inputDuration: number,
  outputDuration: number,
  outputFps: number
): number[] {
  const totalOutputFrames = Math.floor(outputDuration * outputFps);
  const timestamps: number[] = [];

  for (let frameIndex = 0; frameIndex < totalOutputFrames; frameIndex++) {
    // Normalize frame index to 0-1 range (output progress)
    const outputProgress =
      totalOutputFrames > 1 ? frameIndex / (totalOutputFrames - 1) : 0;

    // Apply easing function: maps output progress to source progress
    const sourceProgress = easingFunc(outputProgress);

    // Map to source timestamp, clamped to valid range
    const sourceTime = Math.max(
      0,
      Math.min(sourceProgress * inputDuration, inputDuration - 0.001)
    );

    timestamps.push(sourceTime);
  }

  return timestamps;
}

// =============================================================================
// FRAME EXTRACTION & ENCODING
// =============================================================================

/**
 * Extract frames at specific timestamps using FFmpeg
 */
async function extractFramesAtTimestamps(
  inputPath: string,
  timestamps: number[],
  tempDir: string,
  width: number,
  height: number
): Promise<void> {
  console.error(`Extracting ${timestamps.length} frames...`);

  // Use a single FFmpeg command with select filter for efficiency
  // This is much faster than spawning FFmpeg for each frame

  // Build select expression: select frames nearest to our timestamps
  // We'll use the fps filter to get all frames, then select specific ones

  // For accuracy, we extract each frame individually using -ss (seek)
  // This is slower but more accurate for easing curves

  const totalFrames = timestamps.length;
  let extracted = 0;

  // Process in batches for progress reporting
  const batchSize = 10;

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const outputFile = path.join(tempDir, `frame_${String(i).padStart(6, "0")}.png`);

    // Use -ss before -i for fast seeking
    const cmd = [
      "ffmpeg",
      "-y",
      "-ss", timestamp.toFixed(6),
      "-i", inputPath,
      "-frames:v", "1",
      "-vf", `scale=${width}:${height}`,
      "-q:v", "1", // Best quality for PNG
      outputFile,
    ];

    execSync(cmd.join(" "), { stdio: "pipe" });

    extracted++;
    if (extracted % batchSize === 0 || extracted === totalFrames) {
      const percent = Math.round((extracted / totalFrames) * 100);
      console.error(`  Progress: ${extracted}/${totalFrames} frames (${percent}%)`);
    }
  }
}

/**
 * Encode frames into video using FFmpeg
 */
function encodeFramesToVideo(
  tempDir: string,
  outputPath: string,
  fps: number,
  bitrate: string
): void {
  console.error(`Encoding video at ${fps}fps...`);

  const inputPattern = path.join(tempDir, "frame_%06d.png");

  const cmd = [
    "ffmpeg",
    "-y",
    "-framerate", String(fps),
    "-i", inputPattern,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "18",
    "-b:v", bitrate,
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    outputPath,
  ];

  execSync(cmd.join(" "), { stdio: "pipe" });
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
  const { input, output, outputDuration, outputFps, easing, bitrate, keepTempFrames } =
    options;

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
    // Custom bezier curve
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

  // Calculate source timestamps
  const timestamps = calculateSourceTimestamps(
    easingFunc,
    metadata.duration,
    outputDuration,
    outputFps
  );

  // Log some sample timestamps to show the easing effect
  console.error(`  Sample timestamps (showing easing effect):`);
  const samples = [0, 0.25, 0.5, 0.75, 1].map((p) => {
    const idx = Math.floor(p * (timestamps.length - 1));
    return `    ${(p * 100).toFixed(0)}% output → ${timestamps[idx].toFixed(3)}s source`;
  });
  samples.forEach((s) => console.error(s));

  // Create temp directory for frames
  const tempDir = path.join(path.dirname(output), `.temp_frames_${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    // Extract frames at calculated timestamps
    await extractFramesAtTimestamps(
      input,
      timestamps,
      tempDir,
      metadata.width,
      metadata.height
    );

    // Ensure output directory exists
    const outputDir = path.dirname(output);
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Encode frames to video
    encodeFramesToVideo(tempDir, output, outputFps, bitrate);

    console.error(`Output saved to: ${output}`);

    return {
      input,
      output,
      inputDuration: metadata.duration,
      outputDuration,
      outputFps,
      easing: easingName,
      totalFrames: timestamps.length,
      compressionRatio: metadata.duration / outputDuration,
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
  let easing: string | [number, number, number, number] = values.easing || DEFAULT_EASING;
  if (values.bezier) {
    const parts = values.bezier.split(",").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      console.error("Error: --bezier must be 4 comma-separated numbers (p1x,p1y,p2x,p2y)");
      process.exit(1);
    }
    easing = parts as [number, number, number, number];
  }

  return {
    input: values.input,
    output: values.output,
    outputDuration: parseFloat(values["output-duration"] || String(DEFAULT_OUTPUT_DURATION)),
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
