---
name: fashion-shoot-pipeline
description: Execute image and video generation scripts using FAL.ai (images) and Kling AI (videos). Use AFTER editorial-photography skill. Provides script commands for generate-image, crop-frames, generate-video, and stitch-videos.
---

# Fashion Shoot Pipeline Skill

Execute the generation pipeline using FAL.ai (images), Kling AI (videos), and FFmpeg (stitching).

## Prerequisite

**ALWAYS activate the editorial-photography skill first** to get prompt templates and presets.

```
1. Skill tool → editorial-photography → Get prompts and presets
2. Skill tool → THIS skill → Execute scripts with those prompts
```

## Directory Setup (Run First)

```bash
mkdir -p outputs/frames outputs/videos outputs/final
```

---

## Available Operations

### Generate Image

**Purpose:** Create hero shots, contact sheets, or regenerate individual frames using AI image generation.

**When to use:**
- Starting a new shoot (hero image with reference images)
- Creating the 2×3 contact sheet grid
- Regenerating specific frames when user requests changes
- Creating variations with different presets

**Command:**
```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts \
  --prompt "<PROMPT_FROM_EDITORIAL_PHOTOGRAPHY>" \
  --input ref1.jpg --input ref2.jpg \
  --output outputs/hero.png \
  --aspect-ratio 3:2 \
  --resolution 2K
```

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `--prompt` | Yes | - | Filled prompt template from editorial-photography skill |
| `--input` | No | - | Reference image paths (can specify multiple) |
| `--output` | Yes | - | Output file path |
| `--aspect-ratio` | No | 3:2 | Aspect ratio: 3:2, 16:9, 9:16, 1:1, etc. |
| `--resolution` | No | 1K | Resolution: 1K, 2K, 4K |

**Error handling:**
- `FAL_KEY not set` → Add FAL_KEY to .env
- `Request failed` → Retry once, then report to user

---

### Crop Frames

**Purpose:** Extract individual frames from the 2×3 contact sheet grid.

**When to use:**
- After contact sheet is generated and approved by user
- Uses variance-based gutter detection to find frame boundaries

**Command:**
```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/crop-frames.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/
```

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `--input` | Yes | - | Contact sheet image path |
| `--output-dir` | Yes | - | Directory for extracted frames |
| `--rows` | No | 2 | Grid rows |
| `--cols` | No | 3 | Grid columns |

**Output:** `frame-1.png` through `frame-6.png` (auto-normalized to uniform dimensions)

**Error handling:**
- `Gutter detection failed` → Use fallback below

#### Fallback: crop-frames-ffmpeg.ts

**Purpose:** Alternative frame extraction using simple math division (no gutter detection).

**When to use:**
- When `crop-frames.ts` fails due to minimal/no gutters in contact sheet
- 100% reliable fallback

**Command:**
```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/crop-frames-ffmpeg.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/
```

---

### Resize Frames

**Purpose:** Change aspect ratio of all frames (e.g., for portrait/landscape/square formats).

**When to use:**
- User requests different aspect ratio: "make it portrait", "resize to 16:9", "square format"
- Before video generation if user wants non-default ratio

**Command:**
```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/resize-frames.ts \
  --input-dir outputs/frames/ \
  --output-dir outputs/frames/ \
  --aspect-ratio 16:9
```

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `--input-dir` | Yes | - | Directory containing frame images |
| `--output-dir` | No | input-dir | Output directory (overwrites if same) |
| `--aspect-ratio` | Yes | - | Target ratio: 16:9, 9:16, 4:3, 3:4, 1:1, 3:2, 2:3 |

**Common aspect ratios:**
- `16:9` - Landscape (YouTube, desktop)
- `9:16` - Portrait (TikTok, Reels, Stories)
- `1:1` - Square (Instagram)

---

### Generate Video

**Purpose:** Create motion video clips between frame pairs using AI video generation.

**When to use:**
- After frames are approved (all 6 extracted and any modifications complete)
- Creates 5 videos from 6 frames (frame pairs: 1→2, 2→3, 3→4, 4→5, 5→6)
- Optionally creates video-6 (frame-6→frame-1) for loop mode

**Command:**
```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts \
  --input outputs/frames/frame-1.png \
  --input-tail outputs/frames/frame-2.png \
  --prompt "<PROMPT_FROM_VIDEO.MD>" \
  --output outputs/videos/video-1.mp4 \
  --duration 5
```

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `--input` | Yes | - | Start frame image path |
| `--input-tail` | No | - | End frame image path (for frame-pair interpolation) |
| `--prompt` | Yes | - | Transition prompt from video.md |
| `--output` | Yes | - | Output video path |
| `--duration` | No | 5 | Duration in seconds (5 or 10) |

**Frame-pair mapping:**
| Clip | Start Frame | End Frame |
|------|-------------|-----------|
| video-1 | frame-1.png | frame-2.png |
| video-2 | frame-2.png | frame-3.png |
| video-3 | frame-3.png | frame-4.png |
| video-4 | frame-4.png | frame-5.png |
| video-5 | frame-5.png | frame-6.png |
| video-6 | frame-6.png | frame-1.png | *(loop mode only)* |

**Note:** Each video takes 2-3 minutes to generate. Be patient.

**Error handling:**
- `KLING keys not set` → Add KLING_ACCESS_KEY and KLING_SECRET_KEY to .env
- `Timeout` → Kling is slow, wait 2-3 min per video

---

### Stitch Videos

**Purpose:** Combine all video clips into the final fashion video with speed curves for smooth transitions.

**When to use:**
- After all 5 video clips (or 6 with loop) are generated
- User has approved clips or requested specific speed/easing

**Command (5 clips, no loop):**
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

**Command (6 clips, with loop):**
```bash
npx tsx .claude/skills/fashion-shoot-pipeline/scripts/stitch-videos-eased.ts \
  --clips outputs/videos/video-1.mp4 \
  --clips outputs/videos/video-2.mp4 \
  --clips outputs/videos/video-3.mp4 \
  --clips outputs/videos/video-4.mp4 \
  --clips outputs/videos/video-5.mp4 \
  --clips outputs/videos/video-6.mp4 \
  --output outputs/final/fashion-video.mp4 \
  --clip-duration 1.5 \
  --easing dramaticSwoop
```

**Parameters:**
| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `--clips` | Yes | - | Input video files (specify multiple times) |
| `--output` | Yes | - | Final video output path |
| `--clip-duration` | No | 1.5 | Output duration per clip in seconds |
| `--easing` | No | easeInOutSine | Easing curve for speed ramping |
| `--output-fps` | No | 60 | Output frame rate |

**Recommended settings:** `--clip-duration 1.5 --easing dramaticSwoop`

---

## Output Structure

```
outputs/
├── hero.png                    # Full-body hero shot
├── contact-sheet.png           # 2×3 grid of 6 camera angles
├── frames/
│   ├── frame-1.png            # Beauty portrait
│   ├── frame-2.png            # High-angle 3/4 view
│   ├── frame-3.png            # Low-angle full body
│   ├── frame-4.png            # Side-on profile
│   ├── frame-5.png            # Intimate close-up
│   └── frame-6.png            # Extreme detail
├── videos/
│   ├── video-1.mp4            # Frames 1→2 transition
│   ├── video-2.mp4            # Frames 2→3 transition
│   ├── video-3.mp4            # Frames 3→4 transition
│   ├── video-4.mp4            # Frames 4→5 transition
│   ├── video-5.mp4            # Frames 5→6 transition
│   └── video-6.mp4            # Frames 6→1 (loop only)
└── final/
    └── fashion-video.mp4       # Final stitched video (~9s or ~10.5s with loop)
```

---

## Error Recovery Summary

| Error | Cause | Solution |
|-------|-------|----------|
| FAL_KEY not set | Missing image API key | Add FAL_KEY to .env |
| KLING keys not set | Missing video API keys | Add KLING_ACCESS_KEY and KLING_SECRET_KEY |
| Request failed | API error | Retry once |
| Timeout | Kling slow | Wait 2-3 min per video |
| File not found | Missing output | Check previous step completed |
| Gutter detection failed | Contact sheet has minimal gutters | Use crop-frames-ffmpeg.ts fallback |
| ffmpeg not found | Not installed | `brew install ffmpeg` |
