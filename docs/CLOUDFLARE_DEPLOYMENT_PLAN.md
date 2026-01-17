# Fashion-Shoot-Agent: Cloudflare Production Deployment Plan

## Executive Summary

This document outlines the complete plan to migrate the fashion-shoot-agent from local development to a production-ready deployment on Cloudflare's edge infrastructure.

**Current State:** Working local development with Express.js + Claude Agent SDK
**Target State:** Production deployment on Cloudflare Workers + Containers + R2 + D1

**Estimated Monthly Cost:** $15-60 (depending on usage)

---

## Implementation Progress (Updated: 2026-01-14)

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Pre-Migration Security | ✅ Complete | `.env.example`, `.gitignore`, secrets management |
| 2. Architecture Overview | ✅ Reviewed | Understood, no implementation needed |
| 3. Infrastructure Setup | ✅ Complete | D1, R2, secrets all configured |
| 4. Code Migration | ✅ Complete | All files created, dependencies installed |
| 5. Testing Strategy | 🔲 Not Started | Next phase |
| 6. Deployment Process | 🔲 Not Started | |
| 7. Post-Deployment Ops | 🔲 Not Started | |

### Infrastructure Resources Created

| Resource | Name | ID/Status |
|----------|------|-----------|
| D1 Database | `fashion-shoot-sessions` | `fa67eff0-e99e-4896-b5b6-20cb5f44df9f` |
| R2 Bucket | `fashion-shoot-storage` | ✅ Created |
| Worker | `fashion-shoot-agent` | ✅ Created (auto-created with secrets) |

### Secrets Configured

| Secret | Status |
|--------|--------|
| ANTHROPIC_API_KEY | ✅ Set |
| FAL_KEY | ✅ Set |
| KLING_ACCESS_KEY | ✅ Set |
| KLING_SECRET_KEY | ✅ Set |
| AWS_ACCESS_KEY_ID | ✅ Set (R2 credentials) |
| AWS_SECRET_ACCESS_KEY | ✅ Set (R2 credentials) |

### Files Implemented

```
cloudflare/
├── src/
│   ├── index.ts              ✅ Worker entry point with routing
│   └── handlers/
│       ├── generate.ts       ✅ Main agent orchestration via container
│       ├── upload.ts         ✅ File uploads to R2
│       ├── sessions.ts       ✅ Session management via D1
│       └── media.ts          ✅ Serve files from R2
├── sandbox/
│   ├── agent-runner.ts       ✅ Claude SDK orchestrator
│   ├── orchestrator-prompt.ts ✅ System prompt (adapted for container)
│   ├── lib/
│   │   └── storage-client.ts ✅ R2 filesystem helpers
│   ├── package.json          ✅ Container dependencies
│   └── tsconfig.json         ✅
├── Dockerfile                ✅ FFmpeg, Sharp, Node.js 20, Claude Code
├── wrangler.jsonc            ✅ Full configuration with D1/R2/Container
├── schema.sql                ✅ 3 tables: sessions, session_assets, checkpoints
├── package.json              ✅ Build scripts, worker dependencies
└── tsconfig.json             ✅
```

### Next Steps (Resume Here)

1. **Test locally**: `cd cloudflare && npm run dev`
2. **Build frontend**: `npm run build:frontend`
3. **Deploy**: `npm run deploy`
4. **Verify**: Test health endpoint, upload, generate

---

## Table of Contents

1. [Pre-Migration Security Hardening](#1-pre-migration-security-hardening)
2. [Architecture Overview](#2-architecture-overview)
3. [Infrastructure Setup](#3-infrastructure-setup)
4. [Code Migration](#4-code-migration)
5. [Testing Strategy](#5-testing-strategy)
6. [Deployment Process](#6-deployment-process)
7. [Post-Deployment Operations](#7-post-deployment-operations)
8. [Risk Mitigation](#8-risk-mitigation)
9. [Success Criteria](#9-success-criteria)

---

## 1. Pre-Migration Security Hardening ✅ COMPLETE

### 1.1 Completed: Local Development Security ✅

The following security essentials have been implemented for local development:

| Item | Status | File |
|------|--------|------|
| `.env.example` template | ✅ Done | `.env.example` |
| `.gitignore` updated | ✅ Done | `.gitignore` |
| Git history verified clean | ✅ Done | No secrets in history |

**Files created:**
- `.env.example` - Template with placeholder values for all required API keys
- `.gitignore` - Comprehensive patterns including `cloudflare/agent/`, `cloudflare/public/`

### 1.2 API Key Rotation (If Needed)

If you believe your API keys have been exposed, rotate them:

| Service | Dashboard URL |
|---------|--------------|
| Anthropic API | https://console.anthropic.com/settings/keys |
| FAL.ai | https://fal.ai/dashboard/keys |
| Kling AI | Kling AI dashboard |

```bash
# After rotating, update your local .env file
# Then test locally before proceeding
```

### 1.3 Secrets Management Strategy

| Environment | Method | Location |
|-------------|--------|----------|
| Local Dev | `.env` file | `.env` (gitignored) |
| Cloudflare | Wrangler Secrets | `wrangler secret put` |
| CI/CD | GitHub Secrets | Repository settings |

### 1.4 Security Middleware (Deferred to Cloudflare Phase)

Security middleware (rate limiting, request validation, security headers) is **not needed for local development**. It will be implemented in the Cloudflare Worker code:

| Middleware | Local Dev | Cloudflare Production |
|------------|-----------|----------------------|
| Rate Limiting | ❌ Skip | `cloudflare/src/lib/security.ts` |
| Request Validation (Zod) | ❌ Skip | `cloudflare/src/lib/security.ts` |
| Security Headers | ❌ Skip | `cloudflare/src/index.ts` |
| Input Sanitization | ❌ Skip | `cloudflare/src/lib/security.ts` |

The security implementation will be added in **Section 4.4** (Migration Tasks) when building the Cloudflare Worker

---

## 2. Architecture Overview

### 2.1 Current Architecture (Local)

```
┌─────────────────────────────────────────────────────────────────┐
│  Local Machine                                                   │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────────────┐│
│  │   Vite Dev  │────▶│   Express   │────▶│  Claude Agent SDK   ││
│  │   :5173     │     │   :3002     │     │  + FFmpeg + Sharp   ││
│  └─────────────┘     └──────┬──────┘     └─────────────────────┘│
│                             │                                    │
│                      ┌──────▼──────┐                            │
│                      │  File System │                           │
│                      │  sessions/   │                           │
│                      │  uploads/    │                           │
│                      │  outputs/    │                           │
│                      └─────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Target Architecture (Cloudflare)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Global Network                            │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                           Worker (Edge)                                │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────────────┐│  │
│  │  │  Static Assets  │  │   API Router    │  │    SSE Streaming       ││  │
│  │  │  (React SPA)    │  │   /api/*        │  │    /api/generate-stream││  │
│  │  └─────────────────┘  └────────┬────────┘  └────────────┬───────────┘│  │
│  └────────────────────────────────┼────────────────────────┼────────────┘  │
│                                   │                        │               │
│  ┌────────────────────────────────▼────────────────────────▼────────────┐  │
│  │                    Container (Durable Object)                         │  │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │  │
│  │  │  Node.js Runtime (standard-2: 2 vCPU, 4GB RAM)                  │ │  │
│  │  │  ┌───────────────┐  ┌───────────────┐  ┌───────────────────────┐│ │  │
│  │  │  │ Claude Agent  │  │    FFmpeg     │  │       Sharp           ││ │  │
│  │  │  │    SDK        │  │   (video)     │  │      (image)          ││ │  │
│  │  │  └───────────────┘  └───────────────┘  └───────────────────────┘│ │  │
│  │  └─────────────────────────────────────────────────────────────────┘ │  │
│  │                                    │                                  │  │
│  │                           ┌────────▼────────┐                        │  │
│  │                           │   R2 Mount      │                        │  │
│  │                           │   /storage      │                        │  │
│  │                           └─────────────────┘                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
│  ┌─────────────────────────┐          ┌─────────────────────────────────┐  │
│  │          D1             │          │            R2 Bucket             │  │
│  │  ┌───────────────────┐  │          │  ┌─────────────────────────────┐│  │
│  │  │ sessions          │  │          │  │  /uploads/{session}/*       ││  │
│  │  │ checkpoints       │  │          │  │  /outputs/{session}/        ││  │
│  │  │ session_assets    │  │          │  │    ├── hero.png             ││  │
│  │  └───────────────────┘  │          │  │    ├── contact-sheet.png    ││  │
│  └─────────────────────────┘          │  │    ├── frames/              ││  │
│                                       │  │    ├── videos/              ││  │
│                                       │  │    └── final/               ││  │
│                                       │  └─────────────────────────────┘│  │
│                                       └─────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
                                        │
                    ┌───────────────────┼───────────────────┐
                    │                   │                   │
              ┌─────▼─────┐      ┌──────▼──────┐     ┌──────▼──────┐
              │ Anthropic │      │   FAL.ai    │     │  Kling AI   │
              │    API    │      │   (Image)   │     │   (Video)   │
              └───────────┘      └─────────────┘     └─────────────┘
```

### 2.3 Data Flow

```
1. User Request
   Browser → Worker (edge) → Container (agent)

2. Generation Pipeline
   Container → FAL.ai (image) → R2 (store)
   Container → Kling AI (video) → R2 (store)
   Container → FFmpeg (stitch) → R2 (store)

3. Progress Updates
   Container stdout → Worker SSE → Browser

4. Media Delivery
   Browser → Worker → R2 (cached at edge)
```

---

## 3. Infrastructure Setup ✅ COMPLETE

### 3.1 Prerequisites

| Requirement | Status | Action |
|-------------|--------|--------|
| Cloudflare Account | ✅ Done | Account ID: `091650847ca6a1d9bb40bee044dfdc91` |
| Workers Paid Plan | ✅ Done | Active |
| Wrangler CLI | ✅ Done | v4.59.1 installed |
| Container Access | ✅ Done | Enabled |

### 3.2 Resource Creation

All commands run from the `cloudflare/` directory.

**Step 1: Cloudflare Account Setup**
```bash
# Install Wrangler globally
npm install -g wrangler

# Authenticate
wrangler login

# Verify authentication
wrangler whoami
```

**Step 2: Initialize Cloudflare Directory**
```bash
# Create cloudflare directory structure
mkdir -p cloudflare/{src/handlers,src/lib,sandbox/lib}
cd cloudflare
npm init -y
```

**Step 3: Create D1 Database**
```bash
cd cloudflare
npx wrangler d1 create fashion-shoot-sessions
# Save the database_id from output → update wrangler.jsonc
```

**Step 4: Create R2 Bucket**
```bash
cd cloudflare
npx wrangler r2 bucket create fashion-shoot-storage
```

**Step 5: Generate R2 API Credentials**
1. Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. Create API Token with read/write access
3. Save Access Key ID and Secret Access Key

**Step 6: Configure Secrets**
```bash
cd cloudflare
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put FAL_KEY
npx wrangler secret put KLING_ACCESS_KEY
npx wrangler secret put KLING_SECRET_KEY
npx wrangler secret put AWS_ACCESS_KEY_ID       # R2 S3-compatible credentials
npx wrangler secret put AWS_SECRET_ACCESS_KEY   # R2 S3-compatible credentials
```

### 3.3 D1 Schema

```sql
-- schema.sql

-- Sessions table
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

-- Session assets tracking
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

-- Checkpoints for human-in-loop
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

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_assets_session ON session_assets(session_id);
CREATE INDEX IF NOT EXISTS idx_assets_type ON session_assets(asset_type);
CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_status ON checkpoints(status);
```

**Apply schema:**
```bash
cd cloudflare
npx wrangler d1 execute fashion-shoot-sessions --file=schema.sql
```

---

## 4. Code Migration ✅ COMPLETE

> **Implementation Status:** All files created on 2026-01-14. See "Implementation Progress" section at top for file list.

### 4.1 Project Structure (Option C: Isolated Cloudflare Directory)

This structure keeps all Cloudflare production code in a single `cloudflare/` directory, completely separate from local development. The `agent/` folder is copied into `cloudflare/agent/` during the build process.

**Why Option C:**
- Clean separation between local dev (`server/`) and production (`cloudflare/`)
- Independent `package.json` files with different dependencies
- Docker build context works without hacks (no `../` paths)
- Can deploy from `cloudflare/` without touching local dev code
- Scales to multiple deployment targets in the future

```
fashion-shoot-agent/
│
├── server/                           # LOCAL DEVELOPMENT (unchanged)
│   ├── sdk-server.ts                 # Express app + SSE streaming
│   └── lib/
│       ├── ai-client.ts              # SDK wrapper + checkpoint hooks
│       ├── session-manager.ts        # File-based persistence
│       ├── instrumentor.ts           # Cost tracking
│       └── orchestrator-prompt.ts    # System prompt
│
├── agent/                            # SHARED: Skills (source of truth)
│   ├── .claude/
│   │   └── skills/
│   │       ├── editorial-photography/
│   │       │   ├── SKILL.md
│   │       │   ├── presets/
│   │       │   └── prompts/
│   │       └── fashion-shoot-pipeline/
│   │           ├── SKILL.md
│   │           └── scripts/          # Generation scripts
│   │               ├── generate-image.ts
│   │               ├── crop-frames.ts
│   │               ├── generate-video.ts
│   │               ├── stitch-videos-eased.ts
│   │               └── lib/
│   └── outputs/                      # Local outputs only (gitignored)
│
├── frontend/                         # SHARED: React 19 + Vite
│   ├── src/
│   ├── dist/                         # Build output → used by both envs
│   └── vite.config.ts
│
├── cloudflare/                       # PRODUCTION DEPLOYMENT (all CF code)
│   ├── wrangler.jsonc                # Cloudflare configuration
│   ├── schema.sql                    # D1 database schema
│   ├── package.json                  # CF-specific dependencies
│   ├── tsconfig.json
│   │
│   ├── src/                          # Worker code (runs on edge)
│   │   ├── index.ts                  # Main entry, routing
│   │   ├── handlers/
│   │   │   ├── generate.ts           # /api/generate-stream handler
│   │   │   ├── sessions.ts           # /api/sessions/* handlers
│   │   │   ├── upload.ts             # /api/upload handler
│   │   │   └── media.ts              # /api/media/* handler
│   │   └── lib/
│   │       ├── sse.ts                # SSE utilities
│   │       ├── storage.ts            # R2/D1 helpers
│   │       ├── auth.ts               # API key validation
│   │       └── validation.ts         # Zod schemas
│   │
│   ├── sandbox/                      # Container code (runs in sandbox)
│   │   ├── package.json              # Container dependencies (SDK, Sharp, etc.)
│   │   ├── tsconfig.json
│   │   ├── agent-runner.ts           # Main SDK orchestrator
│   │   ├── orchestrator-prompt.ts    # System prompt
│   │   └── lib/
│   │       ├── checkpoint-emitter.ts # Event emission via stdout
│   │       └── storage-client.ts     # R2 file operations
│   │
│   ├── agent/                        # BUILD ARTIFACT (copied from ../agent/)
│   │   └── .claude/skills/           # Copied during prebuild
│   │
│   ├── public/                       # BUILD ARTIFACT (copied from ../frontend/dist/)
│   │   └── ...                       # React app static files
│   │
│   ├── Dockerfile                    # Container image definition
│   └── README.md                     # CF deployment instructions
│
├── sessions/                         # Local session storage (gitignored)
├── uploads/                          # Local uploads (gitignored)
└── docs/
    ├── ARCHITECTURE.md
    └── CLOUDFLARE_DEPLOYMENT_PLAN.md
```

### 4.2 Build Process

The `agent/` folder is copied into `cloudflare/agent/` during the build. This is explicit and auditable.

**cloudflare/package.json:**
```json
{
  "name": "fashion-shoot-agent-cloudflare",
  "scripts": {
    "prebuild": "rm -rf agent && cp -r ../agent ./agent",
    "build:frontend": "cd ../frontend && npm run build && rm -rf ../cloudflare/public && cp -r dist ../cloudflare/public",
    "build": "npm run prebuild && npm run build:frontend",
    "deploy": "npm run build && npx wrangler deploy",
    "deploy:only": "npx wrangler deploy",
    "dev": "npx wrangler dev",
    "tail": "npx wrangler tail"
  },
  "dependencies": {
    "@cloudflare/sandbox": "^0.6.3"
  },
  "devDependencies": {
    "wrangler": "^3.99.0",
    "@cloudflare/workers-types": "^4.20250109.0",
    "typescript": "^5.7.0"
  }
}
```

> **Note:** The `build:frontend` script copies the frontend build output to `cloudflare/public/` because Wrangler may not resolve parent directory paths (`../frontend/dist`) correctly during deployment.

**cloudflare/sandbox/package.json:**
```json
{
  "name": "fashion-shoot-sandbox",
  "type": "module",
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.73",
    "sharp": "^0.33.5",
    "zod": "^3.24.0",
    "tsx": "^4.19.0"
  }
}
```

### 4.3 .gitignore Strategy

```gitignore
# Root .gitignore additions for Option C
cloudflare/agent/          # Build artifact (copied from ../agent/)
cloudflare/public/         # Build artifact (copied from ../frontend/dist/)
cloudflare/.wrangler/      # Wrangler cache
```

These directories are gitignored because:
- They're build artifacts, not source code
- Source of truth is `../agent/` and `../frontend/`
- Prevents merge conflicts from duplicate files
- Rebuilt fresh on every deploy

### 4.4 Migration Tasks

#### Task 4.4.1: Create Worker Entry Point

```typescript
// cloudflare/src/index.ts
import { getSandbox, proxyToSandbox, type Sandbox } from "@cloudflare/sandbox";
export { Sandbox } from "@cloudflare/sandbox";

export interface Env {
  Sandbox: DurableObjectNamespace<Sandbox>;
  DB: D1Database;
  STORAGE: R2Bucket;
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY: string;
  FAL_KEY: string;
  KLING_ACCESS_KEY: string;
  KLING_SECRET_KEY: string;
  AWS_ACCESS_KEY_ID: string;
  AWS_SECRET_ACCESS_KEY: string;
  CF_ACCOUNT_ID: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Restrict in production
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Handle sandbox proxy
    const proxyResponse = await proxyToSandbox(request, env);
    if (proxyResponse) return proxyResponse;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // API routes
    if (url.pathname.startsWith("/api/")) {
      return handleAPI(request, env, ctx, url);
    }

    // Serve static assets (React frontend)
    return env.ASSETS.fetch(request);
  },
};

async function handleAPI(request: Request, env: Env, ctx: ExecutionContext, url: URL): Promise<Response> {
  try {
    if (url.pathname === "/api/health") {
      return Response.json({ status: "ok", timestamp: new Date().toISOString() });
    }
    if (url.pathname === "/api/generate-stream" && request.method === "POST") {
      return handleGenerate(request, env, ctx);
    }
    if (url.pathname === "/api/upload" && request.method === "POST") {
      return handleUpload(request, env);
    }
    if (url.pathname.startsWith("/api/sessions")) {
      return handleSessions(request, env, url);
    }
    if (url.pathname.startsWith("/api/media/")) {
      return handleMedia(request, env, url);
    }
    return new Response("Not Found", { status: 404 });
  } catch (error) {
    console.error("API Error:", error);
    return Response.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
```

#### Task 4.4.2: Create Dockerfile

```dockerfile
# cloudflare/Dockerfile
FROM docker.io/cloudflare/sandbox:0.6.3

# Install Node.js 20 and system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    git \
    ffmpeg \
    libvips-dev \
    python3 \
    make \
    g++ \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Configure for non-interactive execution (CRITICAL for containers)
ENV HOME=/root
ENV CI=true
ENV CLAUDE_CODE_SKIP_EULA=true
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
ENV TERM=dumb
ENV NO_COLOR=1

# Install Claude Code CLI globally
RUN npm install -g @anthropic-ai/claude-code

# Pre-configure Claude Code (prevents interactive prompts)
RUN mkdir -p /root/.claude && \
    echo '{"ackTosVersion": 2, "hasCompletedOnboarding": true}' > /root/.claude/settings.json

# Create directories (R2 mount point MUST exist)
RUN mkdir -p /storage /workspace
WORKDIR /workspace

# Copy sandbox dependencies and install
COPY sandbox/package.json sandbox/package-lock.json /workspace/
RUN npm ci

# Rebuild Sharp for Linux
RUN npm rebuild sharp

# Copy agent folder (skills + scripts) - copied during prebuild
COPY agent/ /workspace/agent/

# Copy sandbox code
COPY sandbox/agent-runner.ts /workspace/
COPY sandbox/orchestrator-prompt.ts /workspace/
COPY sandbox/lib/ /workspace/lib/
```

#### Task 4.4.3: Create Wrangler Configuration

```jsonc
// cloudflare/wrangler.jsonc
{
  "$schema": "https://raw.githubusercontent.com/cloudflare/workers-sdk/main/packages/wrangler/schemas/config.schema.json",
  "name": "fashion-shoot-agent",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],

  // Static assets - copied from frontend/dist during build
  "assets": {
    "directory": "./public",
    "not_found_handling": "single-page-application",
    "binding": "ASSETS"
  },

  // Container configuration
  "containers": [{
    "class_name": "Sandbox",
    "image": "./Dockerfile",
    "instance_type": "standard-2",
    "max_instances": 10
  }],

  // Durable Object binding
  "durable_objects": {
    "bindings": [{
      "name": "Sandbox",
      "class_name": "Sandbox"
    }]
  },

  // D1 database
  "d1_databases": [{
    "binding": "DB",
    "database_name": "fashion-shoot-sessions",
    "database_id": "YOUR_DATABASE_ID_HERE"
  }],

  // R2 bucket
  "r2_buckets": [{
    "binding": "STORAGE",
    "bucket_name": "fashion-shoot-storage"
  }],

  // Environment variables (non-secret)
  "vars": {
    "ENVIRONMENT": "production",
    "CF_ACCOUNT_ID": "YOUR_ACCOUNT_ID_HERE"
  },

  // Durable Object migrations
  "migrations": [{
    "tag": "v1",
    "new_sqlite_classes": ["Sandbox"]
  }]
}
```

#### Task 4.4.4: Create Agent Runner (SDK Orchestrator)

```typescript
// cloudflare/sandbox/agent-runner.ts
import { query } from "@anthropic-ai/claude-agent-sdk";
import { ORCHESTRATOR_SYSTEM_PROMPT } from "./orchestrator-prompt";

// CRITICAL: Async generator for prompt (prevents "stream closed" errors)
async function* createPromptGenerator(prompt: string, signal: AbortSignal) {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: prompt },
    parent_tool_use_id: null
  };
  await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve()));
}

async function main() {
  const prompt = process.env.PROMPT!;
  const sessionId = process.env.SESSION_ID!;

  console.error(`[agent] Starting session: ${sessionId}`);

  const abortController = new AbortController();
  const messages: any[] = [];

  try {
    for await (const message of query({
      prompt: createPromptGenerator(prompt, abortController.signal),
      options: {
        cwd: '/workspace/agent',              // Agent folder with skills
        systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
        settingSources: ['project'],          // CRITICAL: Load skills from filesystem
        model: 'claude-sonnet-4-20250514',
        maxTurns: 100,

        // CRITICAL: Use default + canUseTool, NOT bypassPermissions
        permissionMode: 'default',
        canUseTool: async () => true,

        allowedTools: [
          'Task', 'Skill', 'TodoWrite',
          'Read', 'Write', 'Edit', 'Glob', 'Grep',
          'Bash', 'WebFetch'
        ]
      }
    })) {
      messages.push(message);

      // Emit progress via stderr (captured by Worker)
      if (message.type === 'assistant') {
        console.error(`[progress] ${JSON.stringify(message)}`);
      }
    }

    abortController.abort();
    console.log(JSON.stringify({ sessionId, messages, success: true }));

  } catch (error: any) {
    abortController.abort();
    console.error(`[agent] Error: ${error.message}`);
    console.log(JSON.stringify({ sessionId, error: error.message, success: false }));
    process.exit(1);
  }
}

main();
```

#### Task 4.4.5: Migrate Session Management

**From:** File-based JSON (`server/lib/session-manager.ts`)
**To:** D1 database with R2 storage (`cloudflare/src/lib/storage.ts`)

Key changes:
- Replace `fs.writeFile/readFile` with D1 queries
- Replace local file paths with R2 keys
- Add proper error handling and transactions

#### Task 4.4.6: Migrate Checkpoint Detection

**Current:** PostToolUse hooks in `server/lib/ai-client.ts`
**Target:** Same logic in `cloudflare/sandbox/agent-runner.ts`, emit via stdout

The checkpoint detection logic stays the same, but output format changes:
```typescript
// Emit checkpoint via stdout (Worker captures this)
console.log(JSON.stringify({
  type: 'checkpoint',
  stage: 'hero',
  artifact: '/storage/outputs/hero.png',
  message: 'Hero image generated'
}));
```

### 4.5 File Mapping

| Current File | Target Location | Changes |
|--------------|-----------------|---------|
| `server/sdk-server.ts` | `cloudflare/src/index.ts` + `cloudflare/src/handlers/*` | Split into Worker handlers |
| `server/lib/ai-client.ts` | `cloudflare/sandbox/agent-runner.ts` | Run in container |
| `server/lib/session-manager.ts` | `cloudflare/src/lib/storage.ts` | D1/R2 integration |
| `server/lib/instrumentor.ts` | `cloudflare/sandbox/lib/` | Run in container |
| `server/lib/orchestrator-prompt.ts` | `cloudflare/sandbox/orchestrator-prompt.ts` | Copy to sandbox |
| `agent/` | `cloudflare/agent/` | Copied during prebuild |
| `frontend/dist/` | `cloudflare/public/` | Copied during build (Wrangler needs local path) |

---

## 5. Testing Strategy

### 5.1 Local Development Testing (Express Server)

Test locally using the existing Express server (no Cloudflare):

```bash
# Terminal 1: Start Express backend
npm run server              # Runs server/sdk-server.ts on :3002

# Terminal 2: Start Vite frontend
npm run dev                 # Runs Vite on :5173, proxies to :3002

# Test full pipeline locally before migrating
```

### 5.2 Cloudflare Local Development

Test the Cloudflare deployment locally using Wrangler:

```bash
# From cloudflare/ directory
cd cloudflare

# Copy agent folder (prebuild step)
npm run prebuild

# Start local Wrangler dev server
npm run dev                 # Runs wrangler dev on :8787

# Test health endpoint
curl http://localhost:8787/api/health

# Test file upload
curl -X POST http://localhost:8787/api/upload \
  -F "images=@test-image.jpg"

# Test generation (SSE stream)
curl -N -X POST http://localhost:8787/api/generate-stream \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Confident fashion editorial", "sessionId": "test-123"}'
```

### 5.3 Container Testing

Test the container image locally before deploying:

```bash
# From cloudflare/ directory
cd cloudflare

# Copy agent folder first
npm run prebuild

# Build container locally
docker build -t fashion-agent-sandbox .

# Test container has correct files
docker run --rm -it fashion-agent-sandbox ls -la /workspace/agent/.claude/skills/

# Test generation scripts are accessible
docker run --rm -it fashion-agent-sandbox \
  ls -la /workspace/agent/.claude/skills/fashion-shoot-pipeline/scripts/

# Test with environment variables
docker run --rm -it \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  -e PROMPT="Test prompt" \
  -e SESSION_ID="test-123" \
  fashion-agent-sandbox \
  npx tsx /workspace/agent-runner.ts
```

### 5.4 Integration Testing

| Test Case | Expected Outcome |
|-----------|------------------|
| Upload image | Returns R2 key, file visible in bucket |
| Generate hero | Checkpoint emitted, image in R2 |
| Full pipeline | All 6 checkpoints, final video in R2 |
| Session resume | Continues from last checkpoint |
| Session list | Returns recent sessions from D1 |
| Media fetch | Returns image/video with cache headers |

### 5.5 Load Testing

```bash
# Use k6 or similar tool
k6 run --vus 10 --duration 30s load-test.js
```

Targets:
- 10 concurrent users
- < 2s response time for API endpoints
- < 5min for full pipeline completion
- No errors under normal load

---

## 6. Deployment Process

All deployment commands run from the `cloudflare/` directory.

### 6.1 First-Time Setup

```bash
cd cloudflare

# 1. Install dependencies
npm install

# 2. Create D1 database
npx wrangler d1 create fashion-shoot-sessions
# Copy the database_id and update wrangler.jsonc

# 3. Create R2 bucket
npx wrangler r2 bucket create fashion-shoot-storage

# 4. Generate R2 API credentials (in Cloudflare Dashboard)
# R2 > Manage R2 API Tokens > Create API Token
# Save the Access Key ID and Secret Access Key

# 5. Set secrets
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put FAL_KEY
npx wrangler secret put KLING_ACCESS_KEY
npx wrangler secret put KLING_SECRET_KEY
npx wrangler secret put AWS_ACCESS_KEY_ID      # R2 credentials
npx wrangler secret put AWS_SECRET_ACCESS_KEY  # R2 credentials

# 6. Initialize database schema
npx wrangler d1 execute fashion-shoot-sessions --file=schema.sql
```

### 6.2 Staging Deployment

```bash
cd cloudflare

# 1. Build (copies agent folder + builds frontend)
npm run build

# 2. Deploy to staging
npx wrangler deploy --env staging

# 3. Smoke test
curl https://fashion-shoot-agent-staging.YOUR_SUBDOMAIN.workers.dev/api/health
```

### 6.3 Production Deployment

```bash
cd cloudflare

# 1. Verify staging is working first

# 2. Deploy to production (includes prebuild + frontend build)
npm run deploy

# 3. Verify deployment
npx wrangler deployments list

# 4. Monitor logs
npx wrangler tail
```

### 6.4 Rollback Procedure

```bash
cd cloudflare

# List recent deployments
npx wrangler deployments list

# Rollback to previous version
npx wrangler rollback --deployment <deployment-id>
```

### 6.5 Force Clean Deploy (After Dockerfile Changes)

Container images are cached. After Dockerfile changes, force a clean rebuild:

```bash
cd cloudflare

# Clean everything
rm -rf node_modules .wrangler agent/
docker builder prune -f

# Reinstall and redeploy
npm install
npm run deploy
```

### 6.6 CI/CD Pipeline (GitHub Actions)

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare

on:
  push:
    branches: [main]
    paths:
      - 'cloudflare/**'
      - 'agent/**'        # Trigger on skill changes
      - 'frontend/**'     # Trigger on frontend changes

jobs:
  deploy:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: ./cloudflare    # All commands run from cloudflare/

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install cloudflare dependencies
        run: npm ci

      - name: Copy agent folder
        run: rm -rf agent && cp -r ../agent ./agent

      - name: Build frontend
        run: cd ../frontend && npm ci && npm run build

      - name: Deploy to Cloudflare
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CF_API_TOKEN }}
          accountId: ${{ secrets.CF_ACCOUNT_ID }}
          workingDirectory: './cloudflare'
```

---

## 7. Post-Deployment Operations

### 7.1 Monitoring Setup

**Cloudflare Dashboard:**
- Workers Analytics: Request volume, error rates, latency
- R2 Metrics: Storage usage, bandwidth
- D1 Metrics: Query performance, row counts

**Custom Metrics (via Analytics Engine):**
```typescript
// Track in Worker
env.ANALYTICS.writeDataPoint({
  blobs: [sessionId, endpoint],
  doubles: [duration],
  indexes: [statusCode.toString()],
});
```

### 7.2 Alerting

Configure Cloudflare Notifications for:
- Error rate > 5%
- Request latency p95 > 30s
- R2 storage > 80% quota
- Container failures

### 7.3 Log Analysis

```bash
cd cloudflare

# Real-time logs
npx wrangler tail

# Filter by status
npx wrangler tail --status error

# Search logs
npx wrangler tail --search "checkpoint"
```

### 7.4 Backup Strategy

| Resource | Backup Method | Frequency |
|----------|---------------|-----------|
| D1 Database | Time Travel (built-in) | Continuous (30-day retention) |
| R2 Objects | Cross-bucket replication | Optional |
| Worker Code | Git + Deployments list | Every deploy |

**D1 Point-in-Time Recovery:**
```bash
cd cloudflare
npx wrangler d1 time-travel restore fashion-shoot-sessions \
  --timestamp "2025-01-12T00:00:00Z"
```

### 7.5 Session Cleanup

Implement D1 scheduled cleanup:
```sql
-- Run daily via scheduled Worker
DELETE FROM sessions
WHERE status = 'completed'
AND updated_at < datetime('now', '-7 days');

DELETE FROM session_assets
WHERE session_id NOT IN (SELECT id FROM sessions);
```

---

## 8. Risk Mitigation

### 8.1 Known Limitations

| Limitation | Impact | Mitigation |
|------------|--------|------------|
| Container cold start (2-5s) | Slower first request | Use `sleepAfter` to keep warm |
| Container timeout (10min max) | Long pipelines may timeout | Checkpoint-based resume |
| R2 mounting requires production | Can't test locally | Mock with local filesystem |
| D1 eventual consistency | Stale reads possible | Accept or use read-after-write |

### 8.2 Fallback Strategies

| Failure | Fallback |
|---------|----------|
| Container unavailable | Return 503, retry with backoff |
| R2 unavailable | Return 503, no fallback storage |
| D1 unavailable | Cache session in Worker memory (temporary) |
| External API down | Return error with retry suggestion |

### 8.3 Security Hardening Checklist

- [ ] API keys stored as Wrangler Secrets only
- [ ] CORS restricted to specific domains
- [ ] File upload validation (type, size, content)
- [ ] Prompt sanitization before SDK
- [ ] Rate limiting enabled
- [ ] No sensitive data in logs
- [ ] R2 bucket not publicly accessible
- [ ] D1 queries parameterized (no SQL injection)

---

## 9. Success Criteria

### 9.1 Functional Requirements

- [ ] Full pipeline completes (hero → contact sheet → frames → clips → final)
- [ ] Checkpoints display correctly in frontend
- [ ] Session resume works after browser refresh
- [ ] Media files load with < 1s latency (cached)
- [ ] Multiple concurrent sessions supported

### 9.2 Performance Requirements

- [ ] API response time p95 < 500ms (non-generation endpoints)
- [ ] Generation pipeline completes in < 10 minutes
- [ ] Frontend loads in < 2s (static assets)
- [ ] Video playback starts in < 1s

### 9.3 Reliability Requirements

- [ ] 99.9% uptime (Worker availability)
- [ ] Zero data loss (D1 + R2 durability)
- [ ] Graceful error handling (no 500 crashes)
- [ ] Successful rollback tested

### 9.4 Security Requirements

- [ ] No API keys in git history
- [ ] All secrets in Wrangler Secrets
- [ ] CORS properly configured
- [ ] Rate limiting active
- [ ] No SQL injection vulnerabilities

---

## Appendix A: Cost Estimation

| Resource | Unit Cost | Estimated Usage | Monthly Cost |
|----------|-----------|-----------------|--------------|
| Workers Paid | $5/month base | - | $5 |
| Worker Requests | $0.30/million | 100K requests | $0.03 |
| Container Compute | ~$0.01/hour | 50 hours | $0.50 |
| R2 Storage | $0.015/GB | 10 GB | $0.15 |
| R2 Operations | $0.36/million Class A | 10K ops | < $0.01 |
| D1 Reads | $0.75/million | 100K reads | $0.08 |
| D1 Writes | $1.00/million | 10K writes | $0.01 |
| **Total** | | | **~$6-15/month** |

*Note: Costs scale with usage. Heavy video generation may increase container hours.*

---

## Appendix B: Timeline

| Week | Phase | Deliverables |
|------|-------|--------------|
| 1 | Security Hardening | API key rotation, git cleanup, auth middleware |
| 2 | Infrastructure Setup | D1, R2, Wrangler config, schema |
| 3 | Worker Migration | Edge handlers, routing, SSE streaming |
| 4 | Container Migration | Dockerfile, agent-runner, scripts |
| 5 | Integration | Connect all components, end-to-end flow |
| 6 | Testing | Local, staging, load testing |
| 7 | Production Deploy | Deploy, monitoring, documentation |
| 8 | Stabilization | Bug fixes, performance tuning |

---

## Appendix C: Reference Documents

- [Cloudflare Workers Documentation](https://developers.cloudflare.com/workers/)
- [Cloudflare Containers Documentation](https://developers.cloudflare.com/workers/platform/containers/)
- [R2 Documentation](https://developers.cloudflare.com/r2/)
- [D1 Documentation](https://developers.cloudflare.com/d1/)
- [Claude Agent SDK Documentation](https://docs.anthropic.com/claude-agent-sdk)
- `cloudflare/cloudflare-agent-blueprint.md` - Internal blueprint
- `docs/ARCHITECTURE.md` - Current architecture

---

## Appendix D: Option C Architecture Summary

This deployment uses **Option C: Isolated Cloudflare Directory** - all Cloudflare production code resides in a single `cloudflare/` directory, completely separate from local development.

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Clean Separation** | Local dev (`server/`) and production (`cloudflare/`) are isolated |
| **Docker Context** | No `../` path hacks needed - Dockerfile works cleanly |
| **Independent Dependencies** | Separate `package.json` files per environment |
| **Explicit Build Process** | `prebuild` step copies `agent/` - visible and auditable |
| **Scalable** | Pattern works for multiple deployment targets (AWS, Docker Compose, etc.) |

### Directory Ownership

| Directory | Owner | Purpose |
|-----------|-------|---------|
| `server/` | Local Dev | Express.js backend for local testing |
| `agent/` | Shared | Skills (source of truth for both envs) |
| `frontend/` | Shared | React app (source of truth) |
| `cloudflare/` | Production | All Cloudflare-specific code |
| `cloudflare/agent/` | Build Artifact | Copied from `../agent/` during prebuild |
| `cloudflare/public/` | Build Artifact | Copied from `../frontend/dist/` during build |

### Workflow Summary

**Local Development:**
```bash
npm run server    # Express on :3002
npm run dev       # Vite on :5173
```

**Production Deployment:**
```bash
cd cloudflare
npm run deploy    # prebuild → build frontend → wrangler deploy
```

### Critical SDK Configuration

The Claude Agent SDK requires specific configuration to work in containers:

```typescript
// cloudflare/sandbox/agent-runner.ts
const options = {
  cwd: '/workspace/agent',           // Points to copied agent folder
  settingSources: ['project'],       // CRITICAL: Enables skill loading
  permissionMode: 'default',         // NOT bypassPermissions
  canUseTool: async () => true,      // Auto-approve tools
};
```

### Critical Pitfalls Avoided

| Pitfall | Solution |
|---------|----------|
| `bypassPermissions` exits with code 1 | Use `permissionMode: 'default'` + `canUseTool` |
| Plain string prompt causes stream close | Use async generator for prompt |
| `exec()` blocks and times out | Use `execStream()` |
| Interactive prompts hang | Set `CI=true`, pre-create settings.json |
| R2 mount fails | Ensure `/storage` exists in Dockerfile |
| Container changes not applied | Force clean rebuild with `docker builder prune` |
