# Fashion-Shoot-Agent: Architectural Transformation Plan

## Executive Summary

Transform the fashion-shoot-agent from a **rigid workflow executor** into a **flexible creative collaborator** by fixing 5 architectural gaps + 3 SDK technical issues, and adding a `/yolo` command for autonomous mode.

---

## Phase 1: SDK Technical Fixes (High Priority)

### 1.1 Fix Permission Handling in ai-client.ts

**File:** `server/lib/ai-client.ts`

**Problem:** Missing `permissionMode` and `canUseTool` - may block on prompts in headless server.

**Fix:**
```typescript
const queryOptions = {
  // ... existing options
  permissionMode: 'default',
  canUseTool: async (toolName, input) => ({
    behavior: 'allow',
    updatedInput: input
  }),
};
```

### 1.2 Add Missing Tools

**File:** `server/lib/ai-client.ts`

**Current:** Missing `Edit`, `Grep`, `TodoWrite`, `WebFetch`

**Fix:**
```typescript
allowedTools: [
  "Read", "Write", "Edit", "Glob", "Grep",
  "Bash", "Task", "Skill", "TodoWrite", "WebFetch"
],
```

### 1.3 Consistent Settings Sources

**File:** `server/lib/ai-client.ts`

**Fix:** Use `settingSources: ['project']` (not `['user', 'project']`).

---

## Phase 2: Orchestrator Prompt Rewrite

### 2.1 Goal-First Structure

**File:** `server/lib/orchestrator-prompt.ts`

**Current:** 193 lines of "Phase 1, Phase 2..." - task-oriented.

**New Structure:**
```markdown
# Creative Director

## Your Goal
Help the user create a professional fashion video that captures their creative vision.

## Success Criteria
- User approves the final output
- Visual style matches their intent
- Quality meets editorial standards

## Your Approach
1. UNDERSTAND: Analyze references, ask clarifying questions
2. PROPOSE: Suggest creative direction with reasoning
3. EXECUTE: Generate incrementally, pause at meaningful moments
4. ADAPT: Incorporate feedback, try alternatives

## Your Capabilities
- Image generation (hero shots, contact sheets, variations)
- Frame extraction and manipulation
- Video creation and stitching
- Style analysis and preset selection

## When to Pause
- Creative decisions: "I chose dramatic lighting. Does this resonate?"
- Before expensive operations: "Video generation takes 5-10 min. Ready?"
- Uncertainty: "The pose feels stiff. Should I retry?"
- User asked: Explicit review request

## YOLO Mode
If user says "/yolo", run entire pipeline to completion without pauses.
```

### 2.2 Remove Rigid Phase Language

**Remove:**
- "Phase 1:", "Phase 2:", etc.
- "ALWAYS use Skill tool in this order"
- Hardcoded script commands
- `---CHECKPOINT---` syntax

**Keep:**
- Tool/skill descriptions
- Quality guidelines
- Error handling advice

---

## Phase 3: Checkpoint System Redesign

### 3.1 Remove System-Forced Checkpoints

**File:** `server/lib/ai-client.ts`

**Remove:** PostToolUse hook that detects file outputs and emits checkpoints.

**Keep:** PostToolUse for progress tracking (emit events but don't force stop).

### 3.2 Agent-Initiated Pauses

**Mechanism:** Agent naturally pauses by asking questions in its response.

**Detection:** Server detects agent is waiting for input when:
- Response ends with a question
- Response contains review request patterns
- Agent explicitly says "waiting for your input"

### 3.3 Implement /yolo Command

**Frontend:** `frontend/src/components/chat/ChatInput.tsx`
- Detect `/yolo` command
- Set session flag `autonomousMode: true`

**Backend:** `server/lib/ai-client.ts`
- Check `autonomousMode` flag
- Inject into system prompt: "User requested autonomous mode. Run to completion without pauses."

---

## Phase 4: Skill Documentation Enhancement

### 4.1 Improve fashion-shoot-pipeline SKILL.md

**File:** `agent/.claude/skills/fashion-shoot-pipeline/SKILL.md`

**Add clearer operation descriptions:**

```markdown
## Available Operations

### Generate Image
**Purpose:** Create hero shots or contact sheets
**When to use:** Starting a new shoot, creating variations
**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| --prompt | Yes | Style description from editorial-photography skill |
| --input | Yes | Reference image paths (can specify multiple) |
| --output | Yes | Output file path |
| --aspect-ratio | No | Default 3:2 |
| --resolution | No | Default 2K |

### Crop Frames
**Purpose:** Extract individual frames from contact sheet
**When to use:** After contact sheet is approved
**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| --input | Yes | Contact sheet path |
| --output-dir | Yes | Directory for frames |
| --grid | No | Default 3x2 |

### Generate Video
**Purpose:** Create motion between two frames
**When to use:** After frames are approved
**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| --start | Yes | Start frame path |
| --end | Yes | End frame path |
| --output | Yes | Output video path |
| --duration | No | Default 5s |

### Stitch Videos
**Purpose:** Combine clips into final video
**When to use:** After all clips are generated
**Parameters:**
| Param | Required | Description |
|-------|----------|-------------|
| --clips | Yes | Video paths in order |
| --output | Yes | Final video path |
| --easing | No | Transition style |
```

### 4.2 Update Orchestrator to Reference Skills Semantically

**In orchestrator prompt, change from:**
```
cd agent && npx tsx .claude/skills/fashion-shoot-pipeline/scripts/generate-image.ts --prompt "..."
```

**To:**
```
Use the fashion-shoot-pipeline skill's "Generate Image" operation.
Refer to the skill documentation for parameters.
```

Agent still constructs bash, but thinks at operation level first.

---

## Phase 5: Reasoning Layer

### 5.1 Add Analyze-Then-Act Pattern

**In orchestrator prompt, add:**
```markdown
## Before Each Major Step

1. State what you understand about user's vision
2. Explain why you're choosing specific presets/approaches
3. Mention alternatives you considered
4. Then execute

Example:
"I see you want an edgy, bold aesthetic. The editorial-drama pose with
studio-black background would create strong contrast and dramatic shadows.
I could also try urban-lean for a more street-style feel. Let me start
with the dramatic approach."
```

---

## Phase 6: WebSocket Implementation

### 6.1 Why WebSocket

Replace SSE with WebSocket for:
- Mid-stream cancellation (stop 5-min video generation)
- Steering signals (adjust during execution)
- Unified bidirectional protocol
- Better UX with `/yolo` and flexible checkpoints

### 6.2 Server WebSocket Handler

**New file:** `server/lib/websocket-handler.ts`

```typescript
import { WebSocketServer, WebSocket } from 'ws';

interface WSClient extends WebSocket {
  sessionId?: string;
  isAlive: boolean;
}

export class WebSocketHandler {
  private wss: WebSocketServer;
  private sessions: Map<string, Session> = new Map();

  constructor(server: HttpServer) {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WSClient) => {
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });
      ws.on('message', (data) => this.handleMessage(ws, data));
      ws.on('close', () => this.handleDisconnect(ws));
    });

    // Heartbeat every 30s
    setInterval(() => {
      this.wss.clients.forEach((ws: WSClient) => {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  private async handleMessage(ws: WSClient, data: Buffer) {
    const msg = JSON.parse(data.toString());

    switch (msg.type) {
      case 'subscribe':
        this.subscribeToSession(ws, msg.sessionId);
        break;
      case 'chat':
        await this.startGeneration(ws, msg);
        break;
      case 'continue':
        await this.continueSession(ws, msg);
        break;
      case 'cancel':
        await this.cancelGeneration(ws);
        break;
      case 'yolo':
        this.setAutonomousMode(ws, true);
        break;
    }
  }
}
```

### 6.3 Session with Subscribers

**Update:** `server/lib/session-manager.ts`

```typescript
class Session {
  private subscribers: Set<WSClient> = new Set();

  subscribe(client: WSClient) {
    this.subscribers.add(client);
    client.sessionId = this.id;
  }

  unsubscribe(client: WSClient) {
    this.subscribers.delete(client);
  }

  broadcast(event: any) {
    const message = JSON.stringify(event);
    for (const client of this.subscribers) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  }
}
```

### 6.4 Message Protocol

**Client → Server:**
```typescript
{ type: 'subscribe', sessionId: string }
{ type: 'chat', content: string, images?: string[] }
{ type: 'continue', content?: string }
{ type: 'cancel' }
{ type: 'yolo' }
```

**Server → Client:**
```typescript
{ type: 'connected', sessionId: string }
{ type: 'subscribed', sessionId: string }
{ type: 'text_delta', text: string }
{ type: 'assistant_message', content: string }
{ type: 'tool_use', toolName: string, toolId: string }
{ type: 'checkpoint', stage: string, artifact: string, message: string }
{ type: 'complete', sessionId: string, stats: object }
{ type: 'cancelled' }
{ type: 'error', message: string }
```

### 6.5 Frontend WebSocket Hook

**New file:** `frontend/src/hooks/useWebSocket.ts`

```typescript
export function useWebSocket(sessionId: string) {
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(`ws://${location.host}/ws`);

    ws.onopen = () => {
      setIsConnected(true);
      ws.send(JSON.stringify({ type: 'subscribe', sessionId }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      handleServerEvent(data);
    };

    wsRef.current = ws;
  }, [sessionId]);

  const send = useCallback((type: string, payload?: any) => {
    wsRef.current?.send(JSON.stringify({ type, ...payload }));
  }, []);

  const cancel = useCallback(() => send('cancel'), [send]);
  const yolo = useCallback(() => send('yolo'), [send]);

  return { isConnected, connect, send, cancel, yolo };
}
```

### 6.6 Cancel During Generation

```typescript
// In ai-client.ts - add AbortController support
class AIClient {
  private abortController: AbortController | null = null;

  async startGeneration(prompt: string) {
    this.abortController = new AbortController();

    for await (const message of query({
      prompt,
      options: { signal: this.abortController.signal }
    })) {
      // ... process messages
    }
  }

  cancel() {
    this.abortController?.abort();
  }
}
```

---

## Files to Modify (Local Server Only)

| File | Changes |
|------|---------|
| `server/lib/orchestrator-prompt.ts` | Complete rewrite - goal-first, reasoning, flexible |
| `server/lib/ai-client.ts` | Add permissions, tools, AbortController for cancel |
| `server/lib/session-manager.ts` | Add subscriber management for WebSocket |
| `server/sdk-server.ts` | Remove SSE endpoints, integrate WebSocket |
| `frontend/src/components/chat/ChatInput.tsx` | Detect `/yolo`, add cancel button |
| `frontend/src/hooks/useStreamingGenerate.ts` | Replace with WebSocket hook |
| `agent/.claude/skills/fashion-shoot-pipeline/SKILL.md` | Enhanced operation docs |

## New Files to Create

| File | Purpose |
|------|---------|
| `server/lib/websocket-handler.ts` | WebSocket server with message routing |
| `frontend/src/hooks/useWebSocket.ts` | WebSocket client hook |

---

## Files to Keep As-Is

| File | Reason |
|------|--------|
| `agent/.claude/skills/editorial-photography/` | Well-structured knowledge skill |
| `agent/.claude/skills/fashion-shoot-pipeline/` | Well-structured action skill |
| `server/lib/session-manager.ts` | Session management is fine |
| `frontend/src/components/chat/*.tsx` | UI components work well |

---

## Verification

### Test 1: WebSocket Connection
```
1. Open browser console
2. Verify: WebSocket connects to ws://localhost:3002/ws
3. Verify: Receives { type: "connected" } message
4. Verify: Heartbeat ping/pong every 30s
```

### Test 2: Normal Flow (with checkpoints)
```
1. Start new session via WebSocket
2. Upload reference image (still via HTTP POST)
3. Send: { type: "chat", content: "Create a dramatic fashion video" }
4. Verify: Receives text_delta events
5. Verify: Agent explains reasoning, generates hero
6. Verify: Receives checkpoint event
7. Send: { type: "continue" }
8. Verify: Agent proceeds, pauses at meaningful moments
9. Complete pipeline
```

### Test 3: YOLO Mode
```
1. Send: { type: "yolo" }
2. Send: { type: "chat", content: "Create a dramatic fashion video" }
3. Verify: Agent runs entire pipeline without checkpoint pauses
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

## Implementation Order

1. **SDK fixes** (Phase 1) - Low risk, immediate benefit
2. **Orchestrator prompt** (Phase 2) - Core change, medium risk
3. **Checkpoint redesign** (Phase 3) - Depends on prompt changes
4. **Skill documentation** (Phase 4) - Minor cleanup
5. **Reasoning layer** (Phase 5) - Polish
6. **WebSocket** (Phase 6) - Replace SSE, add cancel/yolo

**After local server complete:** Port to Cloudflare

---

## Out of Scope (Future)

- **Cloudflare deployment** - Will port changes after local server is complete
- UI action buttons at checkpoints
- Interactive preset picker component
- Multi-agent architecture (skills are sufficient)
- Semantic tool wrappers (nice-to-have, not required)
