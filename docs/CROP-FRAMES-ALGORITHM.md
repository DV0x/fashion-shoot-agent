# Crop Frames Algorithm

## Overview

The `crop-frames.ts` script extracts individual frames from AI-generated contact sheets (grid images). It uses **adaptive variance-based gutter detection** to find the boundaries between cells, ensuring clean crops without gutter artifacts.

```
Input: 2×3 Contact Sheet (2528×1696)
Output: 6 individual frames (~806×807 each)
```

---

## The Problem

AI-generated contact sheets have **non-uniform layouts**:
- Gutter widths vary between cells
- Cell sizes aren't perfectly equal
- Margins around the grid are inconsistent
- Gutter colors can be white, black, gray, or any solid color

Traditional grid cropping assumes uniform spacing:
```
x = offset + col * (cellWidth + gutterWidth)
```

This fails on AI-generated images because the spacing isn't uniform.

---

## Why Variance-Based Detection?

### Failed Approach: Edge Detection

We initially used Canny edge detection to find gutters:

```
Contact Sheet → Canny Edges → Projection Profile → Find Peaks → Crop
```

**Problem:** Edge detection finds **transition points** (where content meets gutter), not gutter centers. When we treated these peaks as gutter centers, crops started *inside* the gutter:

```
Actual gutter:     |████████████████|  (x=832 to x=853)
Detected peak:     ↑ x=824 (transition point, NOT center)
Calculated crop:   ────────────┤ x=803 (24px too early!)
Result:            White border bleeding into cropped frame
```

### Solution: Variance-Based Detection

Instead of detecting edges, we detect **uniform regions** directly:

```
Contact Sheet → Grayscale → Variance Profile → Find Uniform Regions → Crop
```

**Key insight:** Gutters are solid-color regions with **near-zero variance** across their entire span. Content has high variance (textures, colors, details).

| Region Type | Variance |
|-------------|----------|
| True gutter (solid color) | ~0-5 |
| Photo content | ~1000-7000 |

---

## Algorithm Step-by-Step

### Step 1: Load Image and Convert to Grayscale

```typescript
const gray = new cv.Mat();
cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
```

### Step 2: Calculate Variance Profile

For each position along an axis, we measure how uniform the pixels are across the perpendicular axis.

**Sampling strategy:** 17 sample lines from 10% to 90% of the perpendicular axis (every 5%):

```
Image Height
    │
 10%├──────●──────  Sample line 1
 15%├──────●──────  Sample line 2
 20%├──────●──────  Sample line 3
    │      ⋮
 85%├──────●──────  Sample line 16
 90%├──────●──────  Sample line 17
    │
    └──────┴────── Position X
           │
           For each X, collect pixels from all 17 sample lines
           and calculate variance
```

**Why 17 lines?** A true gutter must be uniform across the ENTIRE height/width of the image. By sampling many lines, we filter out false positives (uniform areas within photos like white shirts or backgrounds).

```typescript
for (let pct = 10; pct <= 90; pct += 5) {
  sampleLines.push(Math.floor(perpSize * (pct / 100)));
}

for (let i = 0; i < size; i++) {
  const values = sampleLines.map(pos => gray.ucharAt(pos, i));
  varianceProfile[i] = calculateVariance(values);
}
```

### Step 3: Adaptive Threshold Calculation

The threshold separates "uniform" (gutter) from "varied" (content).

**Strategy:** True gutters cluster at the very bottom of the variance distribution (1st percentile).

```typescript
const sorted = [...variances].sort((a, b) => a - b);
const p1Value = sorted[Math.floor(sorted.length * 0.01)];  // 1st percentile

// Threshold = P1 × 10, clamped to [50, 300]
const threshold = Math.max(50, Math.min(300, p1Value * 10));
```

**Example from real contact sheet:**
```
Variance range: 0.2 - 6993.0
P1 (1st percentile): 0.9
Calculated threshold: 9.1 → clamped to 50
```

**Why these bounds?**
- Minimum 50: Prevents noise from triggering false gutters
- Maximum 300: Conservative upper limit ensures only true uniform regions match

### Step 4: Find Uniform Regions

Scan the variance profile and find continuous regions below threshold:

```typescript
for (let i = 0; i < size; i++) {
  const isUniform = varianceProfile[i] < threshold;

  if (isUniform && !inUniform) {
    // Start of uniform region
    uniformStart = i;
    inUniform = true;
  } else if (!isUniform && inUniform) {
    // End of uniform region
    regions.push({
      start: uniformStart,
      end: i - 1,
      width: i - uniformStart,
      center: Math.round((uniformStart + i - 1) / 2)
    });
    inUniform = false;
  }
}
```

**Output example:**
```
Found 4 vertical uniform regions:
  x=0-8 (width=9, center=4)      ← Left margin
  x=825-855 (width=31, center=840)   ← Gutter 1
  x=1672-1702 (width=31, center=1687) ← Gutter 2
  x=2520-2527 (width=8, center=2524)  ← Right margin
```

### Step 5: Filter Internal Gutters

Separate edge margins from internal gutters:

```typescript
const edgeThreshold = totalSize * 0.05;  // 5% of image size

const internalGutters = regions.filter(r =>
  r.start > edgeThreshold && r.end < totalSize - edgeThreshold
);
```

If more gutters found than expected, select the most evenly spaced ones.

### Step 6: Determine Content Boundaries

Find where actual content starts/ends (after/before margins):

```typescript
const contentLeft = leftMargin ? leftMargin.end + 1 : 0;
const contentRight = rightMargin ? rightMargin.start - 1 : width - 1;
const contentTop = topMargin ? topMargin.end + 1 : 0;
const contentBottom = bottomMargin ? bottomMargin.start - 1 : height - 1;
```

### Step 7: Calculate Cell Boundaries

Using actual gutter start/end positions (not centers!):

```typescript
// Adaptive safety margin: 15% of gutter width, min 3px
const safetyMargin = Math.max(3, Math.round(avgGutterWidth * 0.15));

for (let col = 0; col < expectedCols; col++) {
  if (col === 0) {
    start = contentLeft + safetyMargin;
  } else {
    start = gutters[col - 1].end + 1 + safetyMargin;
  }

  if (col === expectedCols - 1) {
    end = contentRight - safetyMargin;
  } else {
    end = gutters[col].start - 1 - safetyMargin;
  }
}
```

**Visual representation:**
```
│ Margin │  Cell 0  │ Gutter │  Cell 1  │ Gutter │  Cell 2  │ Margin │
│        │←───────→│        │←───────→│        │←───────→│        │
         ↑         ↑        ↑         ↑        ↑         ↑
     contentLeft   │    gutter[0]     │    gutter[1]     contentRight
                   │   start  end     │   start  end
                   │                  │
              Cell 0 ends at      Cell 1 ends at
           gutter[0].start - margin  gutter[1].start - margin
```

### Step 8: Crop Frames

Use Sharp to extract each cell:

```typescript
await sharp(imagePath)
  .extract({ left: cell.x, top: cell.y, width: cell.width, height: cell.height })
  .toFile(outputPath);
```

---

## Adaptive Parameters

All thresholds adapt to each image:

| Parameter | Formula | Purpose |
|-----------|---------|---------|
| `varianceThreshold` | P1 × 10, clamped [50, 300] | Separate uniform from varied |
| `minGutterWidth` | 1% of cell size, min 3px | Filter noise |
| `safetyMarginX` | 15% of vertical gutter width | Buffer from gutter edges |
| `safetyMarginY` | 15% of horizontal gutter width | Buffer from gutter edges |

---

## Why This Works for Any AI-Generated Contact Sheet

1. **Color agnostic:** Variance measures uniformity, not brightness. Works for white, black, gray, or colored gutters.

2. **Adapts to noise levels:** P1 percentile threshold adjusts based on each image's variance distribution.

3. **Handles non-uniform grids:** Uses actual gutter boundaries instead of assuming uniform cell sizes.

4. **Robust sampling:** 17 sample lines across perpendicular axis ensure only true full-span gutters are detected.

5. **No AI tokens:** Pure mathematical approach with zero API calls.

---

## Example Output

```
Input: contact-sheet.png (2528×1696)
Grid: 2 rows × 3 columns

Detected vertical gutters:
  x=825-855 (width=31px)
  x=1672-1702 (width=31px)

Detected horizontal gutter:
  y=834-861 (height=28px)

Output frames:
  Frame 1: (14, 23) 806×807
  Frame 2: (861, 23) 806×807
  Frame 3: (1708, 23) 807×807
  Frame 4: (14, 866) 806×809
  Frame 5: (861, 866) 806×809
  Frame 6: (1708, 866) 807×809
```

---

## Usage

```bash
npx tsx crop-frames.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/ \
  --rows 2 \
  --cols 3
```

**Options:**
- `--input` - Path to contact sheet image
- `--output-dir` - Directory for cropped frames
- `--rows` - Number of rows in grid
- `--cols` - Number of columns in grid
- `--format` - Output format: png, jpeg, webp (default: png)
- `--prefix` - Output filename prefix (default: frame)

---

## Troubleshooting

### Too many gutters detected
- Cause: Threshold too high, detecting uniform areas in photos
- Solution: Lower the `maxThreshold` constant (currently 300)

### Gutters not detected
- Cause: Gutters have gradient or texture (not perfectly uniform)
- Solution: Increase `maxThreshold` or reduce sample line count

### Crops still have gutter edges
- Cause: Safety margin too small
- Solution: Increase the margin multiplier (currently 0.15 = 15%)

### Wrong gutters selected
- Cause: More uniform regions than expected
- Solution: Algorithm selects most evenly spaced; verify grid dimensions are correct
