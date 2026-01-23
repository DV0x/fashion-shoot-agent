// server/actions/generate-hero.ts
// Action executor for generating the hero shot

import { ActionExecutor, ActionResult, ActionContext } from "./types.js";

export const generateHeroExecutor: ActionExecutor = {
  template: {
    id: "generate_hero",
    name: "Generate Hero Shot",
    description: "Create a full-body editorial hero image using AI image generation",
    icon: "📸",
    stage: "hero",
    parameters: {
      prompt: {
        type: "text",
        label: "Prompt",
        description: "The full prompt describing the hero shot",
        required: true,
        multiline: true,
        placeholder: "Full-body editorial fashion photograph...",
      },
      aspectRatio: {
        type: "enum",
        label: "Aspect Ratio",
        description: "Image aspect ratio",
        default: "3:2",
        options: [
          { value: "3:2", label: "3:2 (Standard)" },
          { value: "2:3", label: "2:3 (Portrait)" },
          { value: "16:9", label: "16:9 (Widescreen)" },
          { value: "9:16", label: "9:16 (Vertical)" },
          { value: "1:1", label: "1:1 (Square)" },
          { value: "4:3", label: "4:3 (Classic)" },
          { value: "3:4", label: "3:4 (Portrait Classic)" },
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
        description: "Include uploaded reference images in generation",
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

    // Build script arguments
    const scriptPath = ".claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts";
    // Output path for script execution (relative to cwd which is agent/)
    const outputPath = `outputs/hero.png`;
    // Full path for verification
    const fullOutputPath = `${context.outputDir}/hero.png`;

    console.log(`📸 [HERO] Generating hero shot:`);
    console.log(`   Script: ${scriptPath}`);
    console.log(`   Output: ${outputPath}`);
    console.log(`   Full path: ${fullOutputPath}`);
    console.log(`   Reference images: ${context.referenceImages.length}`);

    const args: string[] = [
      "--prompt", prompt,
      "--output", outputPath,
      "--aspect-ratio", String(aspectRatio),
      "--resolution", String(resolution),
    ];

    // Add reference images if enabled and available
    if (useReferenceImages && context.referenceImages.length > 0) {
      for (const imagePath of context.referenceImages) {
        args.push("--input", imagePath);
      }
    }

    context.emitProgress("hero", "Starting hero image generation...");

    try {
      const result = await context.runScript(scriptPath, args);

      if (result.exitCode !== 0) {
        // Check for specific error messages
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
          error: errorMessage || "Image generation failed",
          errorCode: "GENERATION_FAILED",
          retryable: true,
        };
      }

      // Extract artifact from result - use outputs/hero.png format for static serving
      const artifact = result.artifacts?.[0] || outputPath;

      console.log(`📸 [HERO] Generation complete:`);
      console.log(`   Exit code: ${result.exitCode}`);
      console.log(`   Artifact: ${artifact}`);
      console.log(`   Stdout: ${result.stdout.substring(0, 200)}...`);

      context.emitProgress("hero", "Hero image generated successfully", 100);

      return {
        success: true,
        artifact,
        message: "Hero shot generated successfully",
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
