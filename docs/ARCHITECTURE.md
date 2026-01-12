# Fashion Shoot Agent - Architecture

## Overview

AI-powered fashion photoshoot generator built on the **Claude Agent SDK**. Transforms reference images into editorial photography and video content through a multi-stage pipeline with checkpoint-based user control.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (:5173)                                    │
│                      React 19 + Tailwind CSS 4 + Framer Motion                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  ChatInput   │  │  ChatView    │  │  Checkpoint  │  │  ImageGrid/Video     │ │
│  │  + Upload    │  │  + Thinking  │  │  Messages    │  │  Components          │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
│         │                 │                 │                     │             │
│         └─────────────────┴─────────────────┴─────────────────────┘             │
│                                      │                                           │
│                    useStreamingGenerate (SSE consumer)                           │
└──────────────────────────────────────┼───────────────────────────────────────────┘
                                       │ POST /api/generate-stream
                                       │ POST /api/sessions/:id/continue-stream
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXPRESS SERVER (:3002)                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ /generate-stream  /continue-stream  /upload  /health  /sessions  /outputs │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│           │                    │                    │                           │
│  ┌────────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐                   │
│  │    AIClient     │  │ SessionManager │  │ SDKInstrumentor│                   │
│  │  + PostToolUse  │  │  (persistence) │  │ (cost tracking)│                   │
│  │    Hooks        │  │                │  │                │                   │
│  └────────┬────────┘  └───────┬────────┘  └────────────────┘                   │
└───────────┼───────────────────┼─────────────────────────────────────────────────┘
            │                   │
            ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLAUDE AGENT SDK                                       │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │  query() → async generator  │  Session resume/fork  │  Built-in tools   │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
│           │                                                                      │
│           ▼                                                                      │
│  ┌──────────────────────────────────────────────────────────────────────────┐   │
│  │                              SKILLS                                       │   │
│  │  ┌─────────────────────────┐    ┌─────────────────────────────────────┐  │   │
│  │  │ editorial-photography   │    │ fashion-shoot-pipeline              │  │   │
│  │  │ (Knowledge)             │    │ (Action)                            │  │   │
│  │  │ • Prompt templates      │───▶│ • generate-image.ts  (FAL.ai)       │  │   │
│  │  │ • 7 pose presets        │    │ • crop-frames.ts     (OpenCV+Sharp) │  │   │
│  │  │ • 7 background presets  │    │ • generate-video.ts  (FAL.ai Kling) │  │   │
│  │  │ • 6 camera angles       │    │ • stitch-videos-eased.ts (FFmpeg)   │  │   │
│  │  └─────────────────────────┘    └─────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL SERVICES                                     │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  Claude API     │  │  FAL.ai         │  │  Local Processing               │  │
│  │  (Orchestration)│  │  (Image/Video)  │  │  (Sharp + FFmpeg)               │  │
│  └─────────────────┘  └─────────────────┘  └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Runtime** | Node.js + TypeScript (ES2022) |
| **SDK** | `@anthropic-ai/claude-agent-sdk` v0.1.73 |
| **Server** | Express.js 4.x |
| **Frontend** | React 19 + Vite + Tailwind CSS 4 + Framer Motion |
| **Image Gen** | FAL.ai (nano-banana-pro) |
| **Video Gen** | Kling AI direct API (v2.6 Pro) |
| **Video Stitch** | FFmpeg (xfade with easing) |
| **Image Processing** | Sharp + OpenCV.js |

---

## Project Structure

```
fashion-shoot-agent/
├── server/                          # HTTP Server Layer
│   ├── sdk-server.ts               # Express app + SSE streaming endpoints
│   └── lib/
│       ├── ai-client.ts            # SDK wrapper + PostToolUse checkpoint hooks
│       ├── session-manager.ts      # Persistence + pipeline tracking
│       ├── instrumentor.ts         # Cost & metrics tracking
│       └── orchestrator-prompt.ts  # Workflow system prompt
│
├── agent/                           # Agent Configuration
│   ├── .claude/skills/
│   │   ├── editorial-photography/  # Knowledge skill
│   │   │   ├── SKILL.md           # Preset tables + rules
│   │   │   ├── presets/options.md # 7 poses + 7 backgrounds
│   │   │   └── prompts/           # hero.md, contact-sheet.md, video.md
│   │   │
│   │   └── fashion-shoot-pipeline/ # Action skill
│   │       ├── SKILL.md           # Pipeline documentation
│   │       └── scripts/           # Generation scripts
│   │           ├── lib/           # Shared libraries
│   │           │   ├── easing-functions.ts  # Pure math easing
│   │           │   ├── video-utils.ts       # FFmpeg utilities
│   │           │   └── timestamp-calc.ts    # Speed curve algorithm
│   │
│   └── outputs/                    # Generated assets
│       ├── hero.png               # Full-body hero shot
│       ├── contact-sheet.png      # 2×3 grid
│       ├── frames/frame-{1-6}.png # Individual frames
│       ├── videos/video-{1-6}.mp4 # Individual clips
│       └── final/fashion-video.mp4 # Stitched output (H.264 yuv420p)
│
├── frontend/                        # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/              # ChatView, ChatInput, TextMessage,
│   │   │   │                      # ThinkingMessage, ImageMessage, VideoMessage,
│   │   │   │                      # ImageGrid, CheckpointMessage, ProgressMessage
│   │   │   ├── layout/            # AppShell
│   │   │   └── ui/                # Button, IconButton, Spinner
│   │   ├── hooks/
│   │   │   └── useStreamingGenerate.ts  # SSE stream consumer + state management
│   │   └── lib/
│   │       ├── api.ts             # REST API client
│   │       └── types.ts           # TypeScript interfaces
│   ├── vite.config.ts             # Proxy config for /api, /outputs, /uploads
│   └── package.json
│
├── sessions/                        # Persisted session JSON files
└── uploads/                         # User uploaded reference images
```

---

## Pipeline Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ANALYZE   │────▶│    HERO     │────▶│CONTACT SHEET│────▶│   FRAMES    │────▶│   CLIPS     │────▶│   STITCH    │
│  Reference  │     │ CHECKPOINT 1│     │ CHECKPOINT 2│     │ CHECKPOINT 3│     │ CHECKPOINT 4│     │   (auto)    │
│   images    │     │  2K, 3:2    │     │  2K, 3:2    │     │  6 × 1K     │     │  5 × 5sec   │     │   ~20sec    │
└─────────────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └──────┬──────┘     └─────────────┘
                          │                   │                   │                   │
                     [User Review]       [User Review]       [User Review]       [User Review]
                     ├── Modify          ├── Modify          ├── Modify frame    ├── Regenerate clip
                     └── Continue        └── Continue        ├── Resize ratio    ├── Choose speed
                                                             └── Continue        └── Continue
```

**Frame-Pair Video Generation:** 5 videos from 6 frames using `image_tail` interpolation:
- Clip 1: frame-1 → frame-2
- Clip 2: frame-2 → frame-3
- Clip 3: frame-3 → frame-4
- Clip 4: frame-4 → frame-5
- Clip 5: frame-5 → frame-6

**The 6 Camera Angles (Fixed):**
```
┌─────────────────┬─────────────────┬─────────────────┐
│  1. Beauty      │  2. High-Angle  │  3. Low-Angle   │
│     Portrait    │     3/4 View    │     Full Body   │
├─────────────────┼─────────────────┼─────────────────┤
│  4. Side-On     │  5. Worm's Eye  │  6. Extreme     │
│     Profile     │     Shoe Frame  │     Detail      │
└─────────────────┴─────────────────┴─────────────────┘
```

**Style Treatment (Fixed - Fuji Velvia):**
- Overexposed, significant film grain, oversaturated
- Shiny/oily skin appearance, 3:2 aspect ratio
- Hard flash concentrated on subject, fading to edges

---

## API Endpoints

### Streaming Endpoints (Primary)

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/generate-stream` | POST | Start generation with SSE streaming |
| `/sessions/:id/continue-stream` | POST | Continue session with SSE streaming |

### REST Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with config status |
| `/sessions` | GET | List all active sessions |
| `/sessions/:id` | GET | Session statistics |
| `/sessions/:id/pipeline` | GET | Pipeline stage and assets |
| `/sessions/:id/assets` | GET | All generated assets |
| `/sessions/:id/continue` | POST | Continue (non-streaming) |
| `/generate` | POST | Generate (non-streaming) |
| `/upload` | POST | Upload reference images (max 10) |

### Static Files

| Path | Maps To |
|------|---------|
| `/outputs/*` | `agent/outputs/` |
| `/uploads/*` | `uploads/` |

### Vite Proxy (Development)

Frontend runs on `:5173`, proxies to server on `:3002`:

```typescript
// vite.config.ts
proxy: {
  '/api': { target: 'http://localhost:3002', rewrite: path => path.replace(/^\/api/, '') },
  '/outputs': { target: 'http://localhost:3002' },
  '/uploads': { target: 'http://localhost:3002' },
}
```

---

## Generate Request/Response

**Request:**
```json
{
  "prompt": "Create a confident fashion editorial",
  "sessionId": "optional-session-id",
  "inputImages": ["/uploads/reference.jpg"]
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_abc123",
  "response": "Assistant response text",
  "checkpoint": {
    "stage": "hero",
    "status": "complete",
    "artifact": "outputs/hero.png",
    "message": "Hero image generated. Review and continue..."
  },
  "awaitingInput": true,
  "pipeline": {
    "stage": "generating-hero",
    "progress": 25,
    "assets": { "hero": "outputs/hero.png" }
  },
  "instrumentation": {
    "totalCost_usd": 0.12,
    "totalDuration_ms": 45000
  }
}
```

---

## Session Management

**Session Lifecycle:**
```
Create (UUID) → Get SDK ID → Add Messages → Update Pipeline → Complete/Error → Cleanup
```

**Persistence:**
- Stored in `sessions/` as JSON files
- Auto-save every 10 messages
- 24-hour max age, 1-hour inactivity timeout
- Hourly cleanup interval

**Pipeline States:**
`initialized` → `analyzing` → `generating-hero` → `generating-contact-sheet` → `cropping-frames` → `generating-videos` → `stitching` → `completed`

---

## Image Handling

Images are handled by file path reference, not base64 encoding:

| Method | Size Limit | When Used |
|--------|------------|-----------|
| File path to FAL.ai | No limit | `generate-image.ts --input` |
| Read tool | No practical limit | Agent views generated images |
| Base64 multimodal | 5MB | **Not used** (removed 2026-01-10) |

**Upload Flow:**
1. User uploads image → saved to `/uploads/`
2. File path included in prompt text
3. Agent passes path to `generate-image.ts --input` (FAL.ai handles it)
4. Agent can use Read tool to view images if needed

This approach avoids Claude's 5MB base64 limit for multimodal inputs.

---

## Skills Architecture

### editorial-photography (Knowledge)
Provides exact prompt templates with placeholders:

| Template | Purpose | Placeholders |
|----------|---------|--------------|
| HERO_PROMPT | Full-body hero | `{POSE_PRESET_SNIPPET}`, `{BACKGROUND_PRESET_SNIPPET}` |
| CONTACT_SHEET_PROMPT | 2×3 grid | `{STYLE_DETAILS}` |
| VIDEO_PROMPTS | Camera movements | Pre-defined per frame |

**Presets (7 each):**
- **Poses:** confident-standing, seated-editorial, leaning-casual, editorial-drama, relaxed-natural, street-walk, urban-lean
- **Backgrounds:** studio-grey, studio-white, studio-black, industrial, warm-daylight, color-gel, outdoor-urban

### fashion-shoot-pipeline (Action)
Executes generation scripts:

| Script | API | Purpose |
|--------|-----|---------|
| `generate-image.ts` | FAL.ai nano-banana-pro | Hero + contact sheet |
| `crop-frames.ts` | OpenCV.js + Sharp | Extract 6 frames from grid (variance-based detection) |
| `crop-frames-ffmpeg.ts` | FFmpeg | Fallback: simple math division (100% reliable) |
| `generate-video.ts` | Kling AI direct API (v2.6 Pro) | 5s video per frame pair (with `image_tail`) |
| `stitch-videos-eased.ts` | FFmpeg | Combine with speed curves (smart dimension check) |

#### crop-frames.ts - Adaptive Variance-Based Grid Detection + Normalization

Auto-detects grid structure from contact sheets using variance-based gutter detection. Works with any gutter color (white, black, gray) and adapts to AI-generated layouts. **Includes automatic frame normalization** to ensure all cropped frames have uniform dimensions.

```
Contact Sheet → Grayscale → Variance Profile → Adaptive Threshold → Find Uniform Regions → Per-Cell Boundaries → Normalize Frames
```

**Algorithm:**
1. **Variance Profile** - Sample 17 lines (10%-90%) across perpendicular axis for each position
2. **Adaptive Threshold** - Find P1 (1st percentile) variance, threshold = P1 × 10, clamped to [50, 300]
3. **Uniform Region Detection** - True gutters have near-zero variance across entire span
4. **Gutter Filtering** - Exclude edge margins (within 5% of image edges), select expected count
5. **Per-Cell Boundary Calculation** - Each cell's boundaries derived directly from gutter start/end:
   ```
   Cell 0: contentLeft + margin  →  gutter[0].start - margin
   Cell 1: gutter[0].end + margin  →  gutter[1].start - margin
   Cell N: gutter[N-1].end + margin  →  contentRight - margin
   ```
6. **Adaptive Safety Margin** - 15% of average gutter width, minimum 3px

**Adaptive Parameters:**
| Parameter | Formula |
|-----------|---------|
| `varianceThreshold` | P1 × 10, clamped to [50, 300] |
| `minGutterWidth` | 1% of cell size, min 3px |
| `safetyMargin` | 15% of gutter width, min 3px |

**Why variance-based?** Edge detection found transition points (where content meets gutter), not gutter centers—causing crops to start inside gutters. Variance-based detection finds actual uniform regions regardless of color.

**Why adaptive thresholds?** AI-generated contact sheets vary significantly. Fixed thresholds fail on different images. True gutters have variance ~0-1, content has variance ~1000-7000. P1 percentile adapts to each image's characteristics.

**Zero AI tokens** - Pure math approach, works with any contact sheet layout.

**Frame Normalization:**
After cropping, frames may have slightly varying dimensions due to AI-generated grid inconsistencies. The normalization step:
1. Finds max width and max height across all cropped frames
2. Resizes each frame to uniform dimensions using `sharp.resize()` with `fit: 'contain'`
3. Adds black padding to maintain aspect ratio (letterbox/pillarbox)
4. Can be disabled with `--no-normalize` flag

This ensures all frames have identical dimensions before video generation, eliminating the need for scaling during video stitching.

#### crop-frames-ffmpeg.ts - FFmpeg Fallback (100% Reliable)

When `crop-frames.ts` fails due to gutter detection issues (minimal/no gutters in AI-generated contact sheets), this fallback uses simple math division:

```
Image dimensions ÷ grid = Frame dimensions

2528×1696 ÷ (3×2) = 842×848 per frame
```

**Algorithm:**
1. Get image dimensions via FFprobe
2. Divide width by cols, height by rows
3. Crop each frame using FFmpeg `crop` filter
4. Output uniform dimensions (no normalization needed)

**Why it works:** Skips gutter detection entirely. Any gutter remnants are distributed into frames but are barely noticeable. Contact sheets are always 2K resolution (2528×1696), so frame output is consistent (842×848).

**Usage:** Agent tries `crop-frames.ts` first. If it fails, agent automatically uses `crop-frames-ffmpeg.ts` as documented in SKILL.md.

#### resize-frames.ts - In-Place Updates

Supports resizing frames to different aspect ratios (9:16, 16:9, 1:1, etc.). Uses temp file + atomic rename for in-place updates when input/output directories match—works in sandboxed containers.

#### stitch-videos-eased.ts - Speed Curves

Stitches videos using speed curves (slow-fast-slow) for invisible hard cuts. Uses shared libraries from `lib/` for timestamp calculation and frame extraction.

**Smart Dimension Checking:** Skips scaling when all input clips already have uniform dimensions (optimization added 2026-01-10). Only applies `scaleWithPadding` filter when dimensions differ.

#### Shared Libraries (`scripts/lib/`)

The speed curve scripts share common functionality through three libraries:

| Library | Purpose |
|---------|---------|
| `easing-functions.ts` | Pure math easing functions (30+ presets + custom Bezier) |
| `video-utils.ts` | FFmpeg operations: `getVideoMetadata()`, `buildScaleFilter()`, `encodeFramesToVideo()`, `extractFramesAtTimestamps()`, `findMaxDimensions()` |
| `timestamp-calc.ts` | Speed curve algorithm: `calculateSourceTimestamps()`, `getSampleTimestamps()` |

This eliminates code duplication across `apply-speed-curve.ts` and `stitch-videos-eased.ts`.

**Timestamp Clamping (2026-01-07 Fix):** The `calculateSourceTimestamps()` function accepts an optional `inputFps` parameter to calculate the maximum seekable timestamp. Video containers report duration slightly longer than the last frame (e.g., 5.04s duration but last frame at 5.0s for 24fps). Without this clamping, FFmpeg silently fails to extract frames near the video end, causing missing frames in the output.

---

## Checkpoint Detection (PostToolUse Hooks)

Checkpoints are detected programmatically using SDK PostToolUse hooks, providing 100% reliable detection compared to parsing LLM text output.

### How It Works

```
Agent runs Bash tool (e.g., generate-image.ts)
       │
       ▼
PostToolUse hook fires after tool completion
       │
       ▼
detectCheckpoint() checks tool output for artifact patterns
       │
       ▼
If match found → emit 'checkpoint' event
       │
       ├──► Stored in detectedCheckpoints Map
       └──► Sent to frontend via SSE immediately
```

### Detection Rules (Order Matters)

Detection is checked in this order—first match wins:

| Order | Checkpoint | Trigger Condition |
|-------|------------|-------------------|
| 1 | `hero` | Bash contains `generate-image.ts` AND output contains `outputs/hero.png` |
| 2 | `contact-sheet` | Bash contains `generate-image.ts` AND output contains `outputs/contact-sheet.png` |
| 3 | `frames` | Bash contains `generate-image.ts` AND output contains `outputs/frames/frame-` |
| 4 | `frames` | Bash contains `crop-frames.ts` AND output contains `frame-6.png` |
| 5 | `frames` | Bash contains `resize-frames.ts` AND output contains `"success": true` |
| 6 | `complete` | Bash/TaskOutput contains `fashion-video.mp4` (stitch output) |
| 7 | `clips` | Bash contains `generate-video.ts` AND output contains `video-5.mp4` |
| 8 | `clips` | TaskOutput contains `video-[1-5].mp4` AND `retrieval_status>success` |

**Why `complete` before `clips`?** When `stitch-videos-eased.ts` runs, its output logs the input clips (`video-1.mp4`, etc.). If `clips` were checked first, stitch would incorrectly trigger the clips checkpoint instead of complete.

**Notes:**
- The `contact-sheet` checkpoint triggers after the 2×3 grid is generated, allowing users to review before frame extraction via `crop-frames.ts`.
- The `frames` checkpoint triggers from three sources: `crop-frames.ts` (initial creation), `resize-frames.ts` (aspect ratio change), and `generate-image.ts` (individual/multi-frame regeneration). After resize, users review the resized frames before video generation continues.
- Multi-frame editing is supported: users can say "modify frames 2 and 3", "modify frames 1-4", or "modify all frames".
- The `clips` checkpoint triggers after all 5 video clips (frame pairs) are generated, allowing users to review clips, choose playback speed, or regenerate specific clips before stitching.
- The `complete` checkpoint also checks `TaskOutput` tool results for when stitch runs as a background task (timeout >2min).

### Implementation

**ai-client.ts:**
```typescript
// PostToolUse hook for checkpoint detection
function createCheckpointHooks(sessionId: string) {
  return {
    PostToolUse: [{
      hooks: [async (input, _toolUseId, _options) => {
        const checkpoint = detectCheckpoint(
          input.tool_name,
          input.tool_input,
          input.tool_response
        );
        if (checkpoint) {
          checkpointEmitter.emit('checkpoint', { sessionId, checkpoint });
        }
        return { continue: true };
      }]
    }]
  };
}
```

**sdk-server.ts:**
```typescript
// Listen for checkpoint events
checkpointEmitter.on('checkpoint', ({ sessionId, checkpoint }) => {
  detectedCheckpoints.set(sessionId, checkpoint);
  // Broadcast to SSE connections immediately
  broadcastToSSE(sessionId, { type: 'checkpoint', checkpoint });
});
```

### Why Hooks Over Text Parsing?

| Approach | Reliability | Reason |
|----------|-------------|--------|
| Text parsing (`---CHECKPOINT---`) | ~70% | LLM output is non-deterministic |
| PostToolUse hooks | 100% | Triggers on actual tool output |

The server still supports text parsing as a fallback, but hook-detected checkpoints take priority.

---

## Frontend Streaming Architecture

The frontend uses Server-Sent Events (SSE) for real-time token streaming and checkpoint notifications.

### SSE Event Flow

```
Server                                    Frontend (useStreamingGenerate)
  │                                              │
  ├─ session_init ─────────────────────────────► Set sessionId
  │                                              │
  ├─ text_delta ───────────────────────────────► Append to streaming message
  │    (token by token)                          │
  │                                              │
  ├─ content_block_start { type: 'tool_use' } ──► (detected on server)
  │                                              │
  ├─ message_type_hint: 'thinking' ────────────► Convert message to ThinkingMessage
  │                                              │
  ├─ text_delta ───────────────────────────────► Append to thinking message
  │                                              │
  ├─ assistant_message ────────────────────────► Finalize message, create new placeholder
  │                                              │
  ├─ system { subtype: 'tool_call' } ──────────► Show activity indicator (●●●)
  │                                              │
  ├─ checkpoint ───────────────────────────────► Add artifact + CheckpointMessage
  │    { stage, artifact, message }              │
  │                                              │
  └─ complete ─────────────────────────────────► End generation, update state
       { checkpoint, sessionStats }
```

### Message Types

| Type | Description | Component |
|------|-------------|-----------|
| `text` | Normal assistant response | `TextMessage` |
| `thinking` | Intermediate message with tool_use (collapsible) | `ThinkingMessage` |
| `image` | Generated image artifact | `ImageMessage` / `ImageGrid` |
| `video` | Generated video artifact | `VideoMessage` / `VideoGrid` |
| `checkpoint` | Pipeline checkpoint with actions (hero, contact-sheet, frames, clips, complete) | `CheckpointMessage` |
| `progress` | Progress indicator | `ProgressMessage` |

### Thinking vs Response Detection

The SDK streams text token-by-token, but we only know if a message is "thinking" (has `tool_use`) after streaming completes. Solution:

1. Server detects `tool_use` early via `content_block_start` stream event
2. Server sends `message_type_hint: 'thinking'` immediately
3. Frontend converts current streaming message to `ThinkingMessage` type
4. Thinking messages render collapsed with dimmed styling

```typescript
// Server: sdk-server.ts
if (event?.type === 'content_block_start') {
  if (event.content_block?.type === 'tool_use') {
    res.write(`data: ${JSON.stringify({
      type: 'message_type_hint',
      messageType: 'thinking'
    })}\n\n`);
  }
}
```

### Media Grouping (Images & Videos)

Consecutive image or video messages (3+) are automatically grouped into grids:

```typescript
// ChatView.tsx - groupMessages()
if (consecutiveImages.length >= 3) {
  return { type: 'image-grid', images: consecutiveImages };  // → ImageGrid component
}
if (consecutiveVideos.length >= 3) {
  return { type: 'video-grid', videos: consecutiveVideos };  // → VideoGrid component
}
```

**VideoGrid Features:**
- 2×3 grid layout for 6 clips at Checkpoint 3
- Hover to preview (auto-plays muted thumbnail)
- Click to open lightbox with full playback controls
- Keyboard navigation (arrows, space, ESC)
- Individual clip download

---

## Video Encoding Requirements

Videos must be encoded with browser-compatible settings for web playback.

### Required Settings (stitch-videos-eased.ts)

```typescript
.outputOptions([
  "-c:v", "libx264",         // H.264 codec
  "-profile:v", "high",      // High profile (not 4:4:4)
  "-pix_fmt", "yuv420p",     // YUV 4:2:0 (required for browsers)
  "-crf", "18",              // Quality (lower = better, 18-23 recommended)
  "-movflags", "+faststart"  // Move moov atom for streaming
])
```

### Why These Settings?

| Setting | Reason |
|---------|--------|
| `yuv420p` | Browsers don't support `yuv444p` (4:4:4 chroma) |
| `profile:v high` | `High 4:4:4 Predictive` profile not supported in browsers |
| `movflags +faststart` | Moves metadata to file start for progressive playback |

### Common Error

If video shows play button but fails with `NotSupportedError: The element has no supported sources`:
- Check pixel format: `ffprobe -v error -show_entries stream=pix_fmt video.mp4`
- Should be `yuv420p`, not `yuv444p`

---

## Cost Tracking

The `SDKInstrumentor` tracks:
- Token usage (input, output, cache read/write)
- Tool invocations and durations
- Total cost from SDK `result.total_cost_usd`
- Session duration and turn count

---

## Configuration

**Environment Variables:**
```bash
ANTHROPIC_API_KEY=sk-ant-...  # Required
FAL_KEY=...                    # Required for image generation
KLING_ACCESS_KEY=...           # Required for video generation (Access Key)
KLING_SECRET_KEY=...           # Required for video generation (Secret Key)
PORT=3002                      # Optional
```

**SDK Options:**
```typescript
{
  cwd: 'agent/',
  model: 'claude-opus-4-5-20251101',
  maxTurns: 100,
  allowedTools: ['Read', 'Write', 'Glob', 'Bash', 'Task', 'Skill'],
  systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT
}
```

---

## Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| HTTP Server | ✅ Complete | SSE streaming endpoints |
| AIClient + Hooks | ✅ Complete | PostToolUse checkpoint detection |
| SessionManager | ✅ Complete | Persistence + pipeline tracking |
| Instrumentor | ✅ Complete | Cost & metrics tracking |
| System Prompt | ✅ Complete | Orchestrator workflow |
| editorial-photography Skill | ✅ Complete | 7 poses, 7 backgrounds |
| fashion-shoot-pipeline Skill | ✅ Complete | 4 scripts, browser-compatible video |
| Frontend Streaming | ✅ Complete | SSE consumer, thinking/response separation |
| Frontend Components | ✅ Complete | 13 components (chat, ui, layout) |
| Image Grid | ✅ Complete | Auto-grouping 3+ consecutive images |
| Video Grid | ✅ Complete | Auto-grouping 3+ consecutive videos (clips) |
| Video Playback | ✅ Complete | H.264 yuv420p encoding |
| Checkpoint UI | ✅ Complete | Hero, contact-sheet, frames, clips, complete stages |

**Remaining:**
- Preset selection UI (partial)
- Test suite (not started)
- Production deployment docs

---

## Output Files

```
outputs/
├── hero.png                    # 2K, 3:2 full-body
├── contact-sheet.png           # 2K, 3:2 grid
├── frames/frame-{1-6}.png      # 1K individual
├── videos/video-{1-5}.mp4      # 5s each (frame pairs)
└── final/fashion-video.mp4     # ~20s stitched
```

**Expected Turns:** 50-80 for full pipeline
