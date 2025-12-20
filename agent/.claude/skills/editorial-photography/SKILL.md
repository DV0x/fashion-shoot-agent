---
name: editorial-photography
description: Execute the Tim workflow for fashion editorial photography. Use when generating hero images, contact sheets, and frame isolations. This skill provides EXACT prompt templates - do not improvise or deviate from the templates.
---

# Editorial Photography Skill (Tim Workflow)

This skill provides **exact prompt templates** for the Tim workflow fashion pipeline.

## CRITICAL: No Improvisation

- **DO NOT** change camera angles or shot types
- **DO NOT** modify the style block (Fuji Velvia treatment)
- **DO NOT** skip or reorder pipeline stages
- **DO** fill in placeholders with details from reference image analysis
- **DO** follow the exact prompt structure

## When to Use

Invoke this skill when:
- User provides reference images for a fashion shoot
- You need to generate hero image, contact sheet, or frame isolations
- You need the exact prompt templates for image generation

## Workflow Overview

```
Stage 1: ANALYZE     → Extract details from user's reference images
Stage 2: HERO        → Generate full-body hero shot
Stage 3: CONTACT     → Generate 2×3 grid (6 camera angles)
Stage 4: ISOLATE     → Extract each frame (6 times)
Stage 5: VIDEO       → Generate video from each frame (6 times)
Stage 6: STITCH      → Combine videos with transitions
```

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

1. Read `workflows/tim-workflow-templates.md` for all prompt templates
2. Follow the ANALYSIS PHASE to extract reference details
3. Fill placeholders in templates with extracted details
4. Execute prompts through the fashion-shoot-pipeline scripts

## Available Templates

| Template | Purpose | Placeholders |
|----------|---------|--------------|
| `HERO_PROMPT` | Full-body hero shot | `{SUBJECT}`, `{WARDROBE}`, `{ACCESSORIES}`, `{POSE}`, `{BACKGROUND}` |
| `CONTACT_SHEET_PROMPT` | 6-angle grid | `{STYLE_DETAILS}` (optional override) |
| `FRAME_ISOLATION_PROMPT` | Extract single frame | `{ROW}`, `{COLUMN}` |
| `VIDEO_PROMPTS` | Camera movements | Pre-defined per frame type |

## Style Treatment (FIXED)

All images use this exact style block - never modify:

```
The image is shot on fuji velvia film on a 55mm prime lens with a hard flash,
the light is concentrated on the subject and fades slightly toward the edges
of the frame. The image is over exposed showing significant film grain and is
oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```
