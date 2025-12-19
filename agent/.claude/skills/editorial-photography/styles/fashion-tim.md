# Fashion Tim Workflow - 6-Shot Pattern

## Overview

The "Tim" workflow is a 6-frame contact sheet pattern for high-fashion editorial photography. It defines camera positions and angles that create spatially dynamic, non-linear sequences suitable for video production.

**Key characteristics:**
- Single model focus
- Studio environment
- 6 distinct camera angles in 2×3 grid
- Designed for frame isolation and video conversion

## The 6-Shot Pattern

Each contact sheet contains exactly 6 frames arranged in a 2×3 grid:

```
┌───────────┬───────────┬───────────┐
│  Frame 1  │  Frame 2  │  Frame 3  │
│  R1 C1    │  R1 C2    │  R1 C3    │
│  Beauty   │ High-Angle│ Low-Angle │
│  Portrait │ 3-Quarter │ Full-Body │
├───────────┼───────────┼───────────┤
│  Frame 4  │  Frame 5  │  Frame 6  │
│  R2 C1    │  R2 C2    │  R2 C3    │
│  Side-On  │ Intimate  │ Extreme   │
│  Profile  │ Close     │ Detail    │
└───────────┴───────────┴───────────┘
```

### Frame 1: High-Fashion Beauty Portrait
- **Position:** Very close to face, slightly above or below eye level
- **Angle:** Elegant offset angle enhancing bone structure
- **Focus:** Neckline wardrobe elements, accessories
- **DoF:** Shallow
- **Character:** Editorial, intimate, sculptural

### Frame 2: High-Angle Three-Quarter
- **Position:** Overhead but off-center
- **Angle:** Diagonal downward
- **Focus:** Shape abstraction, wardrobe from above
- **DoF:** Moderate
- **Character:** Geometric, fashion-forward

### Frame 3: Low-Angle Oblique Full-Body
- **Position:** Low to ground, angled obliquely
- **Angle:** Looking up at subject
- **Focus:** Silhouette elongation, footwear emphasis
- **DoF:** Deep
- **Character:** Dramatic, powerful

### Frame 4: Side-On Compression (Long Lens)
- **Position:** Far to one side
- **Angle:** Clean profile or near-profile
- **Focus:** Garment structure, flattened editorial look
- **DoF:** Compressed (telephoto effect)
- **Character:** Editorial, sculptural

### Frame 5: Intimate Close from Unexpected Height
- **Position:** Very close to face/upper torso
- **Angle:** Slightly above or below eye level (non-conventional)
- **Focus:** Expression, upper wardrobe details
- **DoF:** Very shallow
- **Character:** Elegant, expressive, fashion-editorial

### Frame 6: Extreme Detail from Non-Intuitive Angle
- **Position:** Extremely close to detail
- **Angle:** Unusual direction (below, behind, side)
- **Focus:** Texture, accessory, fabric detail
- **DoF:** Razor thin
- **Character:** Abstract, striking, editorial

## Pipeline Stages

### Stage 1: Hero Image
- **Input:** User-provided reference images (model, wardrobe, accessories)
- **Output:** Full-body hero shot establishing the look
- **Resolution:** 2K
- **Aspect:** 3:2

### Stage 2: Contact Sheet
- **Input:** Hero image from Stage 1
- **Output:** 2×3 grid with 6 camera angles
- **Resolution:** 2K
- **Aspect:** 3:2

### Stage 3: Frame Isolation
- **Input:** Contact sheet from Stage 2
- **Output:** 6 individual enhanced frames
- **Resolution:** 1K each
- **Technique:** Prompt-based isolation (not cropping)

### Stage 4: Video Generation
- **Input:** Isolated frames
- **Output:** 6 video clips with camera movement
- **Duration:** ~5 seconds each

### Stage 5: Video Stitching
- **Input:** 6 video clips
- **Output:** Final stitched video with transitions
- **Transitions:** Cubic easing

## Frame Isolation Technique

The workflow uses **prompt-based isolation** rather than image cropping:

```
Isolate and amplify the key frame in row [R] column [C].
Keep all details of the image in this keyframe exactly the same,
do not change the pose or any details of the model.
```

This approach:
- Preserves full resolution
- Allows AI enhancement during extraction
- Maintains style consistency
- Works with any 2×3 contact sheet

## Key Principles

### 1. Spatial Dynamism
Frames must be **non-linear** - avoid predictable progressions like wide→mid→close. Jump between angles unpredictably.

### 2. Resting Frames
Each frame represents the **end position** after a dramatic camera move. Describe where the camera ends up, not the motion path.

### 3. Perfect Continuity
Between all 6 frames, maintain identical:
- Wardrobe (every garment, accessory, detail)
- Styling (hair, makeup)
- Lighting (direction, quality, color)
- Environment (background, set)
- Color grade (film treatment)

### 4. Same Scene, Different Cameras
Frames must feel like **repositioned cameras within one scene**, not six different scenes or shoots.

### 5. Style Consistency
Apply the same visual treatment (e.g., Fuji Velvia) uniformly across all frames.

## Adapting the Pattern

The 6-shot pattern is flexible. You can adapt individual frames while keeping the overall structure:

| Frame | Default | Alternatives |
|-------|---------|--------------|
| 1 | Beauty portrait | Product focus, hands detail |
| 2 | High-angle | Directly overhead, geometric |
| 3 | Low-angle full | Worm's eye, extreme low |
| 4 | Side profile | Rear three-quarter |
| 5 | Intimate close | Over-shoulder, from behind |
| 6 | Detail | Macro texture, accessory focus |

The key is maintaining **spatial variety** and **non-linear progression**.
