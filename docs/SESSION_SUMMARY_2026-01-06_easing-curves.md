# Session Summary: Easing Curves & Video Stitching Deep Dive

**Date:** 2026-01-06
**Project:** `/Users/chakra/Documents/Agents/fashion-shoot-agent`
**Goal:** Understand easing curves and implement seamless video stitching like easy-peasy-ease

---

## Table of Contents

1. [Learning Journey](#learning-journey)
2. [Key Concepts Learned](#key-concepts-learned)
3. [easy-peasy-ease Analysis](#easy-peasy-ease-analysis)
4. [The Core Problem & Solution](#the-core-problem--solution)
5. [FFmpeg vs MediaBunny Research](#ffmpeg-vs-mediabunny-research)
6. [Current Project State](#current-project-state)
7. [Next Steps](#next-steps)
8. [Resources](#resources)

---

## Learning Journey

### Starting Point
User was completely new to cinematography math, easing curves, and video processing concepts. Started from absolute basics.

### Topics Covered (in order)
1. What is easing and why it matters
2. The coordinate system (time vs progress)
3. Types of easing (ease-in, ease-out, ease-in-out)
4. The math behind easing functions
5. Custom curves with Cubic Bezier
6. Transitions vs Easing (key distinction!)
7. easy-peasy-ease implementation analysis
8. FFmpeg limitations for speed curves
9. MediaBunny advantages

---

## Key Concepts Learned

### 1. What is Easing?

Easing makes motion feel natural by varying speed over time.

```
LINEAR (robotic):        EASED (natural):
Start -----> End         Start ~~---====--~~> End
(constant speed)         (slow, fast, slow)
```

**Real-life analogy:** When you reach for a coffee cup:
- Start slow (hand accelerates from rest)
- Speed up in the middle
- Slow down at the end (so you don't knock it over)

### 2. The Coordinate System

```
Output (progress)
  1.0 |            ____●  ← End
      |          /
      |        /
  0.5 |      /
      |    /
      |  /
  0.0 |●___________________  ← Start
      0.0      0.5      1.0
           Input (time)
```

**Key insight:** The SLOPE of the curve = SPEED
- Steep slope = Fast movement
- Flat slope = Slow movement

### 3. Types of Easing

| Type | Behavior | Curve Shape |
|------|----------|-------------|
| ease-in | Slow start, fast end | Flat then steep |
| ease-out | Fast start, slow end | Steep then flat |
| ease-in-out | Slow → fast → slow | Flat-steep-flat |

### 4. The Math (Simplified)

| Easing | Formula | At t=0.5 |
|--------|---------|----------|
| Linear | `t` | 0.500 |
| Quadratic | `t²` | 0.250 |
| Cubic | `t³` | 0.125 |
| Quartic | `t⁴` | 0.062 |
| Exponential | `2^(10t-10)` | 0.001 |

Higher powers = more dramatic easing

### 5. Cubic Bezier (Custom Curves)

```
cubic-bezier(x1, y1, x2, y2)
             ↑    ↑   ↑    ↑
           Handle 1   Handle 2
```

**The "Bendy Wire" Analogy:**
- Start point fixed at (0,0)
- End point fixed at (1,1)
- Two handles act like "magnets" pulling the wire

**Control Rules:**
| Want This? | Do This |
|------------|---------|
| Slow start | Move Handle 1 right (increase x1) |
| Fast start | Move Handle 1 left (decrease x1) |
| Slow end | Move Handle 2 left (decrease x2) |
| Fast end | Move Handle 2 right (increase x2) |

**Famous Presets:**
```
ease-in-out:     (0.42, 0, 0.58, 1)    - Standard
dramatic swoop:  (0.85, 0, 0.15, 1)    - easy-peasy-ease default
```

### 6. Transitions vs Easing (Critical Distinction!)

| Concept | What It Controls | Example |
|---------|------------------|---------|
| **Easing** | HOW FAST change happens | Slow start, fast middle |
| **Transition** | WHAT VISUAL EFFECT | Fade, wipe, dissolve |

**Transition Types:**
- `fade` - Smooth crossfade (both videos blend)
- `fadeblack` - Fade through black
- `fadewhite` - Fade through white
- `wipeleft/right` - Push video off screen
- `circleopen` - Circular reveal
- `dissolve` - Random pixel switching

---

## easy-peasy-ease Analysis

### Repository Location
`/Users/chakra/Documents/Agents/easy-peasy-ease`

### Architecture Overview

**Tech Stack:**
- Next.js 16 + React 19 + TypeScript 5
- MediaBunny (WebCodecs-based video processing)
- Client-side processing (browser)

**Workflow:**
```
Upload video segments → Order and trim → Apply speed curves → Stitch into MP4 → Download
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/easing-functions.ts` | All easing function implementations |
| `lib/easing-presets.ts` | Preset bezier values |
| `lib/speed-curve.ts` | Time warping logic |
| `hooks/useApplySpeedCurve.ts` | Core speed curve application |
| `hooks/useStitchVideos.ts` | Video concatenation |
| `components/CubicBezierEditor.tsx` | Visual curve editor |

### The Core Algorithm (Time Warping)

```typescript
// For each output frame, calculate which source frame to show
for (let outputSlot = 0; outputSlot < totalOutputFrames; outputSlot++) {
  // Normalize to 0-1
  const outputProgress = outputSlot / (totalOutputFrames - 1);

  // Apply easing function (this is the magic!)
  const sourceProgress = easingFunc(outputProgress);

  // Map to source timestamp
  const sourceTime = sourceProgress * inputDuration;

  sourceTimestamps.push(sourceTime);
}

// Use MediaBunny's efficient random-access decoding
const frames = sink.samplesAtTimestamps(sourceTimestamps);
```

### Default Configuration

| Setting | Value | Purpose |
|---------|-------|---------|
| Default easing | `easeInOutSine` | Subtle, works for everything |
| Input duration | 5 seconds | Kling AI video length |
| Output duration | 1.5 seconds | Compressed output per clip |
| Output FPS | 60 | Smooth playback |
| Bitrate | 25 Mbps | High quality |
| Dramatic bezier | `(0.85, 0, 0.15, 1)` | Maximum "swoop" effect |

### Key Insight: NO Visual Transitions!

easy-peasy-ease does NOT use fade/wipe transitions. It uses **hard cuts**.

The seamless feel comes from **speed manipulation**:
```
Video 1: [FAST════════════════SLOW]
                                 │ ← Cut happens here (both in slow-mo)
Video 2:                         [SLOW════════════════FAST]
```

**Why it works:**
1. Video 1 slows down → eye "settles"
2. Cut happens while motion is slow → brain doesn't notice
3. Video 2 starts slow → feels like continuation
4. Video 2 speeds up → momentum continues

---

## The Core Problem & Solution

### The Problem

Current project's `stitch-videos.ts` uses FFmpeg xfade transitions:
```
Video A ████████▓▓▓▓▒▒░░  (fading out)
Video B         ░░▒▒▓▓▓▓████████  (fading in)
```

**Result:** Brain sees TWO clips blending. Feels like editing.

### The easy-peasy-ease Solution

Use speed curves with hard cuts:
```
Video A: ═══════════════●  (slowing down)
Video B:                ●═══════════════  (starting slow)
                        ↑
                   HARD CUT
         (but both are in slow-mo here, so it's invisible)
```

**Result:** Brain sees ONE continuous moment.

### Visual Comparison

| Technique | Brain's Perception |
|-----------|-------------------|
| Fade transition | "Two clips merged together" |
| Hard cut (normal speed) | "Jarring switch" |
| Hard cut (speed-curved) | "One continuous moment" |

---

## FFmpeg vs MediaBunny Research

### FFmpeg Capabilities

**What it CAN do:**
- Constant speed changes (`setpts=0.5*PTS` for 2x speed)
- Piecewise segments with different speeds
- Frame interpolation (`minterpolate`)
- Visual transitions (xfade)

**What it CANNOT do natively:**
- Smooth bezier-based easing on speed
- True "slow → fast → slow" in one expression
- Efficient random-access frame selection

### Three FFmpeg Approaches Evaluated

| Approach | How It Works | Pros | Cons |
|----------|--------------|------|------|
| Piecewise segments | Split into 3 parts with different speeds | Simple | "Stepped" feel |
| Mathematical expression | Use N (frame number) in setpts | Continuous | Complex, limited |
| Frame selection | Extract frames at calculated timestamps | Exact control | Complex to implement |

### MediaBunny Advantages

| Aspect | FFmpeg | MediaBunny |
|--------|--------|------------|
| Easing support | Hacky workarounds | Built-in `samplesAtTimestamps()` |
| Frame selection | Extract → process → re-encode | Direct random-access |
| Control | Expression-limited | Full JavaScript/TypeScript |
| Bezier curves | Approximate only | Exact implementation |
| Fit for speed curves | ~40% | ~95% |

### Conclusion

**MediaBunny is the right tool for speed curves.**

It was literally designed for this use case. The `samplesAtTimestamps()` API lets you request exactly which frames you want at calculated timestamps - the core of the easy-peasy-ease magic.

---

## Current Project State

### Existing Files

**Video Stitching Script:**
```
agent/.claude/skills/fashion-shoot-pipeline/scripts/stitch-videos.ts
```
- Uses FFmpeg xfade for visual transitions
- Supports multiple easing types on transitions
- Produces "two clips blending" feel (not the easy-peasy-ease feel)

**Available Easing in Current Script:**
- linear, quadratic-in/out, cubic-in/out, quartic-in/out
- quintic-in/out, sinusoidal-in/out
- luxurious, cinematic, smooth

**Available Transitions:**
- fade, fadeblack, fadewhite
- wipeleft, wiperight, wipeup, wipedown
- slideleft, slideright
- circlecrop, circleopen, circleclose
- dissolve

### Test Videos Available

```
agent/outputs/videos/
├── video-1.mp4  (5.04s, 1428×1448, 24fps, ~9.5MB)
├── video-2.mp4  (5.04s, 1428×1448, 24fps, ~9.5MB)
├── video-3.mp4  (5.04s, 1428×1448, 24fps, ~10.3MB)
├── video-4.mp4  (5.04s, 1428×1448, 24fps, ~9.9MB)
├── video-5.mp4  (5.04s, 1428×1448, 24fps, ~11.2MB)
└── video-6.mp4  (5.04s, 1428×1448, 24fps, ~19.3MB)
```

These are perfect for testing - they match the 5-second Kling AI format.

### Documentation

- `docs/EASING_CURVES.md` - Easing theory and FFmpeg implementation
- `docs/mediabunny.md` - MediaBunny library documentation

---

## Next Steps

### Option A: Implement MediaBunny Speed Curves (Recommended)

1. **Set up MediaBunny** in the project (npm install mediabunny)
2. **Create easing functions** - port from easy-peasy-ease or implement bezier
3. **Implement frame selection** using `samplesAtTimestamps()`
4. **Concatenate with hard cuts** (no visual transitions)
5. **Test and compare** with current fade-based approach

**Expected Result:** Seamless "one continuous video" feel

### Option B: FFmpeg Approximation (Quick MVP)

1. Use piecewise speed segments (slow-fast-slow)
2. Accept "stepped" transitions as good enough
3. Upgrade to MediaBunny later if needed

**Expected Result:** Better than current, but not as smooth as easy-peasy-ease

### Option C: Hybrid Approach

1. Keep FFmpeg for basic stitching operations
2. Add MediaBunny specifically for speed curve processing
3. Best of both worlds - reliability + precision

---

## Resources

### Interactive Tools
- [easings.net](https://easings.net/) - Visual easing function reference
- [cubic-bezier.com](https://cubic-bezier.com/) - Custom curve creator/tester
- [GSAP Easing Visualizer](https://gsap.com/resources/getting-started/Easing/)

### Documentation
- [xfade-easing](https://github.com/scriptituk/xfade-easing) - FFmpeg easing expressions
- [FFmpeg setpts filter](https://ffmpeg.org/ffmpeg-all.html#setpts_002c-asetpts)
- [MediaBunny GitHub](https://github.com/AlteredVector/mediabunny)

### Reference Implementation
- `/Users/chakra/Documents/Agents/easy-peasy-ease` - The gold standard for speed curves

---

## Quick Reference: The "Dramatic Swoop" Settings

To recreate the easy-peasy-ease cinematic feel:

```typescript
// Bezier curve for extreme slow-fast-slow
const dramaticSwoop = [0.85, 0, 0.15, 1];

// Timing
const inputDuration = 5.0;   // seconds (Kling AI default)
const outputDuration = 1.5;  // seconds (compressed)
const outputFps = 60;        // smooth playback

// What happens:
// - First 30% of output: Shows ~5% of source (extreme slow-mo)
// - Middle 40% of output: Shows ~90% of source (fast)
// - Last 30% of output: Shows ~5% of source (extreme slow-mo)
```

---

## To Continue Next Session

Start with one of these prompts:

1. **"Let's implement MediaBunny-based speed curves for seamless stitching"**
2. **"Let's try the FFmpeg piecewise approximation first as MVP"**
3. **"Show me how easy-peasy-ease handles [specific feature]"**

The groundwork is laid - ready to build!
