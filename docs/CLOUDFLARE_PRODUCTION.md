# Cloudflare Production Deployment - Complete Technical Reference

> **Purpose**: Production deployment documentation for Fashion Shoot Agent on Cloudflare
> **Last Updated**: 2026-01-17
> **Status**: Production Ready (Phases 1-9 Implemented)

---

## Executive Summary

The fashion-shoot-agent is configured for production deployment on Cloudflare's edge infrastructure using:

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Edge Compute** | Cloudflare Workers | API routing, SSE streaming, static serving |
| **Container Runtime** | Cloudflare Containers (Durable Objects) | Claude Agent SDK, FFmpeg, Sharp |
| **Database** | D1 (SQLite) | Session management, checkpoints |
| **Object Storage** | R2 | Uploads, generated assets |
| **Frontend** | React SPA | Static assets served from Workers |

**Architecture Pattern**: Stateless Workers at edge → Stateful Containers for AI workloads

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Directory Structure](#2-directory-structure)
3. [Wrangler Configuration](#3-wrangler-configuration)
4. [Worker Implementation](#4-worker-implementation)
5. [Container Setup](#5-container-setup)
6. [Session Management](#6-session-management)
7. [Agent Integration](#7-agent-integration)
8. [Database Schema](#8-database-schema)
9. [API Reference](#9-api-reference)
10. [SSE Event Protocol](#10-sse-event-protocol)
11. [Deployment Guide](#11-deployment-guide)
12. [Security Considerations](#12-security-considerations)
13. [Performance Characteristics](#13-performance-characteristics)
14. [Monitoring & Debugging](#14-monitoring--debugging)

---

## 1. Architecture Overview

### 1.1 Request Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  POST /api/generate-stream { prompt, inputImages, sessionId }               │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │ HTTPS
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE WORKER (Edge)                              │
│                                                                              │
│  src/index.ts → Routing                                                      │
│       │                                                                      │
│       ├─► /api/generate-stream → handlers/generate.ts                        │
│       ├─► /api/upload → handlers/upload.ts                                   │
│       ├─► /api/sessions/* → handlers/sessions.ts                             │
│       ├─► /api/media/* → handlers/media.ts                                   │
│       └─► /* → Static SPA (public/)                                          │
│                                                                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                          │
│  │ D1 Database │  │ R2 Storage  │  │ Durable Obj │                          │
│  │ (sessions)  │  │ (files)     │  │ (Sandbox)   │                          │
│  └─────────────┘  └─────────────┘  └──────┬──────┘                          │
└──────────────────────────────────────────┬┴─────────────────────────────────┘
                                           │
                                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE CONTAINER (Durable Object)                   │
│                                                                              │
│  Node.js 20 + FFmpeg + Sharp + Claude Agent SDK                              │
│                                                                              │
│  /workspace/                                                                 │
│  ├── agent-runner.ts      → SDK orchestrator                                 │
│  ├── orchestrator-prompt.ts → Workflow system prompt                         │
│  └── agent/                                                                  │
│      └── .claude/skills/  → Fashion shoot skills                             │
│                                                                              │
│  R2 Mounts:                                                                  │
│  ├── /workspace/agent/outputs/ → outputs/{sessionId}/                        │
│  └── /storage/uploads/         → uploads/                                    │
│                                                                              │
│  External API Calls:                                                         │
│  ├── Anthropic API (Claude)                                                  │
│  ├── FAL.ai (Image generation)                                               │
│  └── Kling AI (Video generation)                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Data Flow: Generation Pipeline

```
User Request
    │
    ▼
┌───────────────────┐
│ 1. Parse Request  │ Worker validates prompt, sessionId, inputImages
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 2. Ensure Session │ Create/update D1 session record
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 3. Get Sandbox    │ Durable Object by sessionId (creates or resumes)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 4. Mount R2       │ /workspace/agent/outputs → outputs/{sessionId}/
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 5. Execute Agent  │ sandbox.execStream("agent-runner.ts")
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 6. Stream Events  │ Parse container stdout → SSE to client
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ 7. Update Status  │ D1 session status, pipeline stage
└───────────────────┘
```

### 1.3 Session Isolation

Each unique `sessionId` gets:
- **Separate Durable Object instance** (persistent container)
- **Isolated R2 mount** at `outputs/{sessionId}/`
- **Independent D1 records** (sessions, checkpoints, assets)

```
Session A: session_1705258941234_abc123
├── Container: DO instance A
├── R2 Mount: outputs/session_1705258941234_abc123/
│   ├── hero.png
│   ├── contact-sheet.png
│   ├── frames/
│   ├── videos/
│   └── final/
└── D1: session row + checkpoints + assets

Session B: session_1705258941235_def456
├── Container: DO instance B (separate process)
├── R2 Mount: outputs/session_1705258941235_def456/
└── D1: separate rows
```

---

## 2. Directory Structure

```
cloudflare/
├── src/                              # Worker source code
│   ├── index.ts                     # Entry point, routing, CORS
│   └── handlers/
│       ├── generate.ts              # POST /api/generate-stream
│       ├── upload.ts                # POST /api/upload
│       ├── sessions.ts              # GET /api/sessions/*
│       └── media.ts                 # GET /api/media/* (R2 serving)
│
├── sandbox/                          # Container code
│   ├── package.json                 # Container dependencies
│   ├── tsconfig.json                # TypeScript config
│   ├── agent-runner.ts              # Claude Agent SDK orchestrator
│   ├── orchestrator-prompt.ts       # Workflow system prompt
│   └── lib/
│       └── storage-client.ts        # R2 filesystem helpers
│
├── agent/                            # BUILD ARTIFACT (copied from ../agent/)
│   └── .claude/skills/
│       ├── editorial-photography/   # Knowledge skill
│       └── fashion-shoot-pipeline/  # Action skill (scripts)
│
├── public/                           # BUILD ARTIFACT (copied from ../frontend/dist/)
│   ├── index.html                   # React SPA entry
│   └── assets/                      # Bundled JS/CSS
│
├── Dockerfile                        # Container image definition
├── wrangler.jsonc                   # Cloudflare configuration
├── schema.sql                       # D1 database schema
├── package.json                     # Worker dependencies
└── tsconfig.json                    # Worker TypeScript config
```

### Build Artifacts

| Directory | Source | Build Command |
|-----------|--------|---------------|
| `cloudflare/agent/` | `../agent/` | `npm run prebuild` |
| `cloudflare/public/` | `../frontend/dist/` | `npm run build:frontend` |

Both are gitignored and rebuilt fresh on every deploy.

---

## 3. Wrangler Configuration

### 3.1 Complete Configuration (wrangler.jsonc)

```jsonc
{
  "name": "fashion-shoot-agent",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],

  // Static assets (React SPA)
  "assets": {
    "directory": "./public",
    "not_found_handling": "single-page-application",
    "binding": "ASSETS"
  },

  // Container configuration
  "containers": [{
    "class_name": "Sandbox",
    "image": "./Dockerfile",
    "instance_type": "standard-2",    // 2 vCPU, 4GB RAM
    "max_instances": 10
  }],

  // Durable Object binding
  "durable_objects": {
    "bindings": [{
      "name": "Sandbox",
      "class_name": "Sandbox"
    }]
  },

  // D1 Database
  "d1_databases": [{
    "binding": "DB",
    "database_name": "fashion-shoot-sessions",
    "database_id": "fa67eff0-e99e-4896-b5b6-20cb5f44df9f"
  }],

  // R2 Object Storage
  "r2_buckets": [{
    "binding": "STORAGE",
    "bucket_name": "fashion-shoot-storage"
  }],

  // Non-secret environment variables
  "vars": {
    "ENVIRONMENT": "production",
    "CF_ACCOUNT_ID": "091650847ca6a1d9bb40bee044dfdc91"
  },

  // Durable Object migrations
  "migrations": [{
    "tag": "v1",
    "new_sqlite_classes": ["Sandbox"]
  }]
}
```

### 3.2 Environment Interface

```typescript
// src/index.ts
export interface Env {
  // Bindings
  Sandbox: DurableObjectNamespace<Sandbox>;
  DB: D1Database;
  STORAGE: R2Bucket;
  ASSETS: Fetcher;

  // Secrets (via wrangler secret put)
  ANTHROPIC_API_KEY: string;
  FAL_KEY: string;
  KLING_ACCESS_KEY: string;
  KLING_SECRET_KEY: string;
  AWS_ACCESS_KEY_ID: string;      // R2 S3-compatible
  AWS_SECRET_ACCESS_KEY: string;

  // Vars
  CF_ACCOUNT_ID: string;
  ENVIRONMENT: string;
}
```

### 3.3 Required Secrets

Set via `wrangler secret put <NAME>`:

| Secret | Purpose | Required For |
|--------|---------|--------------|
| `ANTHROPIC_API_KEY` | Claude API access | Agent orchestration |
| `FAL_KEY` | FAL.ai API | Image generation |
| `KLING_ACCESS_KEY` | Kling AI access | Video generation |
| `KLING_SECRET_KEY` | Kling AI secret | Video generation |
| `AWS_ACCESS_KEY_ID` | R2 S3-compatible credentials | Container R2 mounts |
| `AWS_SECRET_ACCESS_KEY` | R2 S3-compatible credentials | Container R2 mounts |

---

## 4. Worker Implementation

### 4.1 Entry Point (src/index.ts)

**Responsibilities:**
1. Sandbox proxy handling
2. Request routing
3. CORS management
4. Error handling
5. Static asset serving

**Routing Table:**

| Method | Path | Handler | Description |
|--------|------|---------|-------------|
| OPTIONS | `*` | - | CORS preflight (204) |
| GET | `/api/health` | inline | Health check |
| POST | `/api/upload` | `handleUpload` | File uploads |
| POST | `/api/generate` | `handleGenerate` | Blocking generation |
| POST | `/api/generate-stream` | `handleGenerateStream` | SSE streaming |
| GET | `/api/sessions` | `handleSessions` | List sessions |
| GET | `/api/sessions/:id` | `handleSessionById` | Session details |
| GET | `/api/sessions/:id/pipeline` | `handleSessionPipeline` | Pipeline status |
| GET | `/api/sessions/:id/assets` | `handleSessionAssets` | List assets |
| POST | `/api/sessions/:id/continue-stream` | `handleContinueStream` | Resume session |
| GET | `/api/media/*` | `handleMedia` | Serve R2 files |
| GET | `/outputs/*` | `handleMedia` | Output files |
| GET | `/uploads/*` | `handleMedia` | Upload files |
| GET | `*` | `env.ASSETS.fetch` | React SPA |

### 4.2 Generate Handler (src/handlers/generate.ts)

**Key Function: `handleGenerateStream()`**

This is the main orchestration handler for AI generation with SSE streaming.

**Flow:**
1. Parse request body (prompt, sessionId, inputImages)
2. Create/update session in D1
3. Get or create Sandbox Durable Object
4. Create output directories in container
5. Mount R2 buckets (uploads + outputs)
6. Execute agent via `sandbox.execStream()`
7. Parse SSE events from container
8. Emit SSE events to client
9. Update session status on completion

**Critical Pattern: Background Processing**

```typescript
// Return SSE stream immediately
const { readable, writable } = new TransformStream();

ctx.waitUntil((async () => {
  // All heavy processing in background
  const execStream = await sandbox.execStream(...);
  for await (const event of parseSSEStream(execStream)) {
    // Parse and forward events
    await writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
  }
})());

return new Response(readable, {
  headers: {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  }
});
```

This avoids Worker's 30-second timeout by returning immediately.

**Container Execution:**

```typescript
const execStream = await sandbox.execStream(
  "npx tsx /workspace/agent-runner.ts",
  {
    env: {
      PROMPT: fullPrompt,
      SESSION_ID: sessionId,
      ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
      FAL_KEY: env.FAL_KEY,
      KLING_ACCESS_KEY: env.KLING_ACCESS_KEY,
      KLING_SECRET_KEY: env.KLING_SECRET_KEY,
      HOME: "/root",
      CI: "true",
      CLAUDE_CODE_SKIP_EULA: "true",
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "true",
      TERM: "dumb",
      NO_COLOR: "1"
    },
    timeout: 600000  // 10 minutes
  }
);
```

### 4.3 Upload Handler (src/handlers/upload.ts)

**Constraints:**
- Allowed types: JPEG, PNG, WebP, GIF
- Max file size: 10MB
- Max files per request: 10

**Current Response Format:**
```json
{
  "success": true,
  "count": 2,
  "files": [
    {
      "originalName": "photo1.jpg",
      "filename": "1705258941234-abc123.jpg",
      "r2Key": "uploads/1705258941234-abc123.jpg",
      "size": 2048576,
      "mimetype": "image/jpeg",
      "url": "/uploads/1705258941234-abc123.jpg"
    }
  ],
  "errors": []
}
```

### 4.4 Media Handler (src/handlers/media.ts)

**Features:**
- Range request support (video seeking)
- MIME type detection
- Cache headers (1 hour)
- ETag support

**HTTP Range Response (206):**
```
HTTP/1.1 206 Partial Content
Content-Type: video/mp4
Content-Range: bytes 1000000-2000000/5000000
Accept-Ranges: bytes
```

---

## 5. Container Setup

### 5.1 Dockerfile

```dockerfile
FROM docker.io/cloudflare/sandbox:0.6.11

# System dependencies
RUN apt-get update && apt-get install -y \
    curl git ffmpeg libvips-dev python3 make g++ \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Environment
ENV HOME=/root
ENV CI=true
ENV CLAUDE_CODE_SKIP_EULA=true
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
ENV TERM=dumb
ENV NO_COLOR=1

# Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code
RUN mkdir -p /root/.claude && \
    echo '{"ackTosVersion": 2, "hasCompletedOnboarding": true}' > /root/.claude/settings.json

# Working directory
RUN mkdir -p /storage /workspace
WORKDIR /workspace

# Dependencies
COPY sandbox/package.json sandbox/package-lock.json /workspace/
RUN npm ci
RUN npm rebuild sharp  # Rebuild for Linux

# Application code
COPY agent/ /workspace/agent/
COPY sandbox/agent-runner.ts /workspace/
COPY sandbox/orchestrator-prompt.ts /workspace/
COPY sandbox/lib/ /workspace/lib/

# CRITICAL: No ENTRYPOINT - base image provides sandbox server
```

### 5.2 Container Specifications

| Resource | Value |
|----------|-------|
| Instance Type | `standard-2` |
| vCPU | 2 |
| RAM | 4GB |
| Max Instances | 10 |
| Execution Timeout | 10 minutes |

### 5.3 Installed Software

| Package | Version | Purpose |
|---------|---------|---------|
| Node.js | 20.x | Runtime |
| FFmpeg | Latest | Video processing |
| Sharp | 0.34.x | Image processing |
| libvips | Latest | Sharp dependency |
| Claude Code CLI | Latest | Skill execution |

---

## 6. Session Management

### 6.1 Overview

Session management handles container persistence, context reconstruction, and lifecycle optimization. The implementation uses a simplified approach based on `continue: true` and context reconstruction rather than complex message history storage.

### 6.2 Container Session Handling

**Pattern:** Get-or-create sessions to handle `SessionAlreadyExists` errors gracefully.

```typescript
// cloudflare/src/handlers/generate.ts:20-36
async function getOrCreateContainerSession(
  sandbox: ReturnType<typeof getSandbox>,
  sessionId: string,
  env: Record<string, string>
) {
  const execSessionId = `exec-${sessionId}`;
  try {
    return await sandbox.createSession({ id: execSessionId, env });
  } catch (err: any) {
    if (err.message?.includes('SessionAlreadyExists')) {
      return await sandbox.getSession(execSessionId);
    }
    throw err;
  }
}
```

### 6.3 Container Timeout Configuration

Custom Sandbox class with 1-hour idle timeout preserves SDK context between user interactions:

```typescript
// cloudflare/src/index.ts:9-17
export class Sandbox extends BaseSandbox {
  override sleepAfter: string | number = '1h';
}
```

### 6.4 Session Continuity

| Scenario | Container State | Handling |
|----------|-----------------|----------|
| User continues quickly | Running | `continue: true` → Full SDK context |
| User idle < 1 hour | Running | `continue: true` → Full SDK context |
| User idle > 1 hour | Sleeping | Context reconstruction via prompt |

**Context Reconstruction** (when container restarts):

```typescript
// cloudflare/sandbox/agent-runner.ts:35-55
function buildEffectivePrompt(): string {
  if (!IS_CONTINUE || PIPELINE_STAGE === "init") return PROMPT;

  return `CONTINUATION: You are resuming at "${PIPELINE_STAGE}" stage.
Check /workspace/agent/outputs/ for completed work...
User request: ${PROMPT}`;
}
```

### 6.5 SSE Heartbeats

30-second heartbeats prevent Cloudflare's 100-second proxy timeout during video generation:

```typescript
// cloudflare/src/handlers/generate.ts:344-351
const heartbeatInterval = setInterval(async () => {
  await writer.write(encoder.encode(': heartbeat\n\n'));
}, 30000);
```

### 6.6 Container Lifecycle Management

Cost-optimized lifecycle handling destroys containers proactively:

| Scenario | Action | Reason |
|----------|--------|--------|
| Pipeline complete | `destroy()` | Free resources immediately |
| Client disconnects | `destroy()` | Avoid accumulating containers |
| Error occurs | `destroy()` | Don't pay for broken state |
| Normal checkpoint | Keep active | User will continue soon |

```typescript
// cloudflare/src/handlers/generate.ts:276-304
async function handleContainerLifecycle(sandbox, sessionId, state) {
  if (state.pipelineCompleted || state.clientDisconnected || state.hadError) {
    await sandbox.destroy();
    console.log(`[lifecycle] Container DESTROYED: ${sessionId}`);
  }
}
```

### 6.7 Continuation Detection

Both `generate-stream` and `continue-stream` endpoints detect existing sessions:

```typescript
// cloudflare/src/handlers/generate.ts:364-373
const existingSession = await env.DB.prepare(`
  SELECT id, pipeline_stage FROM sessions WHERE id = ?
`).bind(sessionId).first();

const isContinuation = !!existingSession && existingSession.pipeline_stage !== "init";

// Pass to agent-runner
env: {
  CONTINUE: isContinuation ? "true" : undefined,
  PIPELINE_STAGE: existingSession?.pipeline_stage || "init",
}
```

---

## 7. Agent Integration

### 7.1 Agent Runner (sandbox/agent-runner.ts)

**Purpose:** Claude Agent SDK orchestrator running inside container

**SDK Configuration:**

```typescript
for await (const message of query({
  prompt: promptGenerator,
  options: {
    cwd: "/workspace/agent",
    systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
    settingSources: ["project"],        // Load skills from cwd
    model: "claude-sonnet-4-20250514",
    maxTurns: 100,
    includePartialMessages: true,       // Token streaming
    permissionMode: "default",
    canUseTool: async (_tool, input) => ({
      behavior: "allow",
      updatedInput: input
    }),
    allowedTools: [
      "Task", "Skill", "TodoWrite",
      "Read", "Write", "Edit", "Glob", "Grep",
      "Bash", "WebFetch"
    ],
    hooks: createHooks()
  }
}))
```

**Critical Settings:**
- `settingSources: ["project"]` - Required to load skills from `agent/.claude/skills/`
- `includePartialMessages: true` - Required for real-time token streaming
- `permissionMode: "default"` + `canUseTool` - NOT `bypassPermissions` (causes exit)

### 7.2 Orchestrator Prompt

The system prompt defines a 6-phase workflow:

| Phase | Output | Checkpoint |
|-------|--------|------------|
| 1. Setup | Directories, presets | - |
| 2. Hero Image | `hero.png` (2K) | CHECKPOINT 1 |
| 3. Contact Sheet | `contact-sheet.png` (2K grid) | CHECKPOINT 2 |
| 4. Frames | `frames/frame-{1-6}.png` | CHECKPOINT 3 |
| 5. Video Clips | `videos/video-{1-5}.mp4` | CHECKPOINT 4 |
| 6. Final Video | `final/fashion-video.mp4` | COMPLETE |

**Key Rules:**
- Always activate skills via Skill tool first
- All Bash commands prefixed with `cd /workspace/agent &&`
- Stop at each checkpoint and wait for user input
- Never analyze images (FAL.ai handles visual intelligence)

### 7.3 Checkpoint Detection

Checkpoints are detected via PostToolUse hooks:

```typescript
function detectCheckpoint(toolName: string, toolInput: any, toolResponse: any): void {
  const output = typeof toolResponse === "string" ? toolResponse : JSON.stringify(toolResponse);
  const command = toolName === "Bash" ? (toolInput?.command || "") : "";
  const sessionPrefix = `outputs/${SESSION_ID}`;

  // Hero checkpoint
  if (command.includes("generate-image.ts") && output.includes("outputs/hero.png")) {
    emitCheckpoint({
      stage: "hero",
      status: "complete",
      artifact: `${sessionPrefix}/hero.png`,
      type: "image",
      message: 'Hero image ready. Reply "continue" or describe changes.'
    });
  }
  // ... more checkpoints
}

function emitCheckpoint(checkpoint: any): void {
  console.log(`[checkpoint] ${JSON.stringify(checkpoint)}`);
}
```

---

## 8. Database Schema

### 8.1 Sessions Table

```sql
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error', 'expired')),
  pipeline_stage TEXT DEFAULT 'init',
  sdk_session_id TEXT,
  total_cost_usd REAL DEFAULT 0,
  total_turns INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSON
);

CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
```

### 8.2 Session Assets Table

```sql
CREATE TABLE IF NOT EXISTS session_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('input', 'hero', 'contact-sheet', 'frame', 'clip', 'final')),
  file_name TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  metadata JSON,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_assets_session ON session_assets(session_id);
CREATE INDEX idx_assets_type ON session_assets(asset_type);
```

### 8.3 Checkpoints Table

```sql
CREATE TABLE IF NOT EXISTS checkpoints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('hero', 'contact-sheet', 'frames', 'clips', 'complete')),
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'modified')),
  artifact_keys JSON,
  message TEXT,
  user_response TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX idx_checkpoints_status ON checkpoints(status);
```

---

## 9. API Reference

### 9.1 Health Check

```
GET /api/health
```

**Response:**
```json
{
  "status": "ok",
  "agent": "fashion-shoot-agent",
  "timestamp": "2025-01-14T13:29:01Z",
  "environment": "production",
  "config": {
    "hasAnthropicKey": true,
    "hasFalKey": true,
    "hasKlingKeys": true
  }
}
```

### 9.2 Upload Files

```
POST /api/upload
Content-Type: multipart/form-data
```

**Form Fields:**
- `images`: File[] (max 10 files, 10MB each)

**Response:**
```json
{
  "success": true,
  "count": 1,
  "files": [{
    "originalName": "reference.jpg",
    "filename": "1705258941234-abc123.jpg",
    "r2Key": "uploads/1705258941234-abc123.jpg",
    "size": 2048576,
    "mimetype": "image/jpeg",
    "url": "/uploads/1705258941234-abc123.jpg"
  }],
  "errors": []
}
```

### 9.3 Generate (Streaming)

```
POST /api/generate-stream
Content-Type: application/json
```

**Request:**
```json
{
  "prompt": "Create a confident fashion editorial with warm lighting",
  "sessionId": "session_1705258941234_abc123",
  "inputImages": ["/storage/uploads/reference.jpg"]
}
```

**Response:** Server-Sent Events stream (see Section 9)

### 9.4 Continue Session

```
POST /api/sessions/{sessionId}/continue-stream
Content-Type: application/json
```

**Request:**
```json
{
  "prompt": "continue"
}
```

**Response:** Server-Sent Events stream

### 9.5 List Sessions

```
GET /api/sessions?limit=50
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "sessions": [{
    "id": "session_1705258941234_abc123",
    "created_at": "2025-01-14T13:29:01Z",
    "updated_at": "2025-01-14T13:45:32Z",
    "status": "active",
    "pipeline_stage": "clips",
    "total_cost_usd": 2.45,
    "total_turns": 8
  }]
}
```

### 9.6 Get Session Details

```
GET /api/sessions/{sessionId}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "session_...",
    "status": "completed",
    "pipeline_stage": "complete",
    "error_message": null,
    "metadata": {}
  }
}
```

### 9.7 Get Pipeline Status

```
GET /api/sessions/{sessionId}/pipeline
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_...",
  "pipeline": {
    "stage": "clips",
    "status": "active",
    "checkpoint": {
      "stage": "clips",
      "status": "complete",
      "artifact_keys": ["outputs/.../video-1.mp4"],
      "message": "5 clips ready...",
      "created_at": "2025-01-14T13:45:32Z"
    }
  }
}
```

### 9.8 List Session Assets

```
GET /api/sessions/{sessionId}/assets
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_...",
  "assets": {
    "hero": [{
      "fileName": "hero.png",
      "url": "/outputs/.../hero.png",
      "size": 4194304,
      "mimeType": "image/png",
      "createdAt": "2025-01-14T13:35:10Z"
    }],
    "frames": [],
    "videos": []
  }
}
```

### 9.9 Serve Media

```
GET /api/media/{key}
GET /uploads/{filename}
GET /outputs/{sessionId}/{path}
```

Supports HTTP Range requests for video streaming.

---

## 10. SSE Event Protocol

### 10.1 Event Types

| Event Type | Fields | Description |
|------------|--------|-------------|
| `session_init` | `sessionId` | Initial session ID |
| `status` | `message` | Status update |
| `text_delta` | `text` | Token-by-token streaming |
| `message_type_hint` | `messageType` | Early message type detection |
| `assistant_message` | `content` | Complete assistant message |
| `system` | `subtype`, `data` | Tool call/response events |
| `checkpoint` | `stage`, `artifact(s)`, `message`, `sessionId`, `awaitingInput` | Checkpoint detected |
| `complete` | `sessionStats`, `checkpoint` | Generation complete |
| `error` | `message` | Error occurred |

### 10.2 Event Flow

```
← data: {"type":"session_init","sessionId":"session_..."}

← data: {"type":"status","message":"Starting generation..."}

← data: {"type":"text_delta","text":"I'll"}
← data: {"type":"text_delta","text":" create"}
← data: {"type":"text_delta","text":" a"}
...

← data: {"type":"system","subtype":"tool_call","data":{"tool_name":"Skill"}}

← data: {"type":"checkpoint","stage":"hero","artifact":"outputs/.../hero.png","message":"Hero image ready...","sessionId":"session_...","awaitingInput":true}

← data: {"type":"complete","sessionStats":{...},"checkpoint":{...}}
```

### 10.3 Frontend Handling

```typescript
// useStreamingGenerate.ts
const eventSource = new EventSource('/api/generate-stream');

eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'text_delta':
      appendToMessage(data.text);
      break;
    case 'checkpoint':
      showCheckpoint(data);
      break;
    case 'complete':
      finishGeneration(data);
      break;
  }
};
```

---

## 11. Deployment Guide

### 11.1 Prerequisites

1. **Cloudflare Account** with Workers, D1, R2 enabled
2. **API Keys** for Anthropic, FAL.ai, Kling AI
3. **R2 API Credentials** (S3-compatible)
4. **Docker** installed locally

### 11.2 Initial Setup

```bash
cd cloudflare

# Install dependencies
npm install

# Create D1 database
npx wrangler d1 create fashion-shoot-sessions
# Update database_id in wrangler.jsonc with returned ID

# Apply schema
npx wrangler d1 execute fashion-shoot-sessions --file=schema.sql

# Create R2 bucket
npx wrangler r2 bucket create fashion-shoot-storage

# Set secrets
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put FAL_KEY
npx wrangler secret put KLING_ACCESS_KEY
npx wrangler secret put KLING_SECRET_KEY
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
```

### 11.3 Build & Deploy

```bash
cd cloudflare

# 1. Copy agent folder
npm run prebuild

# 2. Build frontend
npm run build:frontend

# 3. Deploy
npm run deploy

# 4. Verify
npx wrangler tail
```

### 11.4 Verification

```bash
# Health check
curl https://fashion-shoot-agent.{account}.workers.dev/api/health

# Test upload
curl -X POST https://.../api/upload -F "images=@test.jpg"

# Test generation (SSE)
curl -N -X POST https://.../api/generate-stream \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Fashion shoot","sessionId":"test-123"}'
```

---

## 12. Security Considerations

### 12.1 Current State

| Aspect | Status | Notes |
|--------|--------|-------|
| Secrets storage | ✅ | Wrangler Secrets (encrypted) |
| No keys in code | ✅ | All via environment |
| CORS | Configured | Allows all origins (`*`) |
| Request validation | Minimal | Basic type checking |
| Rate limiting | Not implemented | - |
| Authentication | Not implemented | - |

### 12.2 Container Isolation

- Each container is isolated process
- No network access between containers
- R2 mount restricted by sessionId prefix
- Environment variables session-scoped

---

## 13. Performance Characteristics

### 13.1 Latency Profile

| Operation | Latency | Bottleneck |
|-----------|---------|------------|
| Health check | <50ms | Worker cold start |
| File upload (1MB) | 1-2s | Network + R2 write |
| Generation start | 2-5s | Container cold start |
| First token | 5-10s | SDK + model inference |
| Full pipeline | 5-10 min | FAL.ai + Kling + FFmpeg |
| Media fetch (cached) | <100ms | Edge cache |

### 13.2 Resource Limits

| Resource | Limit |
|----------|-------|
| Worker CPU time | 30s per request |
| Container CPU | 2 vCPU |
| Container RAM | 4GB |
| Container timeout | 10 minutes |
| R2 storage | Unlimited (pay per GB) |
| D1 queries | Unlimited (pay per query) |

### 13.3 Concurrency

- **Max containers per DO namespace:** 10
- **Sessions:** Unlimited (each gets separate DO)
- **Horizontal scaling:** Automatic via Cloudflare

---

## 14. Monitoring & Debugging

### 14.1 Real-Time Logs

```bash
# All logs
npx wrangler tail

# Filter by status
npx wrangler tail --status error

# Search
npx wrangler tail --search "checkpoint"
npx wrangler tail --search "[agent]"
```

### 14.2 Dashboard Metrics

- **Workers** → Metrics → Request count, error rate, latency
- **R2** → Storage usage, bandwidth
- **D1** → Query latency, row counts

### 14.3 Debugging Commands

**Container issues:**
```bash
# Check container logs in wrangler tail output
# Look for [agent] prefixed messages
```

**Session issues:**
```bash
# Query D1 directly
npx wrangler d1 execute fashion-shoot-sessions \
  --command "SELECT * FROM sessions WHERE id = 'session_...'"
```

**R2 issues:**
```bash
# List bucket contents
npx wrangler r2 object list fashion-shoot-storage --prefix "outputs/"
```

---

## Appendix A: Complete File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `wrangler.jsonc` | 56 | Cloudflare configuration |
| `schema.sql` | 53 | D1 database schema |
| `Dockerfile` | 58 | Container image |
| `src/index.ts` | 197 | Worker entry point |
| `src/handlers/generate.ts` | 499 | Main orchestration |
| `src/handlers/upload.ts` | 143 | File uploads |
| `src/handlers/sessions.ts` | 307 | Session management |
| `src/handlers/media.ts` | 109 | R2 serving |
| `sandbox/agent-runner.ts` | 325 | SDK orchestrator |
| `sandbox/orchestrator-prompt.ts` | 196 | Workflow prompt |

**Total:** ~1,550 lines of TypeScript

---

## Appendix B: Environment Variables Reference

### Worker Environment

```typescript
// Bindings (automatic)
env.Sandbox     // DurableObjectNamespace
env.DB          // D1Database
env.STORAGE     // R2Bucket
env.ASSETS      // Fetcher

// Secrets (wrangler secret put)
env.ANTHROPIC_API_KEY
env.FAL_KEY
env.KLING_ACCESS_KEY
env.KLING_SECRET_KEY
env.AWS_ACCESS_KEY_ID
env.AWS_SECRET_ACCESS_KEY

// Vars (wrangler.jsonc)
env.CF_ACCOUNT_ID
env.ENVIRONMENT
```

### Container Environment

```typescript
// Passed via execStream or setEnvVars
process.env.PROMPT
process.env.SESSION_ID
process.env.ANTHROPIC_API_KEY
process.env.FAL_KEY
process.env.KLING_ACCESS_KEY
process.env.KLING_SECRET_KEY
process.env.HOME           // "/root"
process.env.CI             // "true"
process.env.TERM           // "dumb"
process.env.NO_COLOR       // "1"
```

---

*Document generated from comprehensive analysis of cloudflare/ directory.*
