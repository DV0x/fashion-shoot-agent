# Session Summary: Speed Curves Refactor & Frame Normalization

**Date:** 2026-01-07
**Focus:** Code deduplication, architecture improvements, frame normalization

---

## Overview

This session focused on two major improvements:

1. **Refactored speed curves scripts** - Extracted shared code into reusable libraries
2. **Added frame normalization** - Frames are now automatically normalized to uniform dimensions after cropping

---

## 1. Speed Curves Code Refactoring

### Problem

Three scripts had significant code duplication:

| Function | Copies Before |
|----------|---------------|
| `getVideoMetadata()` | 3 |
| `calculateSourceTimestamps()` | 2 |
| `encodeFramesToVideo()` | 2 |
| `extractFramesAtTimestamps()` | 2 |
| `VideoMetadata` interface | 3 |
| Scale filter logic | 2 |

### Solution

Created two new shared libraries in `scripts/lib/`:

#### `lib/video-utils.ts` (289 lines)

Shared video utilities:

```typescript
// Exported functions
export function getVideoMetadata(videoPath: string): VideoMetadata
export function buildScaleFilter(width: number, height: number, padColor?: string): string
export function buildSimpleScaleFilter(width: number, height: number): string
export function encodeFramesToVideo(options: EncodeOptions): void
export function extractFrameAtTimestamp(options: ExtractFrameOptions): void
export function extractFramesAtTimestamps(options: ExtractFramesBatchOptions): Promise<number>
export function findMaxDimensions(metadataList: VideoMetadata[]): { maxWidth, maxHeight }

// Exported types
export interface VideoMetadata { duration, width, height, fps }
export interface EncodeOptions { inputPattern, outputPath, fps, bitrate, preset?, crf? }
export interface ExtractFrameOptions { inputPath, outputPath, timestamp, width, height, scaleWithPadding? }
export interface ExtractFramesBatchOptions { inputPath, tempDir, timestamps, width, height, frameOffset?, scaleWithPadding?, onProgress? }
```

#### `lib/timestamp-calc.ts` (182 lines)

Core speed curve algorithm:

```typescript
// Exported functions
export function calculateSourceTimestamps(options: TimestampCalculationOptions): TimestampCalculationResult
export function calculateTimestamps(easingFunc, inputDuration, outputDuration, outputFps): number[]
export function analyzeSpeedProfile(timestamps, outputFps): SpeedAnalysis
export function getSampleTimestamps(timestamps): Array<{ progress, timestamp }>

// Exported types
export interface TimestampCalculationOptions { easingFunc, inputDuration, outputDuration, outputFps }
export interface TimestampCalculationResult { timestamps, totalFrames, compressionRatio }
```

### Updated Scripts

| Script | Before | After | Change |
|--------|--------|-------|--------|
| `apply-speed-curve.ts` | 456 lines | 317 lines | **-30%** |
| `stitch-videos-eased.ts` | 432 lines | 321 lines | **-26%** |
| `stitch-videos.ts` | 511 lines | 576 lines | +13% (added imports) |

### New File Structure

```
scripts/
├── lib/
│   ├── easing-functions.ts    # 416 lines (unchanged)
│   ├── video-utils.ts         # 289 lines (NEW)
│   └── timestamp-calc.ts      # 182 lines (NEW)
├── apply-speed-curve.ts       # 317 lines (refactored)
├── stitch-videos-eased.ts     # 321 lines (refactored)
└── stitch-videos.ts           # 576 lines (refactored)
```

### Benefits

1. **Single source of truth** - Bug fixes apply everywhere
2. **Better testability** - Isolated pure functions
3. **Clearer architecture** - Separation of concerns
4. **Reusable** - New scripts can import from lib/

---

## 2. Frame Normalization in crop-frames.ts

### Problem

After cropping a contact sheet, frames had slightly different dimensions due to AI-generated grid inconsistencies:

```
frame-1.png: 760×726
frame-2.png: 762×726
frame-3.png: 761×726
frame-4.png: 760×769
frame-5.png: 762×769
frame-6.png: 761×769
```

This caused:
- Auto-scaling during video stitching (quality loss)
- Potential black bars in final video
- Inconsistent FAL.ai inputs

### Solution

Added automatic normalization step after cropping:

```typescript
// New function in crop-frames.ts
async function normalizeFrames(
  results: CropResult[],
  outputFormat: "png" | "jpeg" | "webp"
): Promise<NormalizedDimensions>
```

### How It Works

```
Contact Sheet
     │
     ▼
┌─────────────────────────────────────┐
│  crop-frames.ts                     │
│                                     │
│  1. Detect grid gutters             │
│  2. Crop 6 cells (varying sizes)    │
│  3. Find max(width), max(height)    │
│  4. Normalize all to max dims  ← NEW│
│  5. Output uniform frames           │
└─────────────────────────────────────┘
     │
     ▼
Uniform Frames (762×769)
```

### New CLI Flag

```bash
# Default: normalization ON
npx tsx crop-frames.ts -i contact-sheet.png -o frames/

# Skip normalization (keep varying sizes)
npx tsx crop-frames.ts -i contact-sheet.png -o frames/ --no-normalize
```

### Updated JSON Output

```json
{
  "success": true,
  "framesCount": 6,
  "normalized": true,
  "normalizedDimensions": {
    "width": 762,
    "height": 769
  },
  "grid": { ... },
  "frames": [ ... ]
}
```

### Result

All frames now have uniform dimensions:

```
frame-1.png: 762×769
frame-2.png: 762×769
frame-3.png: 762×769
frame-4.png: 762×769
frame-5.png: 762×769
frame-6.png: 762×769
```

---

## Pipeline Flow (Updated)

```
┌─────────────────┐
│  Contact Sheet  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  crop-frames.ts                             │
│  • Detect grid                              │
│  • Crop frames                              │
│  • Normalize to uniform size (762×769)  NEW │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  6 Uniform      │
│  Frames         │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  generate-video.ts (FAL.ai Kling)           │
│  • Consistent input dimensions              │
│  • Predictable output                       │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  6 Video Clips  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────────────┐
│  stitch-videos-eased.ts                     │
│  • Uses shared lib/video-utils.ts       NEW │
│  • Uses shared lib/timestamp-calc.ts    NEW │
│  • No scaling needed (frames uniform)   NEW │
└────────┬────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  Final Video    │
│  (9s, 60fps)    │
└─────────────────┘
```

---

## Files Changed

### New Files
- `scripts/lib/video-utils.ts` - Shared video utilities
- `scripts/lib/timestamp-calc.ts` - Timestamp calculation algorithm

### Modified Files
- `scripts/apply-speed-curve.ts` - Refactored to use shared libs
- `scripts/stitch-videos-eased.ts` - Refactored to use shared libs
- `scripts/stitch-videos.ts` - Updated to use shared scale filter
- `scripts/crop-frames.ts` - Added frame normalization

---

## Testing

All scripts tested and working:

```bash
# Speed curve scripts
npx tsx apply-speed-curve.ts --help          # ✓
npx tsx stitch-videos-eased.ts --help        # ✓
npx tsx stitch-videos.ts --help              # ✓
npx tsx apply-speed-curve.ts --list-easings  # ✓

# Frame cropping with normalization
npx tsx crop-frames.ts --help                # ✓
npx tsx crop-frames.ts -i contact-sheet.png -o frames/  # ✓ (normalized)
```

---

## Next Steps

Potential future improvements:

1. **Add unit tests** for shared libraries
2. **Parallel frame extraction** - Process multiple frames concurrently
3. **Progress streaming** - Real-time progress updates via SSE
4. **Configurable padding color** - Allow white/transparent padding in normalization
