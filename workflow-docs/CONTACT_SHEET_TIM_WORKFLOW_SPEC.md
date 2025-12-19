# Contact Sheet Workflow Specification - Tim
## High-Fashion Editorial Photography Pipeline

This document provides a complete technical specification for automating the "Tim" contact sheet workflow. The pipeline generates high-fashion editorial photography featuring a model ("Tim") in an oversized jacket with various creative narrative expansions.

---

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Reference Assets](#reference-assets)
4. [Stage 1: Hero Image Generation](#stage-1-hero-image-generation)
5. [Stage 2: Contact Sheet Generation](#stage-2-contact-sheet-generation)
6. [Stage 3: Frame Isolation & Amplification](#stage-3-frame-isolation--amplification)
7. [Stage 4: Narrative Expansion](#stage-4-narrative-expansion)
8. [Visual Style Guide](#visual-style-guide)
9. [Comparison with Bills Supra Workflow](#comparison-with-bills-supra-workflow)
10. [Agent Implementation Notes](#agent-implementation-notes)

---

## Overview

**Workflow Name:** `contact-sheet-tim`
**Date:** 2025-12-07
**Total Nodes:** 29
- Image Inputs: 5
- Prompt Nodes: 12
- NanoBanana Generators: 12

**Primary Output:** A series of high-fashion editorial photography images featuring:
- 6-frame contact sheet from multiple angles
- Individually isolated and amplified frames
- Creative narrative expansions (grillz, shoes, holster props)

**Key Difference from Bills Supra:** This workflow is simpler and more focused on a single model without vehicle integration. It also demonstrates the "frame isolation" technique instead of manual contact sheet splitting.

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REFERENCE ASSETS                                   │
│  [Glasses Ref] [Model Ref] [Jacket Ref]                                     │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STAGE 1: HERO IMAGE GENERATION                          │
│                         (nanoBanana-4)                                       │
│  Input: 3 reference images + detailed scene prompt                          │
│  Output: Full-body hero shot of model in oversized jacket                   │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    STAGE 2: CONTACT SHEET GENERATION                        │
│                         (nanoBanana-6)                                       │
│  Input: Hero image + 6-frame contact sheet prompt                           │
│  Output: 2×3 grid with 6 different camera angles                            │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  FRAME 1 (R1C1) │   │  FRAME 2 (R1C2) │   │  FRAME 3 (R1C3) │
│  nanoBanana-28  │   │  nanoBanana-30  │   │  nanoBanana-31  │
└────────┬────────┘   └─────────────────┘   └────────┬────────┘
         │                                           │
         ▼                                           ▼
┌─────────────────┐                         ┌─────────────────┐
│  GRILLZ SHOT    │                         │  SHOES SHOT     │
│  nanoBanana-40  │                         │  nanoBanana-42  │
└─────────────────┘                         └────────┬────────┘
                                                     │
          ┌─────────────────────┼─────────────────────┐
          ▼                     ▼                     ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  FRAME 4 (R2C1) │   │  FRAME 5 (R2C2) │   │  FRAME 6 (R2C3) │
│  nanoBanana-32  │   │  nanoBanana-33  │   │  nanoBanana-34  │
└─────────────────┘   └─────────────────┘   └─────────────────┘

                                                     │
                                                     ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: NARRATIVE CHAIN                                │
│  nanoBanana-42 (shoes) → nanoBanana-45 (holster) → nanoBanana-47 (calc)   │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Reference Assets

### Primary Reference Images

| Asset ID | Filename | Purpose | Dimensions |
|----------|----------|---------|------------|
| `imageInput-1` | `173-single-default.jpg` | Glasses reference | 780×390 |
| `imageInput-2` | `turtle.webp` | Model face/pose reference | 900×450 |
| `imageInput-3` | `mid-jacket.png` | Oversized jacket reference | 1856×2464 |

### Narrative Expansion Reference Images

| Asset ID | Filename | Purpose | Dimensions |
|----------|----------|---------|------------|
| `imageInput-44` | `christmas-present-from-the-wife-*.png` | Shoe reference | 1080×1440 |
| `imageInput-50` | `some-iconic-calculators-*.webp` | TI-83 Calculator reference | 640×825 |

---

## Stage 1: Hero Image Generation

### Node: `nanoBanana-4`

**Configuration:**
```json
{
  "aspectRatio": "3:2",
  "resolution": "2K",
  "model": "nano-banana-pro",
  "useGoogleSearch": false
}
```

**Input Connections:**
- `imageInput-1` (Glasses) → image
- `imageInput-2` (Model) → image
- `imageInput-3` (Jacket) → image
- `prompt-5` → text

### PROMPT (prompt-5) - Hero Scene Description

```
Show me a high fashion photoshoot image of the model wearing the oversized jacket and glasses, the image should show the a full body shot of the subject. The model is looking past the camera slightly bored expression and eyebrows raised. They have one hand raised with two fingers tapping the side of the glasses. The setting is a studio environment with a blue background. The model is wearing fashionable, dark grey baggy cotton pants. The jacket is extremely, almost comically oversized on the model.

The image is from a low angle looking up at the subject.

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily), and there are harsh white reflections on the glasses frames.

3:2 aspect ratio
```

---

## Stage 2: Contact Sheet Generation

### Node: `nanoBanana-6`

**Configuration:**
```json
{
  "aspectRatio": "3:2",
  "resolution": "2K",
  "model": "nano-banana-pro",
  "useGoogleSearch": false
}
```

**Input Connections:**
- `nanoBanana-4` output → image (hero image from Stage 1)
- `prompt-7` → text

### PROMPT (prompt-7) - 6-Frame Contact Sheet

```
Analyze the input image and silently inventory all fashion-critical details: the subject(s), exact wardrobe pieces, materials, colors, textures, accessories, hair, makeup, body proportions, environment, set geometry, light direction, and shadow quality.
All wardrobe, styling, hair, makeup, lighting, environment, and color grade must remain 100% unchanged across all frames.
Do not add or remove anything.
Do not reinterpret materials or colors.
Do not output any reasoning.

Your visible output must be:

One 2×3 contact sheet image (6 frames).

Then a keyframe breakdown for each frame.

Each frame must represent a resting point after a dramatic camera move — only describe the final camera position and what the subject is doing, never the motion itself.

The six frames must be spatially dynamic, non-linear, and visually distinct, avoiding any progression such as wide → mid → close.

Required 6-Frame Shot List (All Resting Frames)
1. High-Fashion Beauty Portrait (Close, Editorial, Intimate)

Camera positioned very close to the subject's face, slightly above or slightly below eye level, using an elegant offset angle that enhances bone structure and highlights key wardrobe elements near the neckline. Shallow depth of field, flawless texture rendering, and a sculptural fashion-forward composition.

2. High-Angle Three-Quarter Frame

Camera positioned overhead but off-center, capturing the subject from a diagonal downward angle.
This frame should create strong shape abstraction and reveal wardrobe details from above.

3. Low-Angle Oblique Full-Body Frame

Camera positioned low to the ground and angled obliquely toward the subject.
This elongates the silhouette, emphasizes footwear, and creates a dramatic perspective distinct from Frames 1 and 2.

4. Side-On Compression Frame (Long Lens)

Camera placed far to one side of the subject, using a tighter focal length to compress space.
The subject appears in clean profile or near-profile, showcasing garment structure in a flattened, editorial manner.

5. Intimate Close Portrait From an Unexpected Height

Camera positioned very close to the subject's face (or upper torso) but slightly above or below eye level.
The angle should feel fashion-editorial, not conventional — offset, elegant, and expressive.

6. Extreme Detail Frame From a Non-Intuitive Angle

Camera positioned extremely close to a wardrobe detail, accessory, or texture, but from an unusual spatial direction (e.g., from below, from behind, from the side of a neckline).
This must be a striking, abstract, editorial detail frame.

Continuity & Technical Requirements

Maintain perfect wardrobe fidelity in every frame: exact garment type, silhouette, material, color, texture, stitching, accessories, closures, jewelry, shoes, hair, and makeup.

Environment, textures, and lighting must remain consistent.

Depth of field shifts naturally with focal length (deep for distant shots, shallow for close/detail shots).

Photoreal textures and physically plausible light behavior required.

Frames must feel like different camera placements within the same scene, not different scenes.

All keyframes must be the exact same aspect ratio, and exactly 6 keyframes should be output. Maintain the exact visual style in all keyframes, where the image is shot on fuji velvia film with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily), and there are harsh white reflections on the glasses frames.

Output Format
A) 2×3 Contact Sheet Image (Mandatory)

Include all 6 frames, each labeled with:
Frame number
Shot type
```

---

## Stage 3: Frame Isolation & Amplification

Unlike the Bills Supra workflow which manually splits the contact sheet, this workflow uses **prompt-based frame isolation**. Each frame is extracted and enhanced using a specific prompt pattern.

### Frame Isolation Prompt Template

All 6 frames use the same prompt pattern with different row/column coordinates:

**Node Configuration (all frames):**
```json
{
  "aspectRatio": "3:2",
  "resolution": "1K",
  "model": "nano-banana-pro",
  "useGoogleSearch": false
}
```

### Frame 1 - Row 1, Column 1 (Beauty Portrait)

**Node:** `nanoBanana-28`

**PROMPT (prompt-13):**
```
Isolate and amplify the key frame in row 1 column 1. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

### Frame 2 - Row 1, Column 2 (High-Angle Three-Quarter)

**Node:** `nanoBanana-30`

**PROMPT (prompt-35):**
```
Isolate and amplify the key frame in row 1 column 2. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

### Frame 3 - Row 1, Column 3 (Low-Angle Full-Body)

**Node:** `nanoBanana-31`

**PROMPT (prompt-36):**
```
Isolate and amplify the key frame in row 1 column 3. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

### Frame 4 - Row 2, Column 1 (Side-On Compression)

**Node:** `nanoBanana-32`

**PROMPT (prompt-37):**
```
Isolate and amplify the key frame in row 2 column 1. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

### Frame 5 - Row 2, Column 2 (Intimate Close Portrait)

**Node:** `nanoBanana-33`

**PROMPT (prompt-38):**
```
Isolate and amplify the key frame in row 2 column 2. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

### Frame 6 - Row 2, Column 3 (Extreme Detail)

**Node:** `nanoBanana-34`

**PROMPT (prompt-39):**
```
Isolate and amplify the key frame in row 2 column 3. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

---

## Stage 4: Narrative Expansion

This stage creates creative story-driven variations building on isolated frames.

### Chain 1: Grillz Close-Up

**Node:** `nanoBanana-40`

**Configuration:**
```json
{
  "aspectRatio": "3:2",
  "resolution": "1K",
  "model": "nano-banana-pro",
  "useGoogleSearch": true
}
```

**Input:** Output from `nanoBanana-28` (Frame 1 - Beauty Portrait)

**PROMPT (prompt-41):**
```
Show me a wide angle close up of the model, as if dolly zoomed. The model's lips are parted in a snarl, showing gold and diamond plated teeth. The top four teeth have the letters A A P L encrusted into the diamonds.
```

### Chain 2: Shoe Feature → Holster → Calculator

This is a progressive narrative chain that builds on each previous output.

#### Step 1: Shoe Feature Shot

**Node:** `nanoBanana-42`

**Configuration:**
```json
{
  "aspectRatio": "3:2",
  "resolution": "1K",
  "model": "nano-banana-pro",
  "useGoogleSearch": false
}
```

**Input:**
- Output from `nanoBanana-31` (Frame 3 - Low-Angle Full-Body)
- `imageInput-44` (Shoe reference image)

**PROMPT (prompt-43):**
```
Show me a wide angle worms eye view of the model standing, his right foot is extended showing he is wearing the shoes in the reference image.
```

#### Step 2: Holster Reveal

**Node:** `nanoBanana-45`

**Configuration:**
```json
{
  "aspectRatio": "3:2",
  "resolution": "1K",
  "model": "nano-banana-pro",
  "useGoogleSearch": false
}
```

**Input:** Output from `nanoBanana-42` (Shoe shot)

**PROMPT (prompt-46):**
```
Tight shot of the model lifting his jacket to display the holster of a glock 9mm pistol.
```

#### Step 3: Calculator Substitution (Comedic Twist)

**Node:** `nanoBanana-47`

**Configuration:**
```json
{
  "aspectRatio": "3:2",
  "resolution": "2K",
  "model": "nano-banana-pro",
  "useGoogleSearch": true
}
```

**Input:**
- Output from `nanoBanana-45` (Holster shot)
- `imageInput-50` (TI-83 Calculator reference)

**PROMPT (prompt-49):**
```
Replace the pistol with the texas instruments ti-83 calculaator. The calculator is in a black leather holster.
```

---

## Visual Style Guide

### Core Aesthetic Parameters

All images must maintain these consistent visual characteristics:

| Parameter | Value |
|-----------|-------|
| **Film Stock** | Fuji Velvia |
| **Exposure** | Overexposed |
| **Grain** | Significant film grain |
| **Saturation** | Oversaturated |
| **Skin Texture** | Shiny/oily appearance |
| **Reflections** | Harsh white reflections on glasses |
| **Aspect Ratio** | 3:2 |
| **Vignetting** | Light fades toward edges |
| **Background** | Blue studio environment |

### Lighting Setup

- **Key Light:** Hard flash (55mm prime lens setup)
- **Environment:** Studio with blue background
- **Light Quality:** Concentrated on subject, fading toward edges
- **Style:** Editorial fashion photography

### Wardrobe Consistency

| Element | Description |
|---------|-------------|
| **Jacket** | Extremely oversized, almost comically large |
| **Pants** | Dark grey baggy cotton pants |
| **Accessories** | Glasses (with reflections) |
| **Pose** | Bored expression, eyebrows raised, two fingers tapping glasses |

---

## Comparison with Bills Supra Workflow

| Aspect | Tim Workflow | Bills Supra Workflow |
|--------|--------------|---------------------|
| **Complexity** | 29 nodes | 82 nodes |
| **Subject** | Single model | Model + Vehicle |
| **Background** | Blue studio | Dark cyclorama |
| **Frame Extraction** | Prompt-based isolation | Manual image splitting |
| **Narrative Depth** | 2 expansion chains | 5+ expansion chains |
| **Typography** | None | "NODE", "BANANA", "SUPRA" overlays |
| **Vehicle Shots** | None | Dedicated vehicle contact sheet |
| **Secondary Characters** | None | Photographer character |

### Key Technique Differences

1. **Frame Isolation vs Splitting:**
   - Tim uses: `"Isolate and amplify the key frame in row X column Y"`
   - Bills Supra uses: Manual contact sheet splitting into separate image files

2. **Reference Image Count:**
   - Tim: 3 primary + 2 narrative expansion
   - Bills Supra: 5 primary + 20+ for various stages

3. **Narrative Complexity:**
   - Tim: Linear chain (shoes → holster → calculator)
   - Bills Supra: Branching narrative (driver seat, wing mirror, photographer)

---

## Agent Implementation Notes

### Pipeline Automation Requirements

1. **Image Generation API Integration**
   - Model: `nano-banana-pro` (or Gemini equivalent)
   - Resolutions: 2K for hero/final, 1K for intermediate frames
   - Aspect Ratio: Maintain 3:2 throughout

2. **Frame Isolation Technique**
   - Use prompt-based extraction: "Isolate and amplify the key frame in row X column Y"
   - This eliminates need for image processing/splitting code
   - The model understands 2×3 grid coordinates

3. **Prompt Template System**
   - Frame isolation prompts are parameterizable by row/column
   - Style block is consistent across all prompts
   - Narrative prompts are custom per creative expansion

4. **Chain Execution Logic**
   ```
   Stage 1: Hero (requires all 3 refs)
   Stage 2: Contact Sheet (requires Stage 1 output)
   Stage 3: Frame Isolation (all 6 can run in parallel, require Stage 2)
   Stage 4: Narrative Chains
     - Chain A: Frame 1 → Grillz
     - Chain B: Frame 3 → Shoes → Holster → Calculator
   ```

### Suggested Agent Architecture

```python
class TimContactSheetAgent:
    def __init__(self):
        self.reference_images = {}
        self.style_guide = VISUAL_STYLE_PARAMS
        self.generated_outputs = {}

    async def run_pipeline(self, config):
        # Stage 1: Hero generation
        hero = await self.generate_hero(
            refs=[config.glasses, config.model, config.jacket],
            prompt=HERO_PROMPT
        )

        # Stage 2: Contact sheet
        contact_sheet = await self.generate_contact_sheet(
            input_image=hero,
            prompt=CONTACT_SHEET_PROMPT
        )

        # Stage 3: Isolate all 6 frames (parallel execution)
        frames = await asyncio.gather(*[
            self.isolate_frame(contact_sheet, row, col)
            for row in [1, 2] for col in [1, 2, 3]
        ])

        # Stage 4: Narrative expansions
        grillz = await self.generate_grillz(frames[0])  # Frame 1

        shoes = await self.generate_shoes(
            frames[2],  # Frame 3
            config.shoe_reference
        )
        holster = await self.generate_holster(shoes)
        calculator = await self.generate_calculator(
            holster,
            config.calculator_reference
        )

        return {
            'hero': hero,
            'contact_sheet': contact_sheet,
            'frames': frames,
            'grillz': grillz,
            'narrative_chain': [shoes, holster, calculator]
        }

    async def isolate_frame(self, contact_sheet, row, col):
        prompt = f"Isolate and amplify the key frame in row {row} column {col}. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model."
        return await self.generate(contact_sheet, prompt, resolution="1K")
```

### Frame Isolation Grid Reference

```
Contact Sheet Layout:
┌───────────┬───────────┬───────────┐
│  R1 C1    │  R1 C2    │  R1 C3    │
│ (Frame 1) │ (Frame 2) │ (Frame 3) │
│  Beauty   │ High-Angle│ Low-Angle │
│  Portrait │ 3-Quarter │ Full-Body │
├───────────┼───────────┼───────────┤
│  R2 C1    │  R2 C2    │  R2 C3    │
│ (Frame 4) │ (Frame 5) │ (Frame 6) │
│  Side-On  │ Intimate  │ Extreme   │
│  Profile  │ Close     │ Detail    │
└───────────┴───────────┴───────────┘
```

### Video Production Considerations

For converting the final images to video:

1. **Suggested Sequence:**
   - Hero shot (establish)
   - Contact sheet (overview)
   - Individual frames (quick cuts)
   - Grillz close-up (detail punch)
   - Narrative chain (shoes → holster → calculator reveal)

2. **Transition Suggestions:**
   - Ken Burns pan/zoom on hero
   - Grid reveal for contact sheet
   - Fast cuts between isolated frames
   - Slow zoom for grillz reveal
   - Match cuts for narrative chain

3. **Audio Sync Points:**
   - Beat drop on calculator reveal (comedic timing)
   - Bass hit on grillz close-up
   - Ambient fashion music throughout

---

## Appendix: Complete Node Dependency Graph

```
imageInput-1 (glasses) ─────┐
imageInput-2 (model) ───────┼──► nanoBanana-4 ──► nanoBanana-6 ──┬──► nanoBanana-28 (R1C1) ──► nanoBanana-40 (grillz)
imageInput-3 (jacket) ──────┘                                    │
prompt-5 ───────────────────┘                                    ├──► nanoBanana-30 (R1C2)
prompt-7 ────────────────────────────────────────────────────────┤
                                                                 ├──► nanoBanana-31 (R1C3) ──┐
                                                                 │                          │
                                                                 ├──► nanoBanana-32 (R2C1)  │
                                                                 │                          │
                                                                 ├──► nanoBanana-33 (R2C2)  │
                                                                 │                          │
                                                                 └──► nanoBanana-34 (R2C3)  │
                                                                                            │
imageInput-44 (shoes) ─────────────────────────────────────────────────────────────────────┼──► nanoBanana-42 (shoes)
prompt-43 ─────────────────────────────────────────────────────────────────────────────────┘          │
                                                                                                      │
prompt-46 ────────────────────────────────────────────────────────────────────────────────────────────┼──► nanoBanana-45 (holster)
                                                                                                      │          │
imageInput-50 (calculator) ───────────────────────────────────────────────────────────────────────────┼──────────┼──► nanoBanana-47 (calculator)
prompt-49 ────────────────────────────────────────────────────────────────────────────────────────────┘          │
                                                                                                                 ▼
                                                                                                           FINAL OUTPUT
```

---

## Appendix: Reusable Prompt Components

### Style Block (append to all generation prompts)

```
The image is shot on fuji velvia film on a 55mm prime lens with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily), and there are harsh white reflections on the glasses frames.

3:2 aspect ratio
```

### Frame Isolation Template

```
Isolate and amplify the key frame in row {ROW} column {COLUMN}. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

### Consistency Anchors

```
All wardrobe, styling, hair, makeup, lighting, environment, and color grade must remain 100% unchanged across all frames.
Do not add or remove anything.
Do not reinterpret materials or colors.
Do not output any reasoning.
```

---

*Document Version: 1.0*
*Generated from: `examples/contact-sheet-tim.json`*
