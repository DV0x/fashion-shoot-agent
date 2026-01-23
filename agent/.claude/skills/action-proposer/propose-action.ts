#!/usr/bin/env npx tsx
/**
 * propose-action.ts
 *
 * Emit an action proposal for user review and approval.
 * The server intercepts this output and sends an ActionInstance to the frontend.
 *
 * Usage:
 *   npx tsx propose-action.ts \
 *     --templateId generate_hero \
 *     --label "Dramatic Hero Shot" \
 *     --params '{"prompt": "...", "aspectRatio": "3:2"}'
 */

import { randomUUID } from "crypto";
import { parseArgs } from "util";

// Valid template IDs
const VALID_TEMPLATES = [
  "generate_hero",
  "generate_contact_sheet",
  "extract_frames",
  "resize_frames",
  "generate_video_clip",
  "generate_all_clips",
  "stitch_final",
];

function parseArguments() {
  const { values } = parseArgs({
    options: {
      templateId: { type: "string", short: "t" },
      label: { type: "string", short: "l" },
      params: { type: "string", short: "p" },
      help: { type: "boolean", short: "h" },
    },
    allowPositionals: false,
  });

  if (values.help) {
    console.log(`
propose-action.ts - Propose an action for user approval

Usage:
  npx tsx propose-action.ts [options]

Options:
  -t, --templateId  Action template ID (required)
  -l, --label       Human-readable action description (required)
  -p, --params      JSON parameters for the action (required)
  -h, --help        Show this help message

Valid templateIds:
  ${VALID_TEMPLATES.join(", ")}

Example:
  npx tsx propose-action.ts \\
    --templateId generate_hero \\
    --label "Dramatic Hero Shot" \\
    --params '{"prompt": "Full-body fashion photo...", "aspectRatio": "3:2"}'
`);
    process.exit(0);
  }

  if (!values.templateId) {
    console.error("Error: --templateId is required");
    process.exit(1);
  }

  if (!VALID_TEMPLATES.includes(values.templateId)) {
    console.error(`Error: Invalid templateId "${values.templateId}"`);
    console.error(`Valid options: ${VALID_TEMPLATES.join(", ")}`);
    process.exit(1);
  }

  if (!values.label) {
    console.error("Error: --label is required");
    process.exit(1);
  }

  if (!values.params) {
    console.error("Error: --params is required");
    process.exit(1);
  }

  let params: Record<string, unknown>;
  try {
    params = JSON.parse(values.params);
  } catch (error) {
    console.error("Error: --params must be valid JSON");
    process.exit(1);
  }

  return {
    templateId: values.templateId,
    label: values.label,
    params,
  };
}

function main() {
  const args = parseArguments();

  // Generate unique instance ID
  const instanceId = `action_${randomUUID()}`;

  // Emit action proposal JSON
  // The server's PreToolUse hook will intercept this and send to frontend
  const proposal = {
    type: "action_proposal",
    instanceId,
    templateId: args.templateId,
    label: args.label,
    params: args.params,
    timestamp: new Date().toISOString(),
  };

  // Output as JSON line (server parses this from stdout)
  console.log(JSON.stringify(proposal));

  // Also log human-readable confirmation to stderr
  console.error(`✅ Action proposed: ${args.label}`);
  console.error(`   Template: ${args.templateId}`);
  console.error(`   Instance: ${instanceId}`);
}

main();
