# Grid Cropping System

## What It Does

Takes a contact sheet (6 photos arranged in a grid) and extracts each photo as a separate file.

```
INPUT                                    OUTPUT
┌─────────┬─────────┬─────────┐
│    1    │    2    │    3    │          frame-1.png
├─────────┼─────────┼─────────┤    →     frame-2.png
│    4    │    5    │    6    │          frame-3.png
└─────────┴─────────┴─────────┘          frame-4.png
     contact-sheet.png                   frame-5.png
                                         frame-6.png
```

---

## Key Terms

| Term | What It Means |
|------|---------------|
| **Contact Sheet** | A single image containing multiple photos arranged in a grid |
| **Gutter** | The gap/space between photos in the grid |
| **Margin** | The space around the outer edge of the grid |
| **Projection Profile** | A graph showing the sum of pixel values along a row or column |
| **Peak** | A high point in the profile graph (indicates a gutter line) |
| **Canny Edge Detection** | An algorithm that finds boundaries/outlines in an image |
| **Contour** | The outline/boundary of an object in an image |

---

## The Problem

Contact sheets have **gutters** (gaps between photos). We need to:
1. Find where the gutters are
2. Skip them when cropping
3. Extract only the photo content

```
┌──────────────────────────────────────────┐
│ margin                                   │
│   ┌──────┐  gutter  ┌──────┐  gutter  ┌──────┐
│   │photo1│◄───────►│photo2│◄───────►│photo3│
│   └──────┘          └──────┘          └──────┘
│        gutter (vertical gap)
│   ┌──────┐          ┌──────┐          ┌──────┐
│   │photo4│          │photo5│          │photo6│
│   └──────┘          └──────┘          └──────┘
└──────────────────────────────────────────┘
```

---

## Three Approaches

| Approach | Script | How It Works | Limitation |
|----------|--------|--------------|------------|
| **Fixed Grid** | `crop-frames.ts` | You manually specify gutter size | Breaks if gutter size changes |
| **Contour Detection** | `grid-detect-opencv.ts` | Finds outline of each photo | Output sizes vary |
| **Hybrid** | `grid-detect-hybrid.ts` | Auto-detects gutters, uniform output | **Recommended** |

---

## How Hybrid Works

### Step 1: Load Image

```
Tools: Sharp (image processing library)

Read the contact sheet and convert it to a format OpenCV can work with.
- Input: PNG/JPG file
- Output: Raw pixel data (RGBA = Red, Green, Blue, Alpha channels)
```

### Step 2: Convert to Grayscale

```
Tool: cv.cvtColor()

Why? Color information isn't needed for finding grid lines.
     Grayscale is faster to process.

Before: Each pixel has 4 values (R, G, B, A)
After:  Each pixel has 1 value (brightness 0-255)
```

### Step 3: Apply Gaussian Blur

```
Tool: cv.GaussianBlur()

Why? Removes small noise/details that would create false edges.
     "Gaussian" means it uses a bell-curve weighted average.

Before: Sharp image with tiny details
After:  Slightly smoothed image
```

### Step 4: Canny Edge Detection

```
Tool: cv.Canny()

What it does: Finds boundaries where brightness changes sharply.
              Gutter lines (borders between photos) become white lines.
              Everything else becomes black.

Before (grayscale):        After (edges only):
┌────────────────┐         ┌────────────────┐
│  ██  photo  ██ │         │  │          │  │
│  ██        ██  │    →    │  │          │  │
│  ██████████████│         │  └──────────┘  │
└────────────────┘         └────────────────┘
```

### Step 5: Create Projection Profiles

```
What is a Projection Profile?
- Sum all pixel values along each column → Vertical Profile
- Sum all pixel values along each row → Horizontal Profile

Why it works:
- Gutter lines run vertically through the image
- When you sum a column that has a gutter line, you get a HIGH value
  (lots of white edge pixels stacked up)
- Columns without gutter lines have LOW values

Visual:
                    Column with         Column without
                    gutter line         gutter line
                        ↓                   ↓
Edge image:         ┌───┼───┐           ┌───────┐
                    │   │   │           │       │
                    │   │   │           │       │
                    │   │   │           │       │
                    └───┼───┘           └───────┘
                        │                   │
Sum of column:        HIGH                 LOW
                        ↓                   ↓
Profile:            ___███___           _________
```

### Step 6: Find Peaks

```
What is a Peak?
- A high point in the profile
- Represents a gutter line position

For a 2×3 grid, we expect:
- 4 vertical peaks: left margin, 2 gutters, right margin
- 3 horizontal peaks: top margin, 1 gutter, bottom margin

Profile visualization:

Value
  ↑
  │      peak         peak         peak         peak
  │       ↓            ↓            ↓            ↓
  │       █            █            █            █
  │      ███          ███          ███          ███
  │_____█████________█████________█████________█████_____
  └──────────────────────────────────────────────────────→ Position
         48          873         1655         2479
         ↑            ↑            ↑            ↑
     left edge    gutter 1     gutter 2    right edge
```

### Step 7: Classify Peaks

```
Peaks near the edges (< 5% from border) = Margins
Peaks in the middle = Gutters between photos

Example (image width = 2528px):
- 5% threshold = 126px
- Peak at 48 → less than 126 → LEFT MARGIN
- Peak at 873 → between 126 and 2402 → GUTTER
- Peak at 1655 → between 126 and 2402 → GUTTER
- Peak at 2479 → greater than 2402 → RIGHT MARGIN
```

### Step 8: Calculate Grid Parameters

```
From the detected peaks, we calculate:

1. Content Area
   - Left edge to right edge = total content width
   - Top edge to bottom edge = total content height

2. Gutter Size
   - Compare expected cell width vs actual spacing
   - The difference tells us the gutter width

3. Cell Size
   Formula: cellWidth = (contentWidth - gutterWidth × (cols-1)) / cols

Example:
   Content width = 2431px
   Gutter width = 96px
   Columns = 3

   Cell width = (2431 - 96 × 2) / 3 = 746px
```

### Step 9: Crop Each Cell

```
Tool: Sharp .extract()

Using uniform cell dimensions, crop each photo:

Position formula:
  x = margin + column × (cellWidth + gutterWidth)
  y = margin + row × (cellHeight + gutterHeight)

Grid positions:
  ┌─────────────────────────────────────────────────────┐
  │                                                     │
  │  (48,67)      (890,67)      (1732,67)              │
  │     ↓            ↓             ↓                   │
  │  ┌──────┐    ┌──────┐     ┌──────┐                │
  │  │  1   │    │  2   │     │  3   │   Row 0        │
  │  └──────┘    └──────┘     └──────┘                │
  │                                                     │
  │  ┌──────┐    ┌──────┐     ┌──────┐                │
  │  │  4   │    │  5   │     │  6   │   Row 1        │
  │  └──────┘    └──────┘     └──────┘                │
  │  (48,915)    (890,915)    (1732,915)              │
  │                                                     │
  └─────────────────────────────────────────────────────┘
```

---

## Complete Pipeline Diagram

```
┌──────────────┐
│ contact-     │
│ sheet.png    │
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Read image file
│ Load Image   │     Tool: Sharp
│ (Sharp)      │     Output: Raw RGBA pixel data
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Remove color information
│ Grayscale    │     Tool: cv.cvtColor()
│              │     Output: Single-channel image (0-255)
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Smooth out noise
│ Gaussian     │     Tool: cv.GaussianBlur()
│ Blur         │     Output: Slightly blurred image
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Find boundaries/outlines
│ Canny Edge   │     Tool: cv.Canny()
│ Detection    │     Output: White lines on black background
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Sum pixels along rows/columns
│ Projection   │     Output: Two 1D arrays (vertical & horizontal)
│ Profiles     │     High values = gutter line positions
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Find local maxima in profiles
│ Find Peaks   │     Output: List of x and y positions
│              │     These are potential gutter locations
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Separate margins from internal gutters
│ Classify     │     Rule: < 5% from edge = margin
│ Peaks        │           > 5% from edge = gutter
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Compute cell dimensions
│ Calculate    │     Formula: (content - gutters) / cells
│ Grid Params  │     Output: cellWidth, cellHeight, gutterX, gutterY
└──────┬───────┘
       │
       ▼
┌──────────────┐     What: Extract each cell from the image
│ Crop Cells   │     Tool: Sharp .extract()
│ (Sharp)      │     Output: 6 uniform PNG files
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ frame-1.png  │
│ frame-2.png  │
│ frame-3.png  │
│ frame-4.png  │
│ frame-5.png  │
│ frame-6.png  │
└──────────────┘
```

---

## Example Run

```bash
$ npx tsx grid-detect-hybrid.ts \
    --input contact-sheet.png \
    --output-dir frames/

Output:
  Image size: 2528×1696

  Detected peaks:
    Vertical: 48, 873, 1655, 2479
    Horizontal: 67, 870, 1629

  Classified:
    Left margin: 48
    Right margin: 2479
    Vertical gutters: 873, 1655
    Horizontal gutter: 870

  Calculated grid:
    Cell size: 746×714
    Gutter: 96px × 134px
    Offset: 48px, 67px

  Cropped:
    frame-1.png (746×714) at x=48, y=67
    frame-2.png (746×714) at x=890, y=67
    frame-3.png (746×714) at x=1732, y=67
    frame-4.png (746×714) at x=48, y=915
    frame-5.png (746×714) at x=890, y=915
    frame-6.png (746×714) at x=1732, y=915
```

---

## Usage

```bash
# Default 2×3 grid
npx tsx grid-detect-hybrid.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/

# Custom grid size (e.g., 3×4)
npx tsx grid-detect-hybrid.ts \
  --input outputs/contact-sheet.png \
  --output-dir outputs/frames/ \
  --rows 3 \
  --cols 4
```

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@techstark/opencv-js` | Computer vision (edge detection, image processing) |
| `sharp` | Fast image loading and cropping |

---

## Why Hybrid is Best

| Feature | Fixed Grid | Contour | Hybrid |
|---------|------------|---------|--------|
| Auto-detect gutters | No | Yes | Yes |
| Uniform output size | Yes | No | Yes |
| Works with any contact sheet | No | Partially | Yes |
| Handles margins | Manual | Sometimes | Yes |
