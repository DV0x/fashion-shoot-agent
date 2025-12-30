# Fashion Shoot Agent - Architecture

## Overview

AI-powered fashion photoshoot generator built on the **Claude Agent SDK**. Transforms reference images into editorial photography and video content through a multi-stage pipeline with checkpoint-based user control.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    FRONTEND                                      │
│                          React + Tailwind + Framer Motion                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │  ChatInput   │  │  ChatView    │  │  Checkpoint  │  │  Progress/Video      │ │
│  │  + Upload    │  │  Messages    │  │  Actions     │  │  Components          │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘ │
└─────────┼─────────────────┼─────────────────┼─────────────────────┼─────────────┘
          │                 │                 │                     │
          └─────────────────┴─────────────────┴─────────────────────┘
                                      │ HTTP/SSE
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              EXPRESS SERVER (:3002)                              │
│  ┌────────────────────────────────────────────────────────────────────────────┐ │
│  │ /generate  /sessions/:id/continue  /upload  /health  /sessions  /stream   │ │
│  └────────────────────────────────────────────────────────────────────────────┘ │
│           │                    │                    │                           │
│  ┌────────▼────────┐  ┌───────▼────────┐  ┌───────▼────────┐                   │
│  │    AIClient     │  │ SessionManager │  │ SDKInstrumentor│                   │
│  │  (SDK wrapper)  │  │  (persistence) │  │ (cost tracking)│                   │
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
├── server/                          # HTTP Server Layer (1,938 lines)
│   ├── sdk-server.ts               # Express app (610 lines)
│   └── lib/
│       ├── ai-client.ts            # SDK wrapper with multimodal (214 lines)
│       ├── session-manager.ts      # Persistence + pipeline tracking (628 lines)
│       ├── instrumentor.ts         # Cost & metrics tracking (393 lines)
│       └── orchestrator-prompt.ts  # Tim workflow system prompt (93 lines)
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
│   │       └── scripts/           # 4 generation scripts (1,278 lines)
│   │
│   └── outputs/                    # Generated assets
│       ├── hero.png               # Full-body hero shot
│       ├── contact-sheet.png      # 2×3 grid
│       ├── frames/frame-{1-6}.png # Individual frames
│       ├── videos/video-{1-6}.mp4 # Individual clips
│       └── final/fashion-video.mp4 # Stitched output
│
├── frontend/                        # React Frontend (1,835 lines)
│   ├── src/
│   │   ├── components/            # 13 components
│   │   │   ├── chat/              # ChatView, ChatInput, Messages
│   │   │   ├── layout/            # AppShell
│   │   │   └── ui/                # Button, Spinner
│   │   ├── hooks/                 # useStreamingGenerate, useSession
│   │   └── lib/                   # api.ts, types.ts
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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check with config status |
| `/sessions` | GET | List all active sessions |
| `/sessions/:id` | GET | Session statistics |
| `/sessions/:id/pipeline` | GET | Pipeline stage and assets |
| `/sessions/:id/assets` | GET | All generated assets |
| `/sessions/:id/stream` | GET | SSE real-time updates |
| `/sessions/:id/continue` | POST | Continue with new prompt |
| `/generate` | POST | Main generation (multimodal) |
| `/generate-stream` | POST | Streaming generation via SSE |
| `/upload` | POST | Upload reference images (max 10) |

**Static Files:**
- `/outputs/*` → `agent/outputs/`
- `/uploads/*` → `uploads/`

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

| Component | Status | Lines |
|-----------|--------|-------|
| HTTP Server | ✅ Complete | 610 |
| AIClient | ✅ Complete | 214 |
| SessionManager | ✅ Complete | 628 |
| Instrumentor | ✅ Complete | 393 |
| System Prompt | ✅ Complete | 93 |
| editorial-photography Skill | ✅ Complete | 487 |
| fashion-shoot-pipeline Skill | ✅ Complete | 1,471 |
| Frontend Components | ✅ Complete | 1,835 |
| **Total** | **94%** | **~5,700** |

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
