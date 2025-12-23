# Fashion Shoot Agent - Architecture Document

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [Claude Agent SDK Integration](#claude-agent-sdk-integration)
6. [Data Flow](#data-flow)
7. [Session Management](#session-management)
8. [Instrumentation & Cost Tracking](#instrumentation--cost-tracking)
9. [API Reference](#api-reference)
10. [Configuration](#configuration)
11. [SDK Documentation Reference](#sdk-documentation-reference)
12. [Extension Points](#extension-points)
13. [Current State & Roadmap](#current-state--roadmap)

---

## Overview

The Fashion Shoot Agent is an AI-powered fashion photoshoot generation system built on the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`). It provides a REST API layer that orchestrates multi-turn AI conversations with session persistence, cost tracking, and extensible tool integration.

### Purpose

Transform reference images and prompts into editorial photography and video content through a multi-stage AI pipeline:

1. Reference image analysis
2. Hero image generation
3. Contact sheet creation (2×3 grid of keyframes)
4. Video generation from keyframes
5. Video stitching with easing transitions

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js + TypeScript (ES2022) |
| SDK | `@anthropic-ai/claude-agent-sdk` v0.1.73 |
| Web Framework | Express.js 4.x |
| Image Generation | FAL.ai (nano-banana-pro) |
| Video Generation | FAL.ai (Kling 2.6 Pro) |
| Video Stitching | FFmpeg 8.x + fluent-ffmpeg |
| Image Processing | Sharp |
| Schema Validation | Zod |
| Build Tool | tsx (TypeScript Execute) |
| Module System | ESNext (ES Modules) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Applications                         │
│                     (Web App, CLI, Mobile, Integrations)                │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/REST
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Express HTTP Server                            │
│                          (sdk-server.ts:3002)                           │
│  ┌─────────────┬─────────────┬──────────────────┬───────────────────┐  │
│  │   /health   │  /sessions  │    /generate     │ /sessions/:id/... │  │
│  └─────────────┴─────────────┴──────────────────┴───────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
         ┌──────────────────┐  ┌─────────────┐  ┌──────────────────┐
         │    AIClient      │  │  Session    │  │  SDKInstrumentor │
         │  (ai-client.ts)  │  │  Manager    │  │ (instrumentor.ts)│
         │                  │  │             │  │                  │
         │ • SDK wrapper    │  │ • Lifecycle │  │ • Event tracking │
         │ • Query exec     │  │ • Persist   │  │ • Cost tracking  │
         │ • MCP servers    │  │ • Forking   │  │ • Token usage    │
         └────────┬─────────┘  └──────┬──────┘  └──────────────────┘
                  │                   │
                  │                   │
                  ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Claude Agent SDK                                  │
│                   (@anthropic-ai/claude-agent-sdk)                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  query() - Async generator interface for streaming messages      │   │
│  │  • Session management (resume, fork)                             │   │
│  │  • Built-in tools (Read, Write, Glob, Bash, Task, Skill)        │   │
│  │  • MCP server integration                                        │   │
│  │  • Permission system                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ API Calls
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Claude API (Anthropic)                          │
│                        claude-sonnet-4-20250514                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
fashion-shoot-agent/
├── server/                              # HTTP Server Layer
│   ├── sdk-server.ts                   # Express app entry point (461 lines)
│   └── lib/                            # Core libraries
│       ├── ai-client.ts                # Claude SDK wrapper with multimodal support (209 lines)
│       ├── session-manager.ts          # Session persistence & pipeline tracking (629 lines)
│       ├── instrumentor.ts             # Cost & metrics tracking (150 lines)
│       └── orchestrator-prompt.ts      # Tim workflow system prompt (219 lines)
│
├── agent/                               # Agent Configuration
│   ├── .claude/
│   │   └── skills/                     # Agent skills
│   │       ├── editorial-photography/  # Knowledge skill - prompt templates
│   │       │   ├── SKILL.md
│   │       │   └── workflows/
│   │       │       └── tim-workflow-templates.md
│   │       └── fashion-shoot-pipeline/ # Action skill - generation scripts
│   │           ├── SKILL.md
│   │           └── scripts/
│   │               ├── generate-image.ts   # FAL.ai image generation (263 lines)
│   │               ├── generate-video.ts   # FAL.ai Kling video gen (259 lines)
│   │               ├── stitch-videos.ts    # FFmpeg stitching (446 lines)
│   │               └── crop-frames.ts      # Contact sheet cropping (310 lines)
│   └── outputs/                         # Generated assets
│       ├── final/                      # Final stitched videos
│       ├── frames/                     # Isolated frames
│       └── videos/                     # Individual video clips
│
├── sessions/                            # Persisted session data (auto-created)
│   └── session_*.json                  # Individual session files
│
├── docs/                                # Project documentation
│   ├── ARCHITECTURE.md                 # This document
│   ├── IMPLEMENTATION_PLAN.md          # Feature roadmap
│   └── EASING_CURVES.md                # Video transition specs
│
├── workflow-docs/                       # Pipeline specifications
│   ├── workflow.md
│   └── CONTACT_SHEET_TIM_WORKFLOW_SPEC.md
│
├── package.json                         # Dependencies & scripts
├── tsconfig.json                        # TypeScript configuration
└── .env                                 # Environment variables (FAL_KEY, ANTHROPIC_API_KEY)
```

---

## Core Components

### 1. Express HTTP Server (`sdk-server.ts`)

The main entry point that exposes the agent functionality via REST endpoints.

**Responsibilities:**
- HTTP request/response handling
- CORS configuration for cross-origin access
- Request validation
- Response aggregation from SDK streams
- Error handling and logging

**Key Implementation Details:**

```typescript
// Server initialization
const app = express();
app.use(cors());
app.use(express.json());

// Generation endpoint processes SDK message stream
for await (const result of aiClient.queryWithSession(prompt, sessionId)) {
  const { message } = result;
  messages.push(message);
  instrumentor.processMessage(message);  // Track costs

  // Log assistant messages for debugging
  if (message.type === 'assistant') {
    // Extract and log text content
  }
}
```

---

### 2. AIClient (`ai-client.ts`)

Wrapper class around the Claude Agent SDK that handles configuration and session-aware query execution.

**Class Structure:**

```typescript
class AIClient {
  private defaultOptions: Partial<Options>;
  private sessionManager: SessionManager;

  // Create async generator for SDK prompt input
  private async *createPromptGenerator(prompt: string, signal?: AbortSignal);

  // Session-aware query with automatic session management
  async *queryWithSession(prompt: string, sessionId?: string, metadata?: any);

  // Add MCP server for custom tools
  addMcpServer(name: string, server: any);

  // Access session manager
  getSessionManager(): SessionManager;
}
```

**Default SDK Configuration:**

```typescript
{
  cwd: projectRoot,                     // Points to agent/ directory
  model: 'claude-sonnet-4-20250514',    // Claude Sonnet 4
  maxTurns: 100,                        // Full pipeline needs 50-80 turns
  settingSources: ['user', 'project'],  // Load .claude/ settings
  allowedTools: [
    'Read',    // File reading
    'Write',   // File writing
    'Glob',    // Pattern-based file search
    'Bash',    // Shell command execution
    'Task',    // Subagent delegation
    'Skill'    // Skill invocation
  ],
  systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT  // Tim workflow orchestration
}
```

**Multimodal Support:**

The AIClient supports passing reference images to Claude for analysis:

```typescript
// Images are converted to base64 content blocks
async *queryWithSession(prompt: string, sessionId?: string, metadata?: any, imagePaths?: string[]) {
  // Loads images, detects media type (PNG, JPEG, GIF, WEBP)
  // Passes as content blocks to Claude API
}
```

**Prompt Generator Pattern:**

The SDK uses async generators for streaming input. The prompt generator:
1. Yields the initial user message
2. Stays alive during tool execution (critical for multi-turn)
3. Aborts cleanly when query completes

```typescript
private async *createPromptGenerator(prompt: string, signal?: AbortSignal) {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: prompt },
    parent_tool_use_id: null
  };

  // Keep generator alive during tool execution
  if (signal) {
    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve());
    });
  } else {
    await new Promise<void>(() => {});
  }
}
```

---

### 3. SessionManager (`session-manager.ts`)

Manages the lifecycle of conversation sessions with persistence and cleanup.

**Session Data Structure:**

```typescript
interface SessionInfo {
  id: string;                    // Custom session ID (session_uuid)
  sdkSessionId?: string;         // SDK-provided session ID
  createdAt: Date;
  lastAccessedAt: Date;
  metadata: {
    url?: string;                // Reference URL
    campaignName?: string;       // Campaign identifier
    status: 'active' | 'completed' | 'error';
    messageCount: number;
    context?: any;               // Custom context data
    // Fork support
    forkedFrom?: string;         // Parent session if forked
    forkTimestamp?: string;
    forkPurpose?: string;        // e.g., "emotional-angle-variant"
  };
  messages: any[];               // Full message history
  turnCount: number;             // Assistant turn counter
}
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `createSession(metadata)` | Create new session with UUID |
| `getOrCreateSession(id, metadata)` | Get existing or create new |
| `updateSdkSessionId(id, sdkId)` | Link SDK session to custom session |
| `addMessage(id, message)` | Append message to history |
| `getResumeOptions(id)` | Get SDK resume options |
| `saveSession(id)` | Persist to disk |
| `loadSession(id)` | Load from disk |
| `completeSession(id)` | Mark session complete |
| `getSessionStats(id)` | Get statistics |
| `getSessionForks(baseId)` | Get all forks of a session |
| `getSessionFamily(id)` | Get base + all forks |

**Persistence:**
- Sessions stored in `sessions/` directory as JSON files
- Auto-save every 10 messages
- 24-hour maximum session age
- 1-hour inactivity timeout for non-active sessions
- Hourly cleanup interval

---

### 4. SDKInstrumentor (`instrumentor.ts`)

Tracks events, costs, and metrics from SDK message streams.

**Tracked Data:**

```typescript
class SDKInstrumentor {
  private events: any[];           // Event timeline
  private agentCalls: any[];       // Subagent invocations
  private toolCalls: any[];        // Tool usage
  private campaignId: string;      // Session identifier
  private startTime: number;       // Start timestamp
  private totalCost: number;       // SDK-provided cost
  private processedMessageIds: Set<string>;  // Deduplication
}
```

**Message Processing:**

```typescript
processMessage(message: any): void {
  switch (message.type) {
    case 'system':
      // Track init and tool calls
      if (message.subtype === 'init') {
        this.logEvent('INIT', { sessionId: message.session_id });
      }
      if (message.tool_name) {
        this.toolCalls.push({ timestamp, tool: message.tool_name, details });
      }
      break;

    case 'assistant':
      // Extract token usage
      if (message.usage) {
        this.logEvent('USAGE', {
          tokens: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
            cache_read: message.usage.cache_read_input_tokens,
            cache_write: message.usage.cache_creation_input_tokens
          }
        });
      }
      break;

    case 'result':
      // Extract SDK-provided cost (authoritative source)
      if (message.subtype === 'success') {
        this.totalCost = message.total_cost_usd || 0;
      }
      break;
  }
}
```

**Reports:**

- `getReport()` - Summary with timeline
- `getCostBreakdown()` - Cost analysis
- `getCampaignReport()` - Detailed metrics
- `getEventsTimeline()` - Full event history

---

### 5. System Prompt (`orchestrator-prompt.ts`)

Defines the Tim workflow pipeline executor with strict rules against improvisation.

**Key Principles:**

1. **NO IMPROVISATION** - Use EXACT prompt templates from editorial-photography skill
2. **NO CREATIVE INTERPRETATION** - Fill {PLACEHOLDERS} only, do not modify template structure
3. **FIXED CAMERA ANGLES** - The 6-shot pattern is locked, never change it
4. **FIXED STYLE** - Fuji Velvia treatment is locked, never change it

**Pipeline Stages Defined:**

```
Stage 1: ANALYZE     → Look at reference images, extract details
Stage 2: HERO        → Generate full-body hero shot (2K, 3:2)
Stage 3: CONTACT     → Generate 2×3 grid with 6 angles (2K, 3:2)
Stage 4: ISOLATE     → Extract each frame × 6 (1K, 3:2)
Stage 5: VIDEO       → Generate video from each frame × 6 (5s each)
Stage 6: STITCH      → Combine videos with transitions
```

**The 6 Camera Angles (Fixed):**

```
┌─────────────────┬─────────────────┬─────────────────┐
│  Frame 1 (R1C1) │  Frame 2 (R1C2) │  Frame 3 (R1C3) │
│  Beauty Portrait│  High-Angle 3/4 │  Low-Angle Full │
├─────────────────┼─────────────────┼─────────────────┤
│  Frame 4 (R2C1) │  Frame 5 (R2C2) │  Frame 6 (R2C3) │
│  Side-On Profile│  Intimate Close │  Extreme Detail │
└─────────────────┴─────────────────┴─────────────────┘
```

**Style Treatment (Fixed - Never Change):**

- Film: Fuji Velvia
- Exposure: Overexposed
- Grain: Significant film grain
- Saturation: Oversaturated
- Skin: Shiny/oily appearance
- Aspect: 3:2
- Light: Hard flash, concentrated on subject, fading to edges

---

## Claude Agent SDK Integration

### SDK Message Types

The SDK returns an async iterator of `SDKMessage` union types:

| Type | Subtype | Description |
|------|---------|-------------|
| `system` | `init` | Session initialization with `session_id` |
| `system` | - | Tool execution notifications |
| `assistant` | - | Model responses with `usage` metrics |
| `user` | - | User input messages |
| `result` | `success` | Completion with `total_cost_usd` |
| `result` | `error` | Error information |

### Key SDK Features Used

#### 1. Async Generator Query Interface

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({ prompt, options })) {
  // Process each message as it arrives
}
```

#### 2. Session Resumption

```typescript
// Resume existing session
const options = {
  resume: sdkSessionId,  // SDK session ID from previous query
  // ... other options
};
```

#### 3. Built-in Tools

| Tool | Purpose |
|------|---------|
| `Read` | Read files (text, images, PDFs) |
| `Write` | Write/overwrite files |
| `Glob` | Pattern-based file search |
| `Bash` | Execute shell commands |
| `Task` | Delegate to subagents |
| `Skill` | Invoke agent skills |

#### 4. MCP Server Integration

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const server = createSdkMcpServer({
  name: 'image-gen',
  tools: [
    tool('generate', 'Generate image', schema, handler)
  ]
});

aiClient.addMcpServer('image-gen', server);
```

#### 5. Skill System

The agent uses two complementary skills loaded from `.claude/skills/`:

```
agent/.claude/skills/
├── editorial-photography/           # Knowledge skill - provides templates
│   ├── SKILL.md                    # Skill definition
│   └── workflows/
│       └── tim-workflow-templates.md  # All prompt templates
└── fashion-shoot-pipeline/          # Action skill - executes generation
    ├── SKILL.md
    └── scripts/
        ├── generate-image.ts        # FAL.ai image generation
        ├── generate-video.ts        # FAL.ai Kling video generation
        ├── stitch-videos.ts         # FFmpeg video stitching
        └── crop-frames.ts           # Contact sheet frame extraction
```

**Skill 1: editorial-photography (Knowledge)**

Provides exact prompt templates for the Tim workflow:

| Template | Purpose | Placeholders |
|----------|---------|--------------|
| `HERO_PROMPT` | Full-body hero shot | `{SUBJECT}`, `{WARDROBE}`, `{ACCESSORIES}`, `{POSE}`, `{BACKGROUND}` |
| `CONTACT_SHEET_PROMPT` | 6-angle grid | `{STYLE_DETAILS}` (optional override) |
| `FRAME_ISOLATION_PROMPT` | Extract single frame | `{ROW}`, `{COLUMN}` |
| `VIDEO_PROMPTS` | Camera movements | Pre-defined per frame type |

**Skill 2: fashion-shoot-pipeline (Action)**

Executes the generation pipeline:

| Script | Purpose | API |
|--------|---------|-----|
| `generate-image.ts` | Image generation | FAL.ai nano-banana-pro |
| `generate-video.ts` | Video generation | FAL.ai Kling 2.6 Pro |
| `stitch-videos.ts` | Video stitching | FFmpeg xfade with easing |
| `crop-frames.ts` | Frame extraction | Sharp image processing |

---

## Data Flow

### Generation Request Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Client POST /generate { prompt, sessionId? }                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. SessionManager.getOrCreateSession()                                  │
│    - Load from memory/disk or create new                                │
│    - Get SDK resume options if session exists                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. AIClient.queryWithSession()                                          │
│    - Create prompt generator (async iterator)                           │
│    - Configure SDK options with resume if available                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. SDK query() - Message Stream                                         │
│    ┌────────────────────────────────────────────────────────────────┐  │
│    │ system.init → Capture SDK session ID                           │  │
│    │ assistant   → Process content, extract usage                   │  │
│    │ system      → Tool execution notifications                     │  │
│    │ assistant   → More responses after tool results                │  │
│    │ result      → Extract total_cost_usd                           │  │
│    └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. For each message:                                                    │
│    - SessionManager.addMessage() - Store in history                     │
│    - SDKInstrumentor.processMessage() - Track metrics                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. Aggregate Response                                                   │
│    - Extract text from assistant messages                               │
│    - Get session stats and cost breakdown                               │
│    - Return JSON to client                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Session Continuation Flow

```
POST /sessions/:id/continue
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Load existing session → Get SDK session ID → Pass as resume option      │
│                                                                         │
│ SDK maintains full conversation context across queries                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Session Management

### Session Lifecycle

```
┌─────────┐    Create     ┌─────────┐    Complete    ┌───────────┐
│   New   │ ───────────▶  │ Active  │ ─────────────▶ │ Completed │
└─────────┘               └─────────┘                └───────────┘
                               │                           │
                               │ Error                     │
                               ▼                           │
                          ┌─────────┐                      │
                          │  Error  │                      │
                          └─────────┘                      │
                               │                           │
                               ▼                           ▼
                          ┌─────────────────────────────────────┐
                          │            Cleanup                  │
                          │  (24h max age, 1h inactive)         │
                          └─────────────────────────────────────┘
```

### Session Forking

Forking allows exploring alternative creative directions:

```typescript
// Session family structure
{
  baseSession: SessionInfo,    // Original session
  forks: SessionInfo[]         // Creative variants
}

// Fork metadata
{
  forkedFrom: 'session_abc123',
  forkTimestamp: '2025-01-15T10:30:00Z',
  forkPurpose: 'emotional-angle-variant'
}
```

### Persistence Strategy

| Event | Action |
|-------|--------|
| Session created | Save immediately |
| SDK session linked | Save immediately |
| Every 10 messages | Auto-save |
| Session completed | Save immediately |
| Server restart | Load from disk on access |

---

## Instrumentation & Cost Tracking

### Metrics Collected

| Metric | Source | Description |
|--------|--------|-------------|
| `total_cost_usd` | `result.success` | SDK-calculated cost |
| `input_tokens` | `assistant.usage` | Input token count |
| `output_tokens` | `assistant.usage` | Output token count |
| `cache_read_input_tokens` | `assistant.usage` | Cached input tokens |
| `cache_creation_input_tokens` | `assistant.usage` | New cache writes |
| `duration_ms` | `result.success` | Total query duration |
| `num_turns` | `result.success` | Number of turns |
| Tool calls | `system` messages | Tool invocations |

### Cost Breakdown Example

```json
{
  "total": 0.0234,
  "totalFormatted": "$0.0234",
  "events": 15,
  "tools": 3,
  "agents": 0
}
```

### Campaign Report Example

```json
{
  "campaignId": "session-1705312800000",
  "startTime": "2025-01-15T10:00:00.000Z",
  "endTime": "2025-01-15T10:00:45.000Z",
  "totalDuration_ms": 45000,
  "totalCost_usd": 0.0234,
  "summary": {
    "totalEvents": 15,
    "totalTools": 3,
    "totalAgents": 0,
    "avgResponseTime_ms": 3000
  }
}
```

---

## API Reference

### Endpoints

#### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "agent": "fashion-shoot-agent",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "config": {
    "hasAnthropicKey": true,
    "hasFalKey": true,
    "port": 3002
  }
}
```

#### `GET /sessions`

List all active sessions.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "sessions": [
    {
      "id": "session_abc123",
      "sdkSessionId": "sdk_xyz789",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "lastAccessedAt": "2025-01-15T10:30:00.000Z",
      "metadata": {
        "status": "active",
        "messageCount": 25
      },
      "turnCount": 5
    }
  ]
}
```

#### `GET /sessions/:id`

Get session statistics.

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "session_abc123",
    "sdkSessionId": "sdk_xyz789",
    "duration": 1800000,
    "messageCount": 25,
    "turnCount": 5,
    "status": "active",
    "lastActive": "2025-01-15T10:30:00.000Z",
    "isFork": false
  }
}
```

#### `POST /generate`

Main generation endpoint with multimodal support.

**Request:**
```json
{
  "prompt": "Create a fashion photoshoot with confident energy",
  "sessionId": "optional-session-id",
  "inputImages": ["/path/to/reference-image.jpg"]
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_abc123",
  "outputDir": "/sessions/session_abc123/outputs",
  "response": "Final assistant response text",
  "fullResponse": "All responses joined with ---",
  "sessionStats": {
    "id": "session_abc123",
    "duration": 120000,
    "turnCount": 45,
    "messageCount": 120,
    "status": "completed"
  },
  "pipeline": {
    "stage": "completed",
    "assets": {
      "hero": "outputs/hero.png",
      "contactSheet": "outputs/contact-sheet.png",
      "frames": ["outputs/frames/frame-1.png", "..."],
      "videos": ["outputs/videos/video-1.mp4", "..."],
      "finalVideo": "outputs/final/fashion-video.mp4"
    },
    "progress": 100
  },
  "instrumentation": {
    "campaignId": "session_abc123",
    "totalCost_usd": 1.23,
    "totalDuration_ms": 120000
  }
}
```

#### `GET /sessions/:id/pipeline`

Get pipeline status and assets.

**Response:**
```json
{
  "success": true,
  "pipeline": {
    "stage": "generating-videos",
    "progress": 75,
    "assets": {
      "hero": "outputs/hero.png",
      "contactSheet": "outputs/contact-sheet.png",
      "frames": ["outputs/frames/frame-1.png", "..."]
    }
  }
}
```

#### `GET /sessions/:id/assets`

Get all generated assets for a session.

#### `GET /sessions/:id/stream`

SSE endpoint for real-time progress updates.

**SSE Events:**
```javascript
{
  type: 'connected',     // Initial connection
  type: 'heartbeat',     // Keep-alive (30s interval)
  type: 'system',        // SDK system message
  type: 'assistant',     // Claude response
  type: 'user',          // Tool results
  type: 'result'         // Final result (success/error)
}
```

#### `POST /sessions/:id/continue`

Continue an existing session with a new prompt.

**Request:**
```json
{
  "prompt": "Now generate videos from the contact sheet"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_abc123",
  "response": "Latest assistant response",
  "sessionStats": { ... },
  "messageCount": 12
}
```

---

## Configuration

### Environment Variables (`.env`)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...      # Claude API key

# Optional
FAL_KEY=...                        # FAL.ai API key (for image/video gen)
PORT=3002                          # Server port
CLAUDE_CODE_MAX_OUTPUT_TOKENS=16384
NODE_ENV=development
```

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist"
  },
  "include": ["server/**/*", "agent/**/*"]
}
```

### SDK Options

| Option | Default | Description |
|--------|---------|-------------|
| `cwd` | `agent/` | Working directory for `.claude/` |
| `model` | `claude-sonnet-4-20250514` | Claude model to use |
| `maxTurns` | `20` | Maximum conversation turns |
| `settingSources` | `['user', 'project']` | Settings file locations |
| `allowedTools` | See above | Enabled tool list |
| `systemPrompt` | `ORCHESTRATOR_SYSTEM_PROMPT` | Agent instructions |

---

## SDK Documentation Reference

The `claude_sdk/` directory contains 18 documentation files:

### Core Concepts

| File | Content |
|------|---------|
| `overview.md` | SDK capabilities and use cases |
| `typescript_sdk.md` | Complete TypeScript API reference |
| `session_management.md` | Sessions, resume, and forking |

### Tool Integration

| File | Content |
|------|---------|
| `mcp.md` | Model Context Protocol overview |
| `custom_tools.md` | Creating SDK MCP servers |
| `builtinsdktools.md` | Built-in tool documentation |

### Advanced Features

| File | Content |
|------|---------|
| `Agent_skills.md` | Skill system configuration |
| `subagents.md` | Specialized agent delegation |
| `permissions.md` | Permission modes and hooks |
| `streaming_input.md` | Async generator patterns |
| `tracking_costs.md` | Token usage and cost analysis |
| `system_prompts.md` | Customizing Claude behavior |

### Operations

| File | Content |
|------|---------|
| `sdk_hosting.md` | Deployment strategies |
| `skills_troubleshooting.md` | Common issues and solutions |
| `migration_to_agent_sdk.md` | Upgrading from old SDK |

---

## Extension Points

### 1. Adding MCP Servers

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const imageGenServer = createSdkMcpServer({
  name: 'image-gen',
  tools: [
    tool(
      'generate_image',
      'Generate an image from a prompt',
      { prompt: z.string(), style: z.string().optional() },
      async ({ prompt, style }) => {
        // Call FAL.ai or other image generation API
        return { imageUrl: '...' };
      }
    )
  ]
});

aiClient.addMcpServer('image-gen', imageGenServer);
```

### 2. Adding Skills

Create `.claude/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Does something useful
tools:
  - Bash
  - Read
---

# My Skill Instructions

When invoked, do the following...
```

### 3. Adding Subagents

Create `.claude/agents/my-agent.md`:

```markdown
---
name: my-agent
description: Specialized agent for X
tools:
  - Read
  - Write
---

# Agent Instructions

You are a specialized agent for...
```

### 4. Custom Permission Logic

```typescript
const options = {
  canUseTool: (tool, input) => {
    // Custom permission logic
    if (tool === 'Bash' && input.command.includes('rm')) {
      return false;  // Deny destructive commands
    }
    return true;
  }
};
```

---

## Current State & Roadmap

### Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| HTTP Server | ✅ Complete | All endpoints functional, SSE streaming |
| AIClient | ✅ Complete | SDK integration with multimodal support |
| SessionManager | ✅ Complete | Persistence, forking, pipeline tracking |
| Instrumentor | ✅ Complete | Cost tracking from SDK |
| System Prompt | ✅ Complete | Tim workflow orchestrator (219 lines) |
| editorial-photography Skill | ✅ Complete | Knowledge skill with prompt templates |
| fashion-shoot-pipeline Skill | ✅ Complete | Action skill with 4 scripts |
| Image Generation | ✅ Complete | FAL.ai nano-banana-pro integration |
| Video Generation | ✅ Complete | FAL.ai Kling 2.6 Pro integration |
| Video Stitching | ✅ Complete | FFmpeg xfade with easing curves |
| Frame Cropping | ✅ Complete | Sharp-based contact sheet extraction |
| Pipeline Tracking | ✅ Complete | Stage-by-stage progress with assets |

### Completed Implementation Phases

**Phase 1:** Project Setup ✅
- Skill directory structure created
- Dependencies configured (FAL.ai, FFmpeg, Sharp)

**Phase 2:** Knowledge Skill (`editorial-photography`) ✅
- Tim workflow templates
- 6 fixed camera angles
- Fuji Velvia style treatment
- Prompt templates with placeholders

**Phase 3:** Action Skill (`fashion-shoot-pipeline`) ✅
- `generate-image.ts` - FAL.ai image generation (263 lines)
- `generate-video.ts` - FAL.ai Kling 2.6 video (259 lines)
- `stitch-videos.ts` - FFmpeg with easing (446 lines)
- `crop-frames.ts` - Contact sheet cropping (310 lines)

**Phase 4:** Orchestrator Enhancement ✅
- Full Tim workflow system prompt
- Pipeline stage definitions
- Error handling guidelines

**Phase 5:** Session Integration ✅
- Pipeline state tracking (9 stages)
- Asset tracking per stage
- Progress percentage reporting
- SSE real-time updates

### Pipeline Execution Summary

| Stage | Script | Resolution | Output | Expected Turns |
|-------|--------|------------|--------|----------------|
| Hero | generate-image.ts | 2K | hero.png | 2-3 |
| Contact | generate-image.ts | 2K | contact-sheet.png | 2-3 |
| Isolate | generate-image.ts × 6 | 1K | frames/frame-{1-6}.png | 12-18 |
| Video | generate-video.ts × 6 | - | videos/video-{1-6}.mp4 | 12-18 |
| Stitch | stitch-videos.ts | - | final/fashion-video.mp4 | 2-3 |
| **Total** | | | | **50-80 turns** |

### Output Files Generated

```
outputs/
├── hero.png                    # Full-body hero shot (2K, 3:2)
├── contact-sheet.png           # 2×3 grid with 6 angles (2K, 3:2)
├── frames/
│   ├── frame-1.png            # Beauty Portrait (1K)
│   ├── frame-2.png            # High-Angle 3/4
│   ├── frame-3.png            # Low-Angle Full
│   ├── frame-4.png            # Side-On Profile
│   ├── frame-5.png            # Intimate Close
│   └── frame-6.png            # Extreme Detail
├── videos/
│   ├── video-1.mp4            # 5s each with camera movement
│   ├── video-2.mp4
│   ├── video-3.mp4
│   ├── video-4.mp4
│   ├── video-5.mp4
│   └── video-6.mp4
└── final/
    └── fashion-video.mp4       # ~24s final video with transitions
```

---

## Summary

The Fashion Shoot Agent is a **fully implemented** AI-powered fashion photoshoot generation system built on the Claude Agent SDK:

### Core Capabilities

- **Multi-stage pipeline** - 6 stages from reference analysis to final video
- **Deterministic execution** - Fixed camera angles, style treatment, no improvisation
- **Multimodal input** - Reference images passed to Claude for analysis
- **Real-time streaming** - SSE support for progress updates
- **Session persistence** - Full conversation history with pipeline state

### Architecture Highlights

- **Robust session management** with persistence, forking, and pipeline tracking
- **Complete instrumentation** for monitoring and cost tracking
- **Skill-based architecture** - Knowledge skill (templates) + Action skill (scripts)
- **Clean separation** between HTTP layer and SDK integration
- **RESTful API** with SSE streaming for client integration

### Generation Pipeline

```
Reference Images → Hero Shot → Contact Sheet → 6 Frames → 6 Videos → Stitched Video
                   (2K)         (2K, 6 angles)  (1K each)  (5s each)  (~24s final)
```

### Technology Integration

- **Claude Agent SDK** - Orchestration and tool execution
- **FAL.ai** - Image generation (nano-banana-pro) and video generation (Kling 2.6 Pro)
- **FFmpeg** - Video stitching with xfade transitions and easing curves
- **Sharp** - Contact sheet frame extraction

The system is production-ready for generating editorial fashion photography and video content from reference images.
