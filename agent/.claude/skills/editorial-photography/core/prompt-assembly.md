# Prompt Assembly for Fashion Image Generation

## Overview

Fashion image generation prompts follow a hybrid structure combining:
1. **Injection Blocks** - Reusable instruction fragments
2. **Creative Section** - Unique scene/shot description
3. **Style Block** - Consistent visual treatment

## Prompt Structure

```
[ANALYSIS_BLOCK]      ← Instruction to analyze input
[CONTINUITY_BLOCK]    ← Consistency requirements
[CREATIVE_SECTION]    ← Unique shot description
[STYLE_BLOCK]         ← Film/visual treatment
[OUTPUT_FORMAT]       ← Aspect ratio, format specs
```

## Block Types

### 1. Analysis Block
**Purpose:** Instructs the model to inventory all details from input images before generating.

**When to use:**
- Hero image generation (analyzing reference images)
- Contact sheet generation (analyzing hero image)

**Effect:** Ensures the model "understands" what to preserve.

### 2. Continuity Block
**Purpose:** Enforces strict consistency across generated frames.

**When to use:**
- Contact sheet generation
- Frame isolation
- Any multi-frame output

**Key constraints:**
- No additions or removals
- No reinterpretation of materials/colors
- No reasoning output (silent execution)

### 3. Creative Section
**Purpose:** Describes the specific shot, angle, and subject action.

**Structure:**
```
[Camera position and angle]
[Subject pose/action]
[Key visual elements to emphasize]
[Composition notes]
```

**Guidelines:**
- Be specific about camera position (height, distance, angle)
- Describe final pose, not motion
- Mention key wardrobe elements to highlight
- Include depth of field intent

### 4. Style Block
**Purpose:** Defines consistent visual treatment across all outputs.

**Components:**
- Film stock simulation
- Lighting characteristics
- Exposure settings
- Texture qualities
- Color grade

### 5. Output Format
**Purpose:** Technical specifications for the output.

**Includes:**
- Aspect ratio (e.g., "3:2")
- Resolution tier (1K, 2K)
- Frame count (for contact sheets)
- Layout (for grids)

## Assembly Patterns

### Pattern A: Hero Image Generation

```
[Creative scene description with all subject/wardrobe details]
[Camera angle and position]
[Lighting setup description]
[STYLE_BLOCK]
[Aspect ratio]
```

**Example flow:**
1. Describe the full scene (model, wardrobe, environment)
2. Specify camera angle (e.g., "low angle looking up")
3. Add style block for film treatment
4. End with aspect ratio

### Pattern B: Contact Sheet Generation

```
[ANALYSIS_BLOCK]
[CONTINUITY_BLOCK]

Your visible output must be:
One 2×3 contact sheet image (6 frames).

[6-FRAME SHOT LIST with detailed descriptions]

[Technical requirements]
[STYLE_BLOCK]

Output Format: 2×3 Contact Sheet Image
```

**Example flow:**
1. Analysis block to inventory input
2. Continuity block for consistency
3. Output specification (2×3 grid)
4. Each frame described with camera position
5. Continuity requirements restated
6. Style block
7. Format specification

### Pattern C: Frame Isolation

```
Isolate and amplify the key frame in row [R] column [C].
Keep all details of the image in this keyframe exactly the same,
do not change the pose or any details of the model.
```

**Key points:**
- Simple, direct instruction
- Explicit row/column reference
- Strong preservation language

### Pattern D: Narrative Expansion

```
[Action/modification description]
[Camera angle for the new shot]
[Any reference image integration notes]
```

**Example flow:**
1. Describe the change (e.g., "Show gold teeth with AAPL letters")
2. Specify new camera angle (e.g., "wide angle close up, dolly zoom")
3. Mention any new reference images to incorporate

## Creative Section Guidelines

### Camera Description Vocabulary

**Height:**
- "very close to face"
- "positioned overhead"
- "low to the ground"
- "at ground level"
- "high above"

**Angle:**
- "off-center"
- "diagonal downward"
- "angled obliquely"
- "clean profile"
- "looking up at"

**Distance:**
- "extremely close"
- "positioned far back"
- "wide environmental"
- "intimate close"

### Subject Description

**Pose:**
- "looking past the camera"
- "one hand raised"
- "totally motionless"
- "tilted head back"

**Expression:**
- "slightly bored expression"
- "eyebrows raised"
- "blank and distant"
- "staring past the lens"

**Action:**
- "tapping the side of glasses"
- "pulling down glasses"
- "lifting jacket"

### Wardrobe Anchors

Always mention:
- Specific garment names
- Materials and textures
- Colors (exact, not approximations)
- Accessories and jewelry
- Footwear when visible

## Common Mistakes to Avoid

1. **Vague positioning** - "camera somewhere nearby" vs "camera positioned very close, slightly above eye level"

2. **Motion in static prompts** - Describe final position, not the movement path

3. **Inconsistent wardrobe** - Changing details between frames

4. **Missing style block** - Forgetting film treatment leads to inconsistent outputs

5. **Overly complex single prompts** - Break complex scenes into stages

6. **Reasoning requests** - Never ask the model to "explain" or "reason" in generation prompts

## Quality Checklist

Before finalizing a prompt:

- [ ] Camera position clearly specified (height, angle, distance)
- [ ] Subject pose/action described (final state, not motion)
- [ ] Key wardrobe elements mentioned
- [ ] Style block included
- [ ] Aspect ratio specified
- [ ] No conflicting instructions
- [ ] Continuity block present (for multi-frame)
- [ ] No "explain" or "reason" language
