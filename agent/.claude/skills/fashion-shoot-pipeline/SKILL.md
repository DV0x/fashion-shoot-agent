---
name: fashion-shoot-pipeline
description: Execute fashion photoshoot generation pipeline. Use when generating hero images, contact sheets, frame isolations, videos, or stitching final outputs via FAL.ai and FFmpeg.
---

# Fashion Shoot Pipeline Skill

This skill provides tools to execute the fashion photoshoot generation pipeline.

## When to Use

- Generating hero images from reference photos
- Creating contact sheets (2x3 grid of keyframes)
- Isolating individual frames from contact sheets
- Generating videos from keyframes
- Stitching videos with easing transitions

## Pipeline Stages

1. **Reference Analysis** - Analyze input images (multimodal)
2. **Hero Image** - Generate full-body hero shot
3. **Contact Sheet** - Generate 2x3 grid with 6 angles
4. **Frame Isolation** - Extract and enhance each frame
5. **Video Generation** - Create camera movement videos
6. **Video Stitching** - Combine into final output

## Available Scripts (`scripts/`)

### generate-image.ts
Generate images via FAL.ai nano-banana-pro API.

```bash
npx tsx scripts/generate-image.ts \
  --prompt "..." \
  --input ref1.jpg --input ref2.jpg \
  --output hero.png \
  --resolution 2K
```

### generate-video.ts
Generate videos via FAL.ai Kling 2.6 image-to-video API.

```bash
npx tsx scripts/generate-video.ts \
  --input frame-1.png \
  --prompt "Camera slowly pushes in..." \
  --output video-1.mp4
```

### stitch-videos.ts
Stitch videos with FFmpeg and cubic easing transitions.

```bash
npx tsx scripts/stitch-videos.ts \
  --clips video-1.mp4 video-2.mp4 ... video-6.mp4 \
  --output final-output.mp4 \
  --transition fade \
  --easing cubic
```

## File Conventions

```
sessions/{session-id}/
├── inputs/           # Reference images
└── outputs/          # Generated assets
    ├── hero.png
    ├── contact-sheet.png
    ├── frames/       # Isolated frames (frame-1.png ... frame-6.png)
    ├── videos/       # Individual clips (video-1.mp4 ... video-6.mp4)
    └── final/        # Stitched output
```

## Progress Tracking

When executing the pipeline, track progress through each stage:

- [ ] Reference images analyzed
- [ ] Hero image generated
- [ ] Contact sheet generated
- [ ] Frames isolated (6/6)
- [ ] Videos generated (6/6)
- [ ] Final video stitched
