// server/actions/stitch-final.ts
// Action executor for stitching video clips into final fashion video

import { ActionExecutor, ActionResult, ActionContext } from "./types.js";

export const stitchFinalExecutor: ActionExecutor = {
  template: {
    id: "stitch_final",
    name: "Stitch Final Video",
    description: "Combine all video clips into the final fashion video with speed curves",
    icon: "🎞️",
    stage: "final",
    parameters: {
      clipDuration: {
        type: "number",
        label: "Clip Duration",
        description: "Output duration per clip in seconds (after speed curve)",
        default: 1.5,
        min: 0.5,
        max: 3.0,
        step: 0.1,
      },
      easingCurve: {
        type: "enum",
        label: "Easing Curve",
        description: "Speed curve for smooth transitions",
        default: "dramaticSwoop",
        options: [
          { value: "dramaticSwoop", label: "Dramatic Swoop (Recommended)" },
          { value: "easeInOutSine", label: "Ease In/Out Sine (Gentle)" },
          { value: "easeInOutCubic", label: "Ease In/Out Cubic (Smooth)" },
          { value: "easeInOutQuart", label: "Ease In/Out Quart (Punchy)" },
          { value: "easeInOutExpo", label: "Ease In/Out Expo (Extreme)" },
        ],
      },
      includeLoop: {
        type: "boolean",
        label: "Include Loop Clip",
        description: "Include 6th clip for seamless looping (if generated)",
        default: false,
      },
      outputFps: {
        type: "number",
        label: "Output FPS",
        description: "Frame rate for final video",
        default: 60,
        min: 24,
        max: 120,
        step: 1,
        advanced: true,
      },
    },
  },

  execute: async (
    params: Record<string, unknown>,
    context: ActionContext
  ): Promise<ActionResult> => {
    const {
      clipDuration = 1.5,
      easingCurve = "dramaticSwoop",
      includeLoop = false,
      outputFps = 60,
    } = params;

    // Verify videos exist
    const videos = context.getAsset("videos");
    if (!videos || !Array.isArray(videos) || videos.length < 2) {
      return {
        success: false,
        error: "Not enough video clips. Generate clips first.",
        errorCode: "MISSING_VIDEOS",
        retryable: false,
      };
    }

    // Determine which clips to include
    const clipCount = includeLoop ? Math.min(videos.length, 6) : Math.min(videos.length, 5);
    const clipsToStitch = videos.slice(0, clipCount);

    if (clipsToStitch.length < 2) {
      return {
        success: false,
        error: "Need at least 2 video clips to stitch",
        errorCode: "INSUFFICIENT_CLIPS",
        retryable: false,
      };
    }

    const scriptPath = ".claude/skills/fashion-shoot-pipeline/scripts/stitch-videos-eased.ts";
    // Output path relative to cwd (agent/) for static serving at /outputs
    const outputPath = `outputs/final/fashion-video.mp4`;

    console.log(`🎞️ [STITCH] Stitching final video:`);
    console.log(`   Clips: ${clipsToStitch.join(', ')}`);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Easing: ${easingCurve}`);

    // Build args with multiple --clips
    const args: string[] = [];
    for (const clip of clipsToStitch) {
      args.push("--clips", clip);
    }
    args.push(
      "--output", outputPath,
      "--clip-duration", String(clipDuration),
      "--output-fps", String(outputFps)
    );

    // Handle easing - dramaticSwoop is a custom bezier
    if (easingCurve === "dramaticSwoop") {
      args.push("--bezier", "0.85,0,0.15,1");
    } else {
      args.push("--easing", String(easingCurve));
    }

    context.emitProgress("final", `Stitching ${clipsToStitch.length} clips with ${easingCurve}...`);

    try {
      const result = await context.runScript(scriptPath, args);

      if (result.exitCode !== 0) {
        const errorMessage = result.stderr || result.stdout;

        if (errorMessage.includes("ffmpeg")) {
          return {
            success: false,
            error: "FFmpeg not found. Install with: brew install ffmpeg",
            errorCode: "MISSING_FFMPEG",
            retryable: false,
          };
        }

        return {
          success: false,
          error: errorMessage || "Video stitching failed",
          errorCode: "STITCH_FAILED",
          retryable: true,
        };
      }

      const artifact = result.artifacts?.[0] || outputPath;
      const totalDuration = clipsToStitch.length * Number(clipDuration);

      context.emitProgress("final", "Final video created successfully", 100);

      return {
        success: true,
        artifact,
        message: `Final ${totalDuration.toFixed(1)}s fashion video created from ${clipsToStitch.length} clips`,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        errorCode: "EXECUTION_ERROR",
        retryable: true,
      };
    }
  },
};
