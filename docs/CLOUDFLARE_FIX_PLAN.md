# Cloudflare Production Parity Plan

## Problem Summary
The Cloudflare production deployment has several gaps compared to the local server:
1. **Image upload not working** - Frontend can't pass images to agent
2. **All text streaming to single message bubble** - No thinking/checkpoint separation
3. **Artifacts and checkpoints not rendering correctly** - Missing checkpoint data

---

## Root Causes Identified (5 Issues)

### Issue 1: Upload Path Mismatch (CRITICAL - Blocks Pipeline)

**Frontend expects** (`useStreamingGenerate.ts:608`):
```typescript
const inputImages = state.uploadedImages.map((f) => f.path);
```

**Cloudflare upload returns** (`upload.ts:104-111`):
```typescript
{
  originalName: file.name,
  filename,
  r2Key,           // Wrong field name!
  url: `/uploads/${filename}`,
  // Missing: path
}
```

**Result:** `f.path` is `undefined`, so `inputImages` is `[undefined]`, agent receives no reference images.

---

### Issue 2: Output Path Mismatch (CRITICAL)

**Container setup** (`generate.ts:278`):
```typescript
await sandbox.exec(`mkdir -p /storage/outputs/${sessionId}/{frames,videos,final}`);
```

**Agent working directory** (`agent-runner.ts:200`):
```typescript
cwd: "/workspace/agent",
```

**The Problem:** Agent writes to `/workspace/agent/outputs/` (container filesystem) but the Worker serves from R2 (`/storage/outputs/`). Files never reach R2!

**Fix:** Use `mountBucket` with `prefix` option (better than symlinks - validated against Cloudflare docs).

---

### Issue 3: API Keys Not Propagating to Child Processes (CRITICAL)

**From production output:**
```
I can see that the script requires a FAL_KEY environment variable.
However, since I don't have access to actual API keys, I cannot proceed
with the real image generation.
```

**Current approach** (`generate.ts:301-317`):
```typescript
const execStream = await sandbox.execStream("npx tsx agent-runner.ts", {
  env: {
    FAL_KEY: env.FAL_KEY,  // Only sets for THIS command
  }
});
```

**The Problem:** Env vars passed via `execStream({ env })` are set for the single command only. Child processes don't inherit.

**Fix:** Use `sandbox.setEnvVars()` which sets **session-level** env vars that persist and propagate to ALL child processes.

---

### Issue 4: Checkpoint Paths Missing Session Prefix

Checkpoint detection hardcodes paths without session prefix:
```typescript
artifact: "outputs/hero.png",  // Should include session path
```

---

### Issue 5: SSE Events Missing Fields

Missing `awaitingInput`, `sessionId`, `text` fields in SSE events.

---

## Implementation Plan

### Phase 1: Fix Upload Path

**File:** `cloudflare/src/handlers/upload.ts`

```typescript
// Line 104-111: Add path field
uploadedFiles.push({
  originalName: file.name,
  filename,
  r2Key,
  size: file.size,
  mimetype: file.type,
  url: `/uploads/${filename}`,
  path: `/storage/uploads/${filename}`,  // ADD: Container-accessible path
});
```

---

### Phase 2: Fix Output Path + Set Session Env Vars

**File:** `cloudflare/src/handlers/generate.ts`

```typescript
// Mount R2 directly to agent's working directory with session prefix
await mountBucketSafe(sandbox, "fashion-shoot-storage", "/workspace/agent/outputs", {
  endpoint: `https://${env.CF_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  provider: "r2",
  credentials: {
    accessKeyId: env.AWS_ACCESS_KEY_ID,
    secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
  },
  prefix: `outputs/${sessionId}`,  // Session isolation built into SDK!
});

// ADD: Set session-level env vars (propagates to child processes)
await sandbox.setEnvVars({
  FAL_KEY: env.FAL_KEY,
  KLING_ACCESS_KEY: env.KLING_ACCESS_KEY,
  KLING_SECRET_KEY: env.KLING_SECRET_KEY,
  ANTHROPIC_API_KEY: env.ANTHROPIC_API_KEY,
});
```

---

### Phase 3: Fix Artifact Paths in Checkpoint Detection

**File:** `cloudflare/sandbox/agent-runner.ts`

Update checkpoint artifact paths to include session prefix and add `type` field:

```typescript
function detectCheckpoint(toolName: string, toolInput: any, toolResponse: any, sessionId: string): void {
  // Update artifact paths to include session directory:
  emitCheckpoint({
    stage: "hero",
    status: "complete",
    artifact: `outputs/${sessionId}/hero.png`,  // Include session path
    type: "image",  // Add type field
    message: 'Hero image ready. Reply "continue" or describe changes.',
  });
}
```

---

### Phase 4: Fix SSE Event Format in Worker

**File:** `cloudflare/src/handlers/generate.ts`

Add `awaitingInput` to checkpoint events and `text` field to assistant_message events.

---

### Phase 5: Verify Media Serving Path

**File:** `cloudflare/src/index.ts`

Already correctly handles session-prefixed paths - no changes needed.

---

## Files to Modify

| File | Changes |
|------|---------|
| `cloudflare/src/handlers/upload.ts` | Add `path` field to response |
| `cloudflare/src/handlers/generate.ts` | Mount with prefix, use setEnvVars, fix SSE fields |
| `cloudflare/sandbox/agent-runner.ts` | Add session prefix to artifact paths, add `type` field |

---

## Verification Plan

### Step 1: Deploy and Test Upload
```bash
cd cloudflare && npx wrangler deploy

curl -X POST https://fashion-shoot-agent.alphasapien17.workers.dev/api/upload \
  -F "images=@test.jpg"
# Expect: { "files": [{ "path": "/storage/uploads/..." }] }
```

### Step 2: Test Full Pipeline
- Upload reference image
- Send "create an ad shoot for this"
- Verify each checkpoint: hero -> contact-sheet -> frames -> clips -> complete
- Verify artifacts display at each stage

---

## Summary

| Issue | Root Cause | Fix |
|-------|------------|-----|
| 1. Upload path | `f.path` undefined | Add `path` field to upload response |
| 2. Files not in R2 | Agent writes to container FS | Use `mountBucket` with `prefix` |
| 3. API keys missing | `execStream` env not inherited | Use `setEnvVars()` |
| 4. Checkpoint paths | Missing session prefix | Add `${sessionId}` to paths |
| 5. SSE incomplete | Missing fields | Add `awaitingInput`, `text` |

---

*Last Updated: 2026-01-14*
