# Injection Blocks for Fashion Prompts

Reusable prompt fragments for fashion image generation. Copy and adapt these blocks when assembling prompts.

---

## ANALYSIS_BLOCK

Use at the start of generation prompts to ensure the model inventories input details.

```
Analyze the input image and silently inventory all fashion-critical details: the subject(s), exact wardrobe pieces, materials, colors, textures, accessories, hair, makeup, body proportions, environment, set geometry, light direction, and shadow quality.
```

**When to use:**
- Hero image generation (analyzing reference images)
- Contact sheet generation (analyzing hero image)
- Any prompt where preserving input details is critical

---

## CONTINUITY_BLOCK

Use to enforce strict consistency across multiple frames or outputs.

```
All wardrobe, styling, hair, makeup, lighting, environment, and color grade must remain 100% unchanged across all frames.
Do not add or remove anything.
Do not reinterpret materials or colors.
Do not output any reasoning.
```

**When to use:**
- Contact sheet generation
- Frame isolation
- Any multi-frame output
- Sequential narrative expansions

---

## CONTACT_SHEET_FORMAT

Specifies the 2×3 grid output format for contact sheets.

```
Your visible output must be:
One 2×3 contact sheet image (6 frames).

Each frame must represent a resting point after a dramatic camera move — only describe the final camera position and what the subject is doing, never the motion itself.

The six frames must be spatially dynamic, non-linear, and visually distinct, avoiding any progression such as wide → mid → close.
```

**When to use:**
- Contact sheet generation only
- Place after ANALYSIS_BLOCK and CONTINUITY_BLOCK

---

## 6-FRAME SHOT LIST

The standard Tim workflow camera positions. Adapt descriptions to your specific subject/wardrobe.

```
Required 6-Frame Shot List (All Resting Frames)

1. High-Fashion Beauty Portrait (Close, Editorial, Intimate)
Camera positioned very close to the subject's face, slightly above or slightly below eye level, using an elegant offset angle that enhances bone structure and highlights key wardrobe elements near the neckline. Shallow depth of field, flawless texture rendering, and a sculptural fashion-forward composition.

2. High-Angle Three-Quarter Frame
Camera positioned overhead but off-center, capturing the subject from a diagonal downward angle. This frame should create strong shape abstraction and reveal wardrobe details from above.

3. Low-Angle Oblique Full-Body Frame
Camera positioned low to the ground and angled obliquely toward the subject. This elongates the silhouette, emphasizes footwear, and creates a dramatic perspective distinct from Frames 1 and 2.

4. Side-On Compression Frame (Long Lens)
Camera placed far to one side of the subject, using a tighter focal length to compress space. The subject appears in clean profile or near-profile, showcasing garment structure in a flattened, editorial manner.

5. Intimate Close Portrait From an Unexpected Height
Camera positioned very close to the subject's face (or upper torso) but slightly above or below eye level. The angle should feel fashion-editorial, not conventional — offset, elegant, and expressive.

6. Extreme Detail Frame From a Non-Intuitive Angle
Camera positioned extremely close to a wardrobe detail, accessory, or texture, but from an unusual spatial direction (e.g., from below, from behind, from the side of a neckline). This must be a striking, abstract, editorial detail frame.
```

---

## TECHNICAL_REQUIREMENTS

Continuity and quality requirements for contact sheets.

```
Continuity & Technical Requirements

Maintain perfect wardrobe fidelity in every frame: exact garment type, silhouette, material, color, texture, stitching, accessories, closures, jewelry, shoes, hair, and makeup.

Environment, textures, and lighting must remain consistent.

Depth of field shifts naturally with focal length (deep for distant shots, shallow for close/detail shots).

Photoreal textures and physically plausible light behavior required.

Frames must feel like different camera placements within the same scene, not different scenes.

All keyframes must be the exact same aspect ratio, and exactly 6 keyframes should be output.
```

---

## FRAME_ISOLATION_TEMPLATE

Template for isolating individual frames from a contact sheet.

```
Isolate and amplify the key frame in row {ROW} column {COLUMN}. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

**Grid reference:**
| Position | Row | Column |
|----------|-----|--------|
| Frame 1 (Beauty) | 1 | 1 |
| Frame 2 (High-Angle) | 1 | 2 |
| Frame 3 (Low-Angle) | 1 | 3 |
| Frame 4 (Side-On) | 2 | 1 |
| Frame 5 (Intimate) | 2 | 2 |
| Frame 6 (Detail) | 2 | 3 |

---

## OUTPUT_FORMAT_BLOCK

Standard output specification.

```
Output Format
A) 2×3 Contact Sheet Image (Mandatory)

Include all 6 frames, each labeled with:
- Frame number
- Shot type
```

---

## Assembly Example: Full Contact Sheet Prompt

```
[ANALYSIS_BLOCK]

[CONTINUITY_BLOCK]

[CONTACT_SHEET_FORMAT]

[6-FRAME SHOT LIST]

[TECHNICAL_REQUIREMENTS]

[STYLE_BLOCK - see style-fuji-velvia.md]

[OUTPUT_FORMAT_BLOCK]
```
