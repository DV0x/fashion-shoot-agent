---
name: fashion-shoot-pipeline
description: Execute image and video generation scripts using FAL.ai and FFmpeg. Use AFTER editorial-photography skill. Provides script commands for generate-image, crop-frames, generate-video, and stitch-videos.
---

# Fashion Shoot Pipeline Skill

Execute the generation pipeline using FAL.ai and FFmpeg.

## Prerequisite

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Use Skill tool → `editorial-photography` → Get prompts      │
│  2. Use Skill tool → THIS skill → Execute scripts               │
└─────────────────────────────────────────────────────────────────┘
```

**NEVER write your own prompts.** Get them from `editorial-photography` skill first.

## Pipeline Execution Order

```
1. generate-image.ts (HERO)      → outputs/hero.png
2. generate-image.ts (CONTACT)   → outputs/contact-sheet.png
3. crop-frames.ts                → outputs/frames/frame-{1-6}.png
4. generate-video.ts × 6         → outputs/videos/video-{1-6}.mp4
5. stitch-videos.ts              → outputs/final/fashion-video.mp4
```

## Directory Setup (Run First)

```bash
mkdir -p outputs/frames outputs/videos outputs/final
```

---

## Script: generate-image.ts

Generate images via FAL.ai nano-banana-pro.

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts \
  --prompt "<PROMPT_FROM_EDITORIAL_PHOTOGRAPHY>" \
  --input ref1.jpg --input ref2.jpg \
  --output output.png \
  --aspect-ratio 3:2 \
  --resolution 2K
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--prompt` | Yes | - | Filled prompt from editorial-photography |
| `--input` | No | - | Reference image paths (multiple allowed) |
| `--output` | Yes | - | Output file path |
| `--aspect-ratio` | No | 3:2 | 3:2, 16:9, 1:1, etc. |
| `--resolution` | No | 1K | 1K, 2K, 4K |

**Errors:**
- `FAL_KEY not set` → Add FAL_KEY to .env file
- `Request failed` → Retry once, then report to user

---

## Script: crop-frames.ts

Crop contact sheet into individual frames (LOCAL - no API).

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/crop-frames.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/ \
  --rows 2 \
  --cols 3
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--input` | Yes | - | Contact sheet image path |
| `--output-dir` | Yes | - | Output directory for frames |
| `--rows` | No | 2 | Grid rows |
| `--cols` | No | 3 | Grid columns |
| `--gutter-x` | No | auto | Horizontal gap pixels (auto-detected if not specified) |
| `--gutter-y` | No | auto | Vertical gap pixels (auto-detected if not specified) |

**Output:** `frame-1.png` through `frame-6.png`

**Note:** The script auto-detects gutter sizes using edge detection. Manual values can be provided if needed.

**Errors:**
- `Input not found` → Check contact-sheet.png exists
- `Invalid dimensions` → Try manual gutter values

---

## Script: generate-video.ts

Generate videos via FAL.ai Kling 2.6 Pro.

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts \
  --input outputs/frames/frame-1.png \
  --prompt "<VIDEO_PROMPT_FROM_EDITORIAL_PHOTOGRAPHY>" \
  --output outputs/videos/video-1.mp4 \
  --duration 5
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--input` | Yes | - | Source frame image |
| `--prompt` | Yes | - | Camera movement prompt from editorial-photography |
| `--output` | Yes | - | Output video path |
| `--duration` | No | 5 | 5 or 10 seconds |

**Errors:**
- `FAL_KEY not set` → Add FAL_KEY to .env file
- `Timeout` → Kling takes 2-3 minutes per video, be patient
- `Request failed` → Retry once, then report to user

---

## Script: stitch-videos.ts

Stitch videos with FFmpeg transitions (LOCAL - no API).

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/stitch-videos.ts \
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

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--clips` | Yes | - | Input video files (multiple) |
| `--output` | Yes | - | Output video path |
| `--transition` | No | fade | Transition type |
| `--easing` | No | smooth | Easing curve |
| `--transition-duration` | No | 0.5 | Transition seconds |

**Recommended:** `--transition fade --easing smooth --transition-duration 1.2`

**Errors:**
- `ffmpeg not found` → Install with `brew install ffmpeg`
- `Input file missing` → Check all 6 videos exist

---

## Error Recovery Summary

| Error | Cause | Solution |
|-------|-------|----------|
| FAL_KEY not set | Missing API key | Add to .env file |
| Request failed | API error | Retry once |
| Timeout | Kling slow | Wait 2-3 min per video |
| File not found | Missing output | Check previous step completed |
| ffmpeg not found | Not installed | `brew install ffmpeg` |

---

## Output Structure

```
outputs/
├── hero.png                    # From generate-image (HERO)
├── contact-sheet.png           # From generate-image (CONTACT)
├── frames/
│   ├── frame-1.png            # From crop-frames
│   ├── frame-2.png
│   ├── frame-3.png
│   ├── frame-4.png
│   ├── frame-5.png
│   └── frame-6.png
├── videos/
│   ├── video-1.mp4            # From generate-video
│   ├── video-2.mp4
│   ├── video-3.mp4
│   ├── video-4.mp4
│   ├── video-5.mp4
│   └── video-6.mp4
└── final/
    └── fashion-video.mp4       # From stitch-videos
```
