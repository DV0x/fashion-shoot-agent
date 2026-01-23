// server/actions/generate-all-clips.ts
// Action executor for generating all video clips in batch

import { ActionExecutor, ActionResult, ActionContext } from "./types.js";

export const generateAllClipsExecutor: ActionExecutor = {
  template: {
    id: "generate_all_clips",
    name: "Generate All Video Clips",
    description: "Generate all 5 video clips (or 6 with loop) in sequence",
    icon: "🎥",
    stage: "clips",
    parameters: {
      motionPrompt: {
        type: "text",
        label: "Motion Prompt",
        description: "Describe the camera movement style (applied to all clips)",
        required: true,
        multiline: true,
        placeholder: "Smooth camera transition, cinematic movement...",
      },
      duration: {
        type: "enum",
        label: "Duration per Clip",
        description: "Duration for each video clip",
        default: "5",
        options: [
          { value: "5", label: "5 seconds" },
          { value: "10", label: "10 seconds" },
        ],
      },
      includeLoop: {
        type: "boolean",
        label: "Include Loop Clip",
        description: "Generate 6th clip (frame 6 → frame 1) for seamless looping",
        default: false,
      },
      negativePrompt: {
        type: "text",
        label: "Negative Prompt",
        description: "What to avoid in generation",
        default: "blur, distort, and low quality",
        advanced: true,
      },
    },
  },

  execute: async (
    params: Record<string, unknown>,
    context: ActionContext
  ): Promise<ActionResult> => {
    const {
      motionPrompt,
      duration = "5",
      includeLoop = false,
      negativePrompt = "blur, distort, and low quality",
    } = params;

    if (!motionPrompt || typeof motionPrompt !== "string") {
      return {
        success: false,
        error: "Motion prompt is required",
        errorCode: "MISSING_PROMPT",
        retryable: false,
      };
    }

    // Verify frames exist
    const frames = context.getAsset("frames");
    if (!frames || !Array.isArray(frames) || frames.length < 6) {
      return {
        success: false,
        error: "Need 6 frames. Extract frames first.",
        errorCode: "MISSING_FRAMES",
        retryable: false,
      };
    }

    const scriptPath = ".claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts";
    const clipCount = includeLoop ? 6 : 5;
    const artifacts: string[] = [];
    const errors: string[] = [];

    for (let clipNum = 1; clipNum <= clipCount; clipNum++) {
      // Frame pair mapping
      const startFrameIndex = clipNum - 1;
      const endFrameIndex = clipNum === 6 ? 0 : clipNum;

      const startFrame = frames[startFrameIndex];
      const endFrame = frames[endFrameIndex];
      // Output path relative to cwd (agent/) for static serving at /outputs
      const outputPath = `outputs/videos/video-${clipNum}.mp4`;

      console.log(`🎥 [ALL CLIPS] Generating clip ${clipNum}/${clipCount}:`);
      console.log(`   Start: ${startFrame} → End: ${endFrame}`);
      console.log(`   Output: ${outputPath}`);

      const args: string[] = [
        "--input", startFrame,
        "--input-tail", endFrame,
        "--prompt", motionPrompt,
        "--output", outputPath,
        "--duration", String(duration),
      ];

      if (negativePrompt && typeof negativePrompt === "string") {
        args.push("--negative-prompt", negativePrompt);
      }

      context.emitProgress("clips", `Generating clip ${clipNum}/${clipCount}...`, Math.round(((clipNum - 1) / clipCount) * 100));

      try {
        const result = await context.runScript(scriptPath, args);

        if (result.exitCode !== 0) {
          const errorMessage = result.stderr || result.stdout;

          if (errorMessage.includes("KLING")) {
            return {
              success: false,
              error: "KLING_ACCESS_KEY and KLING_SECRET_KEY environment variables are required",
              errorCode: "MISSING_API_KEY",
              retryable: false,
            };
          }

          errors.push(`Clip ${clipNum}: ${errorMessage || "failed"}`);
          continue;
        }

        const artifact = result.artifacts?.[0] || outputPath;
        artifacts.push(artifact);

        context.emitProgress("clips", `Clip ${clipNum}/${clipCount} complete`, Math.round((clipNum / clipCount) * 100));

      } catch (error) {
        errors.push(`Clip ${clipNum}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (artifacts.length === 0) {
      return {
        success: false,
        error: errors.join("; ") || "All clips failed to generate",
        errorCode: "ALL_CLIPS_FAILED",
        retryable: true,
      };
    }

    if (errors.length > 0) {
      return {
        success: true,
        artifacts,
        message: `Generated ${artifacts.length}/${clipCount} clips. Errors: ${errors.join("; ")}`,
      };
    }

    return {
      success: true,
      artifacts,
      message: `All ${clipCount} video clips generated successfully`,
    };
  },
};
