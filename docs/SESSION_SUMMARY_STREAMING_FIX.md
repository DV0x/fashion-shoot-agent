# Session Summary: Streaming UI Fix (2026-01-21)

## Problem Statement

The chat UI was displaying duplicate/multiple message bubbles instead of a clean Claude Code-style interface:

**Before (Broken):**
- Multiple separate text bubbles for each intermediate message
- Thinking section only captured first tool call
- Subsequent reasoning appeared as separate TextMessage bubbles
- Poor UX - user couldn't distinguish thinking from final response

**Desired Behavior:**
- ONE collapsible "Thinking" section containing ALL intermediate content (reasoning + tool calls)
- ONE TextMessage bubble for the final response to the user

## Root Cause Analysis

1. **Server sending unreliable `stopReason`**: The server defaulted to `'end_turn'` when `event.message?.stop_reason` was undefined
2. **Frontend creating new placeholders**: Each `message_start` was creating new message bubbles
3. **Premature finalization**: Messages were being finalized as TextMessages during streaming instead of accumulating

## Solution Implemented

### Key Insight
Instead of relying on `stopReason` to classify messages during streaming, we:
1. Accumulate ALL content in ThinkingMessage during generation
2. On `complete` event, analyze the history to extract the final response

### New Data Structure

```typescript
interface ThinkingSegment {
  text: string;
  hasTools: boolean;  // Track whether this message had tool calls
  blocks: ContentBlock[];
}

interface ThinkingHistory {
  segments: ThinkingSegment[];
}
```

### New Flow

```
User sends message
    ↓
ThinkingMessage created immediately (not TextMessage placeholder)
    ↓
All content streams into ThinkingMessage
    ↓
Each message_stop → adds segment to history with hasTools flag
    ↓
Everything accumulates in ONE ThinkingMessage
    ↓
On 'complete' event:
  - Check last segment: has tools?
  - NO tools → Extract to TextMessage (final response)
  - YES tools → Keep in ThinkingMessage
    ↓
Result:
  - ThinkingMessage = All reasoning + tool calls (collapsible)
  - TextMessage = Final response only (visible bubble)
```

## Files Changed

### Frontend

**`frontend/src/hooks/useWebSocket.ts`**

1. **New interfaces** for tracking thinking history with tool detection
2. **`sendMessage` / `continueSession`**: Create ThinkingMessage from start (not TextMessage)
3. **`handleBlockDelta`**: Stream into ThinkingMessage, combine history + current
4. **`finalizeBlocksToMessage`**: Always add to thinking history (don't create TextMessages during streaming)
5. **`complete` handler**: Extract final response based on `hasTools` flag

### Server (Previous Session)

**`server/sdk-server.ts`**
- Removed `assistant_message` events (Phase 7 blocks handle streaming)
- Kept only block-level events for streaming

**`frontend/src/components/chat/ChatView.tsx`**
- Removed duplicate `streamingBlocks` rendering section
- Simplified props (removed `currentBlocks`)

## Testing Checklist

### Basic Flow
- [ ] Send a message that triggers tool use
- [ ] Verify ThinkingMessage appears and streams content
- [ ] Verify tool calls appear inside ThinkingMessage (collapsible)
- [ ] Verify final response appears as separate TextMessage bubble
- [ ] Verify ThinkingMessage is collapsible

### Edge Cases
- [ ] Direct response (no tools): Should show only TextMessage, no ThinkingMessage
- [ ] Multiple tool calls: All should appear in ONE ThinkingMessage
- [ ] Cancel mid-generation: Should clean up properly
- [ ] Continue session: Should create new ThinkingMessage for new turn

### Visual Verification
- [ ] No duplicate message bubbles
- [ ] Thinking section shows: reasoning text + tool calls
- [ ] Final message bubble shows: Claude's response to user
- [ ] Streaming appears smooth (no flickering)

## How to Test

1. Start the server:
```bash
cd server && npm run dev
```

2. Start the frontend:
```bash
cd frontend && npm run dev
```

3. Open browser to http://localhost:5173

4. Upload a reference image and send a prompt like:
```
Create a high-end fashion ad shoot
```

5. Observe:
   - ThinkingMessage should accumulate all intermediate content
   - Tool calls (Skill, Read, Bash) should appear inside ThinkingMessage
   - Final response should appear as a separate message bubble

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
├─────────────────────────────────────────────────────────────┤
│  useWebSocket Hook                                          │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ThinkingHistory                                      │   │
│  │  segments: [                                         │   │
│  │    { text: "...", hasTools: true, blocks: [...] },  │   │
│  │    { text: "...", hasTools: true, blocks: [...] },  │   │
│  │    { text: "...", hasTools: false, blocks: [...] }  │ ← Final │
│  │  ]                                                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           ↓                                 │
│  On 'complete':                                             │
│    - segments[0..n-1] → ThinkingMessage (has tools)        │
│    - segments[n] → TextMessage (no tools = final response) │
└─────────────────────────────────────────────────────────────┘
                            ↑
                    WebSocket Events
                            │
┌───────────────────────────┴─────────────────────────────────┐
│                         Server                               │
│  - message_start                                             │
│  - block_start / block_delta / block_end                    │
│  - message_stop                                              │
│  - complete                                                  │
└─────────────────────────────────────────────────────────────┘
```

## Known Limitations

1. **stopReason detection**: Still relies on server sending correct stopReason for some edge cases
2. **Empty thinking**: If Claude answers directly without tools, ThinkingMessage is created then removed (minor flash)
3. **Tool result display**: Tool results are not shown in the UI (only tool calls)

## Future Improvements

1. Show tool results inside ThinkingMessage
2. Better animation for ThinkingMessage collapse/expand
3. Show token usage in ThinkingMessage header
4. Add "copy" button for final response
