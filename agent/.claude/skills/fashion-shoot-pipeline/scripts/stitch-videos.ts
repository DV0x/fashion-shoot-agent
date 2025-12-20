#!/usr/bin/env npx tsx
/**
 * stitch-videos.ts
 *
 * Stitch multiple video clips with smooth eased transitions using FFmpeg.
 * Uses custom expressions to achieve smooth easing (cubic, sinusoidal, etc.)
 *
 * Usage:
 *   npx tsx stitch-videos.ts \
 *     --clips video-1.mp4 video-2.mp4 video-3.mp4 \
 *     --output final.mp4 \
 *     --transition fade \
 *     --easing cubic-out \
 *     --transition-duration 0.5
 */

import "dotenv/config";

import ffmpeg from "fluent-ffmpeg";
import { existsSync } from "fs";
import { parseArgs } from "util";
import * as path from "path";

// Easing expressions - store eased progress in st(0)
// Based on https://github.com/scriptituk/xfade-easing
// Note: "in" = fast start/slow end (CSS ease-out), "out" = slow start/fast end (CSS ease-in)
const EASING_EXPRESSIONS: Record<string, string> = {
  // Basic
  "linear": "st(0,P)",

  // Quadratic
  "quadratic-in": "st(0,P*(2-P))",
  "quadratic-out": "st(0,P*P)",
  "quadratic-in-out": "st(0,if(lt(P,0.5),2*P*P,2*P*(2-P)-1))",

  // Cubic
  "cubic-in": "st(0,1-(1-P)^3)",
  "cubic-out": "st(0,P^3)",
  "cubic-in-out": "st(0,if(lt(P,0.5),4*P^3,1-4*(1-P)^3))",

  // Quartic
  "quartic-in": "st(0,1-(1-P)^4)",
  "quartic-out": "st(0,P^4)",
  "quartic-in-out": "st(0,if(lt(P,0.5),8*P^4,1-8*(1-P)^4))",

  // Quintic
  "quintic-in": "st(0,1-(1-P)^5)",
  "quintic-out": "st(0,P^5)",
  "quintic-in-out": "st(0,if(lt(P,0.5),16*P^5,1-16*(1-P)^5))",

  // Sinusoidal
  "sinusoidal-in": "st(0,sin(P*PI/2))",
  "sinusoidal-out": "st(0,1-cos(P*PI/2))",
  "sinusoidal-in-out": "st(0,(1-cos(P*PI))/2)",

  // Premium/Fashion presets - approximations of cubic-bezier curves
  // "luxurious" approximates cubic-bezier(0.19, 1, 0.22, 1) - very fast start, ultra gentle end
  "luxurious": "st(0,1-(1-P)^6)",
  // "cinematic" - smooth, professional feel
  "cinematic": "st(0,P*P*(3-2*P))",
  // "smooth" - classic smoothstep, gentle both ends
  "smooth": "st(0,P*P*(3-2*P))",
};

// Transition expressions - read eased progress from ld(0)
// These work with the eased value instead of linear P
const TRANSITION_EXPRESSIONS: Record<string, string> = {
  "fade": "A*ld(0)+B*(1-ld(0))",
  // fadeblack: first half fades A to black, second half fades black to B
  // Uses PLANE to handle YUV correctly (Y=0 for black, but U/V=128 for neutral)
  "fadeblack": "st(1,if(eq(PLANE,0),0,128));if(lt(ld(0),0.5),lerp(A,ld(1),2*ld(0)),lerp(ld(1),B,2*ld(0)-1))",
  // fadewhite: first half fades A to white, second half fades white to B
  "fadewhite": "st(1,if(eq(PLANE,0),255,128));if(lt(ld(0),0.5),lerp(A,ld(1),2*ld(0)),lerp(ld(1),B,2*ld(0)-1))",
  "wipeleft": "if(gt(X,W*ld(0)),B,A)",
  "wiperight": "if(gt(X,W*(1-ld(0))),A,B)",
  "wipeup": "if(gt(Y,H*ld(0)),B,A)",
  "wipedown": "if(gt(Y,H*(1-ld(0))),A,B)",
  "slideleft": "if(gt(X,W*ld(0)),B,if(gt(X,W*ld(0)-W),b(X-W*ld(0)+W,Y),A))",
  "slideright": "if(lt(X,W*(1-ld(0))),B,if(lt(X,W*(2-ld(0))),a(X-W+W*ld(0),Y),A))",
  "circlecrop": "if(lt(hypot(X-W/2,Y-H/2),hypot(W/2,H/2)*ld(0)),A,B)",
  "circleopen": "if(lt(hypot(X-W/2,Y-H/2),hypot(W/2,H/2)*ld(0)),B,A)",
  "circleclose": "if(gt(hypot(X-W/2,Y-H/2),hypot(W/2,H/2)*(1-ld(0))),B,A)",
  "dissolve": "st(1,st(1,sin(X*12.9898+Y*78.233)*43758.545)-floor(ld(1)));st(1,ld(1)*2+ld(0)*2-1.5);if(gte(ld(1),0.5),A,B)",
};

type EasingType = keyof typeof EASING_EXPRESSIONS;
type TransitionType = keyof typeof TRANSITION_EXPRESSIONS;

interface StitchOptions {
  clips: string[];
  outputPath: string;
  transitionDuration?: number;
  transitionType?: TransitionType;
  easing?: EasingType;
  clipDuration?: number;
  speed?: number; // Playback speed multiplier (1.5 = 50% faster)
}

// Get video duration using ffprobe
function getVideoDuration(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe ${filePath}: ${err.message}`));
        return;
      }
      const duration = metadata.format.duration;
      if (typeof duration !== "number") {
        reject(new Error(`Could not determine duration for ${filePath}`));
        return;
      }
      resolve(duration);
    });
  });
}

// Validate all input clips exist
function validateClips(clips: string[]): void {
  for (const clip of clips) {
    if (!existsSync(clip)) {
      throw new Error(`Input clip not found: ${clip}`);
    }
  }
}

// Build the combined easing + transition expression
function buildCustomExpr(easing: EasingType, transition: TransitionType): string {
  const easingExpr = EASING_EXPRESSIONS[easing];
  const transitionExpr = TRANSITION_EXPRESSIONS[transition];

  if (!easingExpr) {
    throw new Error(`Unknown easing: ${easing}`);
  }
  if (!transitionExpr) {
    throw new Error(`Unknown transition: ${transition}`);
  }

  // Combine: first apply easing (stores in st(0)), then apply transition (reads from ld(0))
  return `${easingExpr};${transitionExpr}`;
}

// Build xfade filter chain for multiple clips using custom expressions
function buildFilterComplex(
  clipCount: number,
  clipDurations: number[],
  transitionDuration: number,
  transitionType: TransitionType,
  easing: EasingType,
  speed?: number
): string {
  if (clipCount < 2) {
    throw new Error("Need at least 2 clips to stitch");
  }

  const customExpr = buildCustomExpr(easing, transitionType);
  // Escape single quotes for FFmpeg
  const escapedExpr = customExpr.replace(/'/g, "'\\''");

  const filters: string[] = [];

  // Apply speed adjustment to each clip if specified
  const speedInputs: string[] = [];
  if (speed && speed !== 1) {
    const ptsFactor = (1 / speed).toFixed(6);
    for (let i = 0; i < clipCount; i++) {
      filters.push(`[${i}:v]setpts=${ptsFactor}*PTS[s${i}]`);
      speedInputs.push(`s${i}`);
    }
  } else {
    for (let i = 0; i < clipCount; i++) {
      speedInputs.push(`${i}:v`);
    }
  }

  // Adjust durations for speed
  const adjustedDurations = speed && speed !== 1
    ? clipDurations.map(d => d / speed)
    : clipDurations;

  let lastOutput = `[${speedInputs[0]}]`;
  let accumulatedDuration = adjustedDurations[0];

  for (let i = 1; i < clipCount; i++) {
    const offset = accumulatedDuration - transitionDuration;
    const outputLabel = i === clipCount - 1 ? "vout" : `v${i}`;
    const currentInput = `[${speedInputs[i]}]`;

    filters.push(
      `${lastOutput}${currentInput}xfade=transition=custom:duration=${transitionDuration}:offset=${offset.toFixed(3)}:expr='${escapedExpr}'[${outputLabel}]`
    );

    lastOutput = `[${outputLabel}]`;
    accumulatedDuration += adjustedDurations[i] - transitionDuration;
  }

  return filters.join(";");
}

// Stitch videos using FFmpeg with custom easing expressions
async function stitchVideos(options: StitchOptions): Promise<string> {
  const {
    clips,
    outputPath,
    transitionDuration = 0.5,
    transitionType = "fade",
    easing = "cubic-out",
    clipDuration,
    speed,
  } = options;

  if (clips.length < 2) {
    throw new Error("Need at least 2 clips to stitch");
  }

  validateClips(clips);

  console.error(`Stitching ${clips.length} video clips...`);
  console.error(`Transition: ${transitionType}`);
  console.error(`Easing: ${easing}`);
  console.error(`Transition duration: ${transitionDuration}s`);
  if (speed && speed !== 1) {
    console.error(`Speed: ${speed}x (${((speed - 1) * 100).toFixed(0)}% faster)`);
  }

  // Get durations for all clips
  let clipDurations: number[];
  if (clipDuration) {
    console.error(`Using fixed clip duration: ${clipDuration}s`);
    clipDurations = clips.map(() => clipDuration);
  } else {
    console.error("Probing clip durations...");
    clipDurations = await Promise.all(clips.map(getVideoDuration));
    clipDurations.forEach((d, i) => {
      console.error(`  ${path.basename(clips[i])}: ${d.toFixed(2)}s`);
    });
  }

  const minDuration = Math.min(...clipDurations);
  if (transitionDuration >= minDuration) {
    throw new Error(
      `Transition duration (${transitionDuration}s) must be shorter than shortest clip (${minDuration.toFixed(2)}s)`
    );
  }

  const filterComplex = buildFilterComplex(
    clips.length,
    clipDurations,
    transitionDuration,
    transitionType,
    easing,
    speed
  );

  console.error("Filter complex built");
  console.error("Starting FFmpeg...");

  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    clips.forEach((clip) => {
      command = command.input(clip);
    });

    command
      .complexFilter(filterComplex)
      .outputOptions([
        "-map", "[vout]",
        "-filter_complex_threads", "1"  // Required for custom expressions with state variables
      ])
      .output(outputPath)
      .on("start", (cmdline) => {
        console.error(`FFmpeg command: ${cmdline.substring(0, 300)}...`);
      })
      .on("progress", (progress) => {
        if (progress.percent) {
          console.error(`Progress: ${progress.percent.toFixed(1)}%`);
        }
      })
      .on("end", () => {
        console.error(`Saved: ${outputPath}`);
        resolve(outputPath);
      })
      .on("error", (err) => {
        reject(new Error(`FFmpeg error: ${err.message}`));
      })
      .run();
  });
}

// Parse command line arguments
function parseArguments() {
  const { values } = parseArgs({
    options: {
      clips: { type: "string", short: "c", multiple: true },
      output: { type: "string", short: "o" },
      transition: { type: "string", short: "t" },
      easing: { type: "string", short: "e" },
      "transition-duration": { type: "string", short: "d" },
      "clip-duration": { type: "string" },
      speed: { type: "string", short: "s" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    const easings = Object.keys(EASING_EXPRESSIONS).join(", ");
    const transitions = Object.keys(TRANSITION_EXPRESSIONS).join(", ");

    console.log(`
stitch-videos.ts - Stitch video clips with smooth eased transitions using FFmpeg

Usage:
  npx tsx stitch-videos.ts [options]

Options:
  -c, --clips              Input video files (required, specify multiple times)
  -o, --output             Output video file path (required)
  -t, --transition         Transition type (default: fade)
                           Options: ${transitions}
  -e, --easing             Easing curve (default: cubic-out)
                           Options: ${easings}
  -d, --transition-duration  Transition duration in seconds (default: 0.5)
  -s, --speed              Playback speed multiplier (1.5 = 50% faster)
      --clip-duration      Fixed clip duration (auto-detected if not specified)
  -h, --help               Show this help message

Easing Types:
  linear          - Constant speed (no easing)
  cubic-out       - Smooth deceleration (recommended for fashion)
  cubic-in        - Smooth acceleration
  cubic-in-out    - Smooth start and end
  sinusoidal-*    - Gentle, wave-like motion
  quartic-*       - More pronounced than cubic
  quintic-*       - Even more dramatic

Examples:
  # Smooth fade with cubic easing (fashion-friendly)
  npx tsx stitch-videos.ts \\
    --clips video-1.mp4 --clips video-2.mp4 \\
    --output final.mp4 \\
    --transition fade \\
    --easing cubic-out

  # Stitch 6 clips with sinusoidal easing
  npx tsx stitch-videos.ts \\
    --clips f1.mp4 --clips f2.mp4 --clips f3.mp4 \\
    --clips f4.mp4 --clips f5.mp4 --clips f6.mp4 \\
    --output fashion-video.mp4 \\
    --transition fade \\
    --easing sinusoidal-in-out \\
    --transition-duration 0.5

  # Wipe transition with quartic easing
  npx tsx stitch-videos.ts \\
    --clips a.mp4 --clips b.mp4 \\
    --output merged.mp4 \\
    --transition wipeleft \\
    --easing quartic-in-out
`);
    process.exit(0);
  }

  if (!values.clips || values.clips.length < 2) {
    console.error("Error: At least 2 --clips are required");
    process.exit(1);
  }

  if (!values.output) {
    console.error("Error: --output is required");
    process.exit(1);
  }

  const validTransitions = Object.keys(TRANSITION_EXPRESSIONS);
  const transition = values.transition || "fade";
  if (!validTransitions.includes(transition)) {
    console.error(`Error: Invalid transition '${transition}'`);
    console.error(`Valid options: ${validTransitions.join(", ")}`);
    process.exit(1);
  }

  const validEasings = Object.keys(EASING_EXPRESSIONS);
  const easing = values.easing || "cubic-out";
  if (!validEasings.includes(easing)) {
    console.error(`Error: Invalid easing '${easing}'`);
    console.error(`Valid options: ${validEasings.join(", ")}`);
    process.exit(1);
  }

  const transitionDuration = values["transition-duration"]
    ? parseFloat(values["transition-duration"])
    : 0.5;
  if (isNaN(transitionDuration) || transitionDuration <= 0) {
    console.error("Error: --transition-duration must be a positive number");
    process.exit(1);
  }

  const clipDuration = values["clip-duration"]
    ? parseFloat(values["clip-duration"])
    : undefined;
  if (clipDuration !== undefined && (isNaN(clipDuration) || clipDuration <= 0)) {
    console.error("Error: --clip-duration must be a positive number");
    process.exit(1);
  }

  const speed = values.speed ? parseFloat(values.speed) : undefined;
  if (speed !== undefined && (isNaN(speed) || speed <= 0)) {
    console.error("Error: --speed must be a positive number (e.g., 1.5 for 50% faster)");
    process.exit(1);
  }

  return {
    clips: values.clips,
    outputPath: values.output,
    transitionType: transition as TransitionType,
    easing: easing as EasingType,
    transitionDuration,
    clipDuration,
    speed,
  };
}

// Main
async function main() {
  try {
    const args = parseArguments();

    const outputPath = await stitchVideos({
      clips: args.clips,
      outputPath: args.outputPath,
      transitionType: args.transitionType,
      easing: args.easing,
      transitionDuration: args.transitionDuration,
      clipDuration: args.clipDuration,
      speed: args.speed,
    });

    // Output result path to stdout (for pipeline integration)
    console.log(outputPath);
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
