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
  findMaxDimensions,
  type VideoMetadata,
} from "./lib/video-utils.js";
import { calculateSourceTimestamps } from "./lib/timestamp-calc.js";

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
// MAIN STITCH FUNCTION
// =============================================================================

async function stitchVideosEased(options: StitchOptions): Promise<StitchResult> {
  const { clips, output, clipDuration, outputFps, easing, bitrate, keepTemp } =
    options;

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
  const metadataList: VideoMetadata[] = clips.map((clip, i) => {
    const meta = getVideoMetadata(clip);
    console.error(
      `  [${i + 1}] ${path.basename(clip)}: ${meta.duration.toFixed(2)}s, ${meta.width}x${meta.height}`
    );
    return meta;
  });

  const { maxWidth, maxHeight } = findMaxDimensions(metadataList);
  console.error(`  Target resolution: ${maxWidth}x${maxHeight}`);

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

      // Calculate timestamps for this clip using shared library
      const { timestamps } = calculateSourceTimestamps({
        easingFunc,
        inputDuration: metadata.duration,
        outputDuration: clipDuration,
        outputFps,
        inputFps: metadata.fps,
      });

      // Extract frames with global frame numbering and auto-scaling
      const framesExtracted = await extractFramesAtTimestamps({
        inputPath: clip,
        tempDir,
        timestamps,
        width: maxWidth,
        height: maxHeight,
        frameOffset: totalFrameCount,
        scaleWithPadding: true, // Enable auto-scaling for stitching
        onProgress: (extracted, total) => {
          const percent = Math.round((extracted / total) * 100);
          process.stderr.write(
            `\r    Frames: ${extracted}/${total} (${percent}%)`
          );
        },
      });

      process.stderr.write("\n");
      totalFrameCount += framesExtracted;
    }

    console.error(`\nTotal frames: ${totalFrameCount}`);

    // Ensure output directory exists
    const outputDir = path.dirname(output);
    if (outputDir && !existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // Encode all frames into final video
    const inputPattern = path.join(tempDir, "frame_%06d.png");
    encodeFramesToVideo({
      inputPattern,
      outputPath: output,
      fps: outputFps,
      bitrate,
    });

    const totalDuration = totalFrameCount / outputFps;
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
    console.error(
      "Error: At least 2 clips are required (use --clips multiple times)"
    );
    process.exit(1);
  }
  if (!values.output) {
    console.error("Error: --output is required");
    process.exit(1);
  }

  let easing: string | [number, number, number, number] =
    values.easing || DEFAULT_EASING;
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
    clipDuration: parseFloat(
      values["clip-duration"] || String(DEFAULT_CLIP_DURATION)
    ),
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
