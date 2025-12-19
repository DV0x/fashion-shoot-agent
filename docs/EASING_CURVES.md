# Easing Curves & Video Stitching Guide

## Overview

This document explains easing curves and our MVP approach for stitching video clips with smooth transitions in the Fashion Shoot Agent.

---

## What Are Easing Curves?

Easing curves control the **rate of change** during a transition. Instead of linear (constant speed), easing creates natural, pleasing motion.

### Visual Comparison

```
LINEAR (No Easing) - Robotic, mechanical
────────────────────────────────────────
Progress:  ●────────────────────────────●
Speed:     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
           Same speed throughout


EASE-OUT - Decelerates (like a car braking)
────────────────────────────────────────
Progress:  ●━━━━━━━━━━━━━━━─────────────●
Speed:     ████████████▓▓▓▓▒▒▒░░░░░
           Fast start → Slow end


EASE-IN-OUT - Accelerate → Cruise → Decelerate
────────────────────────────────────────
Progress:  ●─────━━━━━━━━━━━━━─────────●
Speed:     ░░░▒▒▓███████████▓▒▒░░░
           Natural, cinematic feel
```

---

## The Math: Cubic Bezier Curves

All easing is defined by **cubic-bezier(x1, y1, x2, y2)** - 4 control points:

```
                    ● End (1,1)
                   /
                  /
        Handle 2 ○ (x2, y2) - controls arrival

        Handle 1 ○ (x1, y1) - controls departure
                /
               /
● Start (0,0)
```

---

## Standard Easing Presets

| Name | Bezier Values | Feel | Use Case |
|------|---------------|------|----------|
| `linear` | `(0, 0, 1, 1)` | Robotic | Technical transitions |
| `ease` | `(0.25, 0.1, 0.25, 1)` | Subtle | Default, general use |
| `ease-in` | `(0.42, 0, 1, 1)` | Builds up | Entrances |
| `ease-out` | `(0, 0, 0.58, 1)` | Winds down | Exits |
| `ease-in-out` | `(0.42, 0, 0.58, 1)` | Balanced | Most transitions |

---

## Dramatic Easing Types

### 1. Back (Anticipation/Overshoot)
```
cubic-bezier(0.68, -0.55, 0.27, 1.55)

Graph:     ╭╮
          ╱  ╲
         ╱    ●────  (overshoots, then settles)
        ╱
       ●

Feel: Like a spring - goes past 100%, bounces back
```

### 2. Elastic (Springy)
```
Multiple oscillations before settling

Graph:      ~╭╮~
           ╱    ╲~╭╮
          ╱        ╲───●
         ●

Feel: Rubber band snapping
```

### 3. Exponential (Dramatic acceleration)
```
cubic-bezier(0.95, 0.05, 0.795, 0.035)

Graph:              ●
                   /
                  /
                 /
         ●──────╯

Feel: Very slow start, explosive acceleration
```

### 4. "Voluptuous" / Luxurious
```
cubic-bezier(0.19, 1, 0.22, 1)

Graph:     ╭────────
          ╱
         ╱
        ●

Feel: Silky smooth, premium feel - fast start, very gentle arrival
```

---

## Easing Presets Reference

```typescript
const EASING_PRESETS = {
  // Standard
  linear:      [0, 0, 1, 1],
  ease:        [0.25, 0.1, 0.25, 1],
  easeIn:      [0.42, 0, 1, 1],
  easeOut:     [0, 0, 0.58, 1],
  easeInOut:   [0.42, 0, 0.58, 1],

  // Smooth (Material Design)
  smoothIn:    [0.4, 0, 0.2, 1],
  smoothOut:   [0, 0, 0.2, 1],
  smoothInOut: [0.4, 0, 0.2, 1],

  // Dramatic
  backIn:      [0.6, -0.28, 0.735, 0.045],
  backOut:     [0.175, 0.885, 0.32, 1.275],
  backInOut:   [0.68, -0.55, 0.265, 1.55],

  // Cinematic / "Voluptuous"
  cinematic:   [0.16, 1, 0.3, 1],
  dramatic:    [0.77, 0, 0.175, 1],
  luxurious:   [0.19, 1, 0.22, 1],
};
```

---

## MVP Decision: FFmpeg with Speed Ramping

For v1, we're using **FFmpeg** because:
- No extra dependencies (ffmpeg is standard)
- Fast local processing
- Good enough easing via transitions + speed ramping
- Easy to upgrade later if needed

### FFmpeg Transition Types

| Transition | Effect |
|------------|--------|
| `fade` | Opacity crossfade (most versatile) |
| `fadeblack` | Fade through black |
| `fadewhite` | Fade through white |
| `wipeleft` | Wipe from right to left |
| `wiperight` | Wipe from left to right |
| `slideright` | Slide new clip in |
| `smoothleft` | Smooth directional blend |
| `dissolve` | Pixel dissolve effect |
| `circleopen` | Circular reveal |
| `radial` | Radial wipe |

### FFmpeg Native xfade Options

**Important:** FFmpeg's native `xfade` filter does NOT have an `easing` parameter. It only supports:

| Parameter | Description |
|-----------|-------------|
| `transition` | Visual effect (fade, wipe, dissolve, etc.) |
| `duration` | Transition length in seconds |
| `offset` | When transition starts |
| `expr` | Custom expression for advanced transitions |

---

## Implementation Approach

### Our Solution: Custom Expressions with Easing

We use `transition=custom` with `expr` to implement easing via mathematical expressions.
This is based on the [xfade-easing project](https://github.com/scriptituk/xfade-easing).

**How it works:**
1. Easing expression stores result in `st(0)`: e.g., `st(0,P*P*(3-2*P))` for smoothstep
2. Transition expression reads from `ld(0)`: e.g., `A*ld(0)+B*(1-ld(0))` for fade
3. Combined: `expr='st(0,P*P*(3-2*P));A*ld(0)+B*(1-ld(0))'`

```bash
# Smooth fade transition (recommended for fashion)
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex_threads 1 \
  -filter_complex "[0:v][1:v]xfade=transition=custom:duration=1.2:offset=3.8:expr='st(0,P*P*(3-2*P));A*ld(0)+B*(1-ld(0))'[v]" \
  -map "[v]" output.mp4
```

**Note:** `-filter_complex_threads 1` is required because state variables (`st`/`ld`) aren't thread-safe.

### Available Easing Expressions

| Name | Expression | Feel |
|------|------------|------|
| linear | `st(0,P)` | Mechanical |
| smooth | `st(0,P*P*(3-2*P))` | Classic smoothstep |
| cubic-in | `st(0,1-(1-P)^3)` | Fast start, slow end |
| cubic-out | `st(0,P^3)` | Slow start, fast end |
| luxurious | `st(0,1-(1-P)^6)` | Very fast start, ultra gentle end |
| sinusoidal-in-out | `st(0,(1-cos(P*PI))/2)` | Gentle both ends |

---

## Node.js Implementation (fluent-ffmpeg)

```typescript
import ffmpeg from 'fluent-ffmpeg';
import path from 'path';

interface StitchOptions {
  clips: string[];           // Array of video file paths
  output: string;            // Output file path
  transitionDuration?: number; // Transition duration in seconds (default: 0.5)
  transitionType?: string;   // fade, fadeblack, smoothleft, etc.
  easing?: string;           // linear, quadratic, cubic, squareroot
}

async function stitchVideos(options: StitchOptions): Promise<string> {
  const {
    clips,
    output,
    transitionDuration = 0.5,
    transitionType = 'fade',
    easing = 'cubic'
  } = options;

  if (clips.length < 2) {
    throw new Error('Need at least 2 clips to stitch');
  }

  // Assume each clip is 5 seconds
  const clipDuration = 5;

  // Build filter complex for chained xfade
  let filterComplex = '';
  let lastOutput = '0:v';

  for (let i = 1; i < clips.length; i++) {
    const offset = (clipDuration * i) - (transitionDuration * (i - 1)) - transitionDuration;
    const outputLabel = i === clips.length - 1 ? 'vout' : `v${i}`;

    filterComplex += `[${lastOutput}][${i}:v]xfade=transition=${transitionType}:duration=${transitionDuration}:offset=${offset}:easing=${easing}[${outputLabel}];`;
    lastOutput = outputLabel;
  }

  // Remove trailing semicolon
  filterComplex = filterComplex.slice(0, -1);

  return new Promise((resolve, reject) => {
    let command = ffmpeg();

    // Add all input clips
    clips.forEach(clip => {
      command = command.input(clip);
    });

    command
      .complexFilter(filterComplex)
      .map('[vout]')
      .output(output)
      .on('end', () => resolve(output))
      .on('error', (err) => reject(err))
      .run();
  });
}

// Usage example
await stitchVideos({
  clips: [
    'frame_1.mp4',
    'frame_2.mp4',
    'frame_3.mp4',
    'frame_4.mp4',
    'frame_5.mp4',
    'frame_6.mp4'
  ],
  output: 'final_fashion_video.mp4',
  transitionDuration: 0.5,
  transitionType: 'fade',
  easing: 'cubic'
});
```

---

## MCP Tool Design (Future)

```typescript
// video-stitch-mcp.ts
tool(
  "stitch_videos",
  "Stitch multiple video clips with easing transitions",
  {
    clips: z.array(z.string()).min(2).max(10).describe("Array of video file paths"),
    transitionDuration: z.number().min(0.1).max(2).default(0.5).describe("Transition duration in seconds"),
    transitionType: z.enum([
      'fade', 'fadeblack', 'fadewhite',
      'wipeleft', 'wiperight', 'slideright',
      'smoothleft', 'dissolve', 'circleopen'
    ]).default('fade').describe("Type of transition"),
    easing: z.enum([
      'linear', 'quadratic', 'cubic', 'squareroot', 'circular'
    ]).default('cubic').describe("Easing curve for transition"),
    outputPath: z.string().describe("Output file path"),
    sessionId: z.string().optional()
  },
  async (args) => {
    // Implementation using fluent-ffmpeg
  }
)
```

---

## Alternative: Future Upgrade to Remotion

If FFmpeg's easing isn't sufficient, we can upgrade to Remotion for:
- Custom bezier curves (any CSS timing function)
- Spring physics animations
- Frame-by-frame control
- React-like composition

```typescript
// Remotion example (future enhancement)
import { interpolate, Easing } from 'remotion';

const opacity = interpolate(
  frame,
  [0, 30],
  [0, 1],
  {
    easing: Easing.bezier(0.19, 1, 0.22, 1)  // "luxurious" preset
  }
);
```

---

## Summary

### Current Implementation
- **Tool**: FFmpeg 8.x with xfade filter + custom expressions
- **Transition**: `fade` (crossfade)
- **Easing**: `smooth` (smoothstep function)
- **Duration**: 1.2 seconds overlap
- **Clips**: 6 keyframe videos from Kling 2.6

### Recommended Command
```bash
npx tsx stitch-videos.ts \
  --clips video-1.mp4 --clips video-2.mp4 ... \
  --output final.mp4 \
  --transition fade \
  --easing smooth \
  --transition-duration 1.2
```

### Workflow
```
1. Generate 6 keyframes (nano-banana) → contact sheet
2. Extract individual frames
3. Generate 6 video clips (Kling 2.6)
4. Stitch with FFmpeg xfade transitions + smooth easing
5. Output final video
```

### Future Enhancements
- Add Remotion for true cubic-bezier curves
- Fix fadeblack/fadewhite YUV color handling
- Support for speed ramping
- Audio track handling
