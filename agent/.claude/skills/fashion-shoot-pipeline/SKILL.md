---
name: fashion-shoot-pipeline
description: Execute image and video generation scripts using FAL.ai (images) and Kling AI (videos). Use AFTER editorial-photography skill. Provides script commands for generate-image, crop-frames, generate-video, and stitch-videos.
---

# Fashion Shoot Pipeline Skill

Execute the generation pipeline using FAL.ai (images), Kling AI (videos), and FFmpeg (stitching).

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
1. generate-image.ts (HERO)      → outputs/hero.png           [CHECKPOINT]
2. generate-image.ts (CONTACT)   → outputs/contact-sheet.png  [CHECKPOINT]
3. crop-frames.ts                → outputs/frames/frame-{1-6}.png  [CHECKPOINT]
4. resize-frames.ts (OPTIONAL)   → outputs/frames/frame-{1-6}.png (resized)
5. generate-video.ts × 5         → outputs/videos/video-{1-5}.mp4 (frame pairs)
6. stitch-videos-eased.ts        → outputs/final/fashion-video.mp4
```

**Note:** Video generation uses frame PAIRS (5 videos from 6 frames):
- video-1: frame-1 → frame-2
- video-2: frame-2 → frame-3
- video-3: frame-3 → frame-4
- video-4: frame-4 → frame-5
- video-5: frame-5 → frame-6

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

Crop contact sheet into individual frames (LOCAL - no API). Auto-detects grid gutters using variance-based detection.

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/crop-frames.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--input` | Yes | - | Contact sheet image path |
| `--output-dir` | Yes | - | Output directory for frames |
| `--rows` | No | 2 | Grid rows |
| `--cols` | No | 3 | Grid columns |

**Output:** `frame-1.png` through `frame-6.png` (auto-normalized to uniform dimensions)

**Features:**
- Auto-detects gutter sizes using variance-based detection
- Normalizes all frames to identical dimensions
- Works with any gutter color (white, black, gray)
- Zero API calls - pure local processing

**Errors:**
- `Input not found` → Check contact-sheet.png exists
- `Gutter detection failed` → **Use fallback script below**

### Fallback: crop-frames-ffmpeg.ts

**If `crop-frames.ts` fails** (gutter detection error), use the FFmpeg fallback which uses simple math division:

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/crop-frames-ffmpeg.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--input` | Yes | - | Contact sheet image path |
| `--output-dir` | Yes | - | Output directory for frames |
| `--cols` | No | 3 | Grid columns |
| `--rows` | No | 2 | Grid rows |
| `--padding` | No | 0 | Pixels to trim from each frame edge |

**Why this works:** Divides the image mathematically (width÷3, height÷2) without gutter detection. 100% reliable for any contact sheet.

---

## Script: resize-frames.ts (Optional)

Resize/crop frames to a target aspect ratio (LOCAL - no API). Use when user requests 16:9, 9:16, or other aspect ratios.

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/resize-frames.ts \
  --input-dir outputs/frames/ \
  --output-dir outputs/frames/ \
  --aspect-ratio 16:9
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--input-dir` | Yes | - | Directory containing frame images |
| `--output-dir` | No | input-dir | Output directory (overwrites if same) |
| `--aspect-ratio` | Yes | - | Target ratio: 16:9, 9:16, 4:3, 3:4, 1:1, 3:2, 2:3 |
| `--format` | No | png | Output format: png, jpeg, webp |

**Common Aspect Ratios:**
- `16:9` - Landscape (YouTube, desktop)
- `9:16` - Portrait (TikTok, Reels, Stories)
- `1:1` - Square (Instagram)

**Behavior:** Crops from center to maintain subject focus.

**Errors:**
- `Input directory not found` → Check frames directory exists
- `No image files found` → Check frame-{1-6}.png exist

---

## Script: generate-video.ts

Generate videos via Kling AI direct API with frame-pair interpolation.

### Video Prompts

Use the fixed prompts from `.claude/skills/editorial-photography/prompts/video.md`

Each transition has a specific camera movement prompt for the frame pair. Copy the prompt exactly.

### Command (Frame-Pair Mode)

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts \
  --input outputs/frames/frame-1.png \
  --input-tail outputs/frames/frame-2.png \
  --prompt "<PROMPT_FROM_VIDEO.MD>" \
  --output outputs/videos/video-1.mp4 \
  --duration 5
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--input` | Yes | - | Start frame image |
| `--input-tail` | No | - | End frame image (for frame-pair interpolation) |
| `--prompt` | Yes | - | Transition prompt (from video.md) |
| `--output` | Yes | - | Output video path |
| `--duration` | No | 5 | 5 or 10 seconds |

### Frame-Pair Mapping

| Clip | Start Frame | End Frame | Command |
|------|-------------|-----------|---------|
| video-1 | frame-1.png | frame-2.png | `--input frame-1.png --input-tail frame-2.png` |
| video-2 | frame-2.png | frame-3.png | `--input frame-2.png --input-tail frame-3.png` |
| video-3 | frame-3.png | frame-4.png | `--input frame-3.png --input-tail frame-4.png` |
| video-4 | frame-4.png | frame-5.png | `--input frame-4.png --input-tail frame-5.png` |
| video-5 | frame-5.png | frame-6.png | `--input frame-5.png --input-tail frame-6.png` |

**Important:** When using `--input-tail` for frame-pair mode, `camera_control` JSON is not available. Describe camera movements in the text prompt instead.

**Errors:**
- `KLING_ACCESS_KEY and KLING_SECRET_KEY ... required` → Add both keys to .env file
- `Timeout` → Kling takes 2-3 minutes per video, be patient
- `Request failed` → Retry once, then report to user

---

## Script: stitch-videos-eased.ts

Stitch videos with speed curves for invisible hard cuts (LOCAL - no API).

```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/stitch-videos-eased.ts \
  --clips outputs/videos/video-1.mp4 \
  --clips outputs/videos/video-2.mp4 \
  --clips outputs/videos/video-3.mp4 \
  --clips outputs/videos/video-4.mp4 \
  --clips outputs/videos/video-5.mp4 \
  --output outputs/final/fashion-video.mp4 \
  --clip-duration 1.5 \
  --easing dramaticSwoop
```

| Option | Required | Default | Description |
|--------|----------|---------|-------------|
| `--clips` | Yes | - | Input video files (multiple) |
| `--output` | Yes | - | Output video path |
| `--clip-duration` | No | 1.5 | Output duration per clip (seconds) |
| `--easing` | No | easeInOutSine | Easing curve (dramaticSwoop, cinematic, etc.) |
| `--output-fps` | No | 60 | Output frame rate |
| `--keep-temp` | No | false | Keep temporary frames for debugging |

**Recommended:** `--clip-duration 1.5 --easing dramaticSwoop`

**Errors:**
- `ffmpeg not found` → Install with `brew install ffmpeg`
- `Input file missing` → Check all 5 videos exist

---

## Error Recovery Summary

| Error | Cause | Solution |
|-------|-------|----------|
| FAL_KEY not set | Missing image API key | Add FAL_KEY to .env file |
| KLING keys not set | Missing video API keys | Add KLING_ACCESS_KEY and KLING_SECRET_KEY to .env |
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
│   ├── video-1.mp4            # From generate-video (frames 1→2)
│   ├── video-2.mp4            # From generate-video (frames 2→3)
│   ├── video-3.mp4            # From generate-video (frames 3→4)
│   ├── video-4.mp4            # From generate-video (frames 4→5)
│   └── video-5.mp4            # From generate-video (frames 5→6)
└── final/
    └── fashion-video.mp4       # From stitch-videos (~20s)
```
