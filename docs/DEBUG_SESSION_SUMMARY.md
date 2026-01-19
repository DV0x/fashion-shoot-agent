# Debug Session Summary - Artifact Event Architecture

## Session Goal
Transform from old checkpoint detection system to new artifact event-based architecture where scripts emit JSON events that the frontend displays in real-time.

---

## What Was Completed

### 1. Scripts Updated (All Complete)
All pipeline scripts now emit standardized artifact events to stdout:

| Script | Event Type | Example Output |
|--------|------------|----------------|
| `generate-image.ts` | Single artifact | `{"type":"artifact","path":"outputs/hero.png","artifactType":"image"}` |
| `generate-video.ts` | Single artifact | `{"type":"artifact","path":"outputs/videos/video-1.mp4","artifactType":"video"}` |
| `crop-frames.ts` | Multiple artifacts | `{"type":"artifacts","paths":["frame-1.png",...],"artifactType":"image-grid"}` |
| `crop-frames-ffmpeg.ts` | Multiple artifacts | `{"type":"artifacts","paths":[...],"artifactType":"image-grid"}` |
| `resize-frames.ts` | Multiple artifacts | `{"type":"artifacts","paths":[...],"artifactType":"image-grid"}` |
| `stitch-videos-eased.ts` | Single artifact | `{"type":"artifact","path":"outputs/final/video.mp4","artifactType":"video"}` |

### 2. Server Changes (Complete)

**ai-client.ts:**
- Added `parseArtifactEvents()` function that extracts `stdout` from tool response and parses JSON artifact events
- Updated `createProgressHooks()` to parse Bash output for artifact events
- Emits progress events via `progressEmitter.emit('progress', { sessionId, progress })`

**sdk-server.ts:**
- Removed all workflow config imports and loading
- Now uses `ORCHESTRATOR_SYSTEM_PROMPT` directly
- Removed `sessionWorkflows` map
- All endpoints use static system prompt

**Deleted files:**
- `server/lib/checkpoint-detector.ts`
- `server/lib/prompt-generator.ts`

### 3. Orchestrator Prompt Updated
Added "Artifact Events" section explaining that scripts emit events automatically and frontend displays them.

### 4. Frontend Switched to WebSocket
Changed `App.tsx` from `useStreamingGenerate` (SSE) to `useWebSocket` for bidirectional communication.

---

## Current Issue: WebSocket Connection Unstable

### Symptoms
- WebSocket connects then immediately disconnects
- Browser console shows: `WebSocket is closed before the connection is established`
- Server logs show rapid connect/disconnect cycles

### Root Cause
React StrictMode in development causes double mount/unmount, which triggers:
1. Mount → connect()
2. Unmount (StrictMode) → disconnect()
3. Remount → connect() fails because disconnect() blocked reconnection

### Fixes Applied (but need verification)
1. **useWebSocket.ts line 736**: Changed `disconnect(permanent = false)` - only block reconnection if permanent
2. **useWebSocket.ts line 126**: Added `isMountedRef` to track mount state
3. **useWebSocket.ts line 724**: Only reconnect if `isMountedRef.current` is true
4. **useWebSocket.ts line 944-953**: Reset reconnect attempts on mount, set mounted flag

---

## To Debug Next Session

### 1. Test WebSocket Connection
```bash
# Start server
cd server && npm run dev

# Open browser to http://localhost:5173
# Check browser console for:
[WS] Connecting to: ws://localhost:3002/ws
[WS] Connected

# Check server console for:
🔌 WebSocket client connected: ws_xxx
# (Should NOT immediately show "disconnected")
```

### 2. If Still Disconnecting
Try temporarily removing StrictMode to isolate the issue:

**frontend/src/main.tsx:**
```tsx
// Change from:
<StrictMode>
  <App />
</StrictMode>

// To:
<App />
```

### 3. Test Artifact Detection
Once WebSocket is stable, send a message and check:
- Server logs should show: `🎨 [ARTIFACT] Found: outputs/hero.png (image)`
- Server logs should show: `📊 PROGRESS: image - image ready: outputs/hero.png`
- Server logs should show: `📊 [PROGRESS] SSE connections: 0, WS subscribers: 1`
- Frontend should display the image

### 4. If Artifacts Not Showing
Check if progress events reach frontend:
- Add `console.log` in `useWebSocket.ts` case `'progress'` handler (around line 580)
- Verify the event has `progress.artifact` or `progress.artifacts`

---

## Architecture Flow (Target State)

```
┌─────────────────────────────────────────────────────────────────┐
│  1. User sends prompt via WebSocket                             │
│       ↓                                                         │
│  2. Server calls aiClient.queryWithSession()                    │
│       ↓                                                         │
│  3. Agent runs Bash command (e.g., generate-image.ts)           │
│       ↓                                                         │
│  4. Script emits to stdout:                                     │
│     {"type":"artifact","path":"outputs/hero.png",...}           │
│       ↓                                                         │
│  5. PostToolUse hook fires, parseArtifactEvents() extracts it   │
│       ↓                                                         │
│  6. progressEmitter.emit('progress', { sessionId, progress })   │
│       ↓                                                         │
│  7. sdk-server.ts listener broadcasts to WebSocket subscribers  │
│       ↓                                                         │
│  8. Frontend useWebSocket receives 'progress' event             │
│       ↓                                                         │
│  9. addArtifactMessages() displays image/video in chat          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Files

| File | Purpose |
|------|---------|
| `server/lib/ai-client.ts` | parseArtifactEvents(), PostToolUse hooks |
| `server/sdk-server.ts` | progressEmitter listener, WebSocket broadcast |
| `server/lib/websocket-handler.ts` | WebSocket server implementation |
| `frontend/src/hooks/useWebSocket.ts` | WebSocket client, message handling |
| `frontend/src/App.tsx` | Uses useWebSocket hook |
| `server/lib/orchestrator-prompt.ts` | System prompt for agent |

---

## Test Logs Location
- Server output: Check terminal running `npm run dev`
- Save to: `/Users/chakra/Documents/Agents/fashion-shoot-agent/output.md`
- Errors: `/Users/chakra/Documents/Agents/fashion-shoot-agent/error.md`
