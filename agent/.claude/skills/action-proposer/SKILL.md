---
name: action-proposer
description: Propose actions for user approval instead of executing scripts directly. The user sees an ActionCard UI with editable parameters and controls execution.
---

# Action Proposer Skill

Propose pipeline actions for user review and approval. **NEVER execute generation scripts directly** - always use this skill to propose actions.

## How It Works

1. You call this skill with action details
2. The frontend displays an **ActionCard** with editable parameters
3. User reviews, modifies parameters if desired, and clicks "Generate"
4. Server executes the action and returns results
5. User clicks "Continue" to proceed
6. You receive feedback about results and any parameter changes

## Command

```bash
npx tsx .claude/skills/action-proposer/propose-action.ts \
  --templateId <template_id> \
  --label "<description>" \
  --params '<json_params>'
```

## Available Templates

| templateId | Stage | Description |
|------------|-------|-------------|
| `generate_hero` | hero | Full-body editorial hero shot |
| `generate_contact_sheet` | contact-sheet | 2×3 grid of 6 camera angles |
| `extract_frames` | frames | Extract individual frames from grid |
| `resize_frames` | resize | Change aspect ratio (16:9, 9:16, etc.) |
| `generate_video_clip` | clips | Single video clip between frame pair |
| `generate_all_clips` | clips | All 5 clips (or 6 with loop) in batch |
| `stitch_final` | final | Combine clips into final video |

## Template Parameters

### generate_hero
```json
{
  "prompt": "Full-body editorial fashion photograph...",
  "aspectRatio": "3:2",
  "resolution": "2K",
  "useReferenceImages": true
}
```

### generate_contact_sheet
```json
{
  "prompt": "Fashion editorial contact sheet, 2×3 grid...",
  "aspectRatio": "3:2",
  "resolution": "2K",
  "useReferenceImages": true
}
```

### extract_frames
```json
{
  "cropMethod": "variance",
  "rows": 2,
  "cols": 3,
  "padding": 0
}
```
- `cropMethod`: "variance" (smart gutter detection) or "simple" (math division)
- `padding`: Pixels to trim from edges (useful with simple method)

### resize_frames
```json
{
  "aspectRatio": "9:16"
}
```
Options: "16:9", "9:16", "1:1", "4:3", "3:4", "3:2", "2:3"

### generate_video_clip
```json
{
  "clipNumber": 1,
  "motionPrompt": "Smooth camera transition...",
  "duration": "5",
  "negativePrompt": "blur, distort, and low quality"
}
```

### generate_all_clips
```json
{
  "motionPrompt": "Cinematic camera movement...",
  "duration": "5",
  "includeLoop": false,
  "negativePrompt": "blur, distort, and low quality"
}
```

### stitch_final
```json
{
  "clipDuration": 1.5,
  "easingCurve": "dramaticSwoop",
  "includeLoop": false,
  "outputFps": 60
}
```
Easing options: "dramaticSwoop", "easeInOutSine", "easeInOutCubic", "easeInOutQuart", "easeInOutExpo"

## Examples

### Propose Hero Shot
```bash
npx tsx .claude/skills/action-proposer/propose-action.ts \
  --templateId generate_hero \
  --label "Dramatic Hero with Studio Black" \
  --params '{"prompt": "Full-body editorial fashion photograph, editorial-drama pose, studio-black background, Fuji Velvia style, overexposed highlights, film grain, oversaturated colors", "aspectRatio": "3:2", "resolution": "2K", "useReferenceImages": true}'
```

### Propose Contact Sheet
```bash
npx tsx .claude/skills/action-proposer/propose-action.ts \
  --templateId generate_contact_sheet \
  --label "6-Angle Contact Sheet" \
  --params '{"prompt": "Fashion editorial contact sheet, 2×3 grid showing 6 distinct camera angles of the same subject...", "aspectRatio": "3:2", "resolution": "2K", "useReferenceImages": true}'
```

### Propose Frame Extraction
```bash
npx tsx .claude/skills/action-proposer/propose-action.ts \
  --templateId extract_frames \
  --label "Extract 6 Frames" \
  --params '{"cropMethod": "variance", "rows": 2, "cols": 3}'
```

### Propose All Video Clips
```bash
npx tsx .claude/skills/action-proposer/propose-action.ts \
  --templateId generate_all_clips \
  --label "Generate 5 Video Clips" \
  --params '{"motionPrompt": "Smooth cinematic camera transition, subject maintains pose, subtle movement", "duration": "5", "includeLoop": false}'
```

### Propose Final Stitch
```bash
npx tsx .claude/skills/action-proposer/propose-action.ts \
  --templateId stitch_final \
  --label "Stitch Final Video" \
  --params '{"clipDuration": 1.5, "easingCurve": "dramaticSwoop", "includeLoop": false}'
```

## CRITICAL Rules

1. **ALWAYS explain your creative reasoning BEFORE proposing an action**
   - Describe what you're creating and why
   - Mention preset choices and alternatives considered

2. **NEVER run generation scripts directly**
   - Don't call `generate-image.ts`, `generate-video.ts`, `crop-frames.ts`, etc.
   - Always propose via this skill

3. **ONE action at a time**
   - Propose one action, wait for completion and continuation
   - Don't propose the next action until user continues

4. **User controls execution**
   - You propose, user decides to execute or modify
   - Respect parameter changes in your next response

## Response Format

The skill emits JSON that the server intercepts:
```json
{
  "type": "action_proposal",
  "instanceId": "action_<uuid>",
  "templateId": "generate_hero",
  "label": "Dramatic Hero with Studio Black",
  "params": { ... }
}
```

After user executes and continues, you receive feedback like:
```
[Action Completed: Generate Hero Shot]
Result: SUCCESS
Artifact: outputs/hero.png
Duration: 12.3s

User Parameter Changes:
- aspectRatio: "3:2" → "2:3"

User wants to continue. Comment on result and suggest next step.
```
