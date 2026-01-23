// server/actions/generate-video-clip.ts
// Action executor for generating a single video clip between two frames

import { ActionExecutor, ActionResult, ActionContext } from "./types.js";

export const generateVideoClipExecutor: ActionExecutor = {
  template: {
    id: "generate_video_clip",
    name: "Generate Video Clip",
    description: "Generate a single video clip transitioning between two frames",
    icon: "🎬",
    stage: "clips",
    parameters: {
      clipNumber: {
        type: "number",
        label: "Clip Number",
        description: "Which clip to generate (1-5 for standard, 6 for loop)",
        required: true,
        default: 1,
        min: 1,
        max: 6,
        step: 1,
      },
      motionPrompt: {
        type: "text",
        label: "Motion Prompt",
        description: "Describe the camera movement and action",
        required: true,
        multiline: true,
        placeholder: "Smooth camera transition, model maintains pose...",
      },
      duration: {
        type: "enum",
        label: "Duration",
        description: "Video clip duration in seconds",
        default: "5",
        options: [
          { value: "5", label: "5 seconds" },
          { value: "10", label: "10 seconds" },
        ],
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
      clipNumber,
      motionPrompt,
      duration = "5",
      negativePrompt = "blur, distort, and low quality",
    } = params;

    if (!clipNumber || typeof clipNumber !== "number") {
      return {
        success: false,
        error: "Clip number is required",
        errorCode: "MISSING_CLIP_NUMBER",
        retryable: false,
      };
    }

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
    if (!frames || !Array.isArray(frames) || frames.length < 2) {
      return {
        success: false,
        error: "Not enough frames. Extract frames first.",
        errorCode: "MISSING_FRAMES",
        retryable: false,
      };
    }

    // Determine frame pair based on clip number
    // clip 1: frame-1 → frame-2
    // clip 2: frame-2 → frame-3
    // ...
    // clip 5: frame-5 → frame-6
    // clip 6: frame-6 → frame-1 (loop)
    const startFrameIndex = clipNumber - 1;
    const endFrameIndex = clipNumber === 6 ? 0 : clipNumber;

    if (startFrameIndex >= frames.length || endFrameIndex >= frames.length) {
      return {
        success: false,
        error: `Invalid clip number ${clipNumber} for ${frames.length} frames`,
        errorCode: "INVALID_CLIP_NUMBER",
        retryable: false,
      };
    }

    const startFrame = frames[startFrameIndex];
    const endFrame = frames[endFrameIndex];

    const scriptPath = ".claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts";
    // Output path relative to cwd (agent/) for static serving at /outputs
    const outputPath = `outputs/videos/video-${clipNumber}.mp4`;

    console.log(`🎬 [CLIP] Generating video clip ${clipNumber}:`);
    console.log(`   Start frame: ${startFrame}`);
    console.log(`   End frame: ${endFrame}`);
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

    context.emitProgress("clips", `Generating video clip ${clipNumber}...`);

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

        return {
          success: false,
          error: errorMessage || "Video generation failed",
          errorCode: "GENERATION_FAILED",
          retryable: true,
        };
      }

      const artifact = result.artifacts?.[0] || outputPath;
      context.emitProgress("clips", `Video clip ${clipNumber} generated successfully`, 100);

      return {
        success: true,
        artifact,
        message: `Video clip ${clipNumber} (frame ${startFrameIndex + 1} → ${endFrameIndex + 1}) generated`,
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
