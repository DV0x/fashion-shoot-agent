# Scalable Workflows Implementation Plan

## Overview

This document outlines the step-by-step implementation plan to make the fashion-shoot-agent support multiple workflows through a config-driven architecture.

**Goal:** Add new workflows by creating config files only - no code changes required.

**Current State:** Hardcoded orchestrator prompt and checkpoint detection for fashion-editorial workflow only.

**Target State:** Config-driven system that supports any workflow (fashion, product, headshot, etc.)

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              BEFORE (Current)                                    │
│                                                                                  │
│   orchestrator-prompt.ts ──► Hardcoded fashion workflow                        │
│   ai-client.ts ──────────► Hardcoded checkpoint patterns                       │
└─────────────────────────────────────────────────────────────────────────────────┘

                                    ▼

┌─────────────────────────────────────────────────────────────────────────────────┐
│                              AFTER (Target)                                      │
│                                                                                  │
│   workflows/*.json ──► Config files define workflows                            │
│   prompt-generator.ts ──► Generates prompt FROM config                         │
│   checkpoint-detector.ts ──► Detects checkpoints FROM config                   │
│   sdk-server.ts ──► Loads config, passes to generator                          │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Steps

### Step 1: Create Workflow Config File

**File to create:** `workflows/fashion-editorial.json`

**Purpose:** Define the current fashion-editorial workflow as a config file.

**Tasks:**

1.1. Create `workflows/` directory in project root
```bash
mkdir -p workflows
```

1.2. Create `workflows/fashion-editorial.json` with the following structure:

```json
{
  "id": "fashion-editorial",
  "name": "Fashion Editorial",
  "description": "Editorial fashion photoshoot with 6-frame contact sheet and video clips",

  "skills": {
    "content": "editorial-photography",
    "actions": "fashion-shoot-pipeline"
  },

  "setup": {
    "directories": [
      "outputs/frames",
      "outputs/videos",
      "outputs/final"
    ],
    "workingDir": "agent"
  },

  "presetMatching": {
    "edgy, dramatic, bold, intense": {
      "pose": "editorial-drama",
      "background": "studio-black"
    },
    "casual, relaxed, natural, chill": {
      "pose": "relaxed-natural",
      "background": "studio-grey"
    },
    "street, urban, city": {
      "pose": "street-walk",
      "background": "outdoor-urban"
    },
    "professional, clean, commercial": {
      "pose": "confident-standing",
      "background": "studio-white"
    },
    "industrial, raw, concrete": {
      "pose": "leaning-casual",
      "background": "industrial"
    },
    "warm, soft, intimate": {
      "pose": "seated-editorial",
      "background": "warm-daylight"
    },
    "colorful, vibrant, bold colors": {
      "pose": "editorial-drama",
      "background": "color-gel"
    },
    "default": {
      "pose": "confident-standing",
      "background": "studio-grey"
    }
  },

  "phases": [
    {
      "name": "hero",
      "description": "Generate full-body hero image",
      "promptFile": "prompts/hero.md",
      "script": {
        "command": "generate-image.ts",
        "outputPath": "outputs/hero.png",
        "options": {
          "aspect-ratio": "3:2",
          "resolution": "2K"
        }
      },
      "checkpoint": {
        "detect": {
          "command_contains": "generate-image.ts",
          "output_contains": "outputs/hero.png"
        },
        "artifacts": ["outputs/hero.png"],
        "type": "image",
        "message": "Hero image ready. Reply \"continue\" or describe changes.",
        "modifications": {
          "description": "User requests change → Re-activate content skill, select new presets, regenerate hero.png",
          "examples": [
            "make it more dramatic",
            "change to outdoor background",
            "use a different pose"
          ]
        }
      }
    },
    {
      "name": "contact-sheet",
      "description": "Generate 2x3 contact sheet with 6 camera angles",
      "promptFile": "prompts/contact-sheet.md",
      "script": {
        "command": "generate-image.ts",
        "inputPath": "outputs/hero.png",
        "outputPath": "outputs/contact-sheet.png",
        "options": {
          "aspect-ratio": "3:2",
          "resolution": "2K"
        }
      },
      "checkpoint": null
    },
    {
      "name": "frames",
      "description": "Crop contact sheet into 6 individual frames",
      "script": {
        "command": "crop-frames.ts",
        "inputPath": "outputs/contact-sheet.png",
        "outputDir": "outputs/frames/",
        "options": {
          "rows": 2,
          "cols": 3
        }
      },
      "checkpoint": {
        "detect": [
          {
            "command_contains": "crop-frames.ts",
            "output_contains": "frame-6.png"
          },
          {
            "command_contains": "resize-frames.ts",
            "output_contains": "success"
          },
          {
            "command_contains": "generate-image.ts",
            "output_contains": "outputs/frames/frame-"
          }
        ],
        "artifacts": [
          "outputs/frames/frame-1.png",
          "outputs/frames/frame-2.png",
          "outputs/frames/frame-3.png",
          "outputs/frames/frame-4.png",
          "outputs/frames/frame-5.png",
          "outputs/frames/frame-6.png"
        ],
        "type": "image-grid",
        "message": "6 frames ready. Reply \"continue\" or request modifications.",
        "modifications": {
          "description": "User can modify individual frames, multiple frames, or resize all frames",
          "patterns": {
            "singleFrame": "modify frame {n}",
            "multipleFrames": "modify frames {list}",
            "resize": "resize to {ratio}"
          },
          "supportedRatios": ["16:9", "9:16", "4:3", "3:4", "1:1", "3:2", "2:3"],
          "examples": [
            "modify frame 3 to add sunglasses",
            "modify frames 2 and 5",
            "resize to 9:16 for TikTok"
          ]
        }
      }
    },
    {
      "name": "clips",
      "description": "Generate 6 video clips with camera movements",
      "promptFile": "prompts/video.md",
      "script": {
        "command": "generate-video.ts",
        "repeat": 6,
        "inputPattern": "outputs/frames/frame-{n}.png",
        "outputPattern": "outputs/videos/video-{n}.mp4",
        "options": {
          "duration": 5
        }
      },
      "checkpoint": {
        "detect": [
          {
            "command_contains": "generate-video.ts",
            "output_contains": "video-6.mp4"
          }
        ],
        "artifacts": [
          "outputs/videos/video-1.mp4",
          "outputs/videos/video-2.mp4",
          "outputs/videos/video-3.mp4",
          "outputs/videos/video-4.mp4",
          "outputs/videos/video-5.mp4",
          "outputs/videos/video-6.mp4"
        ],
        "type": "video-grid",
        "message": "6 clips ready. Choose speed, easing, or regenerate any clip.",
        "modifications": {
          "description": "User can regenerate clips or choose stitch settings",
          "patterns": {
            "regenerate": "regenerate clip {n}",
            "speed": "{n}x speed",
            "easing": "use {easing} easing"
          },
          "defaultStitchSettings": {
            "clipDuration": 1.5,
            "easing": "dramaticSwoop",
            "outputFps": 60
          },
          "examples": [
            "regenerate clip 3",
            "1.5x speed",
            "use cinematic easing"
          ]
        }
      }
    },
    {
      "name": "stitch",
      "description": "Stitch videos with speed curves into final video",
      "script": {
        "command": "stitch-videos-eased.ts",
        "inputs": [
          "outputs/videos/video-1.mp4",
          "outputs/videos/video-2.mp4",
          "outputs/videos/video-3.mp4",
          "outputs/videos/video-4.mp4",
          "outputs/videos/video-5.mp4",
          "outputs/videos/video-6.mp4"
        ],
        "outputPath": "outputs/final/fashion-video.mp4",
        "options": {
          "clip-duration": 1.5,
          "easing": "dramaticSwoop",
          "output-fps": 60
        }
      },
      "checkpoint": {
        "detect": [
          {
            "command_contains": "stitch-videos-eased.ts",
            "output_contains": "fashion-video.mp4"
          },
          {
            "command_contains": "ffmpeg",
            "output_contains": "fashion-video.mp4"
          }
        ],
        "artifacts": ["outputs/final/fashion-video.mp4"],
        "type": "video",
        "message": "Fashion video complete!",
        "isFinal": true
      }
    }
  ],

  "rules": [
    "ALWAYS use Skill tool to load skills - never improvise prompts",
    "ALWAYS pass ALL user reference images to hero generation",
    "ALWAYS stop at checkpoints and wait for user input",
    "NEVER analyze or describe images - FAL.ai handles visual intelligence",
    "NEVER skip the skill chain"
  ]
}
```

1.3. Verify the file is valid JSON:
```bash
cat workflows/fashion-editorial.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
```

**Verification:** File exists and contains valid JSON.

---

### Step 2: Create Prompt Generator

**File to create:** `server/lib/prompt-generator.ts`

**Purpose:** Generate dynamic system prompts from workflow config files.

**Tasks:**

2.1. Create `server/lib/prompt-generator.ts`:

```typescript
/**
 * Prompt Generator
 * Generates dynamic system prompts from workflow configuration files.
 */

// ============================================================================
// Types
// ============================================================================

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  skills: {
    content: string;
    actions: string;
  };
  setup: {
    directories: string[];
    workingDir: string;
  };
  presetMatching?: Record<string, { pose: string; background: string }>;
  phases: Phase[];
  rules: string[];
}

export interface Phase {
  name: string;
  description: string;
  promptFile?: string;
  script?: {
    command: string;
    inputPath?: string;
    outputPath?: string;
    outputDir?: string;
    options?: Record<string, any>;
  };
  checkpoint?: CheckpointConfig | null;
}

export interface CheckpointConfig {
  detect: DetectionRule | DetectionRule[];
  artifacts: string[];
  type: 'image' | 'image-grid' | 'video' | 'video-grid';
  message: string;
  isFinal?: boolean;
  modifications?: {
    description: string;
    patterns?: Record<string, string>;
    supportedRatios?: string[];
    examples?: string[];
  };
}

export interface DetectionRule {
  command_contains?: string;
  output_contains?: string;
}

// ============================================================================
// Main Generator Function
// ============================================================================

export function generatePrompt(config: WorkflowConfig): string {
  const sections = [
    generateHeader(config),
    generateBashSection(config),
    generateSkillChainSection(config),
    generatePhasesSection(config),
    config.presetMatching ? generatePresetSection(config.presetMatching) : '',
    generateModificationSection(config.phases),
    generateRulesSection(config.rules)
  ];

  return sections.filter(Boolean).join('\n');
}

// ============================================================================
// Section Generators
// ============================================================================

function generateHeader(config: WorkflowConfig): string {
  return `You are a ${config.name} pipeline executor.

`;
}

function generateBashSection(config: WorkflowConfig): string {
  const workingDir = config.setup.workingDir || 'agent';
  const dirs = config.setup.directories.join(' ');

  return `## BASH COMMANDS - IMPORTANT

All Bash commands MUST run from the ${workingDir}/ directory. Always prefix with \`cd ${workingDir} &&\`:
\`\`\`bash
cd ${workingDir} && mkdir -p ${dirs}
cd ${workingDir} && npx tsx .claude/skills/${config.skills.actions}/scripts/generate-image.ts ...
\`\`\`

`;
}

function generateSkillChainSection(config: WorkflowConfig): string {
  return `## SKILL CHAIN (MANDATORY)

You MUST use the Skill tool to activate skills in this order:

1. **Skill tool** → \`${config.skills.content}\` → Get presets and prompt templates
2. **Skill tool** → \`${config.skills.actions}\` → Get script commands to execute

NEVER improvise prompts or script commands. ALWAYS activate skills via Skill tool.

`;
}

function generatePhasesSection(phases: Phase[]): string {
  let output = '## WORKFLOW PHASES\n\n';

  phases.forEach((phase, index) => {
    const phaseNum = index + 1;
    const hasCheckpoint = phase.checkpoint !== null && phase.checkpoint !== undefined;

    output += `### Phase ${phaseNum}: ${capitalize(phase.name)}`;
    if (hasCheckpoint) {
      output += ' → CHECKPOINT';
    }
    output += '\n';

    output += `${phase.description}\n`;

    if (phase.promptFile) {
      output += `- Read \`${phase.promptFile}\` from content skill\n`;
    }

    if (phase.script) {
      output += `- Execute \`${phase.script.command}\`\n`;
    }

    if (hasCheckpoint && phase.checkpoint) {
      const artifacts = phase.checkpoint.artifacts;
      const artifactLine = artifacts.length === 1
        ? `artifact: ${artifacts[0]}`
        : `artifacts: ${artifacts.join(',')}`;

      const stageName = phase.checkpoint.isFinal ? 'complete' : phase.name;

      output += `
**Checkpoint:** Stop and output:
\`\`\`
---CHECKPOINT---
stage: ${stageName}
status: complete
${artifactLine}
message: ${phase.checkpoint.message}
---END CHECKPOINT---
\`\`\`
`;
    }

    output += '\n';
  });

  return output;
}

function generatePresetSection(presetMatching: Record<string, any>): string {
  let output = '## PRESET SELECTION\n\n';
  output += 'Match user\'s words to presets:\n\n';
  output += '| User Says | Pose Preset | Background Preset |\n';
  output += '|-----------|-------------|-------------------|\n';

  for (const [keywords, presets] of Object.entries(presetMatching)) {
    const keywordDisplay = keywords === 'default' ? '*(no preference)*' : keywords;
    output += `| ${keywordDisplay} | \`${presets.pose}\` | \`${presets.background}\` |\n`;
  }

  output += '\n';
  return output;
}

function generateModificationSection(phases: Phase[]): string {
  const checkpointPhases = phases.filter(
    p => p.checkpoint?.modifications
  );

  if (checkpointPhases.length === 0) {
    return `## CHECKPOINT MODIFICATION HANDLING

At any checkpoint, user can request changes. Regenerate and show checkpoint again until user says "continue".

`;
  }

  let output = '## CHECKPOINT MODIFICATION HANDLING\n\n';

  for (const phase of checkpointPhases) {
    const mods = phase.checkpoint!.modifications!;

    output += `### At Checkpoint: ${capitalize(phase.name)}\n\n`;
    output += `${mods.description}\n\n`;

    if (mods.patterns) {
      output += '**Supported patterns:**\n';
      for (const [patternType, pattern] of Object.entries(mods.patterns)) {
        output += `- ${patternType}: \`${pattern}\`\n`;
      }
      output += '\n';
    }

    if (mods.supportedRatios) {
      output += `**Supported ratios:** ${mods.supportedRatios.join(', ')}\n\n`;
    }

    if (mods.examples) {
      output += '**Examples:**\n';
      for (const example of mods.examples) {
        output += `- "${example}"\n`;
      }
      output += '\n';
    }

    output += '→ Show CHECKPOINT again. Loop until user says "continue".\n\n';
  }

  return output;
}

function generateRulesSection(rules: string[]): string {
  let output = '## RULES\n\n';

  for (const rule of rules) {
    output += `- ${rule}\n`;
  }

  output += '\n';
  return output;
}

// ============================================================================
// Utilities
// ============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
}

// ============================================================================
// Config Loader
// ============================================================================

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export function loadWorkflowConfig(workflowId: string): WorkflowConfig {
  const configPath = resolve(process.cwd(), 'workflows', `${workflowId}.json`);

  if (!existsSync(configPath)) {
    throw new Error(`Workflow config not found: ${configPath}`);
  }

  const configContent = readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent) as WorkflowConfig;
}

export function listAvailableWorkflows(): string[] {
  const workflowsDir = resolve(process.cwd(), 'workflows');

  if (!existsSync(workflowsDir)) {
    return [];
  }

  const { readdirSync } = require('fs');
  const files = readdirSync(workflowsDir) as string[];

  return files
    .filter((f: string) => f.endsWith('.json') && f !== 'index.json')
    .map((f: string) => f.replace('.json', ''));
}
```

2.2. Verify the file compiles:
```bash
npx tsc server/lib/prompt-generator.ts --noEmit --esModuleInterop --module NodeNext --moduleResolution NodeNext
```

**Verification:** File compiles without errors.

---

### Step 3: Create Checkpoint Detector

**File to create:** `server/lib/checkpoint-detector.ts`

**Purpose:** Detect checkpoints by reading rules from workflow config.

**Tasks:**

3.1. Create `server/lib/checkpoint-detector.ts`:

```typescript
/**
 * Checkpoint Detector
 * Detects workflow checkpoints by matching tool output against config rules.
 */

import type { WorkflowConfig, Phase, DetectionRule } from './prompt-generator.js';

// ============================================================================
// Types
// ============================================================================

export interface CheckpointData {
  stage: string;
  status: 'complete' | 'error';
  artifact?: string;
  artifacts?: string[];
  type: 'image' | 'image-grid' | 'video' | 'video-grid';
  message: string;
  isFinal?: boolean;
}

// ============================================================================
// Detector Class
// ============================================================================

export class CheckpointDetector {
  private config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  /**
   * Detect if a tool execution triggered a checkpoint
   */
  detect(toolName: string, toolInput: any, toolResponse: any): CheckpointData | null {
    // Only check Bash and TaskOutput tools
    if (toolName !== 'Bash' && toolName !== 'TaskOutput') {
      return null;
    }

    const command = toolName === 'Bash' ? (toolInput?.command || '') : '';
    const output = typeof toolResponse === 'string'
      ? toolResponse
      : JSON.stringify(toolResponse);

    // Debug logging
    console.log(`🔍 [CHECKPOINT] Checking ${toolName}:`);
    console.log(`   Command: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
    console.log(`   Output: ${output.substring(0, 100)}${output.length > 100 ? '...' : ''}`);

    // Check phases in reverse order (later phases take priority)
    // This handles cases like stitch (which logs video-*.mp4) before clips
    const phasesWithCheckpoints = this.config.phases
      .filter(p => p.checkpoint !== null && p.checkpoint !== undefined)
      .reverse();

    for (const phase of phasesWithCheckpoints) {
      const checkpoint = phase.checkpoint!;
      const rules = Array.isArray(checkpoint.detect)
        ? checkpoint.detect
        : [checkpoint.detect];

      for (const rule of rules) {
        if (this.matchesRule(rule, command, output)) {
          console.log(`✅ [CHECKPOINT] Matched: ${phase.name}`);

          return {
            stage: checkpoint.isFinal ? 'complete' : phase.name,
            status: 'complete',
            artifact: checkpoint.artifacts.length === 1 ? checkpoint.artifacts[0] : undefined,
            artifacts: checkpoint.artifacts.length > 1 ? checkpoint.artifacts : undefined,
            type: checkpoint.type,
            message: checkpoint.message,
            isFinal: checkpoint.isFinal
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if a detection rule matches the command and output
   */
  private matchesRule(rule: DetectionRule, command: string, output: string): boolean {
    const commandMatch = !rule.command_contains || command.includes(rule.command_contains);
    const outputMatch = !rule.output_contains || output.includes(rule.output_contains);

    return commandMatch && outputMatch;
  }

  /**
   * Get checkpoint config for a specific phase
   */
  getPhaseCheckpoint(phaseName: string): CheckpointData | null {
    const phase = this.config.phases.find(p => p.name === phaseName);

    if (!phase?.checkpoint) {
      return null;
    }

    const checkpoint = phase.checkpoint;

    return {
      stage: checkpoint.isFinal ? 'complete' : phase.name,
      status: 'complete',
      artifact: checkpoint.artifacts.length === 1 ? checkpoint.artifacts[0] : undefined,
      artifacts: checkpoint.artifacts.length > 1 ? checkpoint.artifacts : undefined,
      type: checkpoint.type,
      message: checkpoint.message,
      isFinal: checkpoint.isFinal
    };
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCheckpointDetector(config: WorkflowConfig): CheckpointDetector {
  return new CheckpointDetector(config);
}
```

**Verification:** File compiles without errors.

---

### Step 4: Update SDK Server

**File to update:** `server/sdk-server.ts`

**Purpose:** Use dynamic prompt generation and config-driven checkpoint detection.

**Tasks:**

4.1. Add imports at the top of the file:

```typescript
import {
  generatePrompt,
  loadWorkflowConfig,
  listAvailableWorkflows,
  type WorkflowConfig
} from './lib/prompt-generator.js';
import {
  CheckpointDetector,
  createCheckpointDetector
} from './lib/checkpoint-detector.js';
```

4.2. Add workflow storage map (near other Maps):

```typescript
// Store active workflow configs per session
const sessionWorkflows = new Map<string, WorkflowConfig>();
const sessionDetectors = new Map<string, CheckpointDetector>();
```

4.3. Update `/generate-stream` endpoint to accept `workflowType`:

```typescript
app.post('/generate-stream', async (req, res) => {
  const { prompt, sessionId, inputImages, workflowType } = req.body;

  // ... existing validation ...

  // Load workflow config (default to fashion-editorial)
  const workflowId = workflowType || 'fashion-editorial';
  let workflowConfig: WorkflowConfig;

  try {
    workflowConfig = loadWorkflowConfig(workflowId);
    console.log(`📋 Loaded workflow: ${workflowConfig.name}`);
  } catch (error: any) {
    console.error(`❌ Failed to load workflow: ${error.message}`);
    res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
    res.end();
    return;
  }

  // Generate dynamic system prompt
  const systemPrompt = generatePrompt(workflowConfig);

  // ... rest of the endpoint, passing systemPrompt to aiClient ...
});
```

4.4. Update AI client call to use dynamic prompt:

```typescript
// In the query call, pass the dynamic systemPrompt
for await (const result of aiClient.queryWithSession(
  fullPrompt,
  campaignSessionId,
  {
    systemPrompt,  // Pass dynamic prompt
    workflowConfig // Pass config for checkpoint detection
  },
  images
)) {
  // ... existing streaming logic ...
}
```

4.5. Add endpoint to list available workflows:

```typescript
// List available workflows
app.get('/workflows', (_req, res) => {
  const workflows = listAvailableWorkflows();
  res.json({
    success: true,
    workflows: workflows.map(id => {
      try {
        const config = loadWorkflowConfig(id);
        return {
          id: config.id,
          name: config.name,
          description: config.description
        };
      } catch {
        return { id, name: id, description: '' };
      }
    })
  });
});
```

**Verification:** Server starts without errors and `/workflows` endpoint returns the fashion-editorial workflow.

---

### Step 5: Update AI Client

**File to update:** `server/lib/ai-client.ts`

**Purpose:** Use config-driven checkpoint detection instead of hardcoded patterns.

**Tasks:**

5.1. Update imports:

```typescript
import { CheckpointDetector, createCheckpointDetector, type CheckpointData } from './checkpoint-detector.js';
import type { WorkflowConfig } from './prompt-generator.js';
```

5.2. Update `queryWithSession` to accept workflow config:

```typescript
async *queryWithSession(
  prompt: string,
  sessionId?: string,
  metadata?: { systemPrompt?: string; workflowConfig?: WorkflowConfig },
  imagePaths?: string[]
) {
  // ... existing session setup ...

  // Create checkpoint detector from workflow config
  const detector = metadata?.workflowConfig
    ? createCheckpointDetector(metadata.workflowConfig)
    : null;

  const queryOptions = {
    ...this.defaultOptions,
    ...resumeOptions,
    systemPrompt: metadata?.systemPrompt || this.defaultOptions.systemPrompt,
    includePartialMessages: true,
    abortController,
    hooks: createCheckpointHooks(session.id, detector)  // Pass detector
  };

  // ... rest of method ...
}
```

5.3. Update `createCheckpointHooks` to use detector:

```typescript
function createCheckpointHooks(sessionId: string, detector: CheckpointDetector | null) {
  return {
    PostToolUse: [{
      hooks: [async (input: any, _toolUseId: string | undefined, _options: { signal: AbortSignal }) => {
        let checkpoint: CheckpointData | null = null;

        if (detector) {
          // Use config-driven detection
          checkpoint = detector.detect(
            input.tool_name,
            input.tool_input,
            input.tool_response
          );
        } else {
          // Fallback to legacy detection (for backwards compatibility)
          checkpoint = detectCheckpointLegacy(
            input.tool_name,
            input.tool_input,
            input.tool_response
          );
        }

        if (checkpoint) {
          console.log(`⏸️  CHECKPOINT DETECTED: ${checkpoint.stage} - ${checkpoint.message}`);
          checkpointEmitter.emit('checkpoint', { sessionId, checkpoint });
        }

        return { continue: true };
      }]
    }]
  };
}
```

5.4. Rename existing `detectCheckpoint` to `detectCheckpointLegacy`:

```typescript
// Keep for backwards compatibility, but mark as legacy
function detectCheckpointLegacy(toolName: string, toolInput: any, toolResponse: any): CheckpointData | null {
  // ... existing hardcoded detection logic ...
}
```

**Verification:** Checkpoint detection works with the config file.

---

## Testing Plan

### Test 1: Config Loading

```bash
# Start server
npm run dev

# Test workflow list endpoint
curl http://localhost:3002/workflows
# Expected: {"success":true,"workflows":[{"id":"fashion-editorial","name":"Fashion Editorial",...}]}
```

### Test 2: Prompt Generation

```bash
# Add temporary test endpoint or log the generated prompt
# Verify it matches the expected format
```

### Test 3: Full Workflow

1. Open frontend
2. Upload reference images
3. Send message "Create an edgy fashion shoot"
4. Verify:
   - Hero checkpoint triggers
   - Frames checkpoint triggers
   - Clips checkpoint triggers
   - Final video completes

### Test 4: Checkpoint Modifications

1. At hero checkpoint, say "make it more dramatic"
2. Verify hero regenerates and checkpoint shows again
3. Say "continue"
4. Verify workflow proceeds to frames

---

## Rollback Plan

If issues occur, the system can be reverted by:

1. Removing the workflow config loading
2. Restoring the static `ORCHESTRATOR_SYSTEM_PROMPT`
3. Restoring the hardcoded `detectCheckpoint` function

The legacy detection function is preserved for this purpose.

---

## Next Steps After Implementation

Once the basic config-driven system works:

1. **Add Frontend Workflow Selector** - Dropdown to choose workflow
2. **Add More Workflows** - Create product-photography.json, headshot-portrait.json
3. **Refine Config Schema** - Add more options as needed
4. **Add Config Validation** - Validate JSON against schema on load

---

## File Summary

| File | Action | Purpose |
|------|--------|---------|
| `workflows/fashion-editorial.json` | Create | Workflow definition |
| `server/lib/prompt-generator.ts` | Create | Generate prompts from config |
| `server/lib/checkpoint-detector.ts` | Create | Detect checkpoints from config |
| `server/sdk-server.ts` | Update | Load config, use dynamic prompt |
| `server/lib/ai-client.ts` | Update | Use config-driven detection |

---

## Estimated Effort

| Step | Effort | Risk |
|------|--------|------|
| Step 1: Config file | 30 min | Low |
| Step 2: Prompt generator | 1 hour | Low |
| Step 3: Checkpoint detector | 45 min | Low |
| Step 4: Update server | 1 hour | Medium |
| Step 5: Update AI client | 45 min | Medium |
| Testing | 1 hour | - |
| **Total** | **~5 hours** | **Medium** |

---

## Success Criteria

- [ ] `workflows/fashion-editorial.json` exists and is valid JSON
- [ ] `generatePrompt()` produces correct system prompt
- [ ] Checkpoint detection works from config
- [ ] Full workflow completes successfully
- [ ] Checkpoint loops work (modify → regenerate → checkpoint again)
- [ ] No regressions from current behavior
