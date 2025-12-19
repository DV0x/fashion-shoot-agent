# Fashion Shoot Agent - Implementation Plan

## Overview

Build an AI-powered fashion photoshoot generation agent using the Claude Agent SDK. The agent takes reference images and a simple prompt, then orchestrates a multi-stage pipeline to generate editorial photography and video content.

**Workflow Base:** Tim Contact Sheet (29 nodes, single model focus)

---

## Architecture Summary

### Input
- Reference images (3+): model, outfit, accessories
- One-line prompt: "Streetwear editorial, confident energy"

### Output
- Hero image, contact sheet, 6 isolated frames
- 6 video clips, final stitched video

### Tech Stack
- **Runtime:** Node.js + TypeScript
- **Agent SDK:** @anthropic-ai/claude-agent-sdk
- **Image Generation:** FAL.ai (nano-banana-pro)
- **Video Generation:** FAL.ai (Kling 2.6)
- **Video Stitching:** FFmpeg (fluent-ffmpeg)
- **Architecture:** Agent Skills (no MCP)

---

## Implementation Phases

### Phase 1: Project Setup & Skill Structure

**Step 1.1: Create skill directories**
```
agent/.claude/skills/
├── editorial-photography/
│   ├── SKILL.md
│   ├── core/
│   ├── styles/
│   └── templates/
└── fashion-shoot-pipeline/
    ├── SKILL.md
    └── scripts/
```

**Step 1.2: Install dependencies**
```bash
npm install fluent-ffmpeg @types/fluent-ffmpeg
```

**Step 1.3: Update SDK configuration**
- Ensure `settingSources: ["project"]` in ai-client.ts
- Ensure `allowedTools` includes `"Skill"` and `"Bash"`

---

### Phase 2: Knowledge Skill (editorial-photography)

**Step 2.1: Create SKILL.md**
```yaml
---
name: editorial-photography
description: Professional fashion and editorial photography knowledge.
  Use when planning camera angles, designing shot lists, or crafting
  image generation prompts for fashion photoshoots.
---
```

Content should include:
- When to use this skill
- How to read reference documents on-demand
- Overview of the hybrid prompt system

**Step 2.2: Create core/camera-fundamentals.md**
- Camera positions (high, low, eye-level, worm's eye, bird's eye)
- Angle types (three-quarter, profile, frontal, dutch)
- Lens choices (wide for drama, telephoto for compression, macro for detail)
- Composition rules (rule of thirds, leading lines, negative space)

**Step 2.3: Create core/prompt-assembly.md**
- How to structure prompts using injection blocks
- Creative section guidelines
- When to use each block type

**Step 2.4: Create styles/fashion-tim.md**
- Tim workflow 6-shot list pattern:
  1. Beauty Portrait (close, editorial)
  2. High-Angle Three-Quarter
  3. Low-Angle Full-Body
  4. Side-On Compression (long lens)
  5. Intimate Close from Unexpected Height
  6. Extreme Detail from Non-Intuitive Angle
- Blue studio environment specifics
- Oversized jacket styling notes

**Step 2.5: Create templates/injection-blocks.md**
```markdown
## ANALYSIS_BLOCK
Analyze the input image and silently inventory all fashion-critical
details: the subject(s), exact wardrobe pieces, materials, colors,
textures, accessories, hair, makeup, body proportions, environment,
set geometry, light direction, and shadow quality.

## CONTINUITY_BLOCK
All wardrobe, styling, hair, makeup, lighting, environment, and
color grade must remain 100% unchanged across all frames.
Do not add or remove anything.
Do not reinterpret materials or colors.
Do not output any reasoning.

## CONTACT_SHEET_FORMAT
Your visible output must be:
One 2×3 contact sheet image (6 frames).
Each frame must represent a resting point after a dramatic camera move.
The six frames must be spatially dynamic, non-linear, and visually distinct.
```

**Step 2.6: Create templates/style-fuji-velvia.md**
```markdown
## STYLE_FUJI_VELVIA
The image is shot on Fuji Velvia film with a hard flash, the light
is concentrated on the subject and fades slightly toward the edges
of the frame. The image is overexposed showing significant film grain
and is oversaturated. The skin appears shiny (almost oily), and there
are harsh white reflections on accessories.

3:2 aspect ratio
```

---

### Phase 3: Action Skill (fashion-shoot-pipeline)

**Step 3.1: Create SKILL.md**
```yaml
---
name: fashion-shoot-pipeline
description: Execute fashion photoshoot generation pipeline.
  Use when generating hero images, contact sheets, frame isolations,
  videos, or stitching final outputs via FAL.ai and FFmpeg.
---
```

Content should include:
- Pipeline stages overview
- How to call each script
- File path conventions
- Progress tracking checklist

**Step 3.2: Create scripts/generate-image.ts**

Purpose: Wrapper for FAL.ai nano-banana-pro API

```typescript
// Interface
interface GenerateImageOptions {
  prompt: string;
  inputImages?: string[];      // Paths to reference images
  outputPath: string;
  aspectRatio?: string;        // Default: "3:2"
  resolution?: string;         // "1K" | "2K"
}

// Usage via Bash
// npx tsx scripts/generate-image.ts \
//   --prompt "..." \
//   --input ref1.jpg --input ref2.jpg \
//   --output hero.png \
//   --resolution 2K
```

Implementation:
- Read FAL_KEY from environment
- Upload input images to FAL.ai
- Call nano-banana-pro endpoint
- Download result to outputPath
- Print result path to stdout

**Step 3.3: Create scripts/generate-video.ts**

Purpose: Wrapper for FAL.ai Kling 2.6 image-to-video API

```typescript
// Interface
interface GenerateVideoOptions {
  inputImage: string;          // Path to source frame
  prompt: string;              // Camera movement description
  outputPath: string;
  duration?: number;           // Default: 5 seconds
}

// Usage via Bash
// npx tsx scripts/generate-video.ts \
//   --input frame-1.png \
//   --prompt "Camera slowly pushes in..." \
//   --output video-1.mp4
```

Implementation:
- Read FAL_KEY from environment
- Upload input image
- Call Kling 2.6 endpoint
- Poll for completion (async generation)
- Download result to outputPath

**Step 3.4: Create scripts/stitch-videos.ts**

Purpose: FFmpeg video stitching with cubic easing

```typescript
// Interface
interface StitchOptions {
  clips: string[];             // Array of video paths (ordered)
  outputPath: string;
  transitionDuration?: number; // Default: 0.5
  transitionType?: string;     // Default: "fade"
  easing?: string;             // Default: "cubic"
}

// Usage via Bash
// npx tsx scripts/stitch-videos.ts \
//   --clips video-1.mp4 video-2.mp4 ... video-6.mp4 \
//   --output final-output.mp4 \
//   --transition fade \
//   --easing cubic
```

Implementation:
- Use fluent-ffmpeg
- Build xfade filter chain
- Apply cubic easing to transitions
- Output final video

---

### Phase 4: Orchestrator System Prompt Update

**Step 4.1: Update server/lib/orchestrator-prompt.ts**

The orchestrator prompt should:
- Describe the agent's role as a fashion photoshoot director
- Explain the 6-stage pipeline
- Instruct when to trigger each skill
- Define file path conventions for sessions

Key sections:
```markdown
## Your Role
You are a professional fashion photography director. You analyze
reference images, plan creative shot lists, and orchestrate the
generation pipeline.

## Pipeline Stages
1. Reference Analysis - Analyze input images (multimodal)
2. Hero Image - Generate full-body hero shot
3. Contact Sheet - Generate 2×3 grid with 6 angles
4. Frame Isolation - Extract and enhance each frame
5. Video Generation - Create camera movement videos
6. Video Stitching - Combine into final output

## File Conventions
sessions/{session-id}/
├── inputs/       # Reference images
├── outputs/      # Generated assets
│   ├── hero.png
│   ├── contact-sheet.png
│   ├── frames/
│   ├── videos/
│   └── final/

## Skill Usage
- Use editorial-photography skill when planning shots
- Use fashion-shoot-pipeline skill when generating assets
```

---

### Phase 5: Session Management Integration

**Step 5.1: Update session-manager.ts**

Add methods for:
- Creating session output directories
- Tracking pipeline stage progress
- Storing generated asset paths in metadata

**Step 5.2: Update sdk-server.ts**

Ensure the `/generate` endpoint:
- Creates session directory structure
- Passes input image paths to the agent
- Returns final output paths in response

---

### Phase 6: Testing & Validation

**Step 6.1: Test individual scripts**
```bash
# Test image generation
npx tsx scripts/generate-image.ts --prompt "test" --output test.png

# Test video generation
npx tsx scripts/generate-video.ts --input test.png --prompt "slow zoom" --output test.mp4

# Test video stitching
npx tsx scripts/stitch-videos.ts --clips a.mp4 b.mp4 --output final.mp4
```

**Step 6.2: Test skills in isolation**
- Verify editorial-photography triggers on relevant prompts
- Verify fashion-shoot-pipeline executes scripts correctly

**Step 6.3: End-to-end test**
- Provide reference images + prompt
- Verify full pipeline execution
- Check final video output quality

---

## File Changes Summary

### New Files
```
agent/.claude/skills/editorial-photography/
├── SKILL.md
├── core/
│   ├── camera-fundamentals.md
│   └── prompt-assembly.md
├── styles/
│   └── fashion-tim.md
└── templates/
    ├── injection-blocks.md
    └── style-fuji-velvia.md

agent/.claude/skills/fashion-shoot-pipeline/
├── SKILL.md
└── scripts/
    ├── generate-image.ts
    ├── generate-video.ts
    └── stitch-videos.ts
```

### Modified Files
```
server/lib/orchestrator-prompt.ts  # Update system prompt
server/lib/ai-client.ts            # Ensure skill config
server/lib/session-manager.ts      # Add directory management
server/sdk-server.ts               # Update endpoint handling
package.json                       # Add fluent-ffmpeg dependency
```

---

## Implementation Order

1. **Phase 1** - Project setup, directories, dependencies
2. **Phase 2** - Knowledge skill (editorial-photography)
3. **Phase 3** - Action skill scripts (generate-image.ts first)
4. **Phase 4** - Orchestrator prompt update
5. **Phase 5** - Session management integration
6. **Phase 6** - Testing

---

## Success Criteria

- [ ] Agent analyzes reference images and describes contents
- [ ] Agent generates detailed prompts from one-line input
- [ ] Hero image generates successfully via FAL.ai
- [ ] Contact sheet generates with 6 distinct angles
- [ ] All 6 frames isolate correctly
- [ ] All 6 videos generate with camera movement
- [ ] Final video stitches with smooth cubic easing transitions
- [ ] Full pipeline completes in single agent session
