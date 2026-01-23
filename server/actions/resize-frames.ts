// server/actions/resize-frames.ts
// Action executor for resizing frames to a target aspect ratio

import { ActionExecutor, ActionResult, ActionContext } from "./types.js";

export const resizeFramesExecutor: ActionExecutor = {
  template: {
    id: "resize_frames",
    name: "Resize Frames",
    description: "Resize all frames to a target aspect ratio (e.g., for TikTok 9:16 or YouTube 16:9)",
    icon: "📐",
    stage: "resize",
    parameters: {
      aspectRatio: {
        type: "enum",
        label: "Target Aspect Ratio",
        description: "The aspect ratio to resize frames to",
        required: true,
        default: "9:16",
        options: [
          { value: "16:9", label: "16:9 (Landscape/YouTube)" },
          { value: "9:16", label: "9:16 (Portrait/TikTok/Reels)" },
          { value: "1:1", label: "1:1 (Square/Instagram)" },
          { value: "4:3", label: "4:3 (Classic)" },
          { value: "3:4", label: "3:4 (Portrait Classic)" },
          { value: "3:2", label: "3:2 (Standard)" },
          { value: "2:3", label: "2:3 (Portrait Standard)" },
        ],
      },
    },
  },

  execute: async (
    params: Record<string, unknown>,
    context: ActionContext
  ): Promise<ActionResult> => {
    const { aspectRatio } = params;

    if (!aspectRatio || typeof aspectRatio !== "string") {
      return {
        success: false,
        error: "Aspect ratio is required",
        errorCode: "MISSING_ASPECT_RATIO",
        retryable: false,
      };
    }

    // Verify frames exist
    const frames = context.getAsset("frames");
    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return {
        success: false,
        error: "No frames found. Extract frames first.",
        errorCode: "MISSING_FRAMES",
        retryable: false,
      };
    }

    const scriptPath = ".claude/skills/fashion-shoot-pipeline/scripts/resize-frames.ts";
    // Output path relative to cwd (agent/) for static serving at /outputs
    const framesDir = `outputs/frames/`;

    console.log(`📐 [RESIZE] Resizing frames:`);
    console.log(`   Frames dir: ${framesDir}`);
    console.log(`   Target ratio: ${aspectRatio}`);

    const args: string[] = [
      "--input-dir", framesDir,
      "--output-dir", framesDir, // Overwrite in place
      "--aspect-ratio", aspectRatio,
    ];

    context.emitProgress("resize", `Resizing frames to ${aspectRatio}...`);

    try {
      const result = await context.runScript(scriptPath, args);

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || result.stdout || "Frame resize failed",
          errorCode: "RESIZE_FAILED",
          retryable: true,
        };
      }

      const artifacts = result.artifacts || frames;
      context.emitProgress("resize", `Resized ${artifacts.length} frames to ${aspectRatio}`, 100);

      return {
        success: true,
        artifacts,
        message: `All frames resized to ${aspectRatio}`,
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
