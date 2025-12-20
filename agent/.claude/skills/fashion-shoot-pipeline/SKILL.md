---
name: fashion-shoot-pipeline
description: Execute the fashion photoshoot generation pipeline scripts. Use after getting prompts from the editorial-photography skill. This skill runs the actual image/video generation and stitching.
---

# Fashion Shoot Pipeline Skill

This skill executes the generation pipeline using FAL.ai and FFmpeg.

## CRITICAL: Use With Editorial-Photography Skill

1. **First:** Use `editorial-photography` skill to get exact prompt templates
2. **Then:** Use this skill to execute the scripts with those prompts

Do NOT write your own prompts. Always get prompts from the templates.

## Available Scripts

### generate-image.ts

Generate images via FAL.ai nano-banana-pro.

```bash
npx tsx scripts/generate-image.ts \
  --prompt "<PROMPT_FROM_TEMPLATE>" \
  --input ref1.jpg --input ref2.jpg \
  --output output.png \
  --aspect-ratio 3:2 \
  --resolution 2K
```

**Options:**
- `--prompt` (required): The generation prompt from templates
- `--input` (optional, multiple): Reference image paths
- `--output` (required): Output file path
- `--aspect-ratio`: 3:2 (default), 16:9, 1:1, etc.
- `--resolution`: 1K, 2K, 4K

### generate-video.ts

Generate videos via FAL.ai Kling 2.6 Pro.

```bash
npx tsx scripts/generate-video.ts \
  --input frame.png \
  --prompt "<VIDEO_PROMPT_FROM_TEMPLATE>" \
  --output video.mp4 \
  --duration 5
```

**Options:**
- `--input` (required): Source image path
- `--prompt` (required): Camera movement prompt from templates
- `--output` (required): Output video path
- `--duration`: 5 (default) or 10 seconds

### stitch-videos.ts

Stitch videos with FFmpeg and eased transitions.

```bash
npx tsx scripts/stitch-videos.ts \
  --clips video-1.mp4 --clips video-2.mp4 ... \
  --output final.mp4 \
  --transition fade \
  --easing smooth \
  --transition-duration 1.2
```

**Recommended settings for fashion:**
- `--transition fade`
- `--easing smooth`
- `--transition-duration 1.2`

## Pipeline Execution Order

```
1. generate-image.ts (HERO)      → outputs/hero.png
2. generate-image.ts (CONTACT)   → outputs/contact-sheet.png
3. generate-image.ts × 6 (ISOLATE) → outputs/frames/frame-{1-6}.png
4. generate-video.ts × 6         → outputs/videos/video-{1-6}.mp4
5. stitch-videos.ts              → outputs/final/fashion-video.mp4
```

## Directory Setup

Before running pipeline, ensure output directories exist:

```bash
mkdir -p outputs/frames outputs/videos outputs/final
```

## Error Handling

- If FAL.ai fails, check `FAL_KEY` environment variable
- If FFmpeg fails, ensure ffmpeg is installed (`brew install ffmpeg`)
- All scripts output to stderr for logs, stdout for result paths
