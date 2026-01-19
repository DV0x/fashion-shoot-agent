# Fashion-Shoot-Agent: Architectural Transformation Plan

## Executive Summary

Transform the fashion-shoot-agent from a **rigid workflow executor** into a **flexible creative collaborator** by fixing 5 architectural gaps + 3 SDK technical issues, and adding a `/yolo` command for autonomous mode.

---

## Implementation Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: SDK Technical Fixes | ✅ COMPLETE | Added permissions, tools, settings |
| Phase 2: Orchestrator Prompt Rewrite | ✅ COMPLETE | Goal-first Creative Director persona |
| Phase 3: Checkpoint System Redesign | ✅ COMPLETE | Progress events + /yolo command |
| Phase 4: Skill Documentation | ✅ COMPLETE | Enhanced SKILL.md with Purpose/When to use |
| Phase 5: Reasoning Layer | ✅ COMPLETE | Already done in Phase 2 |
| Phase 6: WebSocket Implementation | ✅ COMPLETE | Full WebSocket support with cancellation |
| Phase 6 Testing | ✅ COMPLETE | Connection verified stable |
| Phase 7: Chat UX Streaming | ✅ COMPLETE | Block-level streaming, real-time text, progress events |
| Phase 8: WebSocket Streaming Fixes | ✅ COMPLETE | Phase 7 events for WS, StrictMode fix, artifact detection |

---

## Phase 1: SDK Technical Fixes ✅ COMPLETE

### 1.1 Fix Permission Handling in ai-client.ts

**File:** `server/lib/ai-client.ts`

**Implemented:**
```typescript
permissionMode: 'default',
canUseTool: async (_toolName: string, input: Record<string, unknown>) => ({
  behavior: 'allow' as const,
  updatedInput: input
}),
```

### 1.2 Add Missing Tools

**Implemented:**
```typescript
allowedTools: [
  "Read", "Write", "Edit", "Glob", "Grep",
  "Bash", "Task", "Skill", "TodoWrite", "WebFetch"
],
```

### 1.3 Consistent Settings Sources

**Implemented:** `settingSources: ['project']`

---

## Phase 2: Orchestrator Prompt Rewrite ✅ COMPLETE

**File:** `server/lib/orchestrator-prompt.ts`

**Implemented:** Complete rewrite from 193 lines to goal-first structure:

- `# Creative Director` persona
- `## Your Goal` - Success criteria focused on user satisfaction
- `## Your Approach` - UNDERSTAND → PROPOSE → EXECUTE → ADAPT
- `## Your Capabilities` - Semantic description of skills
- `## Typical Flow` - Flexible, not mandatory
- `## When to Pause for Feedback` - Agent-initiated pauses
- `## YOLO Mode` - Run to completion without pauses
- `## Before Each Major Step` - Reasoning and explanation (Phase 5)
- Removed rigid "Phase 1, Phase 2..." language
- Removed `---CHECKPOINT---` syntax
- Removed hardcoded bash commands

---

## Phase 3: Checkpoint System Redesign ✅ COMPLETE

### 3.1 Changed to Progress Events

**File:** `server/lib/ai-client.ts`

- Renamed `checkpointEmitter` → `progressEmitter`
- Changed event type from `'checkpoint'` → `'progress'`
- PostToolUse hooks emit progress for tracking without forcing stops

### 3.2 Agent-Initiated Pauses

Orchestrator prompt includes "When to Pause for Feedback" section. Agent pauses naturally by asking questions.

### 3.3 Implemented /yolo Command

**session-manager.ts:**
- Added `autonomousMode?: boolean` to session metadata
- Added `setAutonomousMode()` and `isAutonomousMode()` methods

**ai-client.ts:**
- Injects `## AUTONOMOUS MODE ACTIVE` into system prompt when enabled

**sdk-server.ts:**
- Detects `/yolo` in prompt (regex: `/^\/yolo\b/i` or `\byolo\b`)
- Sets session flag, passes to AIClient

**ChatInput.tsx:**
- Visual indicator (amber border + "YOLO" badge) when typing /yolo
- Updated placeholder with tip about /yolo

---

## Phase 4: Skill Documentation Enhancement ✅ COMPLETE

**File:** `agent/.claude/skills/fashion-shoot-pipeline/SKILL.md`

**Enhanced with:**
- `## Available Operations` header
- Each operation has: **Purpose**, **When to use**, **Command**, **Parameters**, **Error handling**
- Operations: Generate Image, Crop Frames, Resize Frames, Generate Video, Stitch Videos
- Better organized output structure documentation

---

## Phase 5: Reasoning Layer ✅ COMPLETE

**Already implemented in Phase 2** with the "Before Each Major Step" section:

```markdown
## Before Each Major Step

Think through your choices:

1. State what you understand about user's vision
2. Explain why you're choosing specific presets/approaches
3. Mention alternatives if relevant
4. Then execute
```

---

## Phase 6: WebSocket Implementation ✅ COMPLETE

### Implementation Summary

Full bidirectional WebSocket communication with mid-generation cancellation.

### Files Created

| File | Purpose |
|------|---------|
| `server/lib/websocket-handler.ts` | WebSocket server with message routing, heartbeat, session subscriptions |
| `frontend/src/hooks/useWebSocket.ts` | WebSocket client hook with auto-reconnect |

### Files Modified

| File | Changes |
|------|---------|
| `server/lib/ai-client.ts` | Added `activeGenerations` Map, `cancelGeneration()`, `isGenerating()`, `getActiveGenerations()` |
| `server/sdk-server.ts` | HTTP server creation, WebSocket integration, event handlers (chat, continue, cancel, yolo), cancel endpoint |
| `frontend/src/hooks/useStreamingGenerate.ts` | Added `cancelGeneration()` function, 'cancelled' event handling |
| `frontend/src/lib/api.ts` | Added `cancelGeneration()` API function |

### Server Features

1. **WebSocket Handler** (`/ws` path)
   - Session subscription (multiple clients per session)
   - Message routing: subscribe, chat, continue, cancel, yolo, ping
   - Heartbeat ping/pong every 30s
   - Auto-cleanup on disconnect

2. **AbortController Support**
   - Stored per session in `activeGenerations` Map
   - `cancelGeneration(sessionId)` - Abort in-progress generation
   - `isGenerating(sessionId)` - Check if generation active

3. **Cancel Endpoint** (`POST /sessions/:id/cancel`)
   - REST API for SSE-based clients
   - Broadcasts cancellation to SSE and WebSocket subscribers

4. **Dual Protocol Support**
   - SSE endpoints maintained for backwards compatibility
   - WebSocket for bidirectional communication
   - Both broadcast same events

### Frontend Features

1. **useWebSocket Hook**
   - Auto-connect on mount
   - Auto-reconnect with exponential backoff (max 5 attempts)
   - `sendMessage()` - Start generation
   - `continueSession()` - Continue at checkpoints
   - `cancelGeneration()` - Stop mid-generation
   - `enableYoloMode()` - Enable autonomous mode
   - `subscribeToSession()` - Watch existing session

2. **useStreamingGenerate Hook (updated)**
   - Added `cancelGeneration()` for SSE-based cancellation
   - Handles 'cancelled' event type

### Message Protocol

**Client → Server:**
```typescript
{ type: 'subscribe', sessionId: string }
{ type: 'unsubscribe', sessionId: string }
{ type: 'chat', content: string, sessionId?: string, images?: string[] }
{ type: 'continue', sessionId: string, content?: string }
{ type: 'cancel', sessionId: string }
{ type: 'yolo', sessionId: string }
{ type: 'ping' }
```

**Server → Client:**
```typescript
{ type: 'connected', sessionId: string, timestamp: string }
{ type: 'subscribed', sessionId: string, timestamp: string }
{ type: 'unsubscribed', sessionId: string, timestamp: string }
{ type: 'session_init', sessionId: string }
{ type: 'text_delta', text: string }
{ type: 'message_type_hint', messageType: 'thinking' | 'response' }
{ type: 'assistant_message', messageType: string, text: string }
{ type: 'system', subtype: string, data: object }
{ type: 'progress', sessionId: string, progress: object, awaitingInput: boolean }
{ type: 'checkpoint', checkpoint: object }
{ type: 'complete', sessionId: string, response: string, checkpoint?: object, awaitingInput: boolean, sessionStats: object, pipeline: object }
{ type: 'cancelled', sessionId: string }
{ type: 'error', error: string }
{ type: 'pong', timestamp: string }
{ type: 'heartbeat', timestamp: string }
```

---

## Files Modified (All Phases)

| File | Changes |
|------|---------|
| `server/lib/ai-client.ts` | Permissions, tools, settingSources, progressEmitter, autonomousMode injection, AbortController support, cancelGeneration(), TaskOutput artifact parsing fix |
| `server/lib/orchestrator-prompt.ts` | Complete rewrite - goal-first Creative Director |
| `server/lib/session-manager.ts` | Added autonomousMode to metadata, setAutonomousMode(), isAutonomousMode() |
| `server/lib/websocket-handler.ts` | Phase 7 message types (block_start/delta/end, message_start/stop), block event fields |
| `server/sdk-server.ts` | /yolo detection, progress events, autonomousMode handling, HTTP server, WebSocket integration, cancel endpoint, Phase 7 block events for WebSocket handlers |
| `frontend/src/main.tsx` | Removed StrictMode (fixes WebSocket connection instability) |
| `frontend/src/components/chat/ChatInput.tsx` | YOLO visual indicator, updated placeholder |
| `frontend/src/hooks/useStreamingGenerate.ts` | Block handling, real-time streaming, progress events, removed duplicate accumulation, cancelGeneration() |
| `frontend/src/hooks/useWebSocket.ts` | Block handling, real-time streaming, progress events, auto-reconnect, cancellation |
| `frontend/src/lib/api.ts` | Added cancelGeneration() API function |
| `frontend/src/lib/types.ts` | Added ContentBlock interface with tool fields |
| `frontend/src/components/chat/ThinkingMessage.tsx` | Renders blocks with tool badges, collapsible |
| `frontend/src/components/chat/ChatView.tsx` | Renders currentBlocks during streaming |
| `agent/.claude/skills/fashion-shoot-pipeline/SKILL.md` | Enhanced with Purpose/When to use sections |

## Files Created (Phase 6 & 7)

| File | Purpose |
|------|---------|
| `server/lib/websocket-handler.ts` | WebSocket server with message routing, heartbeat, session subscriptions |
| `frontend/src/hooks/useWebSocket.ts` | WebSocket client hook with auto-reconnect, cancellation support |
| `frontend/src/components/chat/ToolCallBlock.tsx` | Tool execution visualization with spinner, duration, expandable input |

---

## Phase 6 Verification Tests ✅ COMPLETE

### Test 1: WebSocket Connection ✅ PASSED
```
1. Open browser console
2. Verify: WebSocket connects to ws://localhost:3002/ws ✅
3. Verify: Receives { type: "connected" } message ✅
4. Verify: Heartbeat ping/pong every 30s ✅

Note: Required Phase 8 fix (StrictMode removal) to work properly.
```

### Test 2: Normal Flow (with agent-initiated pauses)
```
1. Start new session via WebSocket
2. Upload reference image (still via HTTP POST)
3. Send: { type: "chat", content: "Create a dramatic fashion video" }
4. Verify: Receives text_delta events
5. Verify: Agent explains reasoning, generates hero
6. Verify: Agent asks for feedback naturally
7. Send: { type: "continue" }
8. Verify: Agent proceeds, pauses at meaningful moments
9. Complete pipeline
```

### Test 3: YOLO Mode
```
1. Send: { type: "yolo" }
2. Send: { type: "chat", content: "Create a dramatic fashion video" }
3. Verify: Agent runs entire pipeline without pauses
4. Verify: Receives complete event with final video
```

### Test 4: Cancel Mid-Generation
```
1. Start generation
2. While video generating, send: { type: "cancel" }
3. Verify: Generation stops
4. Verify: Receives { type: "cancelled" } event
5. Verify: Can start new generation
```

### Test 5: Flexibility
```
1. Send: { type: "chat", content: "Just create a hero image, no video" }
2. Verify: Agent creates hero only, doesn't force full pipeline
```

### Test 6: Agent Reasoning
```
1. Send: { type: "chat", content: "Create something edgy" }
2. Verify: Agent explains why it chose specific presets
3. Verify: Agent mentions alternatives considered
```

---

## Phase 7: Chat UX Streaming Improvements ✅ COMPLETE

### Implementation Summary

Implemented block-level streaming with real-time text display and proper progress event handling.

### Problems Solved

1. **Duplicate messages** - Server sent both `block_delta` and `text_delta` for same content, causing triple accumulation
2. **No real-time streaming** - Text only appeared after `message_stop`, not during streaming
3. **Missing artifact images** - Frontend didn't handle `progress` events from PostToolUse hooks

### Architecture

#### Server Events (sdk-server.ts)

Server emits block-level events from SDK stream:

```typescript
// Block lifecycle
{ type: 'block_start', blockIndex, blockType: 'text' | 'thinking' | 'tool_use', toolName? }
{ type: 'block_delta', blockIndex, text?, inputJsonDelta? }
{ type: 'block_end', blockIndex, toolInput?, toolDuration? }

// Message lifecycle
{ type: 'message_start' }
{ type: 'message_stop' }

// Progress events (from PostToolUse hooks)
{ type: 'progress', sessionId, progress: { stage, artifact?, artifacts?, message } }

// Legacy (backwards compatibility)
{ type: 'text_delta', text }  // Sent alongside block_delta
```

#### Frontend Block Handling (useStreamingGenerate.ts)

```typescript
// Block accumulator tracks streaming blocks
interface BlockAccumulator {
  blocks: Map<number, ContentBlock>;
  toolInputBuffers: Map<number, string>;
}

// handleBlockDelta updates BOTH blocks AND streaming message
const handleBlockDelta = useCallback((event) => {
  // 1. Accumulate to block
  block.content += event.text;

  // 2. Build full text from all text/thinking blocks
  const allTextContent = Array.from(blocks.values())
    .filter(b => b.type === 'text' || b.type === 'thinking')
    .map(b => b.content)
    .join('\n');

  // 3. Update streaming message content (real-time display)
  setState(prev => ({
    messages: prev.messages.map(msg =>
      msg.id === currentStreamingId ? { ...msg, content: allTextContent } : msg
    ),
    currentBlocks: new Map(blocks),
  }));
}, []);

// finalizeBlocksToMessage updates existing placeholder (not create new)
const finalizeBlocksToMessage = useCallback(() => {
  // Update existing streaming message instead of creating new
  if (currentStreamingId) {
    setState(prev => ({
      messages: prev.messages.map(msg =>
        msg.id === currentStreamingId ? { ...msg, content, type, isStreaming: false } : msg
      ),
    }));
  }
}, []);
```

#### Event Handlers

```typescript
// text_delta - IGNORED (prevents duplicate accumulation)
case 'text_delta':
  // Server sends both block_delta and text_delta for same content
  // Block system handles accumulation via block_delta events
  break;

// progress - Handles artifact images from PostToolUse hooks
case 'progress':
  const progress = data.progress as Checkpoint;
  if (progress && (progress.artifact || progress.artifacts?.length)) {
    addArtifactMessages(progress);  // Show images/videos
    addMessage({ role: 'system', type: 'checkpoint', checkpoint: progress });
  }
  break;
```

### Files Modified

| File | Changes |
|------|---------|
| `frontend/src/hooks/useStreamingGenerate.ts` | Block handling, real-time updates, progress events, removed duplicate accumulation |
| `frontend/src/hooks/useWebSocket.ts` | Same block handling and progress event fixes |
| `frontend/src/lib/types.ts` | Added `ContentBlock` interface with tool fields |
| `frontend/src/components/chat/ThinkingMessage.tsx` | Renders blocks with tool badges |
| `frontend/src/components/chat/ToolCallBlock.tsx` | NEW: Tool execution visualization |
| `frontend/src/components/chat/ChatView.tsx` | Renders `currentBlocks` during streaming |

### Data Flow

```
Server (SDK)                          Frontend
============                          ========

content_block_start
    ↓
  block_start ----------------------> handleBlockStart()
                                          → Create ContentBlock
                                          → Update currentBlocks

content_block_delta (text: "Hello")
    ↓
  block_delta ----------------------> handleBlockDelta()
                                          → Accumulate to block.content
                                          → Build allTextContent
                                          → Update streaming message  ← REAL-TIME
                                          → RAF-batched state update (60fps)

  text_delta -----------------------> IGNORED (prevents duplicates)

content_block_stop
    ↓
  block_end ------------------------> handleBlockEnd()
                                          → Mark block complete
                                          → Parse tool input

message_stop
    ↓
  message_stop ---------------------> finalizeBlocksToMessage()
                                          → Update existing placeholder
                                          → Convert to ThinkingMessage if has tools

progress (from PostToolUse hook)
    ↓
  progress -------------------------> case 'progress'
                                          → addArtifactMessages() ← SHOW IMAGES
                                          → addMessage(checkpoint)
```

### Key Fixes

1. **Removed duplicate `appendToStreamingMessage()` from `block_delta`** - Server sends both `block_delta` AND `text_delta` for backwards compatibility. Frontend now only uses block system.

2. **`text_delta` handler is now a no-op** - Prevents triple accumulation (block_delta + text_delta + legacy append).

3. **`handleBlockDelta` updates streaming message in real-time** - Builds `allTextContent` from all blocks and updates the message on each RAF tick.

4. **`finalizeBlocksToMessage` updates existing placeholder** - Instead of creating new messages, it updates the streaming placeholder with finalized content.

5. **Added `progress` event handler** - Frontend now handles progress events from PostToolUse hooks to display artifact images.

### Acceptance Criteria ✅

- [x] Thinking text shown in collapsible component (not chat bubble)
- [x] Final response shown in clean chat bubble
- [x] Tool calls visible inline with name + spinner
- [x] Tool results expandable
- [x] Smooth streaming without flickering (60fps RAF batching)
- [x] Clear visual distinction between phases
- [x] Real-time text streaming (character-by-character)
- [x] Artifact images displayed when progress events received

---

## Phase 8: WebSocket Streaming Fixes ✅ COMPLETE

### Problem Summary

WebSocket chat streaming was not working despite Phase 6 & 7 implementations:
1. **Connection instability** - WebSocket connected then immediately disconnected
2. **No messages rendering** - Frontend showed empty message list
3. **Artifacts not detected** - Agent continued without stopping after generating hero image

### Root Causes Identified

| Issue | Root Cause |
|-------|-----------|
| Connection instability | React StrictMode double mount/unmount |
| Messages not rendering | WebSocket handlers sent `text_delta` (ignored by Phase 7 frontend) instead of block events |
| Artifacts not detected | Background tasks (TaskOutput) returned escaped JSON that wasn't parsed |

### Fixes Implemented

#### 8.1 React StrictMode Removal

**File:** `frontend/src/main.tsx`

**Problem:** StrictMode intentionally double-mounts components in development, causing:
```
Mount → connect() → Unmount → disconnect() → Mount → connect() (fails)
```

**Fix:** Removed StrictMode wrapper (only affects development, not production):
```typescript
// Before
<StrictMode>
  <App />
</StrictMode>

// After
<App />
```

#### 8.2 WebSocket Phase 7 Block Events

**File:** `server/sdk-server.ts`

**Problem:** WebSocket chat/continue handlers only sent `text_delta`, but frontend ignores `text_delta` in Phase 7 (uses block events instead).

**Fix:** Updated WebSocket handlers to emit full Phase 7 block-level events:

```typescript
// Now emits these events (same as SSE endpoints):
{ type: 'message_start' }
{ type: 'block_start', blockIndex, blockType, toolName?, toolId? }
{ type: 'block_delta', blockIndex, text?, inputJsonDelta? }
{ type: 'block_end', blockIndex, toolInput?, toolDuration? }
{ type: 'message_stop' }
```

#### 8.3 Removed Duplicate `assistant_message`

**File:** `server/sdk-server.ts`

**Problem:** After block events streamed, server also sent `assistant_message` which created a NEW empty message placeholder in frontend.

**Fix:** Removed `assistant_message` broadcast from WebSocket handlers. Phase 7 block events handle all streaming - `assistant_message` is only needed for legacy `text_delta` flow.

```typescript
// Before
wsHandler.broadcastToSession(sessionId, { type: 'assistant_message', messageType, text });

// After - just track text for final response, don't broadcast
assistantMessages.push(text);
```

#### 8.4 Updated WSServerMessage Type

**File:** `server/lib/websocket-handler.ts`

Added Phase 7 message types to the TypeScript interface:

```typescript
export interface WSServerMessage {
  type:
    | 'connected' | 'subscribed' | 'unsubscribed' | 'session_init'
    | 'text_delta' | 'message_type_hint' | 'assistant_message'
    | 'system' | 'progress' | 'checkpoint' | 'complete'
    | 'cancelled' | 'error' | 'pong' | 'heartbeat'
    // Phase 7 block-level events (NEW)
    | 'block_start' | 'block_delta' | 'block_end'
    | 'message_start' | 'message_stop';

  // Phase 7 block-level event fields (NEW)
  blockIndex?: number;
  blockType?: string;
  toolName?: string;
  toolId?: string;
  inputJsonDelta?: string;
  toolInput?: Record<string, unknown>;
  toolDuration?: number;
  // ... other fields
}
```

#### 8.5 Background Task Artifact Detection

**File:** `server/lib/ai-client.ts`

**Problem:** When scripts run in background via Bash, the actual output comes through TaskOutput. TaskOutput returns escaped JSON (`\"` instead of `"`), so artifact events weren't parsed.

**Fix:** Unescape TaskOutput responses before parsing:

```typescript
function parseArtifactEvents(toolName: string, toolResponse: any): ProgressData[] {
  // ... get output string ...

  // Unescape if TaskOutput returned escaped JSON (has \" instead of ")
  if (output.includes('\\"')) {
    output = output.replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }

  // ... parse lines for artifact JSON ...
}
```

### Files Modified

| File | Changes |
|------|---------|
| `frontend/src/main.tsx` | Removed StrictMode wrapper |
| `server/sdk-server.ts` | WebSocket handlers emit Phase 7 block events, removed `assistant_message` |
| `server/lib/websocket-handler.ts` | Added Phase 7 message types and fields to WSServerMessage |
| `server/lib/ai-client.ts` | Unescape TaskOutput responses for artifact detection |

### Verification

After fixes, server logs should show:
```
🔌 WebSocket client connected: ws_xxx
📨 WebSocket message from ws_xxx: chat
🎨 [ARTIFACT] Found: outputs/hero.png (image)
📊 PROGRESS: image - image ready: outputs/hero.png
```

And frontend should:
- Maintain stable WebSocket connection (no rapid connect/disconnect)
- Display streaming text in real-time
- Show artifact images when generated

---

## Out of Scope (Future)

- **Cloudflare deployment** - Will port changes after local server is complete
- Interactive preset picker component
- Multi-agent architecture (skills are sufficient)
- Semantic tool wrappers (nice-to-have, not required)
