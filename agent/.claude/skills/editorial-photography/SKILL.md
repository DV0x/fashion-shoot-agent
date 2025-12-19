---
name: editorial-photography
description: Professional fashion and editorial photography knowledge. Use when planning camera angles, designing shot lists, or crafting image generation prompts for fashion photoshoots.
---

# Editorial Photography Skill

Professional knowledge for fashion and editorial photography, including camera techniques, prompt engineering, and the Tim workflow 6-shot pattern.

## When to Use This Skill

Invoke this skill when you need to:
- Plan camera angles and shot compositions for a fashion shoot
- Design a 6-frame contact sheet shot list
- Craft detailed prompts for AI image generation
- Understand the Tim workflow pattern
- Apply consistent visual styles (e.g., Fuji Velvia)

## Available Knowledge

### Core Knowledge (`core/`)

| Document | Content |
|----------|---------|
| `camera-fundamentals.md` | Camera positions (height, lateral), angle types, the 6-angle system, lens choices, composition rules, depth of field, i2v movement concepts |
| `prompt-assembly.md` | Prompt structure, block types, assembly patterns for hero/contact sheet/isolation, creative section guidelines, quality checklist |

### Style Guides (`styles/`)

| Document | Content |
|----------|---------|
| `fashion-tim.md` | Tim workflow 6-shot pattern, grid layout, frame descriptions, pipeline stages, frame isolation technique, key principles |

### Templates (`templates/`)

| Document | Content |
|----------|---------|
| `injection-blocks.md` | ANALYSIS_BLOCK, CONTINUITY_BLOCK, CONTACT_SHEET_FORMAT, 6-FRAME SHOT LIST, TECHNICAL_REQUIREMENTS, FRAME_ISOLATION_TEMPLATE |
| `style-fuji-velvia.md` | Fuji Velvia style block, parameters, lighting characteristics, variations, alternative styles |

## How to Use

### For Shot Planning
1. Read `core/camera-fundamentals.md` for angle and position options
2. Read `styles/fashion-tim.md` for the 6-shot pattern structure
3. Adapt frame descriptions to the specific subject/wardrobe

### For Prompt Crafting
1. Read `core/prompt-assembly.md` for structure guidelines
2. Read `templates/injection-blocks.md` for reusable fragments
3. Read `templates/style-fuji-velvia.md` for visual treatment
4. Assemble blocks in the correct order

### For Contact Sheet Generation
1. Use ANALYSIS_BLOCK to inventory reference images
2. Use CONTINUITY_BLOCK to enforce consistency
3. Use CONTACT_SHEET_FORMAT for output specification
4. Include 6-FRAME SHOT LIST with adapted descriptions
5. Add STYLE_BLOCK for visual treatment
6. Specify aspect ratio (3:2)

### For Frame Isolation
Use the template from `injection-blocks.md`:
```
Isolate and amplify the key frame in row {R} column {C}.
Keep all details exactly the same.
```

## Quick Reference: 6-Frame Grid

```
┌───────────┬───────────┬───────────┐
│  R1 C1    │  R1 C2    │  R1 C3    │
│  Beauty   │ High-Angle│ Low-Angle │
├───────────┼───────────┼───────────┤
│  R2 C1    │  R2 C2    │  R2 C3    │
│  Side-On  │ Intimate  │ Detail    │
└───────────┴───────────┴───────────┘
```

## Key Principles

1. **Spatial dynamism** - Frames must be non-linear, not wide→mid→close
2. **Resting frames** - Describe end positions, not motion
3. **Perfect continuity** - Identical wardrobe/styling/lighting across frames
4. **Same scene** - Different camera positions, not different scenes
5. **Style consistency** - Apply visual treatment uniformly
