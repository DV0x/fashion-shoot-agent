# Cloudflare SSE & Environment Variables Fix

> **Status**: Partially implemented, testing in progress
> **Last Updated**: 2025-01-15

---

## Summary of Issues & Status

| Issue | Status | Solution |
|-------|--------|----------|
| 1. SSE Message Classification | ✅ FIXED | agent-runner emits SSE to stdout, worker forwards directly |
| 2. Env vars not reaching child processes | ✅ FIXED | Using `createSession({ env })` for session-level env vars |
| 3. SessionAlreadyExistsError on continue | ❌ PENDING | Need try/catch with fallback to `getSession()` |
| 4. Mount directory not empty on continue | ❌ PENDING | Need better error handling in sessions.ts |
| 5. Scripts importing dotenv (causes npm install) | ❌ PENDING | Remove `import "dotenv/config"` from scripts |
| 6. Missing @techstark/opencv-js | ❌ PENDING | Add to sandbox/package.json |

---

## Issue 1: SSE Message Classification (FIXED)

### Problem
All streamed content appeared in single message type instead of being classified as thinking vs response. The translation layer in generate.ts was parsing JSON from stderr, which failed when multiple JSON objects were buffered together.

### Solution Implemented
Eliminated the translation layer - agent-runner.ts now emits SSE-formatted events directly to stdout.

### Changes Made

**cloudflare/sandbox/agent-runner.ts:**
```typescript
// NEW: Emit SSE events to stdout
function emitSSE(event: object): void {
  console.log(`data: ${JSON.stringify(event)}\n`);
}

// Token streaming
emitSSE({ type: "text_delta", text: delta.text });

// Thinking mode detection
emitSSE({ type: "message_type_hint", messageType: "thinking" });

// Tool events
emitSSE({ type: "system", subtype: "tool_start", tool: toolName });
emitSSE({ type: "system", subtype: "tool_done", tool: toolName });

// Checkpoints
emitSSE({ type: "checkpoint", checkpoint: {...}, sessionId, awaitingInput: true });
```

**cloudflare/src/handlers/generate.ts:**
```typescript
// Forward stdout SSE events directly (no parsing)
if (event.type === "stdout") {
  const data = event.data as string;
  for (const line of data.split("\n")) {
    if (line.startsWith("data:")) {
      await writer.write(encoder.encode(line + "\n\n"));
    }
  }
}
```

---

## Issue 2: Environment Variables (FIXED)

### Problem
API keys (FAL_KEY, KLING_ACCESS_KEY, etc.) were not available to scripts spawned by Claude SDK's Bash tool. The `execStream({ env })` only passes env vars to the immediate process, not grandchild processes.

### Solution Implemented
Use `createSession({ env })` to set session-level environment variables that persist for ALL commands in the session, including child processes.

### Changes Made

**cloudflare/src/handlers/generate.ts:**
```typescript
// Create session with env vars at session level
const session = await sandbox.createSession({
  id: `exec-${sessionId}`,
  env: {
    ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
    FAL_KEY: env.FAL_KEY,
    KLING_ACCESS_KEY: env.KLING_ACCESS_KEY,
    KLING_SECRET_KEY: env.KLING_SECRET_KEY,
    HOME: "/root",
    CI: "true",
    // ... other env vars
  },
});

// Run agent in that session
const execStream = await session.execStream("npx tsx /workspace/agent-runner.ts", {
  env: {
    PROMPT: fullPrompt,
    SESSION_ID: sessionId,
  },
  timeout: 600000,
});
```

### Verification
Logs show session being created with our ID:
```
[generate] Creating session exec-session_1768465608418_lmi87ga with env vars
[generate] Session created, running agent with session.execStream
{"level":"info","msg":"Session created","details":"ID: exec-session_1768465608418_lmi87ga"}
```

Hero image was generated successfully, confirming FAL_KEY reached the script.

---

## Issue 3: SessionAlreadyExistsError (PENDING)

### Problem
When user continues a session, we call `createSession()` with the same ID, causing:
```
SessionAlreadyExistsError: Session 'exec-session_...' already exists
```

### Solution Needed
Use try/catch and fall back to `getSession()` if session already exists:

```typescript
let session;
try {
  session = await sandbox.createSession({
    id: `exec-${sessionId}`,
    env: { ... }
  });
} catch (err: any) {
  if (err.message?.includes("SessionAlreadyExists")) {
    console.log(`Session already exists, reusing`);
    session = await sandbox.getSession(`exec-${sessionId}`);
  } else {
    throw err;
  }
}
```

### Files to Update
- `cloudflare/src/handlers/generate.ts` - handleGenerateStream
- `cloudflare/src/handlers/sessions.ts` - handleContinueStream

---

## Issue 4: Mount Directory Not Empty (PENDING)

### Problem
The continue handler in sessions.ts tries to mount `/storage` but gets:
```
S3FSMountError: S3FS mount failed: MOUNTPOINT directory /storage is not empty
```

### Solution Needed
The continue handler mounts to `/storage` instead of `/storage/uploads`. Need to:
1. Use consistent mount paths across generate.ts and sessions.ts
2. Add `nonempty` option to mount, OR
3. Skip mounting if already mounted (use mountBucketSafe pattern)

### Files to Update
- `cloudflare/src/handlers/sessions.ts` - handleContinueStream mount logic

---

## Issue 5: Scripts Importing dotenv (PENDING)

### Problem
Scripts have `import "dotenv/config"` at the top:
```typescript
// generate-image.ts line 17
import "dotenv/config";
```

Since `dotenv` isn't in sandbox/package.json, this causes:
```
Cannot find module 'dotenv'
```

The agent sees this error and tries to install packages on every container start.

### Solution Needed
Remove `import "dotenv/config"` from all scripts. The env vars are now set via `createSession({ env })`, so scripts can access them directly via `process.env.FAL_KEY`.

### Files to Update
- `agent/.claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts`
- `agent/.claude/skills/fashion-shoot-pipeline/scripts/generate-video.ts`
- Any other scripts with dotenv import

---

## Issue 6: Missing @techstark/opencv-js (PENDING)

### Problem
`crop-frames.ts` imports OpenCV:
```typescript
import cv, { Mat } from "@techstark/opencv-js";
```

But this package isn't in sandbox/package.json.

### Solution Needed
Add to `cloudflare/sandbox/package.json`:
```json
{
  "dependencies": {
    "@techstark/opencv-js": "^4.10.0",
    // ... existing deps
  }
}
```

---

## Testing Checklist

### SSE Streaming
- [x] Tokens stream in real-time
- [x] `text_delta` events received by frontend
- [ ] `message_type_hint` events properly classify thinking vs response
- [ ] Tool activity indicator shows during execution

### Environment Variables
- [x] `createSession({ env })` creates session with env vars
- [x] FAL_KEY reaches generate-image.ts (hero image generated)
- [ ] KLING keys reach generate-video.ts
- [ ] Env vars persist across continue requests

### Session Continuity
- [ ] Continue after checkpoint works
- [ ] Session reuse (no SessionAlreadyExistsError)
- [ ] Mounts work on continue (no "not empty" error)

### Full Pipeline
- [x] Hero image generation
- [ ] Contact sheet generation
- [ ] Frame cropping
- [ ] Video generation
- [ ] Final video stitching

---

## Deployment Commands

```bash
# Clean rebuild and deploy
cd /Users/chakra/Documents/Agents/fashion-shoot-agent/cloudflare
docker builder prune -af
rm -rf dist .wrangler
npm run deploy

# Watch logs
npx wrangler tail --format pretty
```

---

## Architecture After Fixes

```
┌─────────────────────────────────────────────────────────────┐
│ Cloudflare Worker                                           │
├─────────────────────────────────────────────────────────────┤
│ 1. getSandbox(sessionId)                                    │
│ 2. mountBucketSafe() - R2 mounts                            │
│ 3. createSession({ env }) - session-level env vars          │
│ 4. session.execStream() - runs agent-runner.ts              │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Container (agent-runner.ts)                                 │
├─────────────────────────────────────────────────────────────┤
│ - Receives PROMPT, SESSION_ID via execStream({ env })       │
│ - Session-level env vars (FAL_KEY etc.) inherited           │
│ - Emits SSE events to stdout                                │
│ - Claude SDK Bash tool spawns child processes               │
│   └─ Child processes inherit session-level env vars         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend                                                    │
├─────────────────────────────────────────────────────────────┤
│ - Receives SSE events directly (no translation)             │
│ - text_delta → streaming text                               │
│ - message_type_hint → thinking/response classification      │
│ - checkpoint → pipeline stage UI                            │
└─────────────────────────────────────────────────────────────┘
```
