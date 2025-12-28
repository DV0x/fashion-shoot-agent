---
name: editorial-photography
description: Execute the Tim workflow for fashion editorial photography. Use when generating hero images, contact sheets, and frame isolations. This skill provides EXACT prompt templates with customizable POSE and BACKGROUND presets.
---

# Editorial Photography Skill (Tim Workflow)

This skill provides **exact prompt templates** for the Tim workflow fashion pipeline with **customizable presets** for pose and background.

## CRITICAL: No Improvisation

- **DO NOT** change camera angles or shot types
- **DO NOT** modify the style block (Fuji Velvia treatment)
- **DO NOT** skip or reorder pipeline stages
- **DO** use presets from `presets/` directory for pose and background
- **DO** follow the exact prompt structure

## When to Use

Invoke this skill when:
- User provides reference images for a fashion shoot
- You need to generate hero image, contact sheet, or frame isolations
- You need the exact prompt templates for image generation

## Workflow Overview

```
Stage 1: SELECT      → Choose POSE and BACKGROUND presets (or use defaults)
Stage 2: HERO        → Generate full-body hero shot with selected presets
Stage 3: CONTACT     → Generate 2×3 grid (6 camera angles)
Stage 4: CROP        → Crop contact sheet into 6 frames
Stage 5: VIDEO       → Generate video from each frame (6 times)
Stage 6: STITCH      → Combine videos with transitions
```

## Customizable Presets

### POSE Presets (7 options)
See `presets/poses.md` for full details.

| # | Preset | Style |
|---|--------|-------|
| 1 | Confident Standing | Editorial attitude, hand on hip (DEFAULT) |
| 2 | Seated Editorial | Elegant floor sitting |
| 3 | Leaning Casual | Relaxed against wall |
| 4 | Editorial Drama | Angular high-fashion |
| 5 | Relaxed Natural | Candid, authentic |
| 6 | Street Walk | Mid-stride urban walk |
| 7 | Urban Lean | Street style against wall |

### BACKGROUND Presets (7 options)
See `presets/backgrounds.md` for full details.

| # | Preset | Style |
|---|--------|-------|
| 1 | Studio Grey | Clean seamless backdrop (DEFAULT) |
| 2 | Studio White | High-key commercial |
| 3 | Studio Black | Dramatic low-key |
| 4 | Industrial | Raw concrete, urban texture |
| 5 | Warm Daylight | Natural window light |
| 6 | Color Gel | Bold colored backdrop |
| 7 | Outdoor Urban | City street environment |

## The 6 Camera Angles (FIXED - Never Change)

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Frame 1 (R1C1) │  Frame 2 (R1C2) │  Frame 3 (R1C3) │
│  Beauty Portrait│  High-Angle 3/4 │  Low-Angle Full │
├─────────────────┼─────────────────┼─────────────────┤
│  Frame 4 (R2C1) │  Frame 5 (R2C2) │  Frame 6 (R2C3) │
│  Side-On Profile│  Intimate Close │  Extreme Detail │
└─────────────────┴─────────────────┴─────────────────┘
```

## How to Use

1. Read `presets/poses.md` and `presets/backgrounds.md` for preset options
2. Read `workflows/tim-workflow-templates.md` for prompt templates
3. Fill `{POSE_PRESET_SNIPPET}` and `{BACKGROUND_PRESET_SNIPPET}` with selected presets
4. Execute prompts through the fashion-shoot-pipeline scripts

## Available Templates

| Template | Purpose | Placeholders |
|----------|---------|--------------|
| `HERO_PROMPT` | Full-body hero shot | `{POSE_PRESET_SNIPPET}`, `{BACKGROUND_PRESET_SNIPPET}` |
| `CONTACT_SHEET_PROMPT` | 6-angle grid | `{STYLE_DETAILS}` (optional override) |
| `VIDEO_PROMPTS` | Camera movements | Pre-defined per frame type |

**Note:** Frame extraction is done programmatically via `crop-frames.ts` (no prompt needed).

## Style Treatment (FIXED)

All images use this exact style block - never modify:

```
The image is shot on fuji velvia film on a 55mm prime lens with a hard flash,
the light is concentrated on the subject and fades slightly toward the edges
of the frame. The image is over exposed showing significant film grain and is
oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```
