# Cloudflare Session Architecture - Complete Analysis

> **Purpose**: Comprehensive documentation of session management architecture for Fashion Shoot Agent on Cloudflare
> **Last Updated**: 2025-01-15
> **Status**: Architecture Finalized, Implementation Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Two Session Types](#2-two-session-types)
3. [Critical Discovery: Container Filesystem is Ephemeral](#3-critical-discovery-container-filesystem-is-ephemeral)
4. [Finalized Architecture](#4-finalized-architecture)
5. [Message Storage Strategy](#5-message-storage-strategy)
6. [Implementation Plan](#6-implementation-plan)
7. [Data Flow Diagrams](#7-data-flow-diagrams)
8. [Schema Updates](#8-schema-updates)
9. [Code Changes Required](#9-code-changes-required)
10. [Testing Checklist](#10-testing-checklist)

---

## 1. Executive Summary

### Problem Statement

The Cloudflare deployment has a **critical architectural flaw** in session management that causes the pipeline to restart from scratch on every "continue" request.

### Root Cause

1. **Container Sessions**: Missing get-or-create pattern (throws `SessionAlreadyExistsError`)
2. **SDK Sessions**: Not captured, stored, or resumed
3. **Container Filesystem**: Ephemeral - SDK's internal session files are lost on container restart

### Finalized Solution

| Component | Solution |
|-----------|----------|
| Container Session | Get-or-create pattern with try/catch fallback |
| SDK Session ID | Capture from `system.init`, store in D1 |
| Message History | Store in D1 at checkpoints (survives container restart) |
| Resumption | Try SDK resume first, fallback to reconstructed context |

---

## 2. Two Session Types

### 2.1 Container Session (Cloudflare Infrastructure)

**What it is**: The execution environment managed by Cloudflare Containers (Durable Objects).

```
┌─────────────────────────────────────────────────────────────────┐
│           CONTAINER SESSION (The "Office/Workspace")             │
├─────────────────────────────────────────────────────────────────┤
│  • Environment variables (API keys)                              │
│  • File system access (R2 mounts)                                │
│  • Running processes (Node.js, FFmpeg, Sharp)                    │
│  • Tools available for execution                                 │
│                                                                  │
│  Managed by: Cloudflare Durable Objects                          │
│  Lifecycle: Created → Running → Idle → Evicted                   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 SDK Session (Claude Agent SDK)

**What it is**: Claude's conversation memory - what was discussed and decided.

```
┌─────────────────────────────────────────────────────────────────┐
│           SDK SESSION (Claude's "Memory/Notebook")               │
├─────────────────────────────────────────────────────────────────┤
│  • "User asked for fashion shoot"                                │
│  • "I generated hero.png"                                        │
│  • "I'm at checkpoint 1"                                         │
│  • "Next step: contact sheet"                                    │
│                                                                  │
│  Managed by: Claude Agent SDK internally                         │
│  Storage: ~/.claude/projects/ (EPHEMERAL in container!)          │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Relationship

```
Web Session: session_abc123
     │
     ├─→ D1 Record (persistent ✅)
     │       • sdk_session_id
     │       • messages (JSON)
     │       • pipeline_stage
     │
     ├─→ Container Session: exec-session_abc123 (recreatable)
     │       • Execution environment
     │       • Filesystem (EPHEMERAL ❌)
     │
     └─→ SDK Session: sdk_xyz789
             • Conversation memory
             • Stored in ~/.claude/projects/ (EPHEMERAL ❌)
```

---

## 3. Critical Discovery: Container Filesystem is Ephemeral

### 3.1 Durable Object Lifecycle

| State | Duration | What Happens |
|-------|----------|--------------|
| Active | During request | Processing normally |
| Idle | 70-140 seconds | Waiting for requests |
| Evicted | After idle timeout | **In-memory state lost** |
| Hibernated | 10+ seconds (if conditions met) | Reduced resource usage |

### 3.2 Container Filesystem Behavior

**CRITICAL**: When container sleeps or restarts, the filesystem is **completely wiped**.

```
Container Start → SDK creates ~/.claude/projects/sdk_xyz789
                                    ↓
Container Idle (70-140 seconds) → Container Sleeps
                                    ↓
Container Restart → Fresh Filesystem → sdk_xyz789 GONE!
```

**Official Cloudflare Documentation**:
> "All disk is ephemeral. When a Container instance goes to sleep, the next time it is started, it will have a fresh disk as defined by its container image."

### 3.3 What Survives vs What's Lost

| Storage | Survives Restart? | Use For |
|---------|-------------------|---------|
| Container filesystem (`~/.claude/projects/`) | ❌ **NO** | Temporary files only |
| Durable Object SQLite | ✅ **YES** | Container-specific state |
| D1 Database | ✅ **YES** | Session data, messages |
| R2 Storage | ✅ **YES** | Assets (images, videos) |

### 3.4 Impact on SDK Resume

```
WITHOUT Message Storage:
┌─────────────────────────────────────────────────────────────────┐
│ 1. Generate hero → SDK session created → sdk_session_id saved   │
│ 2. User idle → Container sleeps → Filesystem wiped              │
│ 3. Continue request → New container → Fresh filesystem          │
│ 4. query({ resume: sdk_xyz789 }) → SDK: "Unknown session!" ❌   │
└─────────────────────────────────────────────────────────────────┘

WITH Message Storage (Our Solution):
┌─────────────────────────────────────────────────────────────────┐
│ 1. Generate hero → Messages saved to D1 at checkpoint           │
│ 2. User idle → Container sleeps → Filesystem wiped              │
│ 3. Continue request → Retrieve messages from D1                 │
│ 4. Reconstruct context → Agent continues correctly ✅           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Finalized Architecture

### 4.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLOUDFLARE WORKER                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐      │
│  │   D1 Database   │    │   R2 Storage    │    │  Durable Object │      │
│  │                 │    │                 │    │    (Sandbox)    │      │
│  │ - sessions      │    │ - uploads/      │    │                 │      │
│  │ - sdk_session_id│    │ - outputs/      │    │ Container with  │      │
│  │ - messages ←NEW │    │                 │    │ agent-runner.ts │      │
│  │ - checkpoints   │    │                 │    │                 │      │
│  └────────┬────────┘    └────────┬────────┘    └────────┬────────┘      │
│           │                      │                      │                │
│           └──────────────────────┼──────────────────────┘                │
│                                  │                                       │
│  ┌───────────────────────────────┴───────────────────────────────────┐  │
│  │                        Request Handlers                            │  │
│  │                                                                    │  │
│  │  generate.ts:                 sessions.ts:                         │  │
│  │  - getOrCreateSession()       - getOrCreateSession()               │  │
│  │  - Capture sdk_session_id     - Retrieve sdk_session_id + messages │  │
│  │  - Store messages at checkpoint - Pass context to agent-runner     │  │
│  │  - Stream SSE events          - Stream SSE events                  │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CONTAINER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  agent-runner.ts:                                                        │
│  - Receive PREVIOUS_MESSAGES env var (for context reconstruction)       │
│  - Try SDK resume if SDK_SESSION_ID provided                            │
│  - Fallback to reconstructed context if resume fails                    │
│  - Emit all messages for storage                                        │
│  - Emit checkpoint signals for D1 saves                                 │
│                                                                          │
│  Filesystem: EPHEMERAL (assume nothing survives restart)                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Session State Machine

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         SESSION LIFECYCLE                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌───────────┐  │
│  │  INIT   │────▶│  GENERATING │────▶│ CHECKPOINT  │────▶│ COMPLETED │  │
│  └─────────┘     └─────────────┘     └──────┬──────┘     └───────────┘  │
│       │                                     │                            │
│       │         Container: created          │                            │
│       │         SDK Session: created        │                            │
│       │         Messages: collecting        │                            │
│       │                                     │                            │
│       │                              ┌──────┴──────┐                     │
│       │                              │ 💾 SAVE TO  │                     │
│       │                              │    D1       │                     │
│       │                              └──────┬──────┘                     │
│       │                                     │                            │
│       │                              User goes idle                      │
│       │                              Container may sleep                 │
│       │                              Filesystem wiped                    │
│       │                                     │                            │
│       │                              ┌──────┴──────┐                     │
│       │                              │  CONTINUE   │                     │
│       │                              └──────┬──────┘                     │
│       │                                     │                            │
│       │                              New container (maybe)               │
│       │                              Load messages from D1               │
│       │                              Reconstruct context                 │
│       │                                     │                            │
│       │                              ┌──────┴──────┐                     │
│       │                              │ GENERATING  │                     │
│       │                              └─────────────┘                     │
│       │                                     │                            │
│       └─────────────────────────────────────┘                            │
│                     (cycle continues)                                    │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Data Model

```typescript
// D1 Session Record (Updated)
interface SessionRecord {
  id: string;                    // Web session ID: session_1705258941234_abc
  created_at: string;            // ISO timestamp
  updated_at: string;            // ISO timestamp
  status: 'active' | 'completed' | 'error' | 'expired';
  pipeline_stage: 'init' | 'hero' | 'contact-sheet' | 'frames' | 'clips' | 'complete';
  sdk_session_id: string | null; // SDK session ID (for resume attempt)
  messages: string;              // JSON array of all messages (NEW)
  message_count: number;         // Quick count without parsing JSON (NEW)
  total_cost_usd: number;
  total_turns: number;
  error_message: string | null;
  metadata: object;
}
```

---

## 5. Message Storage Strategy

### 5.1 Checkpoint-Based Saving (Recommended)

Save messages at natural pause points (checkpoints) rather than on every message.

```
Timeline:
─────────────────────────────────────────────────────────────────▶
  │         │              │              │              │
Start    Hero done     Contact done   Frames done    Complete
  │         │              │              │              │
  │      💾 SAVE        💾 SAVE        💾 SAVE        💾 SAVE
  │    [10 msgs]     [25 msgs]      [40 msgs]      [60 msgs]
```

### 5.2 Message Types to Store

```typescript
// Messages emitted by SDK
const messageTypes = [
  // User input
  { type: 'user', content: 'Create a fashion shoot...' },

  // Assistant response
  { type: 'assistant', content: "I'll create a hero image..." },

  // Tool calls
  { type: 'tool_use', id: 'tool_1', name: 'Bash', input: { command: '...' } },

  // Tool results
  { type: 'tool_result', tool_use_id: 'tool_1', content: 'Success...' },

  // System messages
  { type: 'system', subtype: 'init', session_id: 'sdk_xyz789' },
];
```

### 5.3 Storage Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                 CONTAINER (agent-runner.ts)                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  const messages = [];                                            │
│                                                                  │
│  for await (const msg of query({...})) {                        │
│    messages.push(msg);                                           │
│                                                                  │
│    // Emit for collection                                        │
│    emitSSE({ type: 'sdk_message', message: msg });              │
│                                                                  │
│    // At checkpoint, signal save                                 │
│    if (isCheckpoint(msg)) {                                      │
│      emitSSE({ type: 'save_checkpoint', messages });            │
│    }                                                             │
│  }                                                               │
│                                                                  │
│  // Final save                                                   │
│  emitSSE({ type: 'save_checkpoint', messages, final: true });   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 WORKER (generate.ts)                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  for await (const event of parseContainerStream(execStream)) {  │
│    if (event.type === 'save_checkpoint') {                      │
│      await env.DB.prepare(`                                      │
│        UPDATE sessions                                           │
│        SET messages = ?, message_count = ?, updated_at = ?      │
│        WHERE id = ?                                              │
│      `).bind(                                                    │
│        JSON.stringify(event.messages),                           │
│        event.messages.length,                                    │
│        new Date().toISOString(),                                 │
│        sessionId                                                 │
│      ).run();                                                    │
│    }                                                             │
│  }                                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.4 Context Reconstruction

When continuing after container restart:

```typescript
// sessions.ts - handleContinueStream
const session = await env.DB.prepare(
  'SELECT sdk_session_id, messages, pipeline_stage FROM sessions WHERE id = ?'
).bind(sessionId).first();

const previousMessages = JSON.parse(session.messages || '[]');

// Pass to container
const execStream = await container.execStream("npx tsx agent-runner.ts", {
  env: {
    PROMPT: userPrompt,
    SESSION_ID: sessionId,
    SDK_SESSION_ID: session.sdk_session_id || '',
    PREVIOUS_MESSAGES: JSON.stringify(previousMessages),
    PIPELINE_STAGE: session.pipeline_stage,
  }
});
```

```typescript
// agent-runner.ts - Use context
const previousMessages = JSON.parse(process.env.PREVIOUS_MESSAGES || '[]');
const pipelineStage = process.env.PIPELINE_STAGE || 'init';

// Build context-aware prompt
const contextPrompt = previousMessages.length > 0
  ? buildContinuationPrompt(previousMessages, pipelineStage, userPrompt)
  : userPrompt;
```

### 5.5 Size Estimates

| Pipeline Stage | Approx Messages | JSON Size |
|----------------|-----------------|-----------|
| Hero | ~10-20 | ~5-10 KB |
| Contact Sheet | ~20-30 | ~10-15 KB |
| Frames | ~30-50 | ~15-25 KB |
| Videos | ~50-80 | ~25-40 KB |
| Complete | ~80-100 | ~40-50 KB |

D1 row size limit is much larger - this is well within bounds.

---

## 6. Implementation Plan

### 6.1 Phase 1: Container Session Fix

**Goal**: Implement get-or-create pattern

**Files**: `generate.ts`, `sessions.ts`

```typescript
async function getOrCreateContainerSession(
  sandbox: any,
  sessionId: string,
  env: Record<string, string>
) {
  const execSessionId = `exec-${sessionId}`;
  try {
    console.log(`[session] Creating: ${execSessionId}`);
    return await sandbox.createSession({ id: execSessionId, env });
  } catch (err: any) {
    if (err.message?.includes('SessionAlreadyExists')) {
      console.log(`[session] Reusing: ${execSessionId}`);
      return await sandbox.getSession(execSessionId);
    }
    throw err;
  }
}
```

### 6.2 Phase 2: SDK Session ID Capture

**Goal**: Capture and store SDK session ID

**Files**: `agent-runner.ts`, `generate.ts`

```typescript
// agent-runner.ts
for await (const message of query({...})) {
  if (message.type === 'system' && message.subtype === 'init') {
    emitSSE({
      type: 'sdk_session_init',
      sdkSessionId: (message as any).session_id
    });
  }
  // ... rest
}

// generate.ts
if (event.type === 'sdk_session_init') {
  await env.DB.prepare(
    'UPDATE sessions SET sdk_session_id = ? WHERE id = ?'
  ).bind(event.sdkSessionId, sessionId).run();
}
```

### 6.3 Phase 3: Message Storage

**Goal**: Store messages at checkpoints

**Files**: `agent-runner.ts`, `generate.ts`, `schema.sql`

```typescript
// agent-runner.ts
const allMessages: any[] = [];

for await (const message of query({...})) {
  allMessages.push(message);
  emitSSE({ type: 'sdk_message', message });

  if (detectCheckpoint(message)) {
    emitSSE({
      type: 'save_checkpoint',
      messages: allMessages,
      stage: getCurrentStage()
    });
  }
}

// generate.ts
if (event.type === 'save_checkpoint') {
  await env.DB.prepare(`
    UPDATE sessions
    SET messages = ?, message_count = ?, pipeline_stage = ?
    WHERE id = ?
  `).bind(
    JSON.stringify(event.messages),
    event.messages.length,
    event.stage,
    sessionId
  ).run();
}
```

### 6.4 Phase 4: Continue with Context

**Goal**: Retrieve and use stored messages for continuation

**Files**: `sessions.ts`, `agent-runner.ts`

```typescript
// sessions.ts
const session = await env.DB.prepare(
  'SELECT sdk_session_id, messages, pipeline_stage FROM sessions WHERE id = ?'
).bind(sessionId).first();

const execStream = await container.execStream("...", {
  env: {
    PROMPT: prompt,
    SDK_SESSION_ID: session.sdk_session_id || '',
    PREVIOUS_MESSAGES: session.messages || '[]',
    PIPELINE_STAGE: session.pipeline_stage || 'init',
  }
});

// agent-runner.ts
const SDK_SESSION_ID = process.env.SDK_SESSION_ID || '';
const PREVIOUS_MESSAGES = JSON.parse(process.env.PREVIOUS_MESSAGES || '[]');
const PIPELINE_STAGE = process.env.PIPELINE_STAGE || 'init';

// Try SDK resume first (works if container didn't restart)
// Fallback to context reconstruction if needed
const queryOptions = {
  ...baseOptions,
  ...(SDK_SESSION_ID ? { resume: SDK_SESSION_ID } : {}),
};
```

### 6.5 Implementation Order

| Order | Phase | Priority | Effort |
|-------|-------|----------|--------|
| 1 | Container Session Fix | HIGH | Low |
| 2 | SDK Session ID Capture | HIGH | Low |
| 3 | Message Storage | HIGH | Medium |
| 4 | Continue with Context | HIGH | Medium |

---

## 7. Data Flow Diagrams

### 7.1 First Generation (New Session)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        FIRST GENERATION                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Client POST /api/generate-stream                                     │
│     { prompt: "fashion shoot", sessionId: "session_abc123" }            │
│                           │                                              │
│                           ▼                                              │
│  2. Worker: Insert session into D1                                       │
│     INSERT INTO sessions (id, status, messages)                          │
│     VALUES ('session_abc123', 'active', '[]')                           │
│                           │                                              │
│                           ▼                                              │
│  3. Worker: getOrCreateContainerSession()                               │
│     → Creates new container session                                      │
│                           │                                              │
│                           ▼                                              │
│  4. Container: agent-runner.ts starts                                    │
│     → query() called                                                     │
│     → SDK creates internal session                                       │
│                           │                                              │
│                           ▼                                              │
│  5. Container: Captures system.init                                      │
│     → Emits sdk_session_init event                                       │
│                           │                                              │
│                           ▼                                              │
│  6. Worker: Stores SDK session ID                                        │
│     UPDATE sessions SET sdk_session_id = 'sdk_xyz789'                   │
│                           │                                              │
│                           ▼                                              │
│  7. Container: Generates hero, reaches checkpoint                        │
│     → Emits save_checkpoint with all messages                           │
│                           │                                              │
│                           ▼                                              │
│  8. Worker: Stores messages                                              │
│     UPDATE sessions SET messages = '[...]', pipeline_stage = 'hero'     │
│                           │                                              │
│                           ▼                                              │
│  9. Client: Receives checkpoint, waits for user                          │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

D1 State After:
┌────────────────────────────────────────────────────────────────────────┐
│ id             │ sdk_session_id │ pipeline_stage │ messages            │
├────────────────┼────────────────┼────────────────┼─────────────────────┤
│ session_abc123 │ sdk_xyz789     │ hero           │ [{...}, {...}, ...] │
└────────────────┴────────────────┴────────────────┴─────────────────────┘
```

### 7.2 Continue Request (After Container Restart)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                 CONTINUE (Container May Have Restarted)                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  1. Client POST /api/sessions/session_abc123/continue-stream            │
│     { prompt: "continue" }                                               │
│                           │                                              │
│                           ▼                                              │
│  2. Worker: Retrieve session from D1                                     │
│     SELECT sdk_session_id, messages, pipeline_stage                     │
│     FROM sessions WHERE id = 'session_abc123'                           │
│     → Returns: sdk_xyz789, [...messages], 'hero'                        │
│                           │                                              │
│                           ▼                                              │
│  3. Worker: getOrCreateContainerSession()                               │
│     → Creates NEW container (old one may have slept)                    │
│     → Fresh filesystem (no ~/.claude/projects/)                         │
│                           │                                              │
│                           ▼                                              │
│  4. Worker: Execute agent-runner with context                           │
│     env: {                                                               │
│       SDK_SESSION_ID: 'sdk_xyz789',                                     │
│       PREVIOUS_MESSAGES: '[{...}, {...}, ...]',                         │
│       PIPELINE_STAGE: 'hero',                                           │
│       PROMPT: 'continue'                                                 │
│     }                                                                    │
│                           │                                              │
│                           ▼                                              │
│  5. Container: agent-runner.ts starts                                    │
│     → Tries query({ resume: 'sdk_xyz789' })                             │
│     → SDK: "Unknown session" (files gone)                               │
│     → Fallback: Reconstruct from PREVIOUS_MESSAGES                      │
│                           │                                              │
│                           ▼                                              │
│  6. Container: Context reconstructed                                     │
│     → Agent knows: "I'm at hero stage, user said continue"             │
│     → Continues to contact sheet generation                             │
│                           │                                              │
│                           ▼                                              │
│  7. Container: Reaches next checkpoint                                   │
│     → Emits save_checkpoint with updated messages                       │
│                           │                                              │
│                           ▼                                              │
│  8. Worker: Stores updated messages                                      │
│     UPDATE sessions SET messages = '[...]', pipeline_stage = 'contact'  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 8. Schema Updates

### 8.1 Updated Schema

```sql
-- cloudflare/schema.sql

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'error', 'expired')),
  pipeline_stage TEXT DEFAULT 'init',
  sdk_session_id TEXT,
  messages JSON DEFAULT '[]',           -- NEW: All conversation messages
  message_count INTEGER DEFAULT 0,      -- NEW: Quick count
  total_cost_usd REAL DEFAULT 0,
  total_turns INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSON
);

CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);

-- Existing tables remain unchanged
CREATE TABLE IF NOT EXISTS session_assets (...);
CREATE TABLE IF NOT EXISTS checkpoints (...);
```

### 8.2 Migration

```sql
-- Run via wrangler d1 execute
ALTER TABLE sessions ADD COLUMN messages JSON DEFAULT '[]';
ALTER TABLE sessions ADD COLUMN message_count INTEGER DEFAULT 0;
```

---

## 9. Code Changes Required

### 9.1 cloudflare/sandbox/agent-runner.ts

```typescript
// Environment variables
const PROMPT = process.env.PROMPT || '';
const SESSION_ID = process.env.SESSION_ID || `session_${Date.now()}`;
const SDK_SESSION_ID = process.env.SDK_SESSION_ID || '';
const PREVIOUS_MESSAGES = JSON.parse(process.env.PREVIOUS_MESSAGES || '[]');
const PIPELINE_STAGE = process.env.PIPELINE_STAGE || 'init';

// Message collection
const allMessages: any[] = [...PREVIOUS_MESSAGES];

// Query options with conditional resume
const queryOptions = {
  cwd: "/workspace/agent",
  systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT,
  model: "claude-sonnet-4-20250514",
  maxTurns: 100,
  // ... other options

  // Try SDK resume if session ID available
  ...(SDK_SESSION_ID ? { resume: SDK_SESSION_ID } : {}),
};

// Main loop
for await (const message of query({ prompt: promptGenerator, options: queryOptions })) {

  // Capture SDK session ID
  if (message.type === 'system' && message.subtype === 'init') {
    const initMsg = message as any;
    if (initMsg.session_id) {
      emitSSE({ type: 'sdk_session_init', sdkSessionId: initMsg.session_id });
    }
  }

  // Collect all messages
  allMessages.push(message);
  emitSSE({ type: 'sdk_message', message });

  // Save at checkpoints
  if (detectCheckpoint(message)) {
    emitSSE({
      type: 'save_checkpoint',
      messages: allMessages,
      stage: getCurrentStage(),
      messageCount: allMessages.length
    });
  }

  // ... rest of message handling
}

// Final save
emitSSE({
  type: 'save_checkpoint',
  messages: allMessages,
  stage: 'complete',
  messageCount: allMessages.length,
  final: true
});
```

### 9.2 cloudflare/src/handlers/generate.ts

```typescript
// Add helper function
async function getOrCreateContainerSession(sandbox: any, sessionId: string, env: Record<string, string>) {
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

// In handleGenerateStream, update event parsing
for await (const event of parseContainerStream(execStream.stream)) {

  // Store SDK session ID
  if (event.type === 'sdk_session_init') {
    await env.DB.prepare(
      'UPDATE sessions SET sdk_session_id = ? WHERE id = ?'
    ).bind(event.sdkSessionId, sessionId).run();
    continue; // Don't forward to client
  }

  // Store messages at checkpoint
  if (event.type === 'save_checkpoint') {
    await env.DB.prepare(`
      UPDATE sessions
      SET messages = ?, message_count = ?, pipeline_stage = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).bind(
      JSON.stringify(event.messages),
      event.messageCount,
      event.stage,
      sessionId
    ).run();
    continue; // Don't forward to client
  }

  // Forward other events to client
  // ...
}
```

### 9.3 cloudflare/src/handlers/sessions.ts

```typescript
// In handleContinueStream
export async function handleContinueStream(request: Request, env: Env, ctx: ExecutionContext) {
  const { sessionId } = await request.json();
  const { prompt } = await request.json();

  // Retrieve session with messages
  const session = await env.DB.prepare(
    'SELECT sdk_session_id, messages, pipeline_stage FROM sessions WHERE id = ?'
  ).bind(sessionId).first();

  if (!session) {
    return new Response(JSON.stringify({ error: 'Session not found' }), { status: 404 });
  }

  // Get or create container session
  const sandbox = await getSandbox(env, sessionId);
  const containerSession = await getOrCreateContainerSession(sandbox, sessionId, {
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    FAL_KEY: env.FAL_KEY,
    // ... other env vars
  });

  // Execute with context
  const execStream = await containerSession.execStream(
    "npx tsx /workspace/agent-runner.ts",
    {
      env: {
        PROMPT: prompt,
        SESSION_ID: sessionId,
        SDK_SESSION_ID: session.sdk_session_id || '',
        PREVIOUS_MESSAGES: session.messages || '[]',
        PIPELINE_STAGE: session.pipeline_stage || 'init',
      },
      timeout: 600000,
    }
  );

  // ... rest of streaming logic
}
```

---

## 10. Testing Checklist

### Container Sessions
- [ ] First request creates container session successfully
- [ ] Continue request with existing session reuses (no error)
- [ ] Continue request after container restart works (get-or-create)

### SDK Sessions
- [ ] SDK session ID captured from system.init message
- [ ] SDK session ID stored in D1 successfully
- [ ] SDK session ID retrieved on continue request

### Message Storage
- [ ] Messages collected during generation
- [ ] Messages saved to D1 at checkpoint
- [ ] Messages retrieved for continuation
- [ ] Context reconstruction works when SDK resume fails

### Full Pipeline
- [ ] Generate hero → checkpoint → messages saved
- [ ] Continue (same container) → contact sheet → messages updated
- [ ] User idle → container sleeps
- [ ] Continue (new container) → frames → context reconstructed
- [ ] Complete pipeline with multiple container restarts

### Edge Cases
- [ ] Very long message history (performance)
- [ ] Network interruption during save
- [ ] Concurrent continue requests

---

## 11. Context Reconstruction Logic

### 11.1 When Context Reconstruction Is Needed

```
Container restarted → SDK session files wiped → SDK resume fails
                                                      ↓
                              Context reconstruction kicks in
```

### 11.2 Simple Approach (Recommended)

The agent doesn't need full message history. It just needs to know:
1. **What stage it's at** (from D1: `pipeline_stage`)
2. **What files exist** (from R2: `/workspace/agent/outputs/`)

```typescript
// agent-runner.ts
function buildContinuationContext(pipelineStage: string, userPrompt: string): string {
  return `
CONTINUATION CONTEXT:
You are resuming a fashion shoot session at the "${pipelineStage}" checkpoint.
Check /workspace/agent/outputs/ to see completed artifacts.
Continue with the next pipeline stage.

User: ${userPrompt}
`;
}
```

### 11.3 Why This Works

The **artifacts in R2** are the source of truth:

| File Exists | Meaning |
|-------------|---------|
| `hero.png` | Hero stage complete |
| `contact-sheet.png` | Contact sheet complete |
| `frames/frame-*.png` | Frames complete |
| `videos/video-*.mp4` | Videos complete |
| `final/fashion-video.mp4` | Pipeline complete |

The agent checks what files exist and continues from there.

### 11.4 R2 Session Isolation

Each session has isolated storage:

```
R2: fashion-shoot-storage
└── outputs/
    ├── session_abc123/     ← User A (isolated)
    │   ├── hero.png
    │   └── ...
    └── session_def456/     ← User B (isolated)
        └── ...
```

Container mount is session-specific:
```typescript
await sandbox.mountBucket({
  bucket: env.STORAGE,
  path: '/workspace/agent/outputs',
  prefix: `outputs/${sessionId}/`  // Session isolation
});
```

---

## 12. Error Handling

### 12.1 D1 Save Failures

```typescript
// generate.ts - Checkpoint save with retry
async function saveCheckpoint(env: Env, sessionId: string, data: CheckpointData) {
  const maxRetries = 3;
  for (let i = 0; i < maxRetries; i++) {
    try {
      await env.DB.prepare(`
        UPDATE sessions
        SET messages = ?, message_count = ?, pipeline_stage = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(
        JSON.stringify(data.messages),
        data.messages.length,
        data.stage,
        sessionId
      ).run();
      return; // Success
    } catch (err) {
      console.error(`[D1] Save attempt ${i + 1} failed:`, err);
      if (i === maxRetries - 1) {
        // Log error but don't crash - checkpoint data is in R2 anyway
        console.error(`[D1] All save attempts failed for ${sessionId}`);
      }
      await new Promise(r => setTimeout(r, 1000 * (i + 1))); // Backoff
    }
  }
}
```

### 12.2 Messages Too Large for Env Var

Environment variables have ~128KB limit. Our messages are ~40-50KB max, but as safety:

```typescript
// sessions.ts - Check size before passing
const messagesJson = session.messages || '[]';
const messagesSize = new TextEncoder().encode(messagesJson).length;

let envMessages = messagesJson;
if (messagesSize > 100000) { // 100KB threshold
  // Trim to essential messages only (last N messages)
  const messages = JSON.parse(messagesJson);
  const trimmed = messages.slice(-50); // Keep last 50
  envMessages = JSON.stringify(trimmed);
  console.warn(`[session] Messages trimmed from ${messages.length} to ${trimmed.length}`);
}

execStream = await container.execStream("...", {
  env: {
    PREVIOUS_MESSAGES: envMessages,
    // ...
  }
});
```

### 12.3 Container Crash During Generation

If container crashes mid-generation:
- **R2 artifacts**: Partially written files may exist
- **D1 state**: Last checkpoint is preserved
- **Recovery**: User can continue from last checkpoint

```typescript
// generate.ts - Mark session as error on crash
ctx.waitUntil((async () => {
  try {
    // ... generation logic
  } catch (err) {
    console.error(`[generate] Container crashed:`, err);
    await env.DB.prepare(
      'UPDATE sessions SET status = ?, error_message = ? WHERE id = ?'
    ).bind('error', String(err), sessionId).run();
  }
})());
```

### 12.4 Resume Failure Detection

```typescript
// agent-runner.ts
const SDK_SESSION_ID = process.env.SDK_SESSION_ID || '';
const PIPELINE_STAGE = process.env.PIPELINE_STAGE || 'init';

let resumeWorked = false;

// Try SDK resume if we have a session ID
const queryOptions = {
  ...baseOptions,
  ...(SDK_SESSION_ID ? { resume: SDK_SESSION_ID } : {}),
};

for await (const message of query({ prompt, options: queryOptions })) {
  // Check if SDK recognized the session
  if (message.type === 'system' && message.subtype === 'init') {
    const initMsg = message as any;
    // If SDK gave us a NEW session ID, resume failed
    if (SDK_SESSION_ID && initMsg.session_id !== SDK_SESSION_ID) {
      console.log(`[agent] SDK resume failed, using context reconstruction`);
      resumeWorked = false;
    } else if (SDK_SESSION_ID) {
      console.log(`[agent] SDK resume successful`);
      resumeWorked = true;
    }
  }
  // ... rest of handling
}
```

---

## 13. Remaining Issues & Fixes

### 13.1 Issue 4: Mount Directory Not Empty

**Problem**: Continue handler mounts to `/storage` which may not be empty.

**Solution**: Use consistent mount paths with `nonempty` handling.

```typescript
// Helper function for safe mounting
async function mountBucketSafe(
  sandbox: any,
  bucket: R2Bucket,
  path: string,
  prefix: string
) {
  try {
    await sandbox.mountBucket({ bucket, path, prefix });
  } catch (err: any) {
    if (err.message?.includes('not empty')) {
      console.log(`[mount] Path ${path} not empty, skipping (already mounted)`);
      return; // Already mounted, that's fine
    }
    throw err;
  }
}
```

**Files to update**: `sessions.ts` - use `/storage/uploads` not `/storage`

### 13.2 Issue 5: Scripts Importing dotenv

**Problem**: Scripts have `import "dotenv/config"` but dotenv not in sandbox.

**Files affected**:
- `agent/.claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts:18`
- `agent/.claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts:24`

**Solution**: Remove dotenv imports (env vars now via `createSession({ env })`).

```typescript
// REMOVE this line from scripts:
// import "dotenv/config";  ← DELETE

// Env vars are already available via process.env
const FAL_KEY = process.env.FAL_KEY;  // Works without dotenv
```

### 13.3 Issue 6: Missing @techstark/opencv-js

**Problem**: `crop-frames.ts` imports OpenCV but it's not in sandbox dependencies.

**File affected**: `agent/.claude/skills/fashion-shoot-pipeline/scripts/crop-frames.ts:24`

**Solution**: Add to `cloudflare/sandbox/package.json`:

```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.73",
    "@fal-ai/client": "^1.8.0",
    "@techstark/opencv-js": "^4.10.0",  // ADD THIS
    "sharp": "^0.34.5",
    "zod": "^3.24.0",
    "tsx": "^4.19.0"
  }
}
```

**Note**: There's also `crop-frames-ffmpeg.ts` which uses FFmpeg instead of OpenCV. Consider using that as the default to avoid the OpenCV dependency.

---

## 14. Deployment & Migration

### 14.1 Schema Migration

```bash
# 1. Add new columns to existing database
cd cloudflare

npx wrangler d1 execute fashion-shoot-sessions --command "ALTER TABLE sessions ADD COLUMN messages JSON DEFAULT '[]';"

npx wrangler d1 execute fashion-shoot-sessions --command "ALTER TABLE sessions ADD COLUMN message_count INTEGER DEFAULT 0;"

# 2. Verify migration
npx wrangler d1 execute fashion-shoot-sessions --command "PRAGMA table_info(sessions);"
```

### 14.2 Code Changes

```bash
# 1. Update scripts (remove dotenv)
# Edit: agent/.claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts
# Edit: agent/.claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts

# 2. Update sandbox dependencies
# Edit: cloudflare/sandbox/package.json (add opencv-js if needed)
```

### 14.3 Build & Deploy

```bash
cd cloudflare

# 1. Clean previous builds
rm -rf dist .wrangler
docker builder prune -af

# 2. Copy agent folder
npm run prebuild

# 3. Build frontend
npm run build:frontend

# 4. Deploy
npm run deploy

# 5. Watch logs
npx wrangler tail --format pretty
```

### 14.4 Verification Checklist

```bash
# 1. Health check
curl https://fashion-shoot-agent.{account}.workers.dev/api/health

# 2. Test upload
curl -X POST https://.../api/upload -F "images=@test.jpg"

# 3. Test generation (watch for sdk_session_init in logs)
curl -N -X POST https://.../api/generate-stream \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Fashion shoot","sessionId":"test-123"}'

# 4. Check D1 for stored data
npx wrangler d1 execute fashion-shoot-sessions \
  --command "SELECT id, sdk_session_id, pipeline_stage, message_count FROM sessions LIMIT 5;"
```

---

## Appendix A: Related Issues Summary

| Issue | Problem | Solution | Status |
|-------|---------|----------|--------|
| Issue 3 | SessionAlreadyExistsError | Get-or-create pattern | Documented |
| Issue 4 | Mount directory not empty | Consistent mount paths + safe mount helper | Documented |
| Issue 5 | Scripts importing dotenv | Remove dotenv imports from scripts | Documented |
| Issue 6 | Missing opencv-js | Add to sandbox/package.json OR use FFmpeg alternative | Documented |

---

## Appendix B: Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Message storage format | JSON blob in sessions table | Simple, sufficient for our size |
| Save frequency | At checkpoints | Balance of reliability vs performance |
| Resume strategy | Try SDK, fallback to context reconstruction | Best of both worlds |
| Context reconstruction | Simple (stage + file check) | Agent can infer state from R2 artifacts |
| Context passing | Environment variables | Works across container restarts |

---

## Appendix C: File Changes Summary

| File | Changes |
|------|---------|
| `cloudflare/schema.sql` | Add `messages` and `message_count` columns |
| `cloudflare/sandbox/package.json` | Add `@techstark/opencv-js` |
| `cloudflare/sandbox/agent-runner.ts` | SDK session capture, message collection, context reconstruction |
| `cloudflare/src/handlers/generate.ts` | Get-or-create session, store SDK ID, save checkpoints |
| `cloudflare/src/handlers/sessions.ts` | Retrieve context, pass to container, safe mounting |
| `agent/.../generate-image.ts` | Remove `import "dotenv/config"` |
| `agent/.../generate-video.ts` | Remove `import "dotenv/config"` |

---

*Document finalized after comprehensive analysis of Cloudflare infrastructure behavior and session continuity requirements.*
