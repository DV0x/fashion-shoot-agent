# Camera Fundamentals for Editorial Fashion Photography

## Camera Positions

### Height Positions

| Position | Description | Effect | Use Case |
|----------|-------------|--------|----------|
| **Eye Level** | Camera at subject's eye height | Neutral, relatable | Standard portraits |
| **High Angle** | Camera above subject, looking down | Diminishes subject, shows environment | Overhead shots, shape abstraction |
| **Low Angle** | Camera below subject, looking up | Empowers subject, elongates silhouette | Hero shots, dramatic impact |
| **Worm's Eye** | Camera at ground level | Extreme drama, emphasizes footwear | Full-body power shots |
| **Bird's Eye** | Camera directly overhead | Abstract, pattern-focused | Environmental, geometric |

### Lateral Positions

| Position | Description | Effect |
|----------|-------------|--------|
| **Frontal** | Camera directly facing subject | Confrontational, intimate |
| **Three-Quarter** | Camera at 45° to subject | Dimensional, flattering |
| **Profile** | Camera at 90° to subject | Silhouette, editorial |
| **Rear Three-Quarter** | Camera behind at 45° | Mysterious, shape-focused |

## Angle Types

### The Tim Workflow 6-Angle System

1. **Beauty Portrait (Close, Editorial)**
   - Very close to face
   - Slightly above or below eye level
   - Elegant offset angle
   - Shallow depth of field
   - Highlights bone structure and neckline details

2. **High-Angle Three-Quarter**
   - Overhead but off-center
   - Diagonal downward angle
   - Creates shape abstraction
   - Reveals wardrobe from above

3. **Low-Angle Oblique Full-Body**
   - Low to ground, angled obliquely
   - Elongates silhouette
   - Emphasizes footwear
   - Dramatic perspective

4. **Side-On Compression (Long Lens)**
   - Far to one side
   - Tighter focal length
   - Clean profile or near-profile
   - Flattened, editorial look
   - Showcases garment structure

5. **Intimate Close from Unexpected Height**
   - Very close to face/upper torso
   - Slightly above or below eye level
   - Fashion-editorial feel
   - Offset, elegant, expressive

6. **Extreme Detail from Non-Intuitive Angle**
   - Extremely close to detail
   - Unusual spatial direction (below, behind, side)
   - Abstract, striking
   - Editorial detail frame

## Lens Choices

### Focal Length Effects

| Focal Length | Compression | Distortion | Best For |
|--------------|-------------|------------|----------|
| **Wide (24-35mm)** | Low (exaggerates depth) | Barrel distortion at edges | Environmental, drama |
| **Standard (50mm)** | Natural | Minimal | General purpose |
| **Short Tele (85mm)** | Moderate | Flattering for faces | Portraits |
| **Long Tele (135mm+)** | High (flattens space) | None | Compression shots, profiles |

### Fashion Photography Lens Selection

- **55mm prime** - Tim workflow standard, natural perspective with slight compression
- **Wide angle** - Environmental shots, studio scale, footwear emphasis
- **Telephoto** - Side-on compression frames, profile shots

## Composition Rules

### Rule of Thirds
Divide frame into 3×3 grid. Place key elements on intersection points.

### Leading Lines
Use environment geometry to draw eye to subject.

### Negative Space
Empty space creates editorial feel and emphasizes subject.

### Frame Within Frame
Use environmental elements to create natural framing.

### Breaking Rules
Editorial fashion often breaks conventions intentionally for impact.

## Depth of Field Guidelines

| Shot Type | Aperture | DoF | Effect |
|-----------|----------|-----|--------|
| Beauty close-up | f/1.4-2.8 | Very shallow | Subject isolation |
| Three-quarter | f/2.8-4 | Shallow | Subject focus, soft background |
| Full-body | f/4-5.6 | Moderate | Sharp subject, controlled blur |
| Environmental | f/8-11 | Deep | Context visibility |
| Detail macro | f/2.8 | Razor thin | Texture emphasis |

## Camera Movement Concepts (for i2v)

When describing camera movements for video generation:

### Do
- Describe the **final resting position** only
- Emphasize **smooth, deliberate** motion
- Keep subject **relatively still**
- Use terms: "pushes in", "pulls out", "tracks", "booms"

### Don't
- Describe the motion path in detail
- Request fast or jerky movements
- Ask for significant subject movement
- Mix multiple movement types

### Example i2v Prompts
```
"Camera smoothly and slowly pushes in on a boom.
The model stays in the same position, only [small action].
Movements are extremely deliberate and precise."

"Camera smoothly and slowly pulls out to reveal [element].
The model is totally motionless.
Face is perfectly consistent."
```

## Continuity Requirements

For contact sheet generation, all frames must maintain:

- Identical wardrobe (exact garment, material, color, texture)
- Consistent styling (hair, makeup, accessories)
- Same lighting setup (direction, quality, color temperature)
- Matching environment (background, set geometry)
- Unified color grade (film stock simulation)

Frames should feel like **different camera placements within the same scene**, not different scenes.
