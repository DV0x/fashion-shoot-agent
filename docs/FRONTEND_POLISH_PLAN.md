# Frontend Polish Plan - Fashion Shoot Agent

## Goal
Fix the existing frontend to make streaming, thinking indicators, and image/video rendering work reliably. Keep the "Editorial Darkroom" theme - just polish interactions.

---

## Previously Implemented (Keep These)

From the 2025-12-31 session, these features are already working:

| Feature | File | Status |
|---------|------|--------|
| `artifacts` array in Checkpoint type | `types.ts` | ✅ Keep |
| `activity` state for tool indicator | `useStreamingGenerate.ts` | ✅ Keep |
| `getActivityLabel()` - tool name mapping | `useStreamingGenerate.ts` | ✅ Keep |
| `addArtifactMessages()` - images from checkpoints | `useStreamingGenerate.ts` | ✅ Keep |
| `processSSEStream()` - reusable SSE parser | `useStreamingGenerate.ts` | ✅ Keep |
| `/continue-stream` endpoint | `sdk-server.ts` | ✅ Keep |
| Pulsing activity indicator | `ChatView.tsx` | ⚠️ Enhance (3-dot) |
| Softer TextMessage styling | `TextMessage.tsx` | ✅ Keep |
| Gradient CheckpointMessage | `CheckpointMessage.tsx` | ⚠️ Remove Modify btn |
| Floating ChatInput | `ChatInput.tsx` | ⚠️ Add dynamic placeholder |

**We are NOT rewriting from scratch** - we're enhancing what exists.

---

## Key Architectural Insight

**The Claude Agent SDK DOES distinguish between intermediate and final messages** via `stop_reason`:

| `stop_reason` | Has `tool_use` | Meaning |
|---------------|----------------|---------|
| `"tool_use"` | Yes | **Thinking** - Claude explaining what it's about to do before calling tools |
| `"end_turn"` | No | **Response** - Claude's final output to the user |

**Solution:** Server emits different event types based on `stop_reason`
- `thinking_delta` → Messages with `stop_reason: "tool_use"` (intermediate)
- `text_delta` → Messages with `stop_reason: "end_turn"` (final response)

**Frontend handling:**
- `thinking_delta` → Collapsible/dimmed "thinking" section
- `text_delta` → Main response bubble
- Tool activity indicator → Shows during actual tool execution (`system` events)

---

## Visual Design

```
┌─────────────────────────────────────────┐
│ 💭 Setting up pipeline...           [▼] │  ← Thinking (dimmed, collapsible)
│    Reading presets...                   │
│    Activating skill...                  │
└─────────────────────────────────────────┘

     [●●●] Running command...              ← Activity indicator (during tool)

┌─────────────────────────────────────────┐
│ 📸 Hero Image Ready                     │  ← Checkpoint card
│ [Continue]                              │
└─────────────────────────────────────────┘

┌───────┬───────┬───────┐
│ img 1 │ img 2 │ img 3 │                  ← Image grid (2x3)
├───────┼───────┼───────┤
│ img 4 │ img 5 │ img 6 │
└───────┴───────┴───────┘

┌─────────────────────────────────────────┐
│ Here's your completed shoot!▋           │  ← Response (main bubble, cursor)
└─────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 0: Server-Side Thinking/Response Separation (Critical)

**File:** `server/sdk-server.ts`

The server currently sends ALL assistant text as `text_delta`. We need to distinguish based on content:

**Current code (lines 488-503):**
```typescript
if (message.type === 'stream_event') {
  const event = (message as any).event;
  if (event?.type === 'content_block_delta' && event?.delta?.text) {
    res.write(`data: ${JSON.stringify({ type: 'text_delta', text: event.delta.text })}\n\n`);
  }
}
```

**New approach:** Check content blocks in `SDKAssistantMessage`:
```typescript
if (message.type === 'assistant') {
  const hasToolUse = message.message.content.some(c => c.type === 'tool_use');
  const messageType = hasToolUse ? 'thinking' : 'response';
  res.write(`data: ${JSON.stringify({
    type: 'assistant_message',
    messageType,  // NEW: 'thinking' or 'response'
    text
  })}\n\n`);
}
```

Frontend handles `messageType` to render appropriately.

---

### Phase 1: Core Streaming Polish

1. **index.css** - Add CSS for:
   - 3-dot bounce animation
   - Blinking cursor for streaming
   - Image grid layout classes
   - Thinking message styles

2. **ChatView.tsx** - Improve thinking indicator:
   - Replace single pulsing dot with 3-dot animation
   - Smoother fade transitions

3. **TextMessage.tsx** - Add streaming cursor:
   - Check if message is currently streaming (pass as prop)
   - Show cursor after last character when streaming

---

### Phase 2: Media Improvements

4. **ImageMessage.tsx** - Enhance lightbox:
   - Add download button
   - Keyboard support (Esc to close, arrows to navigate)
   - Better close button styling

5. **ImageGrid.tsx** (NEW) - Compact grid:
   - Detect consecutive image messages
   - Render as 2x3 responsive grid
   - Click any image → lightbox with prev/next

6. **VideoMessage.tsx** - Player polish:
   - Visible play button initially (not just on hover)
   - Optional: progress indicator

---

### Phase 3: Checkpoint & Cleanup

7. **CheckpointMessage.tsx** - Simplify:
   - Remove Modify button (user can type in input box)
   - Keep only Continue button

8. **ChatInput.tsx** - Dynamic placeholder:
   - "Continue or type to modify..." when at checkpoint

9. **useStreamingGenerate.ts** - Handle message types:
   - Track `messageType` from server
   - Separate thinking messages from response messages
   - Expose `streamingMessageId` for cursor display

---

## Files to Modify

### Server (Phase 0)
| File | Change Type | Changes |
|------|-------------|---------|
| `server/sdk-server.ts` | **MODIFY** | Add `messageType: 'thinking' \| 'response'` to `assistant_message` events |

### Frontend (Phases 1-3)
| File | Change Type | Changes |
|------|-------------|---------|
| `frontend/src/lib/types.ts` | **MODIFY** | Add `ThinkingMessage` type to message union |
| `frontend/src/index.css` | **MODIFY** | Add: 3-dot bounce, cursor blink, grid layout, thinking styles |
| `frontend/src/hooks/useStreamingGenerate.ts` | **MODIFY** | Handle `messageType`, separate thinking from response |
| `frontend/src/components/chat/ChatView.tsx` | **MODIFY** | Upgrade pulsing dot → 3-dot animation, add image grouping |
| `frontend/src/components/chat/ThinkingMessage.tsx` | **NEW** | Collapsible dimmed thinking block |
| `frontend/src/components/chat/TextMessage.tsx` | **MODIFY** | Add streaming cursor (blinking ▋) |
| `frontend/src/components/chat/ImageMessage.tsx` | **MODIFY** | Lightbox: download button, keyboard (Esc), prev/next |
| `frontend/src/components/chat/ImageGrid.tsx` | **NEW** | Compact 2x3 grid for consecutive images |
| `frontend/src/components/chat/VideoMessage.tsx` | **MODIFY** | Show play button initially (not just hover) |
| `frontend/src/components/chat/CheckpointMessage.tsx` | **MODIFY** | Remove Modify button, keep Continue only |
| `frontend/src/components/chat/ChatInput.tsx` | **MODIFY** | Dynamic placeholder at checkpoints |

### Summary
- **New files:** 2 (`ThinkingMessage.tsx`, `ImageGrid.tsx`)
- **Modified files:** 10
- **Total:** 12 files

---

## CSS Additions

```css
/* 3-dot thinking animation */
.thinking-dots {
  display: flex;
  gap: 4px;
}
.thinking-dot {
  width: 8px;
  height: 8px;
  background: var(--color-accent);
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}
.thinking-dot:nth-child(1) { animation-delay: -0.32s; }
.thinking-dot:nth-child(2) { animation-delay: -0.16s; }
.thinking-dot:nth-child(3) { animation-delay: 0s; }

@keyframes bounce {
  0%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-6px); }
}

/* Streaming cursor */
.streaming-cursor::after {
  content: '▋';
  animation: blink 1s infinite;
  color: var(--color-accent);
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Image grid */
.image-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
@media (max-width: 640px) {
  .image-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Thinking message (collapsible, dimmed) */
.thinking-message {
  opacity: 0.6;
  font-size: 0.875rem;
  border-left: 2px solid var(--color-border);
  padding-left: 12px;
  margin-left: 8px;
}
.thinking-message.collapsed {
  max-height: 2.5em;
  overflow: hidden;
}
.thinking-toggle {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
}
```

---

## Testing Checklist

After implementation:

### Thinking/Response Separation
- [ ] Intermediate messages ("Let me...", "Now I'll...") show as dimmed thinking blocks
- [ ] Final response shows as main message bubble
- [ ] Thinking blocks are collapsible (click to expand/collapse)

### Streaming
- [ ] 3-dot thinking animation appears during tool execution
- [ ] Text streams token-by-token with blinking cursor
- [ ] Cursor disappears when streaming completes
- [ ] Activity label updates ("Running command...", "Reading files...")

### Media
- [ ] Hero image displays correctly after checkpoint
- [ ] 6 frames display in compact 2x3 grid layout
- [ ] Click any frame → lightbox opens with download button
- [ ] Press Esc → lightbox closes
- [ ] Arrow keys navigate between images in lightbox
- [ ] Final video displays with visible play button

### Checkpoints
- [ ] Continue button works, streams next phase
- [ ] Modify button removed
- [ ] Input placeholder changes at checkpoint ("Continue or type to modify...")

---

## Out of Scope (Not Fixing)
- Copy to clipboard button
- Regenerate messages
- Keyboard shortcuts beyond Esc/arrows
- Dark/light theme toggle
- Session persistence in localStorage
- Drag-and-drop file upload

---

## Summary

### What's Already Done (from previous session)
- ✅ SSE streaming infrastructure
- ✅ Activity indicator (needs upgrade to 3-dot)
- ✅ Image/video display from checkpoints
- ✅ `/continue-stream` endpoint
- ✅ Basic UI styling

### What's New in This Plan
| Phase | Focus | New Work |
|-------|-------|----------|
| **0** | Server-side thinking/response separation | Add `messageType` to events |
| **1** | Streaming polish | 3-dot animation, blinking cursor |
| **2** | Media improvements | ImageGrid component, lightbox nav |
| **3** | UX cleanup | Remove Modify, dynamic placeholder |

### Files Summary
- **New components:** 2 (`ThinkingMessage.tsx`, `ImageGrid.tsx`)
- **Modified files:** 10
- **Total changes:** 12 files

### Key Deliverable
Thinking messages shown separately from response - matching Claude/Gemini UX pattern.
