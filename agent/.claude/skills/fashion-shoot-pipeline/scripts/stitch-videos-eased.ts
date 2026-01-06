#!/usr/bin/env npx tsx
/**
 * stitch-videos-eased.ts
 *
 * Stitch multiple videos together using speed curves and hard cuts.
 * This creates the seamless "one continuous video" feel of easy-peasy-ease.
 *
 * The magic: Each clip is speed-curved to slow down at start and end,
 * so hard cuts happen during slow-motion, making them invisible to the eye.
 *
 * Usage:
 *   npx tsx stitch-videos-eased.ts \
 *     --clips video1.mp4 video2.mp4 video3.mp4 \
 *     --output final.mp4 \
 *     --clip-duration 1.5 \
 *     --easing dramaticSwoop
 */

import { execSync } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
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
const DEFAULT_CLIP_DURATION = 1.5; // seconds per clip after speed curve
const DEFAULT_EASING = "easeInOutSine";
const DEFAULT_BITRATE = "25M";

// =============================================================================
// TYPES
// =============================================================================

interface VideoMetadata {
  duration: number;
  width: number;
  height: number;
  fps: number;
}

interface StitchOptions {
  clips: string[];
  output: string;
  clipDuration: number;
  outputFps: number;
  easing: string | [number, number, number, number];
  bitrate: string;
  keepTemp: boolean;
}

interface StitchResult {
  clips: string[];
  output: string;
  clipCount: number;
  clipDuration: number;
  totalDuration: number;
  outputFps: number;
  easing: string;
}

// =============================================================================
// VIDEO METADATA
// =============================================================================

function getVideoMetadata(videoPath: string): VideoMetadata {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${videoPath}"`;
  const result = execSync(cmd, { encoding: "utf-8" });
  const data = JSON.parse(result);

  const videoStream = data.streams.find((s: any) => s.codec_type === "video");
  if (!videoStream) {
    throw new Error(`No video stream found in ${videoPath}`);
  }

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
// TIMESTAMP CALCULATION
// =============================================================================

function calculateSourceTimestamps(
  easingFunc: EasingFunction,
  inputDuration: number,
  outputDuration: number,
  outputFps: number
): number[] {
  const totalOutputFrames = Math.floor(outputDuration * outputFps);
  const timestamps: number[] = [];

  for (let frameIndex = 0; frameIndex < totalOutputFrames; frameIndex++) {
    const outputProgress =
      totalOutputFrames > 1 ? frameIndex / (totalOutputFrames - 1) : 0;
    const sourceProgress = easingFunc(outputProgress);
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

async function extractFramesAtTimestamps(
  inputPath: string,
  timestamps: number[],
  tempDir: string,
  frameOffset: number,
  width: number,
  height: number
): Promise<number> {
  const totalFrames = timestamps.length;
  let extracted = 0;
  const batchSize = 10;

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const globalFrameIndex = frameOffset + i;
    const outputFile = path.join(
      tempDir,
      `frame_${String(globalFrameIndex).padStart(6, "0")}.png`
    );

    // Scale with padding to handle different aspect ratios (adds black bars if needed)
    const scaleFilter = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;

    const cmd = [
      "ffmpeg",
      "-y",
      "-ss", timestamp.toFixed(6),
      "-i", `"${inputPath}"`,
      "-frames:v", "1",
      "-vf", `"${scaleFilter}"`,
      "-q:v", "1",
      `"${outputFile}"`,
    ];

    execSync(cmd.join(" "), { stdio: "pipe" });

    extracted++;
    if (extracted % batchSize === 0 || extracted === totalFrames) {
      const percent = Math.round((extracted / totalFrames) * 100);
      process.stderr.write(`\r    Frames: ${extracted}/${totalFrames} (${percent}%)`);
    }
  }
  process.stderr.write("\n");

  return timestamps.length;
}

function encodeFramesToVideo(
  tempDir: string,
  outputPath: string,
  fps: number,
  bitrate: string
): void {
  console.error(`Encoding final video at ${fps}fps...`);

  const inputPattern = path.join(tempDir, "frame_%06d.png");

  const cmd = [
    "ffmpeg",
    "-y",
    "-framerate", String(fps),
    "-i", `"${inputPattern}"`,
    "-c:v", "libx264",
    "-preset", "slow",
    "-crf", "18",
    "-b:v", bitrate,
    "-pix_fmt", "yuv420p",
    "-movflags", "+faststart",
    `"${outputPath}"`,
  ];

  execSync(cmd.join(" "), { stdio: "pipe" });
}

// =============================================================================
// MAIN STITCH FUNCTION
// =============================================================================

async function stitchVideosEased(options: StitchOptions): Promise<StitchResult> {
  const { clips, output, clipDuration, outputFps, easing, bitrate, keepTemp } = options;

  // Validate all clips exist
  for (const clip of clips) {
    if (!existsSync(clip)) {
      throw new Error(`Clip not found: ${clip}`);
    }
  }

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

  console.error(`\nStitching ${clips.length} clips with hard cuts`);
  console.error(`  Easing: ${easingName}`);
  console.error(`  Clip duration: ${clipDuration}s each`);
  console.error(`  Output FPS: ${outputFps}`);

  // Analyze all clips to find target dimensions (use max of all)
  console.error(`\nAnalyzing clips...`);
  const metadataList = clips.map((clip, i) => {
    const meta = getVideoMetadata(clip);
    console.error(`  [${i + 1}] ${path.basename(clip)}: ${meta.duration.toFixed(2)}s, ${meta.width}x${meta.height}`);
    return meta;
  });

  const targetWidth = Math.max(...metadataList.map((m) => m.width));
  const targetHeight = Math.max(...metadataList.map((m) => m.height));
  console.error(`  Target resolution: ${targetWidth}x${targetHeight}`);

  // Create temp directory
  const tempDir = path.join(path.dirname(output), `.temp_stitch_${Date.now()}`);
  mkdirSync(tempDir, { recursive: true });

  try {
    let totalFrameCount = 0;

    // Process each clip
    console.error(`\nExtracting speed-curved frames...`);
    for (let i = 0; i < clips.length; i++) {
      const clip = clips[i];
      const metadata = metadataList[i];

      console.error(`  [${i + 1}/${clips.length}] ${path.basename(clip)}`);

      // Calculate timestamps for this clip
      const timestamps = calculateSourceTimestamps(
        easingFunc,
        metadata.duration,
        clipDuration,
        outputFps
      );

      // Extract frames with global frame numbering
      const framesExtracted = await extractFramesAtTimestamps(
        clip,
        timestamps,
        tempDir,
        totalFrameCount,
        targetWidth,
        targetHeight
      );

      totalFrameCount += framesExtracted;
    }

    console.error(`\nTotal frames: ${totalFrameCount}`);

    // Ensure output directory exists
    const outputDir = path.dirname(output);
    if (outputDir && !existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Encode all frames into final video
    encodeFramesToVideo(tempDir, output, outputFps, bitrate);

    const totalDuration = (totalFrameCount / outputFps);
    console.error(`\nOutput saved to: ${output}`);
    console.error(`  Duration: ${totalDuration.toFixed(2)}s`);

    return {
      clips,
      output,
      clipCount: clips.length,
      clipDuration,
      totalDuration,
      outputFps,
      easing: easingName,
    };
  } finally {
    // Cleanup
    if (!keepTemp && existsSync(tempDir)) {
      console.error(`Cleaning up temp files...`);
      rmSync(tempDir, { recursive: true, force: true });
    } else if (keepTemp) {
      console.error(`Temp files kept at: ${tempDir}`);
    }
  }
}

// =============================================================================
// CLI
// =============================================================================

function parseArguments(): StitchOptions {
  const { values } = parseArgs({
    options: {
      clips: { type: "string", multiple: true, short: "c" },
      output: { type: "string", short: "o" },
      "clip-duration": { type: "string", short: "d" },
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

  if (values.help) {
    console.log(`
stitch-videos-eased.ts - Stitch videos with speed curves and hard cuts

This creates the seamless "one continuous video" feel by:
1. Applying speed curves to each clip (slow start, fast middle, slow end)
2. Joining clips with hard cuts (no transitions)

The magic: Hard cuts happen while both clips are in slow-motion,
making the cuts invisible to the human eye.

Usage:
  npx tsx stitch-videos-eased.ts \\
    --clips video1.mp4 video2.mp4 video3.mp4 \\
    --output final.mp4

Options:
  -c, --clips <paths...>      Input video files (minimum 2, required)
  -o, --output <path>         Output video file (required)
  -d, --clip-duration <s>     Duration per clip after speed curve (default: ${DEFAULT_CLIP_DURATION})
  -f, --output-fps <n>        Output frame rate (default: ${DEFAULT_OUTPUT_FPS})
  -e, --easing <name>         Easing function (default: ${DEFAULT_EASING})
  -b, --bezier <p1x,p1y,p2x,p2y>  Custom bezier curve
      --bitrate <rate>        Output bitrate (default: ${DEFAULT_BITRATE})
      --keep-temp             Keep temporary files
      --list-easings          List all available easing functions
  -h, --help                  Show this help message

Examples:
  # Stitch 6 fashion videos with dramatic swoop
  npx tsx stitch-videos-eased.ts \\
    -c video-1.mp4 -c video-2.mp4 -c video-3.mp4 \\
    -c video-4.mp4 -c video-5.mp4 -c video-6.mp4 \\
    -o final.mp4 \\
    --bezier 0.85,0,0.15,1

  # Shorter clips with gentle easing
  npx tsx stitch-videos-eased.ts \\
    -c v1.mp4 -c v2.mp4 -c v3.mp4 \\
    -o out.mp4 -d 1.0 -e easeInOutSine
`);
    process.exit(0);
  }

  if (values["list-easings"]) {
    console.log("Available easing functions:\n");
    listEasingNames().forEach((name) => console.log(`  ${name}`));
    console.log(`\nOr use --bezier for custom cubic-bezier curves.`);
    process.exit(0);
  }

  if (!values.clips || values.clips.length < 2) {
    console.error("Error: At least 2 clips are required (use --clips multiple times)");
    process.exit(1);
  }
  if (!values.output) {
    console.error("Error: --output is required");
    process.exit(1);
  }

  let easing: string | [number, number, number, number] = values.easing || DEFAULT_EASING;
  if (values.bezier) {
    const parts = values.bezier.split(",").map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) {
      console.error("Error: --bezier must be 4 comma-separated numbers");
      process.exit(1);
    }
    easing = parts as [number, number, number, number];
  }

  return {
    clips: values.clips,
    output: values.output,
    clipDuration: parseFloat(values["clip-duration"] || String(DEFAULT_CLIP_DURATION)),
    outputFps: parseInt(values["output-fps"] || String(DEFAULT_OUTPUT_FPS), 10),
    easing,
    bitrate: values.bitrate || DEFAULT_BITRATE,
    keepTemp: values["keep-temp"] || false,
  };
}

async function main() {
  try {
    const options = parseArguments();
    const result = await stitchVideosEased(options);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
