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

### FFmpeg Easing Options

FFmpeg's `xfade` filter supports these easing curves:

| Easing | Effect |
|--------|--------|
| `linear` | Constant rate (default) |
| `quadratic` | Slow start, accelerates |
| `cubic` | More pronounced acceleration |
| `squareroot` | Fast start, decelerates |
| `circular` | Circular easing |

---

## Implementation Approach

### Option 1: Simple Crossfade with Easing (Recommended for MVP)

```bash
# Basic fade transition with cubic easing
ffmpeg -i clip1.mp4 -i clip2.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.5:easing=cubic[v]" \
  -map "[v]" output.mp4
```

Parameters:
- `transition=fade` - Type of transition
- `duration=0.5` - Transition lasts 0.5 seconds
- `offset=4.5` - Start transition at 4.5s (assuming 5s clips)
- `easing=cubic` - Apply cubic easing

### Option 2: Multiple Clips with Chained xfade

```bash
# Stitch 6 clips with transitions
ffmpeg \
  -i clip1.mp4 -i clip2.mp4 -i clip3.mp4 \
  -i clip4.mp4 -i clip5.mp4 -i clip6.mp4 \
  -filter_complex "
    [0:v][1:v]xfade=transition=fade:duration=0.5:offset=4.5:easing=cubic[v1];
    [v1][2:v]xfade=transition=fade:duration=0.5:offset=9.0:easing=cubic[v2];
    [v2][3:v]xfade=transition=fade:duration=0.5:offset=13.5:easing=cubic[v3];
    [v3][4:v]xfade=transition=fade:duration=0.5:offset=18.0:easing=cubic[v4];
    [v4][5:v]xfade=transition=fade:duration=0.5:offset=22.5:easing=cubic[v5]
  " \
  -map "[v5]" final_output.mp4
```

### Option 3: Speed Ramping for "Voluptuous" Feel

For more dramatic easing, apply speed ramping at clip boundaries:

```bash
# Slow down end of clip (ease-out feel)
ffmpeg -i clip.mp4 \
  -filter:v "setpts=
    if(gte(T,4),
      PTS + (T-4)*0.5,
      PTS
    )" \
  -an clip_eased.mp4
```

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

### MVP Approach
- **Tool**: FFmpeg with xfade filter
- **Transition**: `fade` with `cubic` easing
- **Duration**: 0.5 seconds overlap
- **Clips**: 6 keyframe videos from Kling 2.6

### Workflow
```
1. Generate 6 keyframes (nano-banana) → contact sheet
2. Extract individual frames
3. Generate 6 video clips (Kling 2.6)
4. Stitch with FFmpeg xfade transitions
5. Output final video
```

### Future Enhancements
- Add Remotion for custom bezier curves
- Support for speed ramping
- User-selectable easing presets
- Audio track handling
