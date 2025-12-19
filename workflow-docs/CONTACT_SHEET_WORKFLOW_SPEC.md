# Contact Sheet Workflow Specification
## High-Fashion Automotive Photography Pipeline

This document provides a complete technical specification for automating the "Bills Supra" contact sheet workflow. The pipeline generates high-fashion photography featuring a model with a black MK4 Toyota Supra, creating contact sheets, individual refined frames, and overlay compositions.

---

## Table of Contents

1. [Overview](#overview)
2. [Pipeline Architecture](#pipeline-architecture)
3. [Reference Assets](#reference-assets)
4. [Stage 1: Hero Image Generation](#stage-1-hero-image-generation)
5. [Stage 2: Contact Sheet Generation](#stage-2-contact-sheet-generation)
6. [Stage 3: Frame Extraction & Refinement](#stage-3-frame-extraction--refinement)
7. [Stage 4: Narrative Expansion](#stage-4-narrative-expansion)
8. [Stage 5: Vehicle-Only Contact Sheet](#stage-5-vehicle-only-contact-sheet)
9. [Stage 6: Upscaling Pipeline](#stage-6-upscaling-pipeline)
10. [Stage 7: Typography Overlay](#stage-7-typography-overlay)
11. [Visual Style Guide](#visual-style-guide)
12. [Agent Implementation Notes](#agent-implementation-notes)

---

## Overview

**Workflow Name:** `contact-sheet-billsSupra`
**Total Nodes:** 82
- Image Inputs: 31
- Prompt Nodes: 26
- NanoBanana Generators: 25

**Primary Output:** A series of high-fashion automotive photography images suitable for video production, featuring:
- 6-frame contact sheets from multiple angles
- Individually refined hero shots
- Typography-integrated compositions
- Vehicle-only beauty shots

---

## Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REFERENCE ASSETS                                   │
│  [Supra Image] [Model Face] [Outfit 1] [Outfit 2] [Sneakers]                │
└───────────────────────────────┬─────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                     STAGE 1: HERO IMAGE GENERATION                          │
│                         (nanoBanana-4)                                       │
│  Input: 5 reference images + detailed scene prompt                          │
│  Output: Full-body hero shot of model with car                              │
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
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌───────────────────────────┐   ┌───────────────────────────┐
│   STAGE 3A: SPLIT IMAGES  │   │   STAGE 3B: SPLIT IMAGES  │
│   (Column 1: 3 frames)    │   │   (Column 2: 3 frames)    │
│   split-1-1, 1-2, 1-3     │   │   split-2-1, 2-2, 2-3     │
└───────────┬───────────────┘   └───────────┬───────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    STAGE 3: FRAME REFINEMENT                               │
│  Each frame → Refinement prompt → Enhanced output                          │
│  Chains: 72→74, 70→78→80, 76→82→84→89, etc.                               │
└───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    STAGE 4: NARRATIVE EXPANSION                            │
│  - Driver seat shots                                                        │
│  - Wing mirror reflection (photographer visible)                           │
│  - Photographer full-body shot                                              │
└───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    STAGE 5: VEHICLE-ONLY CONTACT SHEET                     │
│  Same 6-frame technique but focusing solely on the car                     │
└───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    STAGE 6: UPSCALING                                      │
│  Each final frame → Upscale prompt → High-res output                       │
└───────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌───────────────────────────────────────────────────────────────────────────┐
│                    STAGE 7: TYPOGRAPHY OVERLAY                             │
│  Add "NODE", "BANANA", "SUPRA" text behind subjects                        │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Reference Assets

### Primary Reference Images

| Asset ID | Filename | Purpose | Dimensions |
|----------|----------|---------|------------|
| `imageInput-56` | `j1g26m3k54n51.png` | Black MK4 Supra reference | 640×640 |
| `imageInput-57` | `bill.png` | Model face reference | 800×600 |
| `imageInput-60` | `outfit.png` | Ducati tracksuit reference | 1080×897 |
| `imageInput-61` | `outfit2.png` | Alternative outfit reference | 1080×898 |
| `imageInput-62` | `sneakers.png` | Black sneaker reference | 1078×720 |

### Secondary Reference Images (for photographer character)

| Asset ID | Filename | Purpose |
|----------|----------|---------|
| `imageInput-86` | `American-businessman-Steve-Ballmer-2009.png` | Photographer face reference |
| `imageInput-91` | `ballmer_web.png` | Photographer alternative reference |

### Typography Reference Images

| Asset ID | Filename | Purpose |
|----------|----------|---------|
| `imageInput-124` | `Screenshot_40.png` | Font reference |
| `imageInput-126` | `Screenshot_41.png` | Font reference |
| `imageInput-127` | `Screenshot_42.png` | Font reference |
| `imageInput-131` | `pasted-*.png` | Text style reference |

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
- `imageInput-56` (Supra) → image
- `imageInput-57` (Model face) → image
- `imageInput-60` (Outfit) → image
- `imageInput-61` (Outfit 2) → image
- `imageInput-62` (Sneakers) → image
- `prompt-5` → text

### PROMPT (prompt-5) - Hero Scene Description

```
Generate an high fashion photography image of the older man wearing Ducati tracksuit pants, a red long sleeve top, and black sneakers. He should have a gold chain around his neck over top of the red shirt.

The setting is a pristine, high-budget automotive photography studio. The model is sitting casually on the front hood and fender of the car. One leg is dangling down towards the studio floor, while the other leg is pulled up with his foot resting naturally on the car's front bumper. He is leaning back slightly, supporting himself on his hands behind him. A massive softbox downlight (large diffusion bank) hangs directly overhead, creating long, clean highlights on the vehicle. The background is a seamless, dark studio cyclorama. The car is a black mk4 Supra and should match the reference image. Render the vehicle with hyper-realistic detail, capturing the precise metallic texture of the paint, distinct mechanical components, and accurate light reflections.

The lighting is dramatic and controlled, the model has a blank, model-like expression looking past the camera. The depth of field is focused on the model and car, the background of the image is rendered soft and blurred from the depth of field.

Perfectly match the facial features, bone structure, and complexion of the model. Render the skin with hyper-realistic detail, capturing deep pores, fine wrinkles, and authentic age-related texture.

Ensure that the proportion of the model compared to the car is realistic and that both the model and the car are accurately proportioned.

The photo is taken from a low angle looking up at the subject with a wide lens at a dutch angle. The image is shot on fuji velvia film on a 18mm prime lens with the overhead softbox acting as the key light, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated.

3:2 aspect ratio.
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

Perfectly replicate the exact facial features of the model, specifically the older man's hyper-realistic skin texture, pores, and age details.

Your visible output must be:

One 2×3 contact sheet image (6 frames).

Then a keyframe breakdown for each frame.

Each frame must represent a resting point after a dramatic camera move — only describe the final camera position and what the subject is doing, never the motion itself.

The six frames must be spatially dynamic, non-linear, and visually distinct, avoiding any progression such as wide → mid → close.

Required 6-Frame Shot List (All Resting Frames)

1. High-Fashion Beauty Portrait (Close, Editorial, Intimate)

Camera positioned very close to the subject's face, slightly above or slightly below eye level, using an elegant offset angle that enhances bone structure and highlights key wardrobe elements near the neckline (gold chain). Shallow depth of field, flawless texture rendering, and a sculptural fashion-forward composition.

2. High-Angle Three-Quarter Frame

Camera positioned overhead but off-center, capturing the subject from a diagonal downward angle. This frame should create strong shape abstraction, revealing the subject sitting on the car hood and wardrobe details from above.

3. Low-Angle Oblique Full-Body Frame

Camera positioned low to the ground and angled obliquely toward the subject. This elongates the silhouette, emphasizes the footwear and the car bumper, and creates a dramatic perspective distinct from Frames 1 and 2.

4. Wide Environmental Studio Frame

Camera positioned wide and back, capturing the entire profile of the vehicle with the subject sitting on the hood. This frame emphasizes the scale of the "high-budget studio," showing the massive softbox light source hanging above the car and the seamless cyclorama background. The car's sleek lines and reflections are the primary focus, with the subject integrated into the grand scene. The model is squatting on the hood of the car

5. Intimate Close Portrait From high angle

Camera positioned high above the subject's face, looking at a downward angle as if on a boom. The subject has tilted their head back slightly to face upward. With one finger, they are pulling down their glasses to look over top of the rim. Despite facing the camera, their expression remains totally blank and distant, staring past the lens.

6. Extreme Detail Frame From a Non-Intuitive Angle

Camera positioned extremely close to a wardrobe detail, accessory, or texture, but from an unusual spatial direction. This must be a striking, abstract, editorial detail frame.

Continuity & Technical Requirements

Maintain perfect wardrobe fidelity in every frame: exact garment type (Ducati pants, red top), silhouette, material, color, texture, stitching, accessories (gold chain), closures, jewelry, shoes, hair, and makeup.

Environment, textures, and lighting must remain consistent.

Depth of field shifts naturally with focal length (deep for distant shots, shallow for close/detail shots).

Photoreal textures and physically plausible light behavior required.

Frames must feel like different camera placements within the same scene, not different scenes.

All keyframes must be the exact same aspect ratio, and exactly 6 keyframes should be output. Maintain the exact visual style in all keyframes, where the image is shot on fuji velvia film with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily), and there are harsh white reflections on the skin and gold chain.

Output Format

A) 2×3 Contact Sheet Image (Mandatory)
```

---

## Stage 3: Frame Extraction & Refinement

After the contact sheet is generated, individual frames are extracted and refined through multiple passes.

### Frame Extraction (Manual Step in Current Workflow)

The 2×3 contact sheet is split into 6 individual images:
- `split-1-1.png` (Row 1, Col 1)
- `split-1-2.png` (Row 2, Col 1)
- `split-1-3.png` (Row 3, Col 1)
- `split-2-1.png` (Row 1, Col 2)
- `split-2-2.png` (Row 2, Col 2)
- `split-2-3.png` (Row 3, Col 2)

### Refinement Chain 1: Portrait Enhancement

**Node:** `nanoBanana-72`
```json
{
  "aspectRatio": "3:2",
  "resolution": "1K",
  "model": "nano-banana-pro",
  "useGoogleSearch": true
}
```

**Input:** `split-1-1.png` (imageInput-64)

**PROMPT (prompt-73):**
```
Highly realistic portrait image, perfectly match the facial features skin, and framing of the original image. Remove any outlines or boders, only create the actual image.
```

### Refinement Chain 2: Car + Model Frame

**Node:** `nanoBanana-70`
```json
{
  "aspectRatio": "3:2",
  "resolution": "1K",
  "model": "nano-banana-pro",
  "useGoogleSearch": false
}
```

**Input:** `split-1-2.png` (imageInput-65)

**PROMPT (prompt-71):**
```
Highly realistic image, perfectly match the facial features skin, car details and framing of the original image. Remove any outlines or boders, only create the actual image.
```

### Refinement Chain 3: Wide Studio Shot

**Node:** `nanoBanana-74`
```json
{
  "aspectRatio": "3:2",
  "resolution": "1K",
  "model": "nano-banana-pro",
  "useGoogleSearch": true
}
```

**Input:** `split-1-3.png` (imageInput-66) + output from `nanoBanana-72`

**PROMPT (prompt-75):**
```
Highly realistic image of a man squatting on a car hood in a studio environment, perfectly match the facial features skin, car details and framing of the original image. Remove any outlines or boders, only create the actual image.

Refer to the reference image for the face details.
```

### Refinement Chain 4: Second Column Frames

**Node:** `nanoBanana-76`

**Input:** `split-2-1.png` (imageInput-67)

**PROMPT (prompt-77):**
```
Highly realistic image, perfectly match the facial features skin, car details and framing of the original image. Remove any outlines or boders, only create the actual image.
```

### Refinement Chain 5: High-Angle Portrait

**Node:** `nanoBanana-78`

**Input:** `split-2-2.png` (imageInput-68) + output from `nanoBanana-70`

**PROMPT (prompt-79):**
```
Highly realistic portrait image of a man looking upwards with glasses lowered, perfectly match the facial features skin, and framing of the original image. Remove any outlines or boders, only create the actual image.

The man is resting on the hood of a black mk4 supra.
```

### Detail Frame Enhancement

**Node:** `nanoBanana-80`

**PROMPT (prompt-81):**
```
tight shot of the supreme logo on the red longsleeve top.
```

---

## Stage 4: Narrative Expansion

This stage creates additional storytelling shots beyond the basic contact sheet.

### Driver Seat Shot

**Node:** `nanoBanana-82`

**Input:** Output from `nanoBanana-76` + output from `nanoBanana-70`

**PROMPT (prompt-83):**
```
Show me an image of the man sitting in the drivers seat of the car with legs hanging out, he has a relaxed posture and an bored expression as he looks directly into the camera.

Maintain the exact visual style, where the image is shot on fuji velvia film with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily), and there are harsh white reflections on the skin and gold chain.

The image is shot on a wide lens, with visible lens distortion and showing the details of the vehicle and cycolorama environment.

Perfectly match the facial features of the model.

The positioning of the car should be exactly the same as the reference images, but the position of the camera should move to the new angle and focus.

The camera flash and hints of a photographer are visible in the wing mirror of the open door.
```

### Wing Mirror Reflection Shot

**Node:** `nanoBanana-84`

**Input:** Output from `nanoBanana-82` + photographer reference (imageInput-86)

**PROMPT (prompt-88):**
```
Show me a zoomed in shot of the wing mirror of the car in the reference image. It shows the camera man, the balding man in the reference image. he is wearing an oversized black hoodie and is taking the photo on a large classic camera with a hard flash.

It should be a zoomed in shot of the original image, matching the details of the car perfectly.

The shot is candid, showing the balding man in the act of capturing the original image from outside the car. The man is directing the camera at an off angle to the mirror, and there is visible grain and overexposure due to it being a zoom in of the original image.

The reflection in the mirror shows the photographer is taking the image standing in the open. Critical: the photographer is standing outside the car while taking the image.

Maintain the exact visual style, where the image is shot on fuji velvia film with a hard flash. The image is shot on a fish eye lens with visible vignetting.  The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily), and there are harsh white reflections on the skin.

3:2 aspect ratio
```

### Photographer Full-Body Shot

**Node:** `nanoBanana-89`

**Input:** Output from `nanoBanana-84` + photographer reference (imageInput-91)

**PROMPT (prompt-90):**
```
Show me a high fashion photoshoot image of the blading man taking the photograph wearing an oversized long black hoodie and baggy wide leg cotton pants, the image should show the a full body shot of the subject. The model is looking past the camera slightly bored expression and eyebrows raised. They are holding the camera from the original image by their side, in a relaxed posture.

The image is from a low angle looking up at the subject. The setting is the same cyclorama studio as the reference image with the car.

Perfectly match the facial features, bone structure, and complexion of the model. Render the skin with hyper-realistic detail, capturing deep pores, fine wrinkles, and authentic age-related texture.

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily), and there are harsh white reflections the skin.
```

---

## Stage 5: Vehicle-Only Contact Sheet

A parallel pipeline focusing solely on the car without the human model.

### Vehicle Profile Shot

**Node:** `nanoBanana-93`

**Input:** Car reference image (imageInput-92)

**PROMPT (prompt-94):**
```
Show me a profile shot of the black mk4 Supra without the model. The large overhead softbox light illuminates the car's side, highlighting its body lines, custom wheels, and large rear wing. The model is not present.

Perfectly match the details of the car and setting from the original image.
```

### Vehicle 6-Frame Contact Sheet

**Node:** `nanoBanana-95`

**Input:** Output from `nanoBanana-93`

**PROMPT (prompt-96):**
```
Analyze the input image and silently inventory all automotive-critical details: the specific vehicle make, model, and year (Mk4 Supra), paint color and condition (black, highly reflective metallic), custom modifications (wheels, wing, exhaust, stance), tire tread design, interior visibility through glass, engineering details, environment, set geometry (massive overhead softbox, dark cyclorama), light direction, and reflection quality.

All vehicle details, styling, modifications, lighting, environment, and color grade must remain 100% unchanged across all frames. There must be NO human model present in any frame. Do not reinterpret materials or colors. Do not output any reasoning.

Your visible output must be:

One 2×3 contact sheet image (6 frames).

Then a keyframe breakdown for each frame.

Each frame must represent a resting point after a dramatic camera move — only describe the final camera position and which aspect of the vehicle is being highlighted, never the motion itself.

The six frames must be spatially dynamic, non-linear, and visually distinct, avoiding any progression such as wide → mid → close.

Required 6-Frame Automotive Shot List (All Resting Frames)

1. Low-Angle Front "Hero" Stance (Aggressive, Wide Lens) Camera positioned very low to the studio floor at the front three-quarter view, using a wide-angle lens. This perspective exaggerates the front bumper, headlights, and wide stance of the car, making it appear dominant and aggressive. The massive overhead softbox creates long, sleek highlight lines across the hood and roof.

2. High-Angle Rear Quarter Abstract (Geometric, Sculptural) Camera positioned high overhead, looking down sharply at the rear quarter and wing area. This frame emphasizes the complex geometry of the Supra's "hips," the curve of the rear windshield, and the imposing structure of the rear wing against the dark studio floor.

3. Ultra-Low "Worm's Eye" Profile (Speed, Texture) Camera placed practically on the ground, looking along the side profile of the car from just behind the front wheel towards the rear. The front wheel and tire dominate the immediate foreground, showing tire sidewall details and brake hardware, while the rest of the car body stretches away into the distance, emphasizing length and low ride height.

4. Wide Environmental Studio Frame (Scale, Production Value) Camera positioned very wide and far back, capturing the entire vehicle small within the vastness of the high-budget studio. This shot must include the massive overhead diffusion bank hanging above the car, showing the scale of the lighting setup against the seamless dark cyclorama infinity background.

5. The "Driver's Line" Abstract (Curvature, Reflection) Camera positioned near the base of the windshield (cowl area), looking forward down the length of the long hood and front fender curve. This is a non-traditional angle that focuses on the landscape of the car's bodywork and the precise reflection of the overhead light source on the black paint.

6. Macro Engineering Detail (Texture, Precision) Extreme close-up macro shot focusing on a specific, intricate detail—such as the internal elements of the headlight projector, the texture of the carbon fiber on the wing, or the lug nuts and center cap of the wheel. The focus must be razor-sharp on the metallic and glass textures.

Continuity & Technical Requirements

Maintain perfect vehicle fidelity in every frame: exact paint finish, modifications, wheels, tires, and cleanliness.

Environment, textures, and massive overhead lighting source must remain consistent.

Depth of field shifts naturally with focal length (deep for wide/environmental shots, very shallow for macro/detail shots).

Photoreal textures and physically plausible light behavior (especially metallic paint reflections and glass refractions) required.

Frames must feel like different high-end camera placements within the same shoot.

All keyframes must be the exact same aspect ratio, and exactly 6 keyframes should be output. Maintain the exact visual style in all keyframes: shot on Fuji Velvia film with a hard light source creating high contrast, overexposed highlights showing significant film grain, and oversaturated colors. The black paint should look deep and wet, with harsh white reflections from the light source.

Output Format A) 2×3 Contact Sheet Image,
```

---

## Stage 6: Upscaling Pipeline

Each final frame goes through an upscaling pass for maximum quality.

### Upscaling Prompt Template

**Used by:** `prompt-104`, `prompt-106`, `prompt-108`, `prompt-110`, `prompt-112`, `prompt-114`

```
Upscale this image, keep all details exactly the same.
```

**Configuration for upscaling nodes:**
```json
{
  "aspectRatio": "3:2",
  "resolution": "1K",
  "model": "nano-banana-pro",
  "useGoogleSearch": false
}
```

---

## Stage 7: Typography Overlay

Final compositing stage adding branded text overlays.

### "NODE" Text Overlay

**Node:** `nanoBanana-117`

**Input:** Reference image + text style reference

**PROMPT (prompt-118):**
```
Put the text 'NODE' behind the model and the car in very large type. The text is full width and masked by the car and model. 3:2 aspect ratio. Match the font exactly and keep all other aspects of the image exactly the same
```

### "BANANA" Text Overlay

**Node:** `nanoBanana-136`

**PROMPT (prompt-138):**
```
Put the text 'BANANA' on the floor along the opposite side of the car in very large type. The text is slightly masked by the car. Match the font exactly and keep all other aspects of the image exactly the same.
```

### "SUPRA" Text Overlay

**Node:** `nanoBanana-149`

**PROMPT (prompt-148):**
```
Put the text 'SUPRA' behind the model and the car in very large type. The text is full width and masked by the car and model. 3:2 aspect ratio. Match the font exactly and keep all other aspects of the image exactly the same
```

### Vehicle-Only Text Overlays

**PROMPT (prompt-123, prompt-128, prompt-129):**
```
Put the text behind the car in very large type. The text is full width and masked by the car. 3:2 aspect ratio
```

```
Put the text on the floor alongside the car in very large type. It should align with the far side of the car and is slightly masked by the car. Keep all other details in the image exactly the same.
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
| **Reflections** | Harsh white reflections on metal/glass |
| **Aspect Ratio** | 3:2 |
| **Vignetting** | Light fades toward edges |

### Lighting Setup

- **Key Light:** Massive overhead softbox/diffusion bank
- **Environment:** Dark studio cyclorama (seamless background)
- **Light Quality:** Hard flash with concentrated light on subject
- **Shadows:** Dramatic and controlled

### Technical Camera Settings to Emulate

| Shot Type | Focal Length | Angle |
|-----------|--------------|-------|
| Hero/Wide | 18mm prime | Low angle, dutch angle |
| Portrait | 55mm prime | Eye level or slight offset |
| Detail | Macro/close | Variable |
| Environmental | Wide | High or low dramatic angles |

---

## Agent Implementation Notes

### Pipeline Automation Requirements

1. **Image Generation API Integration**
   - Model: `nano-banana-pro` (or Gemini equivalent)
   - Resolutions: 2K for hero shots, 1K for refinements
   - Aspect Ratio: Maintain 3:2 throughout

2. **Contact Sheet Splitting**
   - Implement automatic 2×3 grid detection and splitting
   - Output naming convention: `split-{row}-{col}.png`
   - Preserve aspect ratio of individual frames

3. **Reference Image Management**
   - Store and index reference images by purpose (face, outfit, vehicle, etc.)
   - Support multiple reference images per generation call

4. **Prompt Template System**
   - Parameterize prompts for:
     - Subject description (model details)
     - Wardrobe items
     - Vehicle details
     - Camera angles/positions
     - Visual style settings
   - Maintain style consistency block as a reusable component

5. **Chain Execution Logic**
   - Track dependencies between generation steps
   - Support parallel execution where possible
   - Implement retry logic for failed generations

### Suggested Agent Architecture

```python
class ContactSheetAgent:
    def __init__(self):
        self.reference_images = {}
        self.style_guide = VISUAL_STYLE_PARAMS
        self.generated_outputs = {}

    async def run_pipeline(self, config):
        # Stage 1: Hero generation
        hero = await self.generate_hero(config.references, config.hero_prompt)

        # Stage 2: Contact sheet
        contact_sheet = await self.generate_contact_sheet(hero)

        # Stage 3: Split and refine
        frames = await self.split_contact_sheet(contact_sheet)
        refined_frames = await self.refine_frames_parallel(frames)

        # Stage 4: Narrative expansion
        narrative_shots = await self.generate_narrative_shots(refined_frames)

        # Stage 5: Vehicle-only (parallel with stage 4)
        vehicle_shots = await self.generate_vehicle_contact_sheet()

        # Stage 6: Upscale all
        upscaled = await self.upscale_all(refined_frames + narrative_shots)

        # Stage 7: Typography
        final_compositions = await self.add_typography(upscaled)

        return final_compositions
```

### Video Production Considerations

For converting the final images to video:

1. **Frame Ordering:** Arrange frames in a visually dynamic sequence
2. **Transitions:** Ken Burns effect (pan/zoom) on static images
3. **Timing:** 2-4 seconds per frame for fashion/automotive content
4. **Audio:** Consider adding ambient studio sounds or music
5. **Color Grading:** Apply final LUT to match the Fuji Velvia aesthetic

### Prompt Engineering Tips

1. **Consistency Anchors:** Always include the style block at the end of prompts
2. **Reference Instructions:** Explicitly state "Perfectly match the facial features" when face consistency is critical
3. **Negative Instructions:** Use "Do not add or remove anything" to prevent hallucination
4. **Output Format:** Specify exact deliverables (e.g., "2×3 contact sheet")
5. **Technical Accuracy:** Include camera/lens specifications for realistic rendering

---

## Appendix: Complete Node Dependency Graph

```
imageInput-56 (supra) ──────┐
imageInput-57 (bill) ───────┤
imageInput-60 (outfit) ─────┼──► nanoBanana-4 ──► nanoBanana-6 ──► [SPLIT]
imageInput-61 (outfit2) ────┤                          │
imageInput-62 (sneakers) ───┘                          │
prompt-5 ───────────────────┘                          │
prompt-7 ──────────────────────────────────────────────┘

[SPLIT] → split-1-1 → nanoBanana-72 → nanoBanana-74
        → split-1-2 → nanoBanana-70 → nanoBanana-78 → nanoBanana-80
        → split-1-3 → nanoBanana-74
        → split-2-1 → nanoBanana-76 → nanoBanana-82 → nanoBanana-84 → nanoBanana-89
        → split-2-2 → nanoBanana-78

nanoBanana-82 + imageInput-86 → nanoBanana-84
nanoBanana-84 + imageInput-91 → nanoBanana-89

imageInput-92 → nanoBanana-93 → nanoBanana-95 → [VEHICLE SPLIT]

[UPSCALING CHAIN]
split frames → nanoBanana-103/105/107/109/111/113

[TYPOGRAPHY CHAIN]
final images + text refs → nanoBanana-117/120/121/122/136/149
```

---

*Document Version: 1.0*
*Generated from: `examples/contact-sheet-billsSupra.json`*
