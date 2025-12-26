# Presets Configuration

This document defines the customizable presets for the fashion shoot pipeline.

---

## Overview

### What We're Adding
- **POSE presets**: 7 predefined poses + custom input
- **BACKGROUND presets**: 7 predefined backgrounds + custom input

### User Flow
```
1. User uploads:
   ├── Their photo (subject/face)
   └── Reference images (outfit, accessories, vibe)

2. User selects presets:
   ├── POSE       → Choose from 7 presets or custom
   └── BACKGROUND → Choose from 7 presets or custom

3. System generates:
   └── Hero → Contact Sheet → Frames → Videos → Final
```

---

## Preset Definitions

### POSE Presets (7)

| # | Preset Name | Internal Prompt Snippet |
|---|-------------|-------------------------|
| 1 | Confident Standing | standing with weight shifted to one leg, hand resting on hip, shoulders back with chin slightly lifted, direct confident gaze at camera, editorial attitude |
| 2 | Seated Editorial | sitting elegantly on floor or low surface, relaxed upright posture, legs arranged gracefully, contemplative gaze, one hand resting naturally |
| 3 | Leaning Casual | leaning against wall or surface, relaxed shoulders, weight shifted to one side, approachable energy, soft natural gaze |
| 4 | Editorial Drama | angular high-fashion pose, strong geometric body shapes, dramatic tension in posture, intense editorial presence, fashion-forward attitude |
| 5 | Relaxed Natural | soft candid posture, natural unstaged stance, weight balanced, effortless and authentic feel, gentle expression |
| 6 | Street Walk | mid-stride walking motion, confident urban walk, natural arm movement, city energy, looking ahead or glancing at camera |
| 7 | Urban Lean | leaning against urban surface like wall or railing, street style attitude, one foot against wall, relaxed but intentional pose |

### BACKGROUND Presets (7)

| # | Preset Name | Internal Prompt Snippet |
|---|-------------|-------------------------|
| 1 | Studio Grey | seamless grey studio backdrop, clean and timeless, professional fashion studio environment |
| 2 | Studio White | white cyclorama background, bright and commercial, high-key studio lighting environment |
| 3 | Studio Black | dark void background, dramatic and moody, low-key studio with subject isolation |
| 4 | Industrial | raw concrete walls with urban texture, exposed architectural elements, edgy industrial setting |
| 5 | Warm Daylight | soft natural window light environment, warm and organic atmosphere, gentle diffused daylight |
| 6 | Color Gel | bold solid colored backdrop with editorial gel lighting, vibrant and fashion-forward, saturated color environment |
| 7 | Outdoor Urban | city street environment, urban architectural context, real-world metropolitan setting with street elements |

---

## Compatibility Guide

Recommended pose + background combinations for best results:

| Background | Best Poses |
|------------|------------|
| Studio Grey | Any (versatile) |
| Studio White | Any (versatile) |
| Studio Black | Editorial Drama, Confident Standing |
| Industrial | Leaning Casual, Urban Lean, Editorial Drama |
| Warm Daylight | Relaxed Natural, Seated Editorial |
| Color Gel | Editorial Drama, Confident Standing |
| Outdoor Urban | Street Walk, Urban Lean, Relaxed Natural |

---

## Prompt Template Changes

### Current HERO_PROMPT Structure
```
Show me a high fashion photoshoot image of {SUBJECT} wearing {WARDROBE}.
{ACCESSORIES_DETAIL}. The image should show a full body shot of the subject.
{POSE_DESCRIPTION}. The setting is a studio environment with a {BACKGROUND_COLOR} background.

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash,
the light is concentrated on the subject and fades slightly toward the edges
of the frame. The image is over exposed showing significant film grain and is
oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```

### Updated HERO_PROMPT Structure
```
Show me a high fashion photoshoot image of the subject from the reference photo
wearing the outfit and accessories from the reference images.

The image should show a full body shot of the subject.

Pose: {POSE_PRESET_SNIPPET}

Setting: {BACKGROUND_PRESET_SNIPPET}

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash,
the light is concentrated on the subject and fades slightly toward the edges
of the frame. The image is over exposed showing significant film grain and is
oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```

### How Presets Inject

**Example with "Confident Standing" + "Outdoor Urban":**
```
Show me a high fashion photoshoot image of the subject from the reference photo
wearing the outfit and accessories from the reference images.

The image should show a full body shot of the subject.

Pose: standing with weight shifted to one leg, hand resting on hip, shoulders
back with chin slightly lifted, direct confident gaze at camera, editorial attitude

Setting: city street environment, urban architectural context, real-world
metropolitan setting with street elements

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash,
the light is concentrated on the subject and fades slightly toward the edges
of the frame. The image is over exposed showing significant film grain and is
oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```

---

## What Stays Fixed (V1)

These elements remain hardcoded and are NOT customizable in V1:

| Element | Fixed Value |
|---------|-------------|
| Camera Angles | 6 fixed angles (Beauty Portrait, High-Angle 3/4, Low-Angle Full-Body, Side-On Profile, Intimate Close, Extreme Detail) |
| Film Stock | Fuji Velvia |
| Lighting | Hard flash, concentrated on subject |
| Lens | 55mm prime |
| Exposure | Overexposed with significant film grain |
| Saturation | Oversaturated |
| Skin Treatment | Shiny/oily |
| Aspect Ratio | 3:2 |

---

## File Structure

### Recommended Pattern: Modular Presets

To avoid bloating the main workflow file, presets are stored in separate files:

```
agent/.claude/skills/editorial-photography/
├── SKILL.md                        # Skill definition (lean, describes when to invoke)
├── presets/
│   ├── poses.md                    # 7 pose preset definitions
│   └── backgrounds.md              # 7 background preset definitions
└── workflows/
    └── tim-workflow-templates.md   # Core prompts (references presets)
```

### Benefits of This Structure

| Benefit | Description |
|---------|-------------|
| **Modular** | Add/edit presets without touching core workflow |
| **Maintainable** | Each file has single responsibility |
| **Scalable** | Easy to add new preset categories (lighting, film stock) |
| **Reusable** | Presets can be shared across different workflows |

---

## File Changes Required

### 1. Create Pose Presets File (NEW)
**File:** `agent/.claude/skills/editorial-photography/presets/poses.md`

Contents:
- All 7 pose preset definitions
- Each with name and full prompt snippet
- Usage instructions

### 2. Create Background Presets File (NEW)
**File:** `agent/.claude/skills/editorial-photography/presets/backgrounds.md`

Contents:
- All 7 background preset definitions
- Each with name and full prompt snippet
- Compatibility hints with poses

### 3. Update Workflow Templates
**File:** `agent/.claude/skills/editorial-photography/workflows/tim-workflow-templates.md`

Changes:
- Reference presets from `presets/` directory
- Update HERO_PROMPT template to use preset injection
- Remove redundant PHASE 1 analysis (subject/wardrobe extracted from visual reference)
- Keep file focused on workflow flow, not preset data

### 4. Update Skill Definition
**File:** `agent/.claude/skills/editorial-photography/SKILL.md`

Changes:
- Reference presets directory
- Update workflow description to include preset selection step
- Keep lean - just describes when to invoke

### 5. No Script Changes Required
The `generate-image.ts` script remains unchanged—it receives the fully constructed prompt with presets already injected.

---

## Future Considerations (V2+)

Additional levers that could be added:

| Lever | Options |
|-------|---------|
| Film Stock | Fuji Velvia, Kodak Portra, Cinestill 800T, Ilford HP5 (B&W) |
| Lighting | Hard Flash, Soft Box, Natural Window, Rim Light, Ring Flash |
| Shot Type | Full Body, 3/4 Shot, Waist Up |
| Mood/Energy | Confident, Moody, Playful, Mysterious |
| Angle Presets | Studio Standard, Urban Dynamic, Editorial Dramatic |

---

## Defaults

When user doesn't select a preset:

| Element | Default |
|---------|---------|
| POSE | Confident Standing |
| BACKGROUND | Studio Grey |
