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
│  │  │ • 6 camera angles       │    │ • stitch-videos.ts   (FFmpeg)       │  │   │
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
| **Video Gen** | FAL.ai (Kling 2.6 Pro) |
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
│   │       └── scripts/           # 4 generation scripts
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
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   ANALYZE   │────▶│    HERO     │────▶│   FRAMES    │────▶│   VIDEOS    │────▶│   STITCH    │
│  Reference  │     │ CHECKPOINT 1│     │ CHECKPOINT 2│     │   (auto)    │     │   (auto)    │
│   images    │     │  2K, 3:2    │     │  6 × 1K     │     │  6 × 5sec   │     │   ~24sec    │
└─────────────┘     └──────┬──────┘     └──────┬──────┘     └─────────────┘     └─────────────┘
                          │                   │
                     [User Review]       [User Review]
                     ├── Modify          ├── Modify frame
                     └── Continue        └── Continue
```

**The 6 Camera Angles (Fixed):**
```
┌─────────────────┬─────────────────┬─────────────────┐
│  1. Beauty      │  2. High-Angle  │  3. Low-Angle   │
│     Portrait    │     3/4 View    │     Full Body   │
├─────────────────┼─────────────────┼─────────────────┤
│  4. Side-On     │  5. Intimate    │  6. Extreme     │
│     Profile     │     Close       │     Detail      │
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
`initialized` → `analyzing` → `generating-hero` → `generating-contact-sheet` → `isolating-frames` → `generating-videos` → `stitching` → `completed`

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
| `crop-frames.ts` | OpenCV.js + Sharp | Extract 6 frames from grid (hybrid detection) |
| `generate-video.ts` | FAL.ai Kling 2.6 Pro | 5s video per frame |
| `stitch-videos.ts` | FFmpeg xfade | Combine with transitions |

#### crop-frames.ts - Hybrid Grid Detection

Auto-detects grid structure from contact sheets without manual configuration:

```
Contact Sheet → Canny Edges → Projection Profiles → Find Peaks → Crop Uniform Cells
```

**Algorithm:**
1. **Edge Detection** - Canny algorithm finds boundaries in the image
2. **Projection Profiles** - Sum edge pixels along columns/rows
3. **Peak Detection** - High values indicate gutter line positions
4. **Grid Calculation** - Derive cell size, gutter width, and margins from peaks
5. **Uniform Cropping** - Extract each frame with identical dimensions

**Why hybrid?** Sending images to AI for cropping costs ~$1/run. Reading 7MB images consumes excessive tokens. This approach uses pure math - zero AI tokens, works with any contact sheet layout.

See `agent/.claude/skills/fashion-shoot-pipeline/docs/GRID-CROPPING.md` for detailed documentation.

#### resize-frames.ts - In-Place Updates

Supports resizing frames to different aspect ratios (9:16, 16:9, 1:1, etc.). Uses temp file + atomic rename for in-place updates when input/output directories match—works in sandboxed containers.

#### stitch-videos.ts - Auto-Scaling

Automatically normalizes all input videos to the same dimensions before applying xfade transitions. Handles resolution mismatches when individual frames are regenerated (e.g., user edits frame-6). Uses `scale` + `pad` filters to avoid cropping.

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

### Detection Rules

| Checkpoint | Trigger Condition |
|------------|-------------------|
| `hero` | Bash command contains `generate-image.ts` AND output contains `outputs/hero.png` |
| `frames` | Bash command contains `crop-frames.ts` AND output contains `frame-6.png` |
| `complete` | Bash command contains `stitch-videos.ts` AND output contains `fashion-video.mp4` |

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
| `video` | Generated video artifact | `VideoMessage` |
| `checkpoint` | Pipeline checkpoint with actions | `CheckpointMessage` |
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

### Image Grouping

Consecutive image messages (3+) are automatically grouped into a 2×3 grid:

```typescript
// ChatView.tsx - groupMessages()
if (consecutiveImages.length >= 3) {
  return { type: 'image-grid', images: consecutiveImages };
}
```

---

## Video Encoding Requirements

Videos must be encoded with browser-compatible settings for web playback.

### Required Settings (stitch-videos.ts)

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
FAL_KEY=...                    # Required for image/video
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
| Frontend Components | ✅ Complete | 12 components (chat, ui, layout) |
| Image Grid | ✅ Complete | Auto-grouping 3+ consecutive images |
| Video Playback | ✅ Complete | H.264 yuv420p encoding |
| Checkpoint UI | ✅ Complete | Hero, frames, complete stages |

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
├── videos/video-{1-6}.mp4      # 5s each
└── final/fashion-video.mp4     # ~24s stitched
```

**Expected Turns:** 50-80 for full pipeline
