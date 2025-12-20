# Tim Workflow - Exact Prompt Templates

This file contains **exact prompts** for the Tim workflow. Fill in `{PLACEHOLDERS}` with details extracted from reference image analysis. Do not modify any other part of the prompts.

---

## PHASE 1: REFERENCE ANALYSIS

Before generating any images, analyze the user's reference images and extract these details:

### Required Extractions

```
SUBJECT:      [Age, gender, ethnicity, hair color/style, facial features]
WARDROBE:     [Main garment(s), fit, material, color]
ACCESSORIES:  [Glasses, jewelry, shoes, bags, hats - be specific]
POSE:         [Body position, hand placement, expression, gaze direction]
BACKGROUND:   [Color, environment type]
```

### Example Analysis Output

```
SUBJECT:      "young Asian female model with shoulder-length black hair"
WARDROBE:     "oversized vintage denim jacket, white crop top underneath, high-waisted black leather pants"
ACCESSORIES:  "gold hoop earrings, layered gold necklaces, black platform boots, no glasses"
POSE:         "confident stance with weight on left leg, right hand on hip, direct gaze at camera, slight smirk"
BACKGROUND:   "grey seamless studio backdrop"
```

---

## PHASE 2: HERO IMAGE GENERATION

### HERO_PROMPT Template

Fill in the placeholders, then use this exact prompt:

```
Show me a high fashion photoshoot image of {SUBJECT} wearing {WARDROBE}. {ACCESSORIES_DETAIL}. The image should show a full body shot of the subject. {POSE_DESCRIPTION}. The setting is a studio environment with a {BACKGROUND_COLOR} background.

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```

### Example Filled Hero Prompt

```
Show me a high fashion photoshoot image of a young Asian female model with shoulder-length black hair wearing an oversized vintage denim jacket with a white crop top underneath and high-waisted black leather pants. She has gold hoop earrings and layered gold necklaces, wearing black platform boots. The image should show a full body shot of the subject. She stands with confident stance, weight on left leg, right hand on hip, direct gaze at camera with a slight smirk. The setting is a studio environment with a grey background.

The image is shot on fuji velvia film on a 55mm prime lens with a hard flash, the light is concentrated on the subject and fades slightly toward the edges of the frame. The image is over exposed showing significant film grain and is oversaturated. The skin appears shiny (almost oily).

3:2 aspect ratio
```

### Script Execution

```bash
npx tsx scripts/generate-image.ts \
  --prompt "<HERO_PROMPT>" \
  --input ref1.jpg --input ref2.jpg --input ref3.jpg \
  --output outputs/hero.png \
  --aspect-ratio 3:2 \
  --resolution 2K
```

---

## PHASE 3: CONTACT SHEET GENERATION

### CONTACT_SHEET_PROMPT (Use Exactly - Only Add Style Details If Needed)

This prompt is FIXED. Only modify `{STYLE_DETAILS}` if the subject has specific accessories that need reflection/texture notes (like glasses).

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

### Style Details Placeholder

If subject has glasses:
```
{STYLE_DETAILS} = "The skin appears shiny (almost oily), and there are harsh white reflections on the glasses frames."
```

If no glasses:
```
{STYLE_DETAILS} = "The skin appears shiny (almost oily)."
```

### Script Execution

```bash
npx tsx scripts/generate-image.ts \
  --prompt "<CONTACT_SHEET_PROMPT>" \
  --input outputs/hero.png \
  --output outputs/contact-sheet.png \
  --aspect-ratio 3:2 \
  --resolution 2K
```

---

## PHASE 4: FRAME ISOLATION

### FRAME_ISOLATION_PROMPT Template

Use this exact template for each of the 6 frames:

```
Isolate and amplify the key frame in row {ROW} column {COLUMN}. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

### All 6 Frame Isolation Prompts (Copy-Paste Ready)

**Frame 1 (R1C1 - Beauty Portrait):**
```
Isolate and amplify the key frame in row 1 column 1. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

**Frame 2 (R1C2 - High-Angle Three-Quarter):**
```
Isolate and amplify the key frame in row 1 column 2. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

**Frame 3 (R1C3 - Low-Angle Full-Body):**
```
Isolate and amplify the key frame in row 1 column 3. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

**Frame 4 (R2C1 - Side-On Profile):**
```
Isolate and amplify the key frame in row 2 column 1. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

**Frame 5 (R2C2 - Intimate Close):**
```
Isolate and amplify the key frame in row 2 column 2. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

**Frame 6 (R2C3 - Extreme Detail):**
```
Isolate and amplify the key frame in row 2 column 3. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model.
```

### Script Execution (Run 6 Times)

```bash
# Frame 1
npx tsx scripts/generate-image.ts \
  --prompt "Isolate and amplify the key frame in row 1 column 1. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model." \
  --input outputs/contact-sheet.png \
  --output outputs/frames/frame-1.png \
  --aspect-ratio 3:2 \
  --resolution 1K

# Frame 2
npx tsx scripts/generate-image.ts \
  --prompt "Isolate and amplify the key frame in row 1 column 2. Keep all details of the image in this keyframe exactly the same, do not change the pose or any details of the model." \
  --input outputs/contact-sheet.png \
  --output outputs/frames/frame-2.png \
  --aspect-ratio 3:2 \
  --resolution 1K

# ... repeat for frames 3-6
```

---

## PHASE 5: VIDEO GENERATION

### VIDEO_PROMPTS (Fixed Per Frame Type)

Each frame type has a specific camera movement. Use these exact prompts:

**Frame 1 (Beauty Portrait) - Push In:**
```
Camera pushes in toward the subject's face, maintaining eye contact. Micro-movements in expression. The lighting remains consistent throughout.
```

**Frame 2 (High-Angle) - Orbital:**
```
Camera performs an orbital movement around the subject from the high angle, revealing different aspects of the wardrobe from above. Movement is smooth and elegant.
```

**Frame 3 (Low-Angle Full-Body) - Rise Up:**
```
Camera rises from the low angle, emphasizing the subject's height and presence. The silhouette remains powerful throughout the movement.
```

**Frame 4 (Side-On Profile) - Lateral Track:**
```
Camera performs a lateral tracking movement along the subject's profile, maintaining the compressed telephoto look. Movement is smooth and refined.
```

**Frame 5 (Intimate Close) - Breath Movement:**
```
Extremely subtle movement suggesting the subject's natural breathing. Camera holds nearly still with micro-adjustments. Intimate and personal feeling.
```

**Frame 6 (Extreme Detail) - Macro Drift:**
```
Camera performs a steady drift across the detail, revealing texture and craftsmanship. Movement is precise and refined.
```

### Script Execution (Run 6 Times)

```bash
# Video 1 from Frame 1
npx tsx scripts/generate-video.ts \
  --input outputs/frames/frame-1.png \
  --prompt "Camera pushes in toward the subject's face, maintaining eye contact. Micro-movements in expression. The lighting remains consistent throughout." \
  --output outputs/videos/video-1.mp4 \
  --duration 5

# Video 2 from Frame 2
npx tsx scripts/generate-video.ts \
  --input outputs/frames/frame-2.png \
  --prompt "Camera performs an orbital movement around the subject from the high angle, revealing different aspects of the wardrobe from above. Movement is smooth and elegant." \
  --output outputs/videos/video-2.mp4 \
  --duration 5

# ... repeat for videos 3-6
```

---

## PHASE 6: VIDEO STITCHING

### Stitch Command (Fixed Settings)

```bash
npx tsx scripts/stitch-videos.ts \
  --clips outputs/videos/video-1.mp4 \
  --clips outputs/videos/video-2.mp4 \
  --clips outputs/videos/video-3.mp4 \
  --clips outputs/videos/video-4.mp4 \
  --clips outputs/videos/video-5.mp4 \
  --clips outputs/videos/video-6.mp4 \
  --output outputs/final/fashion-video.mp4 \
  --transition fade \
  --easing smooth \
  --transition-duration 1.2
```

---

## QUICK REFERENCE: Full Pipeline

```
1. ANALYZE references → Extract SUBJECT, WARDROBE, ACCESSORIES, POSE, BACKGROUND
2. HERO → generate-image.ts with filled HERO_PROMPT (2K, 3:2)
3. CONTACT → generate-image.ts with CONTACT_SHEET_PROMPT (2K, 3:2)
4. ISOLATE → generate-image.ts × 6 with FRAME_ISOLATION_PROMPTs (1K, 3:2)
5. VIDEO → generate-video.ts × 6 with VIDEO_PROMPTs (5s each)
6. STITCH → stitch-videos.ts with fade/smooth/1.2s
```

---

## FILE OUTPUT STRUCTURE

```
outputs/
├── hero.png                    # Stage 2 output
├── contact-sheet.png           # Stage 3 output
├── frames/
│   ├── frame-1.png            # Beauty Portrait
│   ├── frame-2.png            # High-Angle
│   ├── frame-3.png            # Low-Angle Full
│   ├── frame-4.png            # Side-On Profile
│   ├── frame-5.png            # Intimate Close
│   └── frame-6.png            # Extreme Detail
├── videos/
│   ├── video-1.mp4            # From frame-1
│   ├── video-2.mp4            # From frame-2
│   ├── video-3.mp4            # From frame-3
│   ├── video-4.mp4            # From frame-4
│   ├── video-5.mp4            # From frame-5
│   └── video-6.mp4            # From frame-6
└── final/
    └── fashion-video.mp4       # Final stitched output
```
