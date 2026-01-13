# Speed Curves & Video Stitching Reference

Complete reference for the easing and stitching parameters in the fashion-shoot-pipeline.

---

## Overview

The speed curve system creates the "invisible hard cuts" effect by:
1. Slowing down video at the start and end of each clip
2. Speeding up in the middle
3. Joining clips with hard cuts during the slow-motion moments

```
CLIP 1          CLIP 2          CLIP 3
▁▁▁███▁▁▁      ▁▁▁███▁▁▁      ▁▁▁███▁▁▁
slow fast slow  slow fast slow  slow fast slow
     │               │
     └───────────────┘
     HARD CUT HERE (invisible because both clips are in slow-mo)
```

---

## Scripts

| Script | Purpose |
|--------|---------|
| `apply-speed-curve.ts` | Apply speed curve to a single video |
| `stitch-videos-eased.ts` | Stitch multiple videos with speed curves |

---

## CLI Parameters

### `apply-speed-curve.ts` - Single Video

```bash
npx tsx apply-speed-curve.ts \
  --input video.mp4 \
  --output curved.mp4 \
  --output-duration 1.5 \
  --output-fps 60 \
  --easing dramaticSwoop \
  --bitrate 25M
```

| Parameter | Flag | Default | Description |
|-----------|------|---------|-------------|
| `input` | `-i, --input` | **required** | Input video path |
| `output` | `-o, --output` | **required** | Output video path |
| `outputDuration` | `-d, --output-duration` | `1.5` | Output duration in seconds |
| `outputFps` | `-f, --output-fps` | `60` | Output frame rate |
| `easing` | `-e, --easing` | `easeInOutSine` | Named easing function |
| `bezier` | `-b, --bezier` | — | Custom bezier `p1x,p1y,p2x,p2y` |
| `bitrate` | `--bitrate` | `25M` | Output video bitrate |
| `keepTempFrames` | `--keep-temp` | `false` | Keep extracted PNG frames |

### `stitch-videos-eased.ts` - Multi-Video

```bash
npx tsx stitch-videos-eased.ts \
  -c video-1.mp4 -c video-2.mp4 -c video-3.mp4 \
  -c video-4.mp4 -c video-5.mp4 -c video-6.mp4 \
  --output final.mp4 \
  --clip-duration 1.5 \
  --bezier 0.85,0,0.15,1
```

| Parameter | Flag | Default | Description |
|-----------|------|---------|-------------|
| `clips` | `-c, --clips` | **required (2+)** | Input video paths (repeat flag) |
| `output` | `-o, --output` | **required** | Output video path |
| `clipDuration` | `-d, --clip-duration` | `1.5` | Duration **per clip** after speed curve |
| `outputFps` | `-f, --output-fps` | `60` | Output frame rate |
| `easing` | `-e, --easing` | `easeInOutSine` | Named easing function |
| `bezier` | `-b, --bezier` | — | Custom bezier `p1x,p1y,p2x,p2y` |
| `bitrate` | `--bitrate` | `25M` | Output video bitrate |
| `keepTemp` | `--keep-temp` | `false` | Keep temp frame directory |

---

## Parameter Explanations

### `outputDuration` (default: 1.5 seconds)

**What it does:** How long each clip will be after processing.

**Impact:**
```
Input video: 5 seconds of footage
                    ↓
outputDuration: 1.5s → Compressed into 1.5 seconds (3.3x faster overall)
outputDuration: 2.5s → Compressed into 2.5 seconds (2x faster overall)
outputDuration: 1.0s → Compressed into 1.0 seconds (5x faster overall)
```

**Rules:**
- Shorter duration = more compression = faster middle section
- Longer duration = less compression = gentler speed changes

---

### `outputFps` (default: 60)

**What it does:** How many frames per second in the output video.

**Impact:**
```
60 fps → Buttery smooth slow-motion (90 frames for 1.5s output)
30 fps → Standard smoothness (45 frames for 1.5s output)
24 fps → Cinematic/film look (36 frames for 1.5s output)
```

**Rules:**
- Higher FPS = smoother slow-motion sections (but larger file)
- Lower FPS = more "film-like" but choppier slow-mo

**Why 60?** When the video slows down at the start/end, you need extra frames to keep it smooth. 60fps ensures slow-motion looks silky, not stuttery.

---

### `easing` (default: `easeInOutSine`)

**What it does:** Controls the speed curve shape — when the video plays slow vs fast.

**The concept:**
```
TIME IN OUTPUT VIDEO ────────────────────────────►
0%              50%              100%

With easeInOutSine:
SLOW            FAST             SLOW
     (start)    (middle)         (end)
```

**Visual comparison:**
```
linear:           ████████████████████████████
                  Same speed throughout

easeInOutSine:    ▄▂▁▁▂▄████████████▄▂▁▁▂▄
                  Gentle curve

dramaticSwoop:    ▁▁▁▁▁▁▁▁████████▁▁▁▁▁▁▁▁
                  Extreme slow at edges
```

---

### `bezier` (custom curve)

**What it does:** Define your own speed curve with 4 numbers.

**Format:** `--bezier p1x,p1y,p2x,p2y`

**How to think about it:**
```
         p2 (p2x, p2y)
          *
         /
        /
       /
      *
    p1 (p1x, p1y)
```

| Numbers | Effect |
|---------|--------|
| `0.85,0,0.15,1` | **dramaticSwoop** — extreme slow edges |
| `0.42,0,0.58,1` | Standard CSS ease-in-out |
| `0.7,0,0.3,1` | Gentle swoop — less extreme |
| `0,0,1,1` | Linear (no curve) |

**Rules:**
- Higher first X (p1x) = slower start
- Lower last X (p2x) = slower end
- `0.85,0,0.15,1` means "stay slow for 85% of the start, then rush, then slow for last 15%"

---

### `bitrate` (default: `25M`)

**What it does:** How much data per second in the output video.

**Impact:**
```
25M (25 Mbps) → High quality, larger files (~4MB per second)
15M (15 Mbps) → Good quality, moderate files
8M (8 Mbps)   → Acceptable quality, smaller files
```

**Rules:**
- Higher bitrate = better quality, bigger file
- Lower bitrate = more compression artifacts, smaller file

---

## Available Easing Functions

### Base Easings (30)

| Category | Functions |
|----------|-----------|
| Linear | `linear` |
| Quadratic | `easeInQuad`, `easeOutQuad`, `easeInOutQuad` |
| Cubic | `easeInCubic`, `easeOutCubic`, `easeInOutCubic` |
| Quartic | `easeInQuart`, `easeOutQuart`, `easeInOutQuart` |
| Quintic | `easeInQuint`, `easeOutQuint`, `easeInOutQuint` |
| Sinusoidal | `easeInSine`, `easeOutSine`, `easeInOutSine` |
| Exponential | `easeInExpo`, `easeOutExpo`, `easeInOutExpo` |
| Circular | `easeInCirc`, `easeOutCirc`, `easeInOutCirc` |
| Elastic | `easeInElastic`, `easeOutElastic`, `easeInOutElastic` |
| Back | `easeInBack`, `easeOutBack`, `easeInOutBack` |
| Bounce | `easeInBounce`, `easeOutBounce`, `easeInOutBounce` |

### Bezier Presets (8)

| Name | Control Points | Use Case |
|------|----------------|----------|
| `ease` | `0.25, 0.1, 0.25, 1` | CSS default |
| `easeIn` | `0.42, 0, 1, 1` | CSS ease-in |
| `easeOut` | `0, 0, 0.58, 1` | CSS ease-out |
| `easeInOut` | `0.42, 0, 0.58, 1` | CSS ease-in-out |
| **`dramaticSwoop`** | `0.85, 0, 0.15, 1` | **easy-peasy-ease default** |
| `gentleSwoop` | `0.7, 0, 0.3, 1` | Less extreme swoop |
| `cinematic` | `0.77, 0, 0.175, 1` | Film-like motion |
| `luxurious` | `0.19, 1, 0.22, 1` | Fast start, ultra gentle end |

### Material Design (3)

| Name | Control Points |
|------|----------------|
| `materialStandard` | `0.4, 0, 0.2, 1` |
| `materialDecelerate` | `0, 0, 0.2, 1` |
| `materialAccelerate` | `0.4, 0, 1, 1` |

### Hybrid/Asymmetric (3)

| Name | First Half | Second Half |
|------|------------|-------------|
| `easeInExpoOutCubic` | Exponential in | Cubic out |
| `easeInQuartOutQuad` | Quartic in | Quadratic out |
| `easeInCircOutQuad` | Circular in | Quadratic out |

---

## Easing Behavior Guide

| Easing | Behavior | Feel |
|--------|----------|------|
| `linear` | Constant speed throughout | Boring, no effect |
| `easeInOutSine` | Gentle slow-fast-slow | Smooth, subtle |
| `easeInOutCubic` | Moderate slow-fast-slow | Noticeable but natural |
| `easeInOutExpo` | Extreme slow-fast-slow | Very dramatic |
| `dramaticSwoop` | Almost frozen → lightning fast → almost frozen | **The "wow" effect** |
| `gentleSwoop` | Soft slow → fast → soft slow | Elegant, understated |
| `cinematic` | Film-like acceleration | Professional feel |
| `luxurious` | Fast start, ultra gentle end | High-end, smooth landing |

---

## Hardcoded Settings (FFmpeg)

These are not configurable via CLI but are optimized for web playback:

| Setting | Value | Why |
|---------|-------|-----|
| Codec | `libx264` | Universal browser support |
| Pixel format | `yuv420p` | Required for browser playback |
| CRF | `18` | Visually lossless quality |
| Preset | `slow` | Better compression quality |
| Movflags | `+faststart` | Enables streaming playback |
| Frame format | PNG | Lossless intermediate frames |
| Padding color | `black` | Standard letterbox |

---

## Recommended Configurations

| Use Case | Easing | Duration | FPS | Command |
|----------|--------|----------|-----|---------|
| **Fashion video (default)** | `dramaticSwoop` | 1.5s | 60 | `--bezier 0.85,0,0.15,1 -d 1.5 -f 60` |
| Subtle slow-mo | `easeInOutSine` | 2.0s | 60 | `-e easeInOutSine -d 2.0 -f 60` |
| Very dramatic | `easeInOutExpo` | 1.0s | 60 | `-e easeInOutExpo -d 1.0 -f 60` |
| Cinematic feel | `cinematic` | 1.5s | 24 | `-e cinematic -d 1.5 -f 24` |
| Smooth/luxury | `luxurious` | 2.0s | 60 | `-e luxurious -d 2.0 -f 60` |
| Gentle elegance | `gentleSwoop` | 1.8s | 60 | `-e gentleSwoop -d 1.8 -f 60` |

---

## Quick Reference: What to Change

| I want... | Change this |
|-----------|-------------|
| Smoother slow-motion | Increase `outputFps` (try 60 or 120) |
| More dramatic speed changes | Use `dramaticSwoop` or `easeInOutExpo` |
| Subtler speed changes | Use `easeInOutSine` or `gentleSwoop` |
| Longer clips | Increase `outputDuration` (try 2.0 or 2.5) |
| Snappier cuts | Decrease `outputDuration` (try 1.0) |
| Smaller file size | Decrease `bitrate` (try 15M or 10M) |
| Higher quality | Increase `bitrate` (try 35M or 50M) |

---

## Example: Full Pipeline

6 clips stitched with `dramaticSwoop` at 1.5s each:

```
CLIP 1          CLIP 2          CLIP 3          CLIP 4          CLIP 5          CLIP 6
▁▁▁███▁▁▁      ▁▁▁███▁▁▁      ▁▁▁███▁▁▁      ▁▁▁███▁▁▁      ▁▁▁███▁▁▁      ▁▁▁███▁▁▁
slow fast slow  slow fast slow  slow fast slow  slow fast slow  slow fast slow  slow fast slow
     │               │               │               │               │
     └───────────────┴───────────────┴───────────────┴───────────────┘
                              HARD CUTS (invisible)
```

**Input:** 6 videos × 5 seconds each = 30 seconds of footage
**Output:** 6 clips × 1.5 seconds = **9 seconds** final video

```bash
npx tsx stitch-videos-eased.ts \
  -c videos/video-1.mp4 \
  -c videos/video-2.mp4 \
  -c videos/video-3.mp4 \
  -c videos/video-4.mp4 \
  -c videos/video-5.mp4 \
  -c videos/video-6.mp4 \
  --output final/fashion-video.mp4 \
  --clip-duration 1.5 \
  --bezier 0.85,0,0.15,1 \
  --output-fps 60
```

---

## Algorithm Overview

```
                    USER INPUT
                        │
        ┌───────────────┼───────────────┐
        ▼               ▼               ▼
   ┌─────────┐    ┌──────────┐    ┌──────────┐
   │ easing  │    │ duration │    │ outputFps│
   └────┬────┘    └────┬─────┘    └────┬─────┘
        │              │               │
        ▼              ▼               ▼
┌───────────────────────────────────────────────┐
│           timestamp-calc.ts                    │
│                                               │
│  totalFrames = outputDuration x outputFps     │
│  For each frame:                              │
│    outputProgress = frameIndex / totalFrames  │
│    sourceProgress = easingFunc(outputProgress)│
│    sourceTime = sourceProgress x inputDuration│
└───────────────────────┬───────────────────────┘
                        │
                        ▼ timestamps[]
┌───────────────────────────────────────────────┐
│           video-utils.ts                       │
│                                               │
│  extractFramesAtTimestamps()                  │
│    → FFmpeg extracts frame at each timestamp  │
│                                               │
│  encodeFramesToVideo()                        │
│    → H.264, CRF 18, yuv420p                   │
└───────────────────────────────────────────────┘
```

---

## File Locations

```
agent/.claude/skills/fashion-shoot-pipeline/scripts/
├── apply-speed-curve.ts      # Single video speed curve
├── stitch-videos-eased.ts    # Multi-video stitching
└── lib/
    ├── easing-functions.ts   # 41 easing functions
    ├── timestamp-calc.ts     # Core algorithm
    └── video-utils.ts        # FFmpeg utilities
```
