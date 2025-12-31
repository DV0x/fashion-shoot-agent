# CONTACT_SHEET_PROMPT

Generates a 2×3 contact sheet with 6 different camera angles from the hero image.

## Template

Use this exact prompt. Only modify `{STYLE_DETAILS}` based on glasses presence.

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

All keyframes must be the exact same aspect ratio, and exactly 6 keyframes should be output. Maintain the exact visual style in all keyframes, where the image is shot on fuji velvia film with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. {STYLE_DETAILS}

Output Format
A) 2×3 Contact Sheet Image (Mandatory)

Include all 6 frames, each labeled with:
Frame number
Shot type
```

## Style Details Placeholder

**If subject has glasses:**
```
{STYLE_DETAILS} = "The skin appears shiny (almost oily), and there are harsh white reflections on the glasses frames."
```

**If no glasses:**
```
{STYLE_DETAILS} = "The skin appears shiny (almost oily)."
```

## Frame Grid Reference

```
┌───────────────┬───────────────┬───────────────┐
│  Frame 1      │  Frame 2      │  Frame 3      │
│  R1C1         │  R1C2         │  R1C3         │
│  Beauty       │  High-Angle   │  Low-Angle    │
│  Portrait     │  3/4 Frame    │  Full-Body    │
├───────────────┼───────────────┼───────────────┤
│  Frame 4      │  Frame 5      │  Frame 6      │
│  R2C1         │  R2C2         │  R2C3         │
│  Side-On      │  Intimate     │  Extreme      │
│  Profile      │  Close        │  Detail       │
└───────────────┴───────────────┴───────────────┘
```

## Execution

After filling template, use `fashion-shoot-pipeline` skill:

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts \
  --prompt "<FILLED_CONTACT_SHEET_PROMPT>" \
  --input outputs/hero.png \
  --output outputs/contact-sheet.png \
  --aspect-ratio 3:2 \
  --resolution 2K
```
