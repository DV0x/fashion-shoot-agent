# Fashion Shoot Agent - Cloudflare Deployment Guide

> Complete guide for deploying Claude Agent SDK agents to Cloudflare Workers + Containers.

---

## Table of Contents

1. [Architecture](#architecture)
2. [Prerequisites](#prerequisites)
3. [Infrastructure Setup](#infrastructure-setup)
4. [Code Structure](#code-structure)
5. [Critical Configuration](#critical-configuration)
6. [Deployment Commands](#deployment-commands)
7. [Troubleshooting](#troubleshooting)
8. [Lessons Learned](#lessons-learned)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Cloudflare Edge                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │
│  │   HTTP Request  │───▶│  Worker (index) │───▶│  Sandbox (DO)   │     │
│  └─────────────────┘    └─────────────────┘    └────────┬────────┘     │
│                                │                        │               │
│                                ▼                        ▼               │
│                         ┌───────────┐          ┌─────────────────┐     │
│                         │ D1 (SQL)  │          │ Container       │     │
│                         │ Sessions  │          │ ┌─────────────┐ │     │
│                         └───────────┘          │ │agent-runner │ │     │
│                                                │ │  (SDK)      │ │     │
│                         ┌───────────┐          │ └─────────────┘ │     │
│                         │R2 (Files) │◀─────────│ /storage mount  │     │
│                         │ Images    │          └─────────────────┘     │
│                         └───────────┘                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

**Components:**
| Component | Purpose |
|-----------|---------|
| **Worker** | HTTP routing, SSE streaming, static assets |
| **Sandbox (Durable Object)** | Container orchestration via `@cloudflare/sandbox` |
| **Container** | Claude Agent SDK execution (Node.js 20, FFmpeg, Sharp) |
| **D1** | Session metadata, checkpoints |
| **R2** | File storage (images, videos, outputs) |

---

## Prerequisites

### Cloudflare Account
- Workers Paid plan ($5/month minimum)
- Containers access (included with paid plan as of June 2025)

### Local Tools
```bash
# Install wrangler CLI
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Docker Desktop (required for container builds)
# Download from: https://www.docker.com/products/docker-desktop/
```

### API Keys Required
- `ANTHROPIC_API_KEY` - Claude API access
- `FAL_KEY` - FAL.ai image generation
- `KLING_ACCESS_KEY` / `KLING_SECRET_KEY` - Kling video generation
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` - R2 S3-compatible credentials

---

## Infrastructure Setup

### 1. Create D1 Database

```bash
npx wrangler d1 create fashion-shoot-sessions
# Output: database_id: fa67eff0-e99e-4896-b5b6-20cb5f44df9f
```

### 2. Create R2 Bucket

```bash
npx wrangler r2 bucket create fashion-shoot-storage
```

### 3. Generate R2 API Credentials

1. Go to Cloudflare Dashboard → R2 → Manage R2 API Tokens
2. Create API Token with read/write permissions
3. Save Access Key ID and Secret Access Key

### 4. Set Secrets

```bash
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put FAL_KEY
npx wrangler secret put KLING_ACCESS_KEY
npx wrangler secret put KLING_SECRET_KEY
npx wrangler secret put AWS_ACCESS_KEY_ID
npx wrangler secret put AWS_SECRET_ACCESS_KEY
```

### 5. Initialize Database Schema

```bash
npx wrangler d1 execute fashion-shoot-sessions --file=schema.sql
```

---

## Code Structure

```
cloudflare/
├── src/                          # Worker code (runs on edge)
│   ├── index.ts                  # Entry point, routing, CORS
│   └── handlers/
│       ├── generate.ts           # Main SSE streaming handler
│       ├── upload.ts             # File upload to R2
│       ├── sessions.ts           # Session management
│       └── media.ts              # Serve files from R2
│
├── sandbox/                      # Container code
│   ├── agent-runner.ts           # Claude SDK orchestrator
│   ├── orchestrator-prompt.ts    # System prompt
│   ├── lib/
│   │   └── storage-client.ts     # R2 helpers
│   ├── package.json              # Container dependencies
│   └── package-lock.json         # Lock file (IMPORTANT)
│
├── agent/                        # Copied from ../agent during build
│   └── .claude/
│       └── skills/               # Agent skills
│
├── public/                       # Frontend (built from ../frontend)
│
├── Dockerfile                    # Container image definition
├── wrangler.jsonc               # Cloudflare configuration
├── schema.sql                   # D1 database schema
├── package.json                 # Worker dependencies
└── tsconfig.json
```

---

## Critical Configuration

### wrangler.jsonc

```jsonc
{
  "name": "fashion-shoot-agent",
  "main": "src/index.ts",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],

  // Static assets (React frontend)
  "assets": {
    "directory": "./public",
    "not_found_handling": "single-page-application"
  },

  // Container configuration
  "containers": [{
    "class_name": "Sandbox",
    "image": "./Dockerfile",
    "instance_type": "standard-2",  // 4GB RAM, 2 CPU
    "max_instances": 10
  }],

  // Durable Object for container orchestration
  "durable_objects": {
    "bindings": [{ "name": "Sandbox", "class_name": "Sandbox" }]
  },

  // D1 database
  "d1_databases": [{
    "binding": "DB",
    "database_name": "fashion-shoot-sessions",
    "database_id": "YOUR_DATABASE_ID"
  }],

  // R2 bucket
  "r2_buckets": [{
    "binding": "STORAGE",
    "bucket_name": "fashion-shoot-storage"
  }],

  "vars": {
    "ENVIRONMENT": "production",
    "CF_ACCOUNT_ID": "YOUR_ACCOUNT_ID"
  },

  "migrations": [{
    "tag": "v1",
    "new_sqlite_classes": ["Sandbox"]
  }]
}
```

### Dockerfile

```dockerfile
# CRITICAL: Version must match @cloudflare/sandbox npm package
FROM docker.io/cloudflare/sandbox:0.6.11

# Install Node.js 20 and dependencies
RUN apt-get update && apt-get install -y \
    curl git ffmpeg libvips-dev python3 make g++ \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# CRITICAL: Non-interactive execution settings
ENV HOME=/root
ENV CI=true
ENV CLAUDE_CODE_SKIP_EULA=true
ENV CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=true
ENV TERM=dumb
ENV NO_COLOR=1

# Install Claude Code CLI
RUN npm install -g @anthropic-ai/claude-code

# Pre-configure Claude Code (prevents interactive prompts)
RUN mkdir -p /root/.claude && \
    echo '{"ackTosVersion": 2, "hasCompletedOnboarding": true}' > /root/.claude/settings.json

# Create directories (R2 mount point MUST exist)
RUN mkdir -p /storage /workspace
WORKDIR /workspace

# Install sandbox dependencies
COPY sandbox/package.json sandbox/package-lock.json /workspace/
RUN npm ci

# Copy agent and sandbox code
COPY agent/ /workspace/agent/
COPY sandbox/agent-runner.ts /workspace/
COPY sandbox/orchestrator-prompt.ts /workspace/
COPY sandbox/lib/ /workspace/lib/

# DO NOT add CMD or ENTRYPOINT!
# Base image runs HTTP server on port 3000 for sandbox.exec() API
```

### Version Matching (CRITICAL)

The `@cloudflare/sandbox` npm package and Dockerfile base image **MUST match**:

| File | Setting |
|------|---------|
| `cloudflare/package.json` | `"@cloudflare/sandbox": "^0.6.11"` |
| `cloudflare/Dockerfile` | `FROM docker.io/cloudflare/sandbox:0.6.11` |

Mismatch causes: `Version mismatch detected! SDK version (X) does not match container version (Y)`

---

## Deployment Commands

### First Deploy

```bash
cd cloudflare

# 1. Install dependencies
npm install

# 2. Build frontend
npm run build:frontend

# 3. Deploy
npx wrangler deploy

# 4. Initialize database (first time only)
npm run db:init
```

### Update Deploy

```bash
cd cloudflare
npx wrangler deploy
```

### Force Clean Deploy (after Dockerfile/base image changes)

```bash
cd cloudflare

# 1. Clear Docker build cache
docker builder prune -a -f

# 2. Delete cached container images from Cloudflare registry
npx wrangler containers images list
npx wrangler containers images delete fashion-shoot-agent-sandbox:<tag>

# 3. Rebuild and deploy
npx wrangler deploy
```

### View Logs

```bash
npx wrangler tail --format=pretty
```

---

## Troubleshooting

### Error: "Image already exists remotely, skipping push"

**Cause:** Cloudflare's registry has cached the old image.

**Fix:**
```bash
npx wrangler containers images list
npx wrangler containers images delete fashion-shoot-agent-sandbox:<tag>
npx wrangler deploy
```

### Error: "Version mismatch detected"

**Cause:** `@cloudflare/sandbox` npm version doesn't match Dockerfile base image.

**Fix:** Ensure both match:
```bash
# package.json
"@cloudflare/sandbox": "^0.6.11"

# Dockerfile
FROM docker.io/cloudflare/sandbox:0.6.11
```

Then clear cache and redeploy.

### Error: "Container is not listening in TCP address 10.0.0.1:3000"

**Cause:** Dockerfile has CMD or ENTRYPOINT that overrides the base image's HTTP server.

**Fix:** Remove any CMD or ENTRYPOINT from Dockerfile. The base image's entrypoint must run.

### Error: "Worker code hung and would never generate a response"

**Cause:** Container setup (mountBucket, mkdir) takes too long before returning SSE stream.

**Fix:** Return SSE stream immediately, move setup inside `ctx.waitUntil()`:

```typescript
// WRONG - blocks until setup complete
await sandbox.exec(`mkdir -p /storage`);
await sandbox.mountBucket(...);
return new Response(readable, ...);

// CORRECT - return immediately, setup in background
const { readable, writable } = new TransformStream();

ctx.waitUntil((async () => {
  await writer.write(`data: {"type":"status","message":"Initializing..."}\n\n`);
  await sandbox.exec(`mkdir -p /storage`);
  await sandbox.mountBucket(...);
  // ... rest of processing
})());

return new Response(readable, { headers: { 'Content-Type': 'text/event-stream' } });
```

### Error: Docker build "input/output error"

**Cause:** Docker Desktop disk issue.

**Fix:**
```bash
# Restart Docker Desktop
killall Docker && open -a Docker

# Or clear Docker data
# Docker Desktop → Settings → Troubleshoot → Clean/Purge data
```

---

## Lessons Learned

### 1. Container Base Image Version Matters

The `@cloudflare/sandbox` package communicates with the container via HTTP on port 3000. Version mismatches cause protocol errors.

### 2. Don't Override Container Entrypoint

The base image (`cloudflare/sandbox:X.X.X`) runs an HTTP server that handles `sandbox.exec()`, `sandbox.mountBucket()`, etc. Adding CMD/ENTRYPOINT replaces this server.

### 3. Return SSE Stream Immediately

Workers have a 30-second timeout. Container cold start + setup can take 15+ seconds. Return the SSE response immediately and do setup in `ctx.waitUntil()`.

### 4. Container Caching is Aggressive

Cloudflare caches container images by content hash. Changes to Dockerfile comments don't trigger rebuilds. To force rebuild:
1. Delete from registry: `npx wrangler containers images delete`
2. Or change actual content (add a RUN echo command)

### 5. Lock Files Matter

Include `package-lock.json` in the sandbox directory and use `npm ci` instead of `npm install` for reproducible builds.

### 6. SDK Prompt Must Be Async Generator

For long-running agent tasks, use async generator pattern:

```typescript
async function* createPromptGenerator(prompt: string, signal: AbortSignal) {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: prompt },
    parent_tool_use_id: null,
  };
  await new Promise<void>((resolve) => {
    signal.addEventListener("abort", () => resolve());
  });
}
```

### 7. Permission Mode

Use `permissionMode: 'default'` with `canUseTool: async () => true`, NOT `bypassPermissions`.

### 8. SSE Token Streaming Must Use JSON

String markers like `[token] text` corrupt token text due to `console.error()` newlines and regex parsing issues. Use JSON instead:

**agent-runner.ts:**
```typescript
// WRONG - causes word splitting ("cin ematic")
console.error(`[token] ${delta.text}`);

// CORRECT - preserves exact token text
console.error(JSON.stringify({ t: "token", d: delta.text }));
```

**generate.ts (Worker):**
```typescript
// Parse JSON events from container stderr
try {
  const parsed = JSON.parse(data.trim());
  if (parsed.t === "token") {
    await writer.write(encoder.encode(
      `data: ${JSON.stringify({ type: "text_delta", text: parsed.d })}\n\n`
    ));
  }
} catch {
  // Not JSON - ignore or log
}
```

### 9. Idempotent Session & Mount Operations

Same `sessionId` = same Durable Object = same container instance. Operations must handle "already exists" cases:

**Session upsert (D1):**
```typescript
async function ensureSession(env: Env, sessionId: string): Promise<void> {
  const existing = await env.DB.prepare(`SELECT id FROM sessions WHERE id = ?`).bind(sessionId).first();
  if (existing) {
    await env.DB.prepare(`UPDATE sessions SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(sessionId).run();
  } else {
    await env.DB.prepare(`INSERT INTO sessions (id, status, pipeline_stage) VALUES (?, 'active', 'init')`).bind(sessionId).run();
  }
}
```

**Mount bucket safely (R2):**
```typescript
async function mountBucketSafe(sandbox, bucketName, mountPath, options): Promise<void> {
  try {
    await sandbox.mountBucket(bucketName, mountPath, options);
  } catch (error: any) {
    if (error?.message?.includes("already in use")) {
      console.log(`Bucket already mounted, continuing...`);
      return;
    }
    throw error;
  }
}
```

---

## SSE Event Flow

```
Agent-Runner (Container)              Worker (Edge)                    Frontend
        │                                   │                              │
        │ JSON.stringify({t:"token",d:"Hi"})│                              │
        ├──────────────────────────────────►│                              │
        │                                   │ { type: "text_delta",        │
        │                                   │   text: "Hi" }               │
        │                                   ├─────────────────────────────►│
        │                                   │                              │
        │ JSON.stringify({t:"thinking"})    │                              │
        ├──────────────────────────────────►│                              │
        │                                   │ { type: "message_type_hint", │
        │                                   │   messageType: "thinking" }  │
        │                                   ├─────────────────────────────►│
        │                                   │                              │
        │ JSON.stringify({t:"tool",d:"Bash"})                              │
        ├──────────────────────────────────►│                              │
        │                                   │ { type: "system",            │
        │                                   │   subtype: "tool_call" }     │
        │                                   ├─────────────────────────────►│
        │                                   │                              │
        │ JSON.stringify({t:"assistant"})   │                              │
        ├──────────────────────────────────►│                              │
        │                                   │ { type: "assistant_message" }│
        │                                   ├─────────────────────────────►│
```

**Event Types:**
| Container JSON | Worker SSE | Purpose |
|----------------|------------|---------|
| `{t:"token",d:"..."}` | `text_delta` | Stream token text |
| `{t:"thinking"}` | `message_type_hint` | Mark as thinking message |
| `{t:"tool",d:"Bash"}` | `system/tool_call` | Tool activity indicator |
| `{t:"tool_done"}` | `system/tool_result` | Tool completed |
| `{t:"assistant"}` | `assistant_message` | Message complete |

---

## Quick Reference

| Task | Command |
|------|---------|
| Deploy | `npx wrangler deploy` |
| View logs | `npx wrangler tail --format=pretty` |
| List container images | `npx wrangler containers images list` |
| Delete container image | `npx wrangler containers images delete <name>:<tag>` |
| Clear Docker cache | `docker builder prune -a -f` |
| Test health | `curl https://fashion-shoot-agent.alphasapien17.workers.dev/api/health` |

---

## URLs

- **Production**: https://fashion-shoot-agent.alphasapien17.workers.dev
- **Health Check**: https://fashion-shoot-agent.alphasapien17.workers.dev/api/health
- **Cloudflare Dashboard**: https://dash.cloudflare.com

---

*Last Updated: 2026-01-14 (SSE JSON streaming fix)*
