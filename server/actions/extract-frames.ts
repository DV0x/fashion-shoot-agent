// server/actions/extract-frames.ts
// Action executor for extracting individual frames from contact sheet

import { ActionExecutor, ActionResult, ActionContext } from "./types.js";

export const extractFramesExecutor: ActionExecutor = {
  template: {
    id: "extract_frames",
    name: "Extract Frames",
    description: "Extract 6 individual frames from the contact sheet grid",
    icon: "✂️",
    stage: "frames",
    parameters: {
      cropMethod: {
        type: "enum",
        label: "Crop Method",
        description: "How to detect and crop frame boundaries",
        default: "variance",
        options: [
          {
            value: "variance",
            label: "Smart Detection (Recommended)",
          },
          {
            value: "simple",
            label: "Simple Math (Fallback)",
          },
        ],
      },
      rows: {
        type: "number",
        label: "Grid Rows",
        description: "Number of rows in the contact sheet",
        default: 2,
        min: 1,
        max: 4,
        step: 1,
      },
      cols: {
        type: "number",
        label: "Grid Columns",
        description: "Number of columns in the contact sheet",
        default: 3,
        min: 1,
        max: 4,
        step: 1,
      },
      padding: {
        type: "number",
        label: "Edge Padding",
        description: "Pixels to trim from each frame edge (helps remove grid lines)",
        default: 0,
        min: 0,
        max: 50,
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
      cropMethod = "variance",
      rows = 2,
      cols = 3,
      padding = 0,
    } = params;

    // Get contact sheet path
    const contactSheet = context.getAsset("contactSheet");
    if (!contactSheet || typeof contactSheet !== "string") {
      return {
        success: false,
        error: "Contact sheet not found. Generate it first.",
        errorCode: "MISSING_CONTACT_SHEET",
        retryable: false,
      };
    }

    // Select script based on crop method
    const useSimple = cropMethod === "simple";
    const scriptPath = useSimple
      ? ".claude/skills/fashion-shoot-pipeline/scripts/crop-frames-ffmpeg.ts"
      : ".claude/skills/fashion-shoot-pipeline/scripts/crop-frames.ts";

    // Output path relative to cwd (agent/) for static serving at /outputs
    const outputDir = `outputs/frames/`;

    console.log(`✂️ [FRAMES] Extracting frames:`);
    console.log(`   Input: ${contactSheet}`);
    console.log(`   Output dir: ${outputDir}`);
    console.log(`   Method: ${useSimple ? 'simple' : 'variance'}`);

    const args: string[] = [
      "--input", contactSheet,
      "--output-dir", outputDir,
      "--rows", String(rows),
      "--cols", String(cols),
    ];

    // Add padding for simple method
    if (useSimple && padding && Number(padding) > 0) {
      args.push("--padding", String(padding));
    }

    const methodName = useSimple ? "Simple Math" : "Smart Detection";
    context.emitProgress("frames", `Extracting frames using ${methodName}...`);

    try {
      let result = await context.runScript(scriptPath, args);

      // If variance-based detection failed and we're not already using simple, offer it as option
      if (result.exitCode !== 0 && !useSimple) {
        const errorMessage = result.stderr || result.stdout || "";

        // Check if it's a gutter detection failure
        if (errorMessage.toLowerCase().includes("gutter") ||
            errorMessage.toLowerCase().includes("detection")) {
          return {
            success: false,
            error: "Smart detection couldn't find frame boundaries. Try 'Simple Math' crop method instead.",
            errorCode: "DETECTION_FAILED",
            retryable: true,
          };
        }

        return {
          success: false,
          error: errorMessage || "Frame extraction failed",
          errorCode: "EXTRACTION_FAILED",
          retryable: true,
        };
      }

      if (result.exitCode !== 0) {
        return {
          success: false,
          error: result.stderr || result.stdout || "Frame extraction failed",
          errorCode: "EXTRACTION_FAILED",
          retryable: true,
        };
      }

      const frameCount = Number(rows) * Number(cols);
      const artifacts = result.artifacts ||
        Array.from({ length: frameCount }, (_, i) => `${outputDir}frame-${i + 1}.png`);

      context.emitProgress("frames", `Extracted ${frameCount} frames successfully`, 100);

      return {
        success: true,
        artifacts,
        message: `${frameCount} frames extracted using ${methodName}`,
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
