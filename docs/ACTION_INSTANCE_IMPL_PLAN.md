# Action Instance Pattern - Implementation Plan

## Progress

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1 | ✅ Complete | Foundation - Types, ActionsManager, all 7 executors |
| Phase 2 | ✅ Complete | Skill & Prompt - action-proposer skill, orchestrator update, hooks |
| Phase 3 | ✅ Complete | Server Integration - execute_action/continue_action handlers |
| Phase 4 | ✅ Complete | Frontend - ActionCard.tsx, ContinueButton.tsx |
| Phase 5 | ✅ Complete | All action executors created |
| Phase 6 | 🔲 Pending | Testing & Polish |

### Completed Files

**Phase 1:**
- `server/actions/types.ts` - Type definitions
- `server/actions/index.ts` - ActionsManager class
- `server/actions/generate-hero.ts`
- `server/actions/generate-contact-sheet.ts`
- `server/actions/extract-frames.ts` (with cropMethod enum for variance/simple)
- `server/actions/resize-frames.ts`
- `server/actions/generate-video-clip.ts`
- `server/actions/generate-all-clips.ts`
- `server/actions/stitch-final.ts`

**Phase 2:**
- `agent/.claude/skills/action-proposer/SKILL.md` - Skill documentation
- `agent/.claude/skills/action-proposer/propose-action.ts` - Proposal script
- `server/lib/orchestrator-prompt.ts` - Updated for action-based workflow
- `server/lib/ai-client.ts` - Added PreToolUse hooks, actionEmitter
- `server/lib/session-manager.ts` - Removed autonomousMode
- `server/sdk-server.ts` - Removed YOLO, added actionEmitter listener
- `server/lib/websocket-handler.ts` - Added action message types

**Phase 3:**
- `server/sdk-server.ts` - Added execute_action, continue_action handlers, updated continue handler
- `server/lib/websocket-handler.ts` - Added originalParams field to types

**Phase 4:**
- `frontend/src/lib/types.ts` - Added ActionTemplate, ActionInstance, ActionResult, ActionMessage types
- `frontend/src/components/chat/ActionCard.tsx` - Form-based action UI component (NEW)
- `frontend/src/components/chat/ContinueButton.tsx` - Continuation trigger button (NEW)
- `frontend/src/hooks/useWebSocket.ts` - Added action state, handlers, executeAction, continueAction
- `frontend/src/components/chat/ChatView.tsx` - Render ActionCard, ContinueButton
- `frontend/src/App.tsx` - Pass action props to ChatView

---

## Key Decisions

| Decision | Choice |
|----------|--------|
| YOLO Mode | Remove completely |
| Action Delivery | Skill-based (`action-proposer`) + Form UI |
| Parameter Display | All template parameters editable |
| User Modifications | Notify agent of changes |
| Continuation Flow | Wait for user (Continue button or type) |
| Error Handling | Auto-retry once, then show error |
| Artifact Detection | Remove PostToolUse - only actions |
| Checkpoint System | Remove entirely |

---

## Architecture

```
Frontend (React)          Server (Express)           Claude SDK
    │                          │                          │
    │◄─── WebSocket ──────────►│◄────────────────────────►│
    │                          │                          │
ActionCard ◄── action_instance │ ◄── action-proposer skill│
    │                          │                          │
execute_action ──────────────► │ ─► ActionExecutor        │
    │                          │        │                 │
action_complete ◄───────────── │ ◄──────┘                 │
    │                          │                          │
Continue click ──────────────► │ ─► continueSession() ───►│
```

---

## File Structure

```
agent/.claude/skills/
└── action-proposer/
    ├── SKILL.md
    └── propose-action.ts

server/
├── actions/
│   ├── types.ts
│   ├── index.ts                 # ActionsManager
│   ├── generate-hero.ts
│   ├── generate-contact-sheet.ts
│   ├── extract-frames.ts
│   ├── resize-frames.ts
│   ├── generate-video-clip.ts
│   ├── generate-all-clips.ts
│   └── stitch-final.ts
└── lib/
    ├── ai-client.ts             # Add PreToolUse block
    ├── orchestrator-prompt.ts   # Add skill instructions
    └── session-manager.ts       # Remove checkpoint

frontend/src/
├── components/chat/
│   ├── ActionCard.tsx           # NEW
│   ├── ContinueButton.tsx       # NEW
│   └── ChatView.tsx             # Modified
├── hooks/
│   └── useWebSocket.ts          # Action handling
└── lib/
    └── types.ts                 # Action types
```

---

## Type Definitions

```typescript
// server/actions/types.ts

export type PipelineStage = 'hero' | 'contact-sheet' | 'frames' | 'resize' | 'clips' | 'final';
export type ParamType = 'enum' | 'text' | 'boolean' | 'number';

export interface ParamSchema {
  type: ParamType;
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: { value: string; label: string }[];  // enum
  min?: number; max?: number; step?: number;      // number
  placeholder?: string; multiline?: boolean;      // text
  locked?: boolean;
  advanced?: boolean;
}

export interface ActionTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  stage: PipelineStage;
  parameters: Record<string, ParamSchema>;
}

export interface ActionInstance {
  instanceId: string;
  sessionId: string;
  templateId: string;
  label: string;
  params: Record<string, any>;
  timestamp: Date;
  status?: 'pending' | 'executing' | 'completed' | 'error';
}

export interface ActionResult {
  success: boolean;
  artifact?: string;
  artifacts?: string[];
  message?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  duration?: number;
}

export interface ScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  artifacts?: string[];
}

export interface ActionContext {
  sessionId: string;
  cwd: string;
  outputDir: string;
  referenceImages: string[];
  getAsset(type: 'hero' | 'contactSheet' | 'frames' | 'videos'): string | string[] | null;
  getPipelineStage(): PipelineStage;
  emitProgress(stage: string, message: string, progress?: number): void;
  runScript(scriptName: string, args: string[]): Promise<ScriptResult>;
  buildPrompt(templateName: string, variables: Record<string, string>): string;
}

export interface ActionExecutor {
  template: ActionTemplate;
  execute: (params: Record<string, any>, context: ActionContext) => Promise<ActionResult>;
}
```

---

## WebSocket Messages

### Client → Server

```typescript
interface ExecuteActionMessage {
  type: 'execute_action';
  sessionId: string;
  instanceId: string;
  params: Record<string, any>;
  originalParams: Record<string, any>;
}

interface CancelActionMessage {
  type: 'cancel_action';
  sessionId: string;
  instanceId: string;
}

interface ContinueMessage {
  type: 'continue';
  sessionId: string;
  content?: string;
}
```

### Server → Client

```typescript
interface ActionInstanceMessage {
  type: 'action_instance';
  sessionId: string;
  instance: ActionInstance;
  template: ActionTemplate;
}

interface ActionStartMessage {
  type: 'action_start';
  sessionId: string;
  instanceId: string;
  templateId: string;
  label: string;
}

interface ActionProgressMessage {
  type: 'action_progress';
  sessionId: string;
  instanceId: string;
  stage: string;
  message: string;
  progress?: number;
  retryAttempt?: number;
}

interface ActionCompleteMessage {
  type: 'action_complete';
  sessionId: string;
  instanceId: string;
  result: { success: true; artifact?: string; artifacts?: string[]; message?: string; duration?: number; };
}

interface ActionErrorMessage {
  type: 'action_error';
  sessionId: string;
  instanceId: string;
  error: { code: string; message: string; retryable: boolean; autoRetried: boolean; };
}

interface AwaitingContinuationMessage {
  type: 'awaiting_continuation';
  sessionId: string;
  instanceId: string;
}
```

---

## Implementation Tasks

### Phase 1: Foundation ✅ COMPLETE

**1.1 Create `server/actions/types.ts`** ✅
- Type definitions for ActionTemplate, ActionInstance, ActionResult, ActionContext, ActionExecutor
- WebSocket message types for action workflow

**1.2 Create `server/actions/index.ts`** ✅
- ActionsManager class with template registration and execution
- createActionContext() helper with runScript() for pipeline scripts
- PendingContinuation tracking and buildContinuationMessage()

**1.3 Create all action executors** ✅
- `generate-hero.ts` - Hero shot with prompt, aspectRatio, resolution, useReferenceImages
- `generate-contact-sheet.ts` - Contact sheet with same params
- `extract-frames.ts` - Frame extraction with cropMethod enum (variance/simple)
- `resize-frames.ts` - Aspect ratio conversion
- `generate-video-clip.ts` - Single video clip
- `generate-all-clips.ts` - Batch clip generation
- `stitch-final.ts` - Final video stitching with easing curves

---

### Phase 2: Skill & Prompt ✅ COMPLETE

**2.1 Create `agent/.claude/skills/action-proposer/SKILL.md`** ✅
- Full skill documentation with all 7 templates
- Parameter schemas for each action type
- Usage examples and critical rules

**2.2 Create `agent/.claude/skills/action-proposer/propose-action.ts`** ✅
- Parses --templateId, --label, --params arguments
- Validates templateId against allowed list
- Emits action_proposal JSON to stdout (server intercepts)

**2.3 Update `server/lib/orchestrator-prompt.ts`** ✅
- Added action-based workflow instructions (UNDERSTAND → PROPOSE → WAIT → ADAPT)
- Added action-proposer skill usage examples
- Removed all YOLO mode references
- Added handling for user feedback and parameter changes

**2.4 Update `server/lib/ai-client.ts`** ✅
- Added BLOCKED_SCRIPTS list and isBlockedScript() check
- Added PreToolUse hook to block direct script execution
- Added PostToolUse hook to intercept action_proposal JSON
- Added actionEmitter EventEmitter for forwarding proposals
- Removed progressEmitter, ProgressData, CheckpointData
- Removed YOLO mode injection

**2.5 Remove checkpoint/autonomous systems** ✅
- `session-manager.ts`: Removed autonomousMode property and methods
- `sdk-server.ts`: Removed YOLO mode handling, checkpoint parsing, detectedCheckpoints
- `sdk-server.ts`: Added actionEmitter listener to forward proposals to WebSocket
- `websocket-handler.ts`: Added action message types, removed yolo event

---

### Phase 3: Server Integration ✅ COMPLETE

**3.1 WebSocket handlers in `sdk-server.ts`** ✅
- `execute_action` handler: Looks up instance, creates context, executes with auto-retry, stores pending continuation
- `continue_action` handler: Builds continuation message from pending state, injects into agent session
- Updated `continue` handler: Checks for pending continuation and injects context

**3.2 Action instance registration** ✅
- `actionEmitter.on('proposal')`: Now registers ActionInstance in ActionsManager
- Includes template in broadcast for frontend form rendering

**3.3 Implementation Details**
- Auto-retry: One retry with 2s delay for retryable errors
- Progress emission: Via WebSocket `action_progress` messages
- Parameter diff tracking: Compares `params` vs `originalParams`
- Continuation message: Built by `actionsManager.buildContinuationMessage()`
- Stage mapping: Session-manager stages mapped to action stages

---

### Phase 4: Frontend ✅ COMPLETE

**4.1 `ActionCard.tsx`** ✅
- Form renders from template.parameters (enum→dropdown, text→textarea, boolean→checkbox, number→input)
- Generate button with loading state, Reset button for modified params
- Shows result summary with success/error status after completion
- Shows executing state with thinking dots animation

**4.2 `ContinueButton.tsx`** ✅
- Pill-style button with arrow icon
- Appears after action completes (awaitingContinuation state)
- Triggers continueAction or continueSession

**4.3 `useWebSocket.ts`** ✅
- Added action state: pendingAction, executingActionId, awaitingContinuation
- Handles: action_instance, action_start, action_progress, action_complete, awaiting_continuation
- Added executeAction(instanceId, params, originalParams) function
- Added continueAction(instanceId) function
- Auto-adds artifact images/videos on action completion

**4.4 `ChatView.tsx` & `App.tsx`** ✅
- ActionCard rendered for 'action' message type
- ContinueButton shown when awaitingContinuation && !isGenerating
- Props passed from App.tsx: onExecuteAction, onContinueAction, onContinue

---

### Phase 5: Remaining Actions ✅ COMPLETE

All executors created in Phase 1:
- ✅ `generate-contact-sheet.ts`
- ✅ `extract-frames.ts` (with cropMethod enum: variance/simple)
- ✅ `resize-frames.ts`
- ✅ `generate-video-clip.ts`
- ✅ `generate-all-clips.ts` (batch with progress events)
- ✅ `stitch-final.ts` (uses stitch-videos-eased.ts)

---

### Phase 6: Testing & Polish 🔲 PENDING

- E2E test full pipeline
- Test parameter modification
- Test error scenarios and auto-retry
- UI polish: loading states, animations
- Responsive design

---

## Action Templates Reference

| Action | Stage | Key Parameters |
|--------|-------|----------------|
| `generate_hero` | hero | prompt, aspectRatio |
| `generate_contact_sheet` | contact-sheet | prompt, aspectRatio |
| `extract_frames` | frames | cropMethod |
| `resize_frames` | resize | targetRatio, fitMode |
| `generate_video_clip` | clips | clipNumber, motionPrompt, duration |
| `generate_all_clips` | clips | motionPrompt, duration |
| `stitch_final` | final | includeLoop, easingCurve, clipDuration |

---

## Message Flow

```
User: "Create Star Wars shoot"
    ↓
Agent (discuss): "I have directions: Sith Lord, Jedi, Bounty Hunter..."
    ↓
User: "Sith Lord"
    ↓
Agent (propose): "Here's the hero:" + calls action-proposer
    ↓
Server: action_instance → Frontend
    ↓
Frontend: Render ActionCard with editable prompt
    ↓
User: Modifies prompt, clicks Generate
    ↓
Client: execute_action → Server
    ↓
Server: action_start → action_progress → action_complete
    ↓
Server: awaiting_continuation → Frontend
    ↓
Frontend: Show artifact + Continue button
    ↓
User: Clicks Continue
    ↓
Client: continue → Server
    ↓
Server: Inject result context → Agent
    ↓
Agent: Comments on result, proposes next action
```

---

## Git Commits

1. `feat: Add action types, manager, and generate_hero executor`
2. `feat: Add action-proposer skill and update orchestrator prompt`
3. `feat: WebSocket action handling, remove YOLO/checkpoint`
4. `feat: ActionCard UI with user continuation`
5. `feat: Complete all action executors`
6. `feat: Complete action instance pattern MVP`
