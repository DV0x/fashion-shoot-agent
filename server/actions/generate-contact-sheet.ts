// server/actions/generate-contact-sheet.ts
// Action executor for generating the 2x3 contact sheet grid

import { ActionExecutor, ActionResult, ActionContext } from "./types.js";

export const generateContactSheetExecutor: ActionExecutor = {
  template: {
    id: "generate_contact_sheet",
    name: "Generate Contact Sheet",
    description: "Create a 2×3 grid of 6 camera angles/poses",
    icon: "🎞️",
    stage: "contact-sheet",
    parameters: {
      prompt: {
        type: "text",
        label: "Prompt",
        description: "The prompt describing the 6-panel contact sheet layout",
        required: true,
        multiline: true,
        placeholder: "Fashion editorial contact sheet, 2×3 grid showing 6 distinct camera angles...",
      },
      aspectRatio: {
        type: "enum",
        label: "Aspect Ratio",
        description: "Overall grid aspect ratio",
        default: "3:2",
        options: [
          { value: "3:2", label: "3:2 (Standard)" },
          { value: "16:9", label: "16:9 (Widescreen)" },
          { value: "1:1", label: "1:1 (Square)" },
        ],
      },
      resolution: {
        type: "enum",
        label: "Resolution",
        description: "Output image resolution",
        default: "2K",
        options: [
          { value: "1K", label: "1K (Fast)" },
          { value: "2K", label: "2K (Balanced)" },
          { value: "4K", label: "4K (High Quality)" },
        ],
      },
      useReferenceImages: {
        type: "boolean",
        label: "Use Reference Images",
        description: "Include uploaded reference images to maintain character consistency",
        default: true,
      },
    },
  },

  execute: async (
    params: Record<string, unknown>,
    context: ActionContext
  ): Promise<ActionResult> => {
    const {
      prompt,
      aspectRatio = "3:2",
      resolution = "2K",
      useReferenceImages = true,
    } = params;

    if (!prompt || typeof prompt !== "string") {
      return {
        success: false,
        error: "Prompt is required",
        errorCode: "MISSING_PROMPT",
        retryable: false,
      };
    }

    const scriptPath = ".claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts";
    // Output path relative to cwd (agent/) for static serving at /outputs
    const outputPath = `outputs/contact-sheet.png`;

    console.log(`🎞️ [CONTACT] Generating contact sheet:`);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Reference images: ${context.referenceImages.length}`);

    const args: string[] = [
      "--prompt", prompt,
      "--output", outputPath,
      "--aspect-ratio", String(aspectRatio),
      "--resolution", String(resolution),
    ];

    // Add reference images (hero + original refs) for consistency
    if (useReferenceImages) {
      const hero = context.getAsset("hero");
      if (hero && typeof hero === "string") {
        args.push("--input", hero);
      }
      for (const imagePath of context.referenceImages) {
        args.push("--input", imagePath);
      }
    }

    context.emitProgress("contact-sheet", "Generating contact sheet grid...");

    try {
      const result = await context.runScript(scriptPath, args);

      if (result.exitCode !== 0) {
        const errorMessage = result.stderr || result.stdout;

        if (errorMessage.includes("FAL_KEY")) {
          return {
            success: false,
            error: "FAL_KEY environment variable is not set",
            errorCode: "MISSING_API_KEY",
            retryable: false,
          };
        }

        return {
          success: false,
          error: errorMessage || "Contact sheet generation failed",
          errorCode: "GENERATION_FAILED",
          retryable: true,
        };
      }

      const artifact = result.artifacts?.[0] || outputPath;
      context.emitProgress("contact-sheet", "Contact sheet generated successfully", 100);

      return {
        success: true,
        artifact,
        message: "Contact sheet with 6 camera angles generated",
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
