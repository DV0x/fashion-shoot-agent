# Speed Curves & Video Stitching Implementation

**Date:** 2026-01-06
**Project:** fashion-shoot-agent
**Inspired by:** [easy-peasy-ease](https://github.com/...)

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [The Algorithm](#the-algorithm)
5. [Easing Functions](#easing-functions)
6. [Scripts Reference](#scripts-reference)
7. [Usage Examples](#usage-examples)
8. [Configuration](#configuration)
9. [Technical Details](#technical-details)

---

## Overview

This implementation provides **cinematic speed curves** for video processing, creating smooth slow-fast-slow motion effects that make hard cuts between clips appear seamless.

### The Problem

Traditional video stitching with hard cuts looks jarring:
```
Video 1: [==========>] HARD CUT Video 2: [==========>]
                       ↑
              Visible jump here
```

### The Solution

Apply easing-based speed curves so clips slow down at boundaries:
```
Video 1: [===FAST====>slow] CUT [slow<====FAST====]  :Video 2
                           ↑
                  Cut happens during slow-motion
                  (nearly invisible to the eye)
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SPEED CURVE PIPELINE                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐     ┌──────────────────┐     ┌──────────────────────────┐
│   Source Videos  │     │  Easing Functions │     │      Configuration       │
│  (5s each, 24fps)│     │   (Pure Math)     │     │  - Output duration: 1.5s │
│                  │     │                   │     │  - Output FPS: 60        │
│  video-1.mp4     │     │  easeInOutSine    │     │  - Bitrate: 25Mbps       │
│  video-2.mp4     │     │  dramaticSwoop    │     │  - Bezier: custom        │
│  video-3.mp4     │     │  easeInOutCubic   │     │                          │
│  ...             │     │  ...              │     │                          │
└────────┬─────────┘     └────────┬──────────┘     └────────────┬─────────────┘
         │                        │                              │
         │                        │                              │
         ▼                        ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                        TIMESTAMP CALCULATION                                │
│                           (The Core Algorithm)                              │
│                                                                             │
│   for each output frame (0 to 89):                                         │
│       outputProgress = frame / 89                    // 0.0 → 1.0          │
│       sourceProgress = easingFunc(outputProgress)    // Apply curve        │
│       sourceTime = sourceProgress * inputDuration    // Map to seconds     │
│                                                                             │
│   Result: Array of source timestamps                                        │
│   [0.0003s, 0.0012s, 0.0028s, ... 5.0388s, 5.0397s, 5.0400s]              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                     PHASE 1: APPLY SPEED CURVE                              │
│                        (apply-speed-curve.ts)                               │
│                                                                             │
│   ┌─────────────┐    ┌─────────────────┐    ┌─────────────────────────┐    │
│   │   FFmpeg    │    │  Frame Buffer   │    │       FFmpeg            │    │
│   │   Extract   │───▶│  (PNG files)    │───▶│       Encode            │    │
│   │   Frames    │    │  frame_000.png  │    │   (libx264, 60fps)      │    │
│   │   at t=Xs   │    │  frame_001.png  │    │                         │    │
│   └─────────────┘    │  ...            │    └─────────────────────────┘    │
│                      └─────────────────┘                                    │
│                                                                             │
│   Input: video-1.mp4 (5.04s, 24fps)                                        │
│   Output: video-1-curved.mp4 (1.5s, 60fps, speed-curved)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ (Repeat for each video)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                     PHASE 2: STITCH WITH HARD CUTS                          │
│                       (stitch-videos-eased.ts)                              │
│                                                                             │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│   │ Clip 1  │ │ Clip 2  │ │ Clip 3  │ │ Clip 4  │ │ Clip 5  │ │ Clip 6  │  │
│   │ curved  │ │ curved  │ │ curved  │ │ curved  │ │ curved  │ │ curved  │  │
│   └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘ └────┬────┘  │
│        │           │           │           │           │           │        │
│        ▼           ▼           ▼           ▼           ▼           ▼        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     Auto-Scale + Pad                                 │  │
│   │   scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:...        │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│        │           │           │           │           │           │        │
│        ▼           ▼           ▼           ▼           ▼           ▼        │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                     FFmpeg Concat Filter                             │  │
│   │         [v0][v1][v2][v3][v4][v5]concat=n=6:v=1:a=0[out]             │  │
│   │                      (Pure hard cuts, no transitions)                │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│                          fashion-video-eased.mp4                            │
│                           (9s total, 60fps)                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### File Structure

```
agent/.claude/skills/fashion-shoot-pipeline/
├── SKILL.md                          # Pipeline documentation
├── scripts/
│   ├── lib/
│   │   └── easing-functions.ts       # Pure math easing functions
│   ├── apply-speed-curve.ts          # Apply easing to single video
│   ├── stitch-videos-eased.ts        # Combine videos with hard cuts
│   └── stitch-videos.ts              # Original FFmpeg xfade version
└── docs/
    └── SPEED_CURVES_IMPLEMENTATION.md  # This document
```

---

## Core Components

### 1. Easing Functions (`lib/easing-functions.ts`)

Pure mathematical functions with **zero dependencies**. Each function maps normalized time (0→1) to normalized progress (0→1).

```typescript
type EasingFunction = (t: number) => number;

// Example: easeInOutSine
const easeInOutSine = (t: number): number =>
  -(Math.cos(Math.PI * t) - 1) / 2;
```

**Available Easings:**

| Category | Functions |
|----------|-----------|
| **Linear** | `linear` |
| **Polynomial** | `easeInQuad`, `easeOutQuad`, `easeInOutQuad`, `easeInCubic`, `easeOutCubic`, `easeInOutCubic`, `easeInQuart`, `easeOutQuart`, `easeInOutQuart`, `easeInQuint`, `easeOutQuint`, `easeInOutQuint` |
| **Sinusoidal** | `easeInSine`, `easeOutSine`, `easeInOutSine` |
| **Exponential** | `easeInExpo`, `easeOutExpo`, `easeInOutExpo` |
| **Circular** | `easeInCirc`, `easeOutCirc`, `easeInOutCirc` |
| **Elastic** | `easeInElastic`, `easeOutElastic`, `easeInOutElastic` |
| **Back** | `easeInBack`, `easeOutBack`, `easeInOutBack` |
| **Bounce** | `easeInBounce`, `easeOutBounce`, `easeInOutBounce` |
| **Bezier Presets** | `ease`, `easeIn`, `easeOut`, `easeInOut`, `dramaticSwoop`, `gentleSwoop`, `cinematic`, `luxurious` |
| **Hybrid** | `easeInExpoOutCubic`, `easeInQuartOutQuad`, `easeInCircOutQuad` |

### 2. Cubic Bezier Support

Create custom CSS-compatible easing curves:

```typescript
import { createBezierEasing } from './lib/easing-functions.js';

// Dramatic swoop (easy-peasy-ease default)
const dramaticSwoop = createBezierEasing(0.85, 0, 0.15, 1);

// Custom curve
const myEasing = createBezierEasing(0.7, 0, 0.3, 1);
```

### 3. Apply Speed Curve (`apply-speed-curve.ts`)

Transforms a single video using easing-based speed manipulation.

**Process:**
1. Probe video metadata (duration, resolution, fps)
2. Calculate source timestamps using easing function
3. Extract frames at calculated timestamps via FFmpeg
4. Re-encode frames at constant output framerate

### 4. Stitch Videos Eased (`stitch-videos-eased.ts`)

Combines multiple speed-curved videos with hard cuts.

**Process:**
1. Validate all input clips exist
2. Analyze clips to find target dimensions
3. For each clip: calculate timestamps, extract frames
4. Auto-scale all frames to uniform resolution
5. Encode combined frames into final video

---

## The Algorithm

### Core Concept: Output-Driven Frame Selection

Instead of speeding up/slowing down playback, we **select which source frames to show** at each output timestamp.

```
OUTPUT TIMELINE (1.5s @ 60fps = 90 frames)
├─Frame 0──Frame 1──Frame 2──...──Frame 88──Frame 89─┤
     │         │        │              │         │
     ▼         ▼        ▼              ▼         ▼
   0.0000s  0.0003s  0.0012s  ...   5.0388s  5.0400s
     │         │        │              │         │
     └─────────┴────────┴──────────────┴─────────┘
                SOURCE TIMESTAMPS
        (calculated by easing function)
```

### Timestamp Calculation

```typescript
function calculateSourceTimestamps(
  easingFunc: EasingFunction,
  inputDuration: number,    // e.g., 5.04 seconds
  outputDuration: number,   // e.g., 1.5 seconds
  outputFps: number         // e.g., 60
): number[] {
  const totalOutputFrames = Math.floor(outputDuration * outputFps);  // 90
  const timestamps: number[] = [];

  for (let frame = 0; frame < totalOutputFrames; frame++) {
    // Normalize to 0-1
    const outputProgress = frame / (totalOutputFrames - 1);

    // Apply easing function (THE MAGIC!)
    const sourceProgress = easingFunc(outputProgress);

    // Map to source video timestamp
    const sourceTime = sourceProgress * inputDuration;

    timestamps.push(sourceTime);
  }

  return timestamps;
}
```

### Example: Dramatic Swoop Bezier (0.85, 0, 0.15, 1)

```
Output Frame → Source Time (showing easing effect)
─────────────────────────────────────────────────
Frame  0 (  0.0%) → 0.0000s  ┐
Frame  1 (  1.1%) → 0.0003s  │ SLOW: First 10 frames
Frame  2 (  2.2%) → 0.0012s  │ cover only 0.03s of source
...                          │ (near frozen)
Frame  9 ( 10.1%) → 0.0271s  ┘

Frame 40 ( 44.9%) → 2.1847s  ┐
Frame 41 ( 46.1%) → 2.3590s  │ FAST: Middle frames
Frame 42 ( 47.2%) → 2.5307s  │ jump ~170ms each
Frame 43 ( 48.3%) → 2.6986s  │ (rapid motion)
Frame 44 ( 49.4%) → 2.8615s  ┘

Frame 80 ( 89.9%) → 5.0129s  ┐
Frame 81 ( 91.0%) → 5.0190s  │ SLOW: Last 10 frames
...                          │ cover only 0.03s of source
Frame 89 (100.0%) → 5.0400s  ┘ (near frozen)
```

---

## Easing Functions

### How Easing Creates Speed Changes

The **slope of the easing curve** determines **playback speed**:

```
Progress (y)
    1.0 │                    ___●
        │                 __/
        │              __/        ← Steep = FAST
        │           __/
    0.5 │        __/
        │      _/
        │    _/                   ← Flat = SLOW
        │  _/
    0.0 │●___________________________
        0.0        0.5        1.0
                Time (x)
```

### Bezier Control Points

```
cubic-bezier(x1, y1, x2, y2)
              ↑    ↑   ↑    ↑
           Handle 1   Handle 2

Start point: (0, 0) - fixed
End point:   (1, 1) - fixed
Handles:     Control the curve shape
```

### Famous Presets

| Name | Bezier | Effect |
|------|--------|--------|
| `ease` | (0.25, 0.1, 0.25, 1) | CSS default |
| `easeInOut` | (0.42, 0, 0.58, 1) | Standard symmetric |
| `dramaticSwoop` | (0.85, 0, 0.15, 1) | Extreme slow-fast-slow |
| `cinematic` | (0.77, 0, 0.175, 1) | Film-like feel |

---

## Scripts Reference

### apply-speed-curve.ts

Apply easing-based speed curve to a single video.

```bash
npx tsx apply-speed-curve.ts \
  --input video.mp4 \
  --output curved.mp4 \
  --output-duration 1.5 \
  --easing easeInOutSine
```

**Options:**

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--input` | `-i` | required | Input video file |
| `--output` | `-o` | required | Output video file |
| `--output-duration` | `-d` | 1.5 | Output duration in seconds |
| `--output-fps` | `-f` | 60 | Output frame rate |
| `--easing` | `-e` | easeInOutSine | Easing function name |
| `--bezier` | `-b` | - | Custom bezier (p1x,p1y,p2x,p2y) |
| `--bitrate` | - | 25M | Output bitrate |
| `--keep-temp` | - | false | Keep temporary frames |
| `--list-easings` | - | - | Show all available easings |

### stitch-videos-eased.ts

Combine multiple videos with speed curves and hard cuts.

```bash
npx tsx stitch-videos-eased.ts \
  --clips video1.mp4 --clips video2.mp4 --clips video3.mp4 \
  --output final.mp4 \
  --clip-duration 1.5 \
  --easing dramaticSwoop
```

**Options:**

| Option | Short | Default | Description |
|--------|-------|---------|-------------|
| `--clips` | `-c` | required | Input videos (multiple) |
| `--output` | `-o` | required | Output video file |
| `--clip-duration` | `-d` | 1.5 | Duration per clip |
| `--output-fps` | `-f` | 60 | Output frame rate |
| `--easing` | `-e` | easeInOutSine | Easing function name |
| `--bezier` | `-b` | - | Custom bezier curve |
| `--bitrate` | - | 25M | Output bitrate |
| `--keep-temp` | - | false | Keep temporary files |

---

## Usage Examples

### Basic Speed Curve

```bash
# Apply default easing (easeInOutSine) to a single video
npx tsx apply-speed-curve.ts \
  -i agent/outputs/videos/video-1.mp4 \
  -o agent/outputs/video-1-curved.mp4
```

### Dramatic Swoop (easy-peasy-ease Style)

```bash
# Apply dramatic slow-fast-slow effect
npx tsx apply-speed-curve.ts \
  -i video.mp4 \
  -o curved.mp4 \
  --bezier 0.85,0,0.15,1
```

### Full Pipeline: 6 Videos

```bash
# Step 1: Create output directory
mkdir -p agent/outputs/videos-curved

# Step 2: Apply speed curves to all videos (parallel)
for i in 1 2 3 4 5 6; do
  npx tsx apply-speed-curve.ts \
    -i agent/outputs/videos/video-$i.mp4 \
    -o agent/outputs/videos-curved/video-$i-curved.mp4 \
    -d 1.5 -b 0.85,0,0.15,1 &
done
wait

# Step 3: Stitch with hard cuts
npx tsx stitch-videos-eased.ts \
  -c agent/outputs/videos-curved/video-1-curved.mp4 \
  -c agent/outputs/videos-curved/video-2-curved.mp4 \
  -c agent/outputs/videos-curved/video-3-curved.mp4 \
  -c agent/outputs/videos-curved/video-4-curved.mp4 \
  -c agent/outputs/videos-curved/video-5-curved.mp4 \
  -c agent/outputs/videos-curved/video-6-curved.mp4 \
  -o agent/outputs/final/fashion-video-eased.mp4
```

---

## Configuration

### Default Settings

```typescript
const DEFAULT_OUTPUT_FPS = 60;        // Smooth playback
const DEFAULT_OUTPUT_DURATION = 1.5;  // Seconds per clip
const DEFAULT_EASING = "easeInOutSine"; // Gentle, works for everything
const DEFAULT_BITRATE = "25M";        // High quality (25 Mbps)
```

### Recommended Settings by Use Case

| Use Case | Easing | Duration | Notes |
|----------|--------|----------|-------|
| Fashion video | `dramaticSwoop` | 1.5s | Maximum slow-fast-slow |
| Product showcase | `easeInOutSine` | 2.0s | Gentle, professional |
| Action/sports | `easeInOutCubic` | 1.0s | Moderate effect |
| Cinematic | `cinematic` | 1.5s | Film-like feel |

---

## Technical Details

### FFmpeg Commands Used

**Frame Extraction:**
```bash
ffmpeg -y -ss <timestamp> -i input.mp4 -frames:v 1 \
  -vf "scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:(ow-iw)/2:(oh-ih)/2:black,setsar=1" \
  -q:v 1 frame_000000.png
```

**Video Encoding:**
```bash
ffmpeg -y -framerate 60 -i frame_%06d.png \
  -c:v libx264 -preset slow -crf 18 -b:v 25M \
  -pix_fmt yuv420p -movflags +faststart output.mp4
```

### Why This Approach?

| Aspect | Our Approach | Alternative |
|--------|--------------|-------------|
| **Frame selection** | FFmpeg `-ss` seek | MediaBunny `samplesAtTimestamps()` |
| **Works in** | Node.js CLI | Browser only |
| **Accuracy** | Frame-level | Sample-level |
| **Speed** | Moderate | Fast (WebCodecs) |
| **Dependencies** | FFmpeg binary | WebCodecs API |

### Comparison with easy-peasy-ease

| Feature | easy-peasy-ease | Our Implementation |
|---------|-----------------|-------------------|
| **Environment** | Browser (Next.js) | Node.js CLI |
| **Decode/Encode** | MediaBunny (WebCodecs) | FFmpeg |
| **Easing Math** | TypeScript | TypeScript (ported) |
| **Stitching** | Hard cuts | Hard cuts |
| **Post-processing** | None | None |
| **Algorithm** | Output-driven timestamps | Output-driven timestamps |

---

## Troubleshooting

### Visible Jump Cuts

**Cause:** Visual content differs significantly between clips at cut points.

**Solutions:**
1. Ensure source videos have similar content at start/end
2. Use more extreme easing (more freeze at boundaries)
3. Consider adding brief crossfade (not pure hard cut)

### Frame Rate Issues

**Cause:** Source videos have variable frame rates.

**Solution:** Use `-vsync cfr` in FFmpeg encoding to force constant frame rate.

### Resolution Mismatch

**Cause:** Source videos have different resolutions.

**Solution:** Auto-scaling filter handles this automatically:
```
scale=W:H:force_original_aspect_ratio=decrease,pad=W:H:...
```

---

## References

- [easings.net](https://easings.net/) - Visual easing reference
- [cubic-bezier.com](https://cubic-bezier.com/) - Custom curve creator
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [easy-peasy-ease](https://github.com/...) - Original inspiration

---

*Document generated: 2026-01-06*
