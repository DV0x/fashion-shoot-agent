# Scalable Workflows Architecture

## Overview

The fashion-shoot-agent uses a **config-driven workflow system** that allows adding new workflows by creating JSON config files only - no code changes required.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW SYSTEM                                    │
│                                                                              │
│   workflows/*.json ──► prompt-generator.ts ──► Dynamic System Prompt        │
│          │                                                                   │
│          └──────────► checkpoint-detector.ts ──► Config-driven Detection    │
│                                                                              │
│   GET /workflows ──► List available workflows                               │
│   POST /generate-stream { workflowType: "..." } ──► Run specific workflow   │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Components

### 1. Workflow Config Files (`workflows/*.json`)

Each workflow is defined in a JSON file:

```
workflows/
├── fashion-editorial.json    # Fashion photoshoot workflow
├── product-photography.json  # (future) Product shots
└── headshot-portrait.json    # (future) Professional headshots
```

### 2. Prompt Generator (`server/lib/prompt-generator.ts`)

Generates dynamic system prompts from workflow config:

| Export | Purpose |
|--------|---------|
| `generatePrompt(config)` | Generates system prompt from config |
| `loadWorkflowConfig(id)` | Loads JSON config from `workflows/` |
| `listAvailableWorkflows()` | Lists all available workflow IDs |

### 3. Checkpoint Detector (`server/lib/checkpoint-detector.ts`)

Detects checkpoints using rules from config:

| Export | Purpose |
|--------|---------|
| `createCheckpointDetector(config)` | Creates detector instance |
| `detector.detect(toolName, input, output)` | Checks if checkpoint triggered |

### 4. Server Integration (`server/sdk-server.ts`)

| Endpoint | Purpose |
|----------|---------|
| `GET /workflows` | List available workflows |
| `POST /generate-stream` | Accepts `workflowType` parameter |
| `POST /sessions/:id/continue-stream` | Uses stored workflow config |

---

## Workflow Config Schema

```json
{
  "id": "workflow-id",
  "name": "Human Readable Name",
  "description": "Description for UI",

  "skills": {
    "content": "skill-name-for-prompts",
    "actions": "skill-name-for-scripts"
  },

  "setup": {
    "directories": ["outputs/dir1", "outputs/dir2"],
    "workingDir": "agent"
  },

  "presetMatching": {
    "keyword1, keyword2": { "preset1": "value1", "preset2": "value2" },
    "default": { "preset1": "default-value1", "preset2": "default-value2" }
  },

  "phases": [
    {
      "name": "phase-name",
      "description": "What this phase does",
      "promptFile": "prompts/template.md",
      "script": {
        "command": "script-name.ts",
        "outputPath": "outputs/file.png"
      },
      "checkpoint": {
        "detect": [
          { "output_contains": "file.png" }
        ],
        "artifacts": ["outputs/file.png"],
        "type": "image",
        "message": "Checkpoint message for user"
      }
    }
  ],

  "rules": [
    "Rule 1 for the agent",
    "Rule 2 for the agent"
  ]
}
```

---

## Checkpoint Detection Rules

Each checkpoint has a `detect` array with rules. A rule matches when **all** conditions are true:

| Condition | Description |
|-----------|-------------|
| `command_contains` | Bash command includes this string |
| `output_contains` | Tool output includes this string |

### Examples

```json
// Flexible: Any command that outputs hero.png
{ "output_contains": "outputs/hero.png" }

// Specific: Only crop-frames.ts with frame-6.png
{ "command_contains": "crop-frames.ts", "output_contains": "frame-6.png" }

// Multiple conditions
{ "command_contains": "stitch-videos", "output_contains": "fashion-video.mp4" }
```

### Detection Order

Phases are checked in **reverse order** (later phases first). This prevents:
- `stitch-videos.ts` (which logs `video-*.mp4` inputs) triggering `clips` checkpoint
- Instead, it correctly triggers `complete` checkpoint

---

## Adding a New Workflow

### Step 1: Create Config File

Create `workflows/your-workflow.json`:

```json
{
  "id": "product-photography",
  "name": "Product Photography",
  "description": "Clean product shots on white background",

  "skills": {
    "content": "product-photography",
    "actions": "product-shoot-pipeline"
  },

  "setup": {
    "directories": ["outputs/products", "outputs/angles"],
    "workingDir": "agent"
  },

  "phases": [
    {
      "name": "hero-product",
      "description": "Generate main product shot",
      "promptFile": "prompts/product-hero.md",
      "script": {
        "command": "generate-product.ts",
        "outputPath": "outputs/products/hero.png"
      },
      "checkpoint": {
        "detect": [{ "output_contains": "products/hero.png" }],
        "artifacts": ["outputs/products/hero.png"],
        "type": "image",
        "message": "Product hero ready. Continue or request changes."
      }
    },
    {
      "name": "angles",
      "description": "Generate multiple angle shots",
      "script": {
        "command": "generate-angles.ts",
        "outputPath": "outputs/angles/"
      },
      "checkpoint": {
        "detect": [{ "output_contains": "angle-4.png" }],
        "artifacts": [
          "outputs/angles/angle-1.png",
          "outputs/angles/angle-2.png",
          "outputs/angles/angle-3.png",
          "outputs/angles/angle-4.png"
        ],
        "type": "image-grid",
        "message": "4 angles ready. Continue or regenerate any angle."
      }
    }
  ],

  "rules": [
    "Use white seamless background for all shots",
    "Maintain consistent lighting across angles"
  ]
}
```

### Step 2: Create Skills (if needed)

If your workflow needs new skills:

```
agent/.claude/skills/
├── product-photography/       # Content skill
│   ├── SKILL.md
│   └── prompts/
│       └── product-hero.md
│
└── product-shoot-pipeline/    # Action skill
    ├── SKILL.md
    └── scripts/
        ├── generate-product.ts
        └── generate-angles.ts
```

### Step 3: Validate Config

```bash
cat workflows/your-workflow.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
```

### Step 4: Test

```bash
# Test config loading
npx tsx -e "
import { loadWorkflowConfig, generatePrompt } from './server/lib/prompt-generator.js';
const config = loadWorkflowConfig('product-photography');
console.log('Loaded:', config.name);
console.log(generatePrompt(config));
"

# Test via API
curl http://localhost:3002/workflows
```

### Step 5: Use in Frontend

```typescript
// List workflows
const { workflows } = await fetch('/api/workflows').then(r => r.json());

// Start workflow
fetch('/api/generate-stream', {
  method: 'POST',
  body: JSON.stringify({
    prompt: "Photograph this product",
    workflowType: "product-photography",  // <-- specify workflow
    inputImages: ["/uploads/product.jpg"]
  })
});
```

---

## Checkpoint Types

| Type | Description | Component |
|------|-------------|-----------|
| `image` | Single image | `ImageMessage` |
| `image-grid` | Multiple images (3+) | `ImageGrid` |
| `video` | Single video | `VideoMessage` |
| `video-grid` | Multiple videos (3+) | `VideoGrid` |

---

## Artifacts & Actions

### How Artifacts Flow to Frontend

```
Workflow Config                    Server                         Frontend
      │                              │                               │
      │  checkpoint.artifacts ──────►│ SSE: checkpoint event ───────►│ Renders artifact
      │  checkpoint.type ───────────►│     { artifacts, type } ─────►│ based on type
      │                              │                               │
```

When a checkpoint is detected:
1. Server reads `artifacts` array and `type` from config
2. Sends SSE event with checkpoint data
3. Frontend renders appropriate component based on `type`

### Defining Artifacts

Artifacts are the outputs displayed at each checkpoint:

```json
{
  "checkpoint": {
    "artifacts": [
      "outputs/hero.png"           // Single artifact
    ],
    "type": "image"                // Rendered as ImageMessage
  }
}
```

```json
{
  "checkpoint": {
    "artifacts": [
      "outputs/frames/frame-1.png",
      "outputs/frames/frame-2.png",
      "outputs/frames/frame-3.png",
      "outputs/frames/frame-4.png",
      "outputs/frames/frame-5.png",
      "outputs/frames/frame-6.png"
    ],
    "type": "image-grid"           // Rendered as ImageGrid (2x3)
  }
}
```

### Artifact Path Resolution

Artifacts are served from `agent/outputs/` via the `/outputs/` static route:

| Config Path | URL | File Location |
|-------------|-----|---------------|
| `outputs/hero.png` | `/outputs/hero.png` | `agent/outputs/hero.png` |
| `outputs/frames/frame-1.png` | `/outputs/frames/frame-1.png` | `agent/outputs/frames/frame-1.png` |

---

## Checkpoint Modifications (Actions)

Modifications define what users can do at each checkpoint. These inform the AI agent how to handle user requests.

### Basic Structure

```json
{
  "checkpoint": {
    "message": "Hero image ready. Reply 'continue' or describe changes.",
    "modifications": {
      "description": "What the agent should do when user requests changes",
      "examples": [
        "make it more dramatic",
        "change the background"
      ]
    }
  }
}
```

### Advanced Modifications with Patterns

For complex checkpoints with multiple action types:

```json
{
  "checkpoint": {
    "message": "6 frames ready. Reply 'continue' or request modifications.",
    "modifications": {
      "description": "User can modify individual frames, multiple frames, or resize all",
      "patterns": {
        "singleFrame": "modify frame {n}",
        "multipleFrames": "modify frames {list}",
        "resize": "resize to {ratio}"
      },
      "supportedRatios": ["16:9", "9:16", "4:3", "1:1"],
      "examples": [
        "modify frame 3 to add sunglasses",
        "modify frames 2 and 5",
        "resize to 9:16 for TikTok"
      ]
    }
  }
}
```

### Modifications with Default Settings

For checkpoints that need configuration options:

```json
{
  "checkpoint": {
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
}
```

---

## Complex Workflow Example

Here's a multi-stage workflow with different artifact types and actions:

```json
{
  "id": "social-media-campaign",
  "name": "Social Media Campaign",
  "description": "Generate images and videos for multiple platforms",

  "skills": {
    "content": "social-media-templates",
    "actions": "media-generation-pipeline"
  },

  "setup": {
    "directories": [
      "outputs/hero",
      "outputs/stories",
      "outputs/reels",
      "outputs/thumbnails"
    ],
    "workingDir": "agent"
  },

  "phases": [
    {
      "name": "hero-image",
      "description": "Generate main campaign image",
      "checkpoint": {
        "detect": [{ "output_contains": "hero/main.png" }],
        "artifacts": ["outputs/hero/main.png"],
        "type": "image",
        "message": "Campaign hero ready. Continue or request changes.",
        "modifications": {
          "description": "Regenerate with different style or composition",
          "examples": [
            "make it more vibrant",
            "add more negative space for text overlay"
          ]
        }
      }
    },
    {
      "name": "platform-variants",
      "description": "Generate platform-specific variants",
      "checkpoint": {
        "detect": [{ "output_contains": "variant-4.png" }],
        "artifacts": [
          "outputs/stories/variant-1.png",
          "outputs/stories/variant-2.png",
          "outputs/stories/variant-3.png",
          "outputs/stories/variant-4.png"
        ],
        "type": "image-grid",
        "message": "4 platform variants ready (IG Story, TikTok, LinkedIn, Twitter).",
        "modifications": {
          "description": "Regenerate specific variants or adjust for platform",
          "patterns": {
            "regenerate": "regenerate variant {n}",
            "platform": "optimize for {platform}"
          },
          "examples": [
            "regenerate variant 2",
            "optimize variant 3 for LinkedIn"
          ]
        }
      }
    },
    {
      "name": "video-reels",
      "description": "Generate short video reels",
      "checkpoint": {
        "detect": [{ "output_contains": "reel-3.mp4" }],
        "artifacts": [
          "outputs/reels/reel-1.mp4",
          "outputs/reels/reel-2.mp4",
          "outputs/reels/reel-3.mp4"
        ],
        "type": "video-grid",
        "message": "3 reels ready. Review and continue to final export.",
        "modifications": {
          "description": "Regenerate reels or adjust timing",
          "patterns": {
            "regenerate": "regenerate reel {n}",
            "duration": "make reel {n} {seconds}s long"
          },
          "defaultSettings": {
            "duration": 15,
            "format": "9:16"
          },
          "examples": [
            "regenerate reel 2",
            "make reel 1 30s long"
          ]
        }
      }
    },
    {
      "name": "export-package",
      "description": "Package all assets for download",
      "checkpoint": {
        "detect": [{ "output_contains": "campaign-package.zip" }],
        "artifacts": ["outputs/campaign-package.zip"],
        "type": "file",
        "message": "Campaign package ready for download!",
        "isFinal": true
      }
    }
  ],

  "rules": [
    "Maintain brand colors across all variants",
    "Ensure text-safe zones in story formats",
    "Video reels must have hook in first 3 seconds"
  ]
}
```

---

## Frontend Integration

### Receiving Artifacts

The frontend receives checkpoint data via SSE:

```typescript
// SSE event
{
  type: 'checkpoint',
  checkpoint: {
    stage: 'frames',
    status: 'complete',
    artifacts: [
      'outputs/frames/frame-1.png',
      'outputs/frames/frame-2.png',
      // ...
    ],
    type: 'image-grid',
    message: '6 frames ready...'
  }
}
```

### Rendering Based on Type

```typescript
// ChatView.tsx
function renderCheckpointArtifacts(checkpoint: CheckpointData) {
  switch (checkpoint.type) {
    case 'image':
      return <ImageMessage src={checkpoint.artifact} />;

    case 'image-grid':
      return <ImageGrid images={checkpoint.artifacts} />;

    case 'video':
      return <VideoMessage src={checkpoint.artifact} />;

    case 'video-grid':
      return <VideoGrid videos={checkpoint.artifacts} />;

    case 'file':
      return <FileDownload src={checkpoint.artifact} />;

    default:
      return null;
  }
}
```

### Adding Custom Actions UI (Future Enhancement)

To add action buttons at checkpoints, extend the frontend:

```typescript
// CheckpointMessage.tsx
function CheckpointActions({ checkpoint, onAction }) {
  const { modifications } = checkpoint;

  if (!modifications?.patterns) return null;

  return (
    <div className="checkpoint-actions">
      {modifications.patterns.regenerate && (
        <Button onClick={() => onAction('regenerate')}>
          Regenerate
        </Button>
      )}
      {modifications.supportedRatios && (
        <Select
          options={modifications.supportedRatios}
          onChange={(ratio) => onAction('resize', ratio)}
        />
      )}
    </div>
  );
}
```

---

## Adding New Artifact Types

### 1. Define in Config

```json
{
  "checkpoint": {
    "artifacts": ["outputs/model.glb"],
    "type": "3d-model",
    "message": "3D model ready for preview"
  }
}
```

### 2. Add Frontend Component

```typescript
// components/chat/Model3DMessage.tsx
export function Model3DMessage({ src }: { src: string }) {
  return (
    <model-viewer
      src={src}
      camera-controls
      auto-rotate
    />
  );
}
```

### 3. Update Renderer

```typescript
case '3d-model':
  return <Model3DMessage src={checkpoint.artifact} />;
```

### 4. Update TypeScript Types

```typescript
// lib/types.ts
type CheckpointType =
  | 'image'
  | 'image-grid'
  | 'video'
  | 'video-grid'
  | 'file'
  | '3d-model';  // Add new type
```

---

## Generated Prompt Structure

The `generatePrompt()` function creates a system prompt with these sections:

```
You are a {Workflow Name} pipeline executor.

## BASH COMMANDS - IMPORTANT
All Bash commands MUST run from the {workingDir}/ directory...

## SKILL CHAIN (MANDATORY)
You MUST use the Skill tool to activate skills in this order:
1. {content skill}
2. {actions skill}

## WORKFLOW PHASES

### Phase 1: {Phase Name} → CHECKPOINT
{description}
- Read `{promptFile}` from content skill
- Execute `{script.command}`

**Checkpoint:** Stop and output:
---CHECKPOINT---
stage: {phase.name}
...
---END CHECKPOINT---

## PRESET SELECTION
| User Says | Preset 1 | Preset 2 |
|-----------|----------|----------|
| keywords  | value1   | value2   |

## CHECKPOINT MODIFICATION HANDLING
### At Checkpoint: {Phase Name}
{modifications.description}
...

## RULES
- {rule 1}
- {rule 2}
```

---

## File Reference

| File | Purpose |
|------|---------|
| `workflows/*.json` | Workflow definitions |
| `server/lib/prompt-generator.ts` | Generates prompts from config |
| `server/lib/checkpoint-detector.ts` | Detects checkpoints from config |
| `server/lib/ai-client.ts` | Uses detector with legacy fallback |
| `server/sdk-server.ts` | Loads config, serves `/workflows` |

---

## Backwards Compatibility

If no `workflowType` is specified, the system defaults to `fashion-editorial`.

If no workflow config exists, `ai-client.ts` falls back to legacy hardcoded detection (`detectCheckpointLegacy`).

---

## Troubleshooting

### Checkpoint Not Detected

1. Check detection rules in config match actual output
2. Use flexible rules (just `output_contains`) when possible
3. Check server logs for `🔍 [CHECKPOINT] Checking Bash:`

### Workflow Not Loading

1. Verify JSON is valid: `cat workflows/x.json | python3 -m json.tool`
2. Check `workflows/` directory exists in project root
3. Check server logs for `📋 Loaded workflow:`

### Wrong Checkpoint Order

Later phases are checked first (reverse order). If `phase-b` logs output that matches `phase-a`, put `phase-b` later in the phases array.
