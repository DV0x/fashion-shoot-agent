# Plan: Contact Sheet Checkpoint with Individual Frame Generation

## Summary

**Simplify the pipeline** by removing the unreliable crop-frames.ts approach entirely. After contact sheet preview, always generate 6 individual frames via FAL.ai in parallel.

**New flow:**
```
Hero → Contact Sheet (preview) → Checkpoint → Generate 6 frames (parallel) → Frames checkpoint → Clips → Stitch
```

---

## Architecture

The system uses a **config-driven workflow mechanism** (see `docs/SCALABLE_WORKFLOWS.md`):

```
workflows/fashion-editorial.json  →  prompt-generator.ts  →  Dynamic System Prompt
         │
         └──────────────────────→  checkpoint-detector.ts  →  Config-driven Detection
```

---

## Files to Modify

| File | Change |
|------|--------|
| `workflows/fashion-editorial.json` | Add checkpoint to `contact-sheet` phase, update frames phase |
| `frontend/src/components/chat/CheckpointMessage.tsx` | Add `contact-sheet` stage UI |
| `frontend/src/lib/types.ts` | Add `'contact-sheet'` to Checkpoint stage union |
| `agent/.claude/skills/editorial-photography/prompts/individual-frames.md` | **NEW** - 6 isolate prompts |
| `agent/.claude/skills/fashion-shoot-pipeline/scripts/stitch-videos-eased.ts` | Remove dimension normalization |

**Files to potentially remove/deprecate:**
- `agent/.claude/skills/fashion-shoot-pipeline/scripts/crop-frames.ts` (no longer used)
- References to crop-frames in SKILL.md files

---

## Implementation Steps

### Step 1: Update workflow config

**File:** `workflows/fashion-editorial.json`

1. Add checkpoint to `contact-sheet` phase
2. Update the `frames` phase to use individual generation instead of cropping

**contact-sheet phase (add checkpoint):**
```json
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
  "checkpoint": {
    "detect": { "output_contains": "outputs/contact-sheet.png" },
    "artifacts": ["outputs/contact-sheet.png"],
    "type": "image",
    "message": "Contact sheet preview ready. Continue to generate 6 individual frames.",
    "modifications": {
      "description": "User reviews contact sheet. On 'continue': read prompts/individual-frames.md and execute ALL 6 generate-image.ts commands IN PARALLEL with contact-sheet.png as input, using 'isolate and upscale' prompts for each row/column position, outputting to outputs/frames/frame-{1-6}.png",
      "examples": ["continue", "looks good", "generate frames"]
    }
  }
}
```

**frames phase (update to individual generation):**
```json
{
  "name": "frames",
  "description": "Generate 6 individual frames from contact sheet (parallel)",
  "promptFile": "prompts/individual-frames.md",
  "checkpoint": {
    "detect": [
      { "command_contains": "generate-image.ts", "output_contains": "frame-6.png" }
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
    "message": "6 frames ready. Continue or request modifications.",
    "modifications": {
      "description": "User can regenerate individual frames",
      "patterns": {
        "regenerate": "regenerate frame {n}",
        "resize": "resize to {ratio}"
      },
      "examples": ["regenerate frame 3", "resize to 9:16"]
    }
  }
}
```

### Step 2: Create individual frames prompt

**File:** `agent/.claude/skills/editorial-photography/prompts/individual-frames.md` (NEW)

Uses **AI-powered isolation** - tell FAL.ai to isolate and upscale each cell from the contact sheet grid:

```markdown
# INDIVIDUAL_FRAME_PROMPTS

Isolate and upscale each of the 6 images from the contact sheet grid.
Use contact-sheet.png as input for each frame.

## Grid Layout Reference

┌─────────────┬─────────────┬─────────────┐
│  Frame 1    │  Frame 2    │  Frame 3    │
│  Row 1 Col 1│  Row 1 Col 2│  Row 1 Col 3│
├─────────────┼─────────────┼─────────────┤
│  Frame 4    │  Frame 5    │  Frame 6    │
│  Row 2 Col 1│  Row 2 Col 2│  Row 2 Col 3│
└─────────────┴─────────────┴─────────────┘

## Prompt Template

Use this exact prompt structure for each frame, changing only the row/column reference:

"Review the grid of six images. I want you to Isolate and upscale the {POSITION} image in the {ROW} row of images. Do not change the pose or any details of the model, match the high angle and shot distance perfectly. It is critical that you only output a single image from the six image grid."

## Frame Prompts

| Frame | Position | Prompt |
|-------|----------|--------|
| 1 | first image, first row | "...Isolate and upscale the first image in the first row..." |
| 2 | second image, first row | "...Isolate and upscale the second image in the first row..." |
| 3 | third image, first row | "...Isolate and upscale the third image in the first row..." |
| 4 | first image, second row | "...Isolate and upscale the first image in the second row..." |
| 5 | second image, second row | "...Isolate and upscale the second image in the second row..." |
| 6 | third image, second row | "...Isolate and upscale the third image in the second row..." |

## Execution (PARALLEL)

Execute ALL 6 commands IN PARALLEL using multiple Bash tool calls in a single response.
Use **contact-sheet.png** as input:

# Frame 1 (Row 1, Col 1)
cd agent && npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts \
  --prompt "Review the grid of six images. I want you to Isolate and upscale the first image in the first row of images. Do not change the pose or any details of the model, match the high angle and shot distance perfectly. It is critical that you only output a single image from the six image grid." \
  --input outputs/contact-sheet.png \
  --output outputs/frames/frame-1.png \
  --aspect-ratio 3:2 \
  --resolution 1K

# Frame 2 (Row 1, Col 2)
cd agent && npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts \
  --prompt "Review the grid of six images. I want you to Isolate and upscale the second image in the first row of images. Do not change the pose or any details of the model, match the high angle and shot distance perfectly. It is critical that you only output a single image from the six image grid." \
  --input outputs/contact-sheet.png \
  --output outputs/frames/frame-2.png \
  --aspect-ratio 3:2 \
  --resolution 1K

# ... frames 3-6 follow same pattern ...
```

### Step 3: Update frontend types

**File:** `frontend/src/lib/types.ts`

Add `'contact-sheet'` to the Checkpoint stage union:

```typescript
export interface Checkpoint {
  stage: 'hero' | 'contact-sheet' | 'frames' | 'clips' | 'complete';
  // ...
}
```

### Step 4: Update CheckpointMessage component

**File:** `frontend/src/components/chat/CheckpointMessage.tsx`

Add contact-sheet stage:

```typescript
const stageLabels: Record<string, string> = {
  hero: 'Hero Image Ready',
  'contact-sheet': 'Contact Sheet Preview',  // NEW
  frames: 'Frames Ready',
  clips: 'Video Clips Ready',
  complete: 'Pipeline Complete',
};

const stageIcons: Record<string, string> = {
  hero: '📸',
  'contact-sheet': '🎞️',  // NEW
  frames: '🖼️',
  clips: '🎥',
  complete: '🎬',
};
```

The default Continue button works for contact-sheet stage (no special UI needed).

### Step 5: Smart normalization in stitch script

**File:** `agent/.claude/skills/fashion-shoot-pipeline/scripts/stitch-videos-eased.ts`

Keep normalization as a fallback, but skip it when all clips have uniform dimensions:

**Add helper function:**
```typescript
function allSameDimensions(metadataList: VideoMetadata[]): boolean {
  if (metadataList.length === 0) return true;
  const { width, height } = metadataList[0];
  return metadataList.every(m => m.width === width && m.height === height);
}
```

**Update logic (around lines 105-116, 150):**
```typescript
// Check if all clips have same dimensions
const uniformDimensions = allSameDimensions(metadataList);
const { maxWidth, maxHeight } = findMaxDimensions(metadataList);

if (uniformDimensions) {
  console.error(`  All clips are ${maxWidth}x${maxHeight} - skipping scaling`);
} else {
  console.error(`  Mixed dimensions - scaling to ${maxWidth}x${maxHeight}`);
}

// ... later in extractFramesAtTimestamps ...
scaleWithPadding: !uniformDimensions, // Only scale if dimensions differ
```

This:
- Skips scaling when all clips are same size (no quality loss)
- Falls back to scaling when dimensions differ (safety net)

---

## Flow Diagram

```
Hero Checkpoint (existing)
        │
        ▼
Generate Contact Sheet
        │
        ▼
┌───────────────────────────┐
│ CONTACT SHEET CHECKPOINT  │  ◄── NEW
│ (preview of 6 angles)     │
│                           │
│ [Continue]                │
└───────────────────────────┘
        │
        ▼
Generate 6 frames (PARALLEL via FAL.ai)
(uses "isolate and upscale" prompts)
        │
        ▼
┌───────────────────────────┐
│ FRAMES CHECKPOINT         │
│ (6 individual images)     │
│                           │
│ • Regenerate frame X      │
│ • Resize ratio            │
│ • Continue                │
└───────────────────────────┘
        │
        ▼
    (clips → stitch)
```

---

## Verification

### 1. Validate JSON config
```bash
cat workflows/fashion-editorial.json | python3 -m json.tool > /dev/null && echo "Valid JSON"
```

### 2. Test prompt generation
```bash
npx tsx -e "
import { loadWorkflowConfig, generatePrompt } from './server/lib/prompt-generator.js';
const config = loadWorkflowConfig('fashion-editorial');
console.log(generatePrompt(config));
" | grep -A 10 "contact-sheet"
```

### 3. E2E Test
- Start server: `npm run dev`
- Upload reference → Generate hero → Continue
- Generate contact sheet → See preview → **Continue**
- Verify 6 frames generated **IN PARALLEL** (check server logs)
- Verify all frames have identical dimensions: `identify agent/outputs/frames/*.png`

### 4. Verify checkpoint detection
Check server logs for:
```
✅ [CHECKPOINT] Matched: contact-sheet
✅ [CHECKPOINT] Matched: frames
```

---

## Cleanup (Optional)

After implementation works, consider:
- Removing `crop-frames.ts` from the codebase
- Removing crop-frames references from SKILL.md and ARCHITECTURE.md
- Removing `resize-frames.ts` if no longer needed

---

## Notes

- **AI-powered isolation** - FAL.ai "isolates and upscales" each cell from the contact sheet grid
- **No programmatic cropping** - no variance-based detection, no edge cases, no quality loss
- **Uniform dimensions** - all frames/videos have identical size (no normalization needed anywhere)
- **Smart scaling in stitch** - only scales when dimensions differ, skips when uniform
- **Parallel generation** - ~1 minute instead of ~6 minutes
- **Contact sheet as input** - frames use contact-sheet.png to isolate specific cells
- **Regenerate at frames checkpoint** - user can still regenerate individual frames if needed
