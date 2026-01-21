# MVP: Action Instance Pattern for Fashion Shoot Agent

## Document Info

| Field | Value |
|-------|-------|
| Version | 1.2 |
| Created | January 20, 2026 |
| Updated | January 21, 2026 |
| Status | Planning |
| Author | Engineering Team |

> **Reference:** This document is informed by the [Email Agent Architecture](./EMAIL_AGENT_ARCHITECTURE_REFERENCE.md) which implements a similar action instance pattern.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [First Principles Analysis](#first-principles-analysis)
4. [Vision & Strategic Direction](#vision--strategic-direction)
5. [Product Requirements](#product-requirements)
6. [Technical Architecture](#technical-architecture)
7. [Implementation Plan](#implementation-plan)
8. [Success Metrics](#success-metrics)
9. [Risks & Mitigations](#risks--mitigations)
10. [Future Roadmap](#future-roadmap)

---

## Executive Summary

### What We're Building

Transform the fashion-shoot-agent from a **direct execution model** (agent runs scripts immediately) to an **Action Instance pattern** (agent proposes actions, user approves and executes).

### Why It Matters

This MVP is the foundation for disrupting node-based workflow tools (n8n, Make, ComfyUI) with a prompt-driven approach where:
- Users describe outcomes, not processes
- AI provides creative intelligence, not mechanical execution
- Workflows are conversations, not graphs

### Expected Outcome

A working fashion shoot pipeline where:
1. Agent explains creative decisions conversationally
2. User sees proposed actions with editable parameters
3. User controls when things execute
4. Natural back-and-forth collaboration
5. Foundation for workflow templates and marketplace

---

## Problem Statement

### Current State Issues

#### Issue 1: Broken Conversation Flow

**What happens now:**
```
User: "Create a star wars themed shoot"
Agent: "Let me generate..." → [Bash executes] → [SDK stops]
Result: Terse output, no creative discussion
```

**What should happen:**
```
User: "Create a star wars themed shoot"
Agent: "For that Sith aesthetic, I'm thinking dramatic lighting with
        deep shadows. The editorial-drama pose will give that powerful
        Vader stance. Here's what I suggest - feel free to adjust..."
        [Shows action card with editable parameters]
User: [Adjusts settings, clicks Generate]
Agent: "The red lightsaber really pops against the dark background!
        Ready for the contact sheet?"
```

#### Issue 2: No User Control Over Parameters

**Current:** User can only describe changes in text after seeing results.

**Needed:** User can preview and modify parameters BEFORE execution.

#### Issue 3: Checkpoint System Complexity

**Current architecture problem:**
- We tried `{ continue: false }` in PostToolUse → Stops before agent responds
- We tried prompt-based pausing → Agent ignores instructions
- We removed checkpoint UI → Lost the pause mechanism entirely

**Root cause:** We're fighting against the execution model instead of embracing a proposal model.

#### Issue 4: Not Aligned with Vision

Our goal is to disrupt node-based workflows with prompt-driven creative tools. Current implementation is just "AI executes a script" - no different from a traditional automation.

---

## First Principles Analysis

### What is a Creative Workflow?

Breaking down the fundamental elements:

```
┌─────────────────────────────────────────────────────────────────────┐
│                    CREATIVE WORKFLOW ELEMENTS                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. VISION                                                          │
│     └── What does the user want to achieve?                         │
│         "An edgy streetwear campaign for TikTok"                    │
│                                                                      │
│  2. EXPERTISE                                                       │
│     └── What knowledge is needed to achieve it?                     │
│         Lighting, composition, platform formats, trends             │
│                                                                      │
│  3. DECISIONS                                                       │
│     └── What choices must be made along the way?                    │
│         Pose style, background, aspect ratio, motion style          │
│                                                                      │
│  4. EXECUTION                                                       │
│     └── What actions produce the outputs?                           │
│         Generate image, crop frames, create video                   │
│                                                                      │
│  5. ITERATION                                                       │
│     └── How do we refine toward the vision?                         │
│         Review, feedback, adjust, regenerate                        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Where Should AI vs Human Be Involved?

| Element | Node-Based Tools | Current Agent | Action Instance Pattern |
|---------|-----------------|---------------|------------------------|
| **Vision** | Human defines | Human describes | Human describes |
| **Expertise** | Human configures | AI has it | AI proposes with reasoning |
| **Decisions** | Human hardcodes | AI decides alone | AI suggests, Human approves |
| **Execution** | Automatic | Automatic | Human-triggered |
| **Iteration** | Human rewires | Text feedback | Modify params, re-run |

**Key Insight:** The Action Instance pattern puts AI expertise in service of human vision, with human control over decisions and execution.

### Why Node-Based Tools Fall Short for Creative Work

```
NODE-BASED APPROACH
═══════════════════

[Input] → [Resize] → [Style Transfer] → [Output]
              ↓
         Fixed params
         No context
         No adaptation

Problems:
1. User must know the "recipe" upfront
2. No intelligence - just mechanical steps
3. One path - no exploration
4. Changes require rewiring
5. No creative feedback loop
```

```
PROMPT-DRIVEN APPROACH (Our Vision)
═══════════════════════════════════

User: "Make it moodier"

Agent: "I'll deepen the shadows and add blue color grading.
        Also thinking we could try a tighter crop to increase
        intimacy. Which direction interests you?"

        [Action: Adjust Lighting]  [Action: Crop Tighter]

Advantages:
1. User describes outcome, AI figures out process
2. AI brings expertise and suggestions
3. Multiple paths can be explored
4. Changes are conversational
5. Continuous creative dialogue
```

### The Core Innovation: Proposal vs Execution

**Traditional automation:** "Do this thing"
**Action Instance pattern:** "Here's what I suggest, with my reasoning. Adjust if needed, then approve."

This shift:
- Preserves AI expertise (it still recommends the best approach)
- Adds human judgment (user controls final decision)
- Enables natural conversation (agent explains, user responds)
- Supports iteration (modify params, try again)

---

## Vision & Strategic Direction

### The Big Picture

We're building toward a world where:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         FUTURE STATE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  USER                           AGENT                                │
│  ════                           ═════                                │
│                                                                      │
│  "I need content for my         "Based on your brand, I suggest     │
│   new sneaker launch"           three approaches:                    │
│                                                                      │
│                                 1. Street style - urban, edgy        │
│                                 2. Studio minimal - clean, premium   │
│                                 3. Action shots - dynamic, sporty    │
│                                                                      │
│                                 Which resonates? Or should I         │
│                                 explore a different direction?"      │
│                                                                      │
│  "Let's try street style        "Great choice! For street style,    │
│   but make it premium"          I'll blend urban textures with      │
│                                 premium lighting..."                 │
│                                                                      │
│                                 [Action: Generate Hero]              │
│                                 [Action: Generate Alternatives]      │
│                                                                      │
│  [Adjusts params, Generates]                                        │
│                                                                      │
│  "Love it! Save this as         "Saved as 'Premium Street Style'.   │
│   a template for future"        You can reuse it or share with      │
│                                 your team."                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### MVP's Role in the Vision

This MVP establishes:

1. **Action Instance Pattern** - Foundation for all future workflows
2. **Parameter UI** - User control over AI suggestions
3. **Conversational Flow** - Agent explains, proposes, responds
4. **Execution Model** - User-triggered, not automatic

Future builds on this:
- Workflow templates (save successful sessions)
- Marketplace (share and discover workflows)
- Multi-skill composition (combine different capabilities)
- Team collaboration (shared sessions)

---

## Product Requirements

### Functional Requirements

#### FR-1: Agent Proposes Actions (Not Executes)

**Description:** Agent outputs action proposals in a structured format instead of executing scripts directly.

**Acceptance Criteria:**
- [ ] Agent response includes `action` code block with JSON
- [ ] Action JSON contains: templateId, label, params
- [ ] Agent provides creative reasoning before proposing action
- [ ] Agent does NOT execute Bash commands for generation scripts

**Example:**
```markdown
Based on your streetwear vision, I'm going with an urban industrial
look - the raw textures will complement the edgy aesthetic.

```action
{
  "templateId": "generate_hero",
  "label": "Generate Hero Shot",
  "params": {
    "pose": "street-walk",
    "background": "industrial",
    "aspectRatio": "9:16"
  }
}
```
```

#### FR-2: Action Card UI

**Description:** Frontend renders proposed actions as interactive cards with editable parameters.

**Acceptance Criteria:**
- [ ] Action card displays action name and icon
- [ ] All parameters shown with appropriate input controls
- [ ] Enum params render as dropdowns
- [ ] Text params render as text areas
- [ ] Boolean params render as checkboxes
- [ ] "Generate" button triggers execution
- [ ] "Reset" button restores agent's suggested values
- [ ] Loading state shown during execution

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│ 🎬 Generate Hero Shot                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Pose         [street-walk         ▼]                          │
│               ○ editorial-drama                                 │
│               ● street-walk                                     │
│               ○ relaxed-natural                                 │
│                                                                 │
│  Background   [industrial          ▼]                          │
│                                                                 │
│  Aspect Ratio [9:16 TikTok         ▼]                          │
│                                                                 │
│  Style Notes  [________________________________]                │
│               Additional style instructions                     │
│                                                                 │
│  [        Generate        ]  [ Reset ]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### FR-3: Action Execution

**Description:** When user clicks "Generate", action executes and result is shown.

**Acceptance Criteria:**
- [ ] WebSocket message sent with action instanceId and final params
- [ ] Server executes appropriate script with params
- [ ] Progress/loading state broadcast to client
- [ ] Result (artifact) displayed in chat
- [ ] Errors displayed gracefully
- [ ] Agent receives result and can respond

#### FR-4: Agent Response to Results

**Description:** After action executes, agent sees result and continues conversation.

**Acceptance Criteria:**
- [ ] Agent receives notification of action completion
- [ ] Agent can see which artifact was generated
- [ ] Agent provides commentary on result
- [ ] Agent proposes next action in pipeline
- [ ] Conversation flows naturally

**Example Flow:**
```
[Action executes, hero.png generated]

Agent: "The industrial backdrop adds great texture! The 9:16 format
        is perfect for TikTok. Notice how the lighting catches the
        fabric details.

        Ready for the contact sheet? I'll generate 6 angles with
        the same urban energy:"

        [Action: Generate Contact Sheet]
```

#### FR-5: Full Pipeline Support

**Description:** All pipeline stages available as actions.

**Actions Required:**
| Action | Stage | Key Parameters |
|--------|-------|----------------|
| `generate_hero` | hero | pose, background, aspectRatio, styleNotes |
| `generate_contact_sheet` | contact-sheet | angleStyle, styleNotes |
| `extract_frames` | frames | cropMethod |
| `resize_frames` | resize | targetRatio, fitMode |
| `generate_video_clip` | clips | clipNumber, motionStyle, duration |
| `generate_all_clips` | clips | motionStyle, duration |
| `stitch_final` | final | includeLoop, easingCurve, clipDuration |

#### FR-6: Modification Actions

**Description:** User can regenerate/modify any previous output.

**Acceptance Criteria:**
- [ ] Agent can propose modification actions at any time
- [ ] `regenerate_hero` available after hero exists
- [ ] `modify_frame` available after frames extracted
- [ ] `regenerate_clip` available after clips generated
- [ ] Modified assets replace previous versions

### Non-Functional Requirements

#### NFR-1: Response Time

- Action card render: < 100ms after message received
- Action execution feedback: < 500ms to show loading state
- Script execution: Depends on FAL/Kling APIs (show progress)

#### NFR-2: Error Handling

- All errors shown in UI (not silent failures)
- Agent notified of errors so it can suggest fixes
- Retry option available for transient failures

#### NFR-3: State Management

- Action state persisted in session
- Page refresh should not lose pending action
- Multiple actions should queue (not conflict)

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ARCHITECTURE                                 │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌─────────────┐         ┌─────────────┐         ┌─────────────┐   │
│  │   FRONTEND  │◄───────►│   SERVER    │◄───────►│  CLAUDE SDK │   │
│  │             │   WS    │             │         │             │   │
│  │ - ChatView  │         │ - Express   │         │ - Agent     │   │
│  │ - ActionCard│         │ - WS Handler│         │ - Skills    │   │
│  │ - useWebSock│         │ - Actions   │         │ - Tools     │   │
│  └─────────────┘         └──────┬──────┘         └─────────────┘   │
│                                 │                                   │
│                          ┌──────▼──────┐                           │
│                          │   ACTIONS   │                           │
│                          │             │                           │
│                          │ - Templates │                           │
│                          │ - Executors │                           │
│                          │ - Manager   │                           │
│                          └──────┬──────┘                           │
│                                 │                                   │
│                          ┌──────▼──────┐                           │
│                          │   SCRIPTS   │                           │
│                          │             │                           │
│                          │ - generate  │                           │
│                          │ - crop      │                           │
│                          │ - stitch    │                           │
│                          └─────────────┘                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                          DATA FLOW                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. USER INPUT                                                      │
│     └── "Create an edgy streetwear shoot"                          │
│                    ↓                                                 │
│  2. AGENT REASONING                                                 │
│     └── Analyzes request, selects presets, formulates approach     │
│                    ↓                                                 │
│  3. AGENT RESPONSE (with Action)                                    │
│     └── "For streetwear, I suggest..."                             │
│         ```action { "templateId": "generate_hero", ... } ```       │
│                    ↓                                                 │
│  4. SERVER-SIDE PARSING                                             │
│     └── Detects action block, extracts JSON                        │
│     └── Strips action blocks from text                             │
│     └── Registers ActionInstance in ActionsManager                 │
│     └── Sends clean text + actions array to frontend               │
│                    ↓                                                 │
│  5. FRONTEND RENDERING                                              │
│     └── Displays assistant text (actions stripped)                 │
│     └── Renders ActionCard with editable params                    │
│                    ↓                                                 │
│  6. USER INTERACTION                                                │
│     └── Reviews params, modifies if desired                        │
│     └── Clicks "Generate"                                          │
│                    ↓                                                 │
│  7. EXECUTE_ACTION MESSAGE                                          │
│     └── { type: 'execute_action', instanceId, params }             │
│                    ↓                                                 │
│  8. SERVER EXECUTION                                                │
│     └── Looks up action template                                   │
│     └── Runs executor with params                                  │
│     └── Broadcasts progress/result                                 │
│                    ↓                                                 │
│  9. RESULT DISPLAY                                                  │
│     └── Artifact shown in chat                                     │
│     └── Action card removed/completed                              │
│                    ↓                                                 │
│  10. AGENT CONTINUATION                                             │
│      └── Agent sees result, comments, proposes next action         │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Static vs Dynamic Templates

Unlike the email-agent (where the agent creates new handler files at runtime), fashion-shoot-agent uses **static templates** pre-defined in `server/actions/`:

| Aspect | Email Agent | Fashion-Shoot Agent |
|--------|-------------|---------------------|
| Template creation | Agent writes .ts files | Pre-coded at build time |
| Hot reload | Yes (file watcher) | No (restart required) |
| Template count | Unlimited | Fixed (7 pipeline actions) |
| Complexity | Higher | Lower |

This simplification is appropriate because the fashion pipeline has fixed stages that don't need runtime customization.

### Key Architectural Decisions

The following decisions were made to ensure a clean, controlled implementation:

#### Decision 1: Remove YOLO/Autonomous Mode

**Choice:** Remove autonomous mode entirely - all generations require user approval via action cards.

**Rationale:**
- The core value proposition is user control over creative decisions
- YOLO mode bypasses the action system, defeating its purpose
- Simpler implementation without conditional execution paths
- Users can still move quickly by accepting default params

**Impact:**
- Remove `/yolo` command handling from server
- Remove `autonomousMode` flag from SessionManager
- Remove YOLO-related instructions from orchestrator prompt
- All generations go through ActionCard UI

#### Decision 2: PreToolUse Hook for Bash Blocking

**Choice:** Use PreToolUse hooks to block Bash calls containing generation script names.

**Rationale:**
- Technical enforcement is more reliable than prompt-only instructions
- Agent can still use Bash for legitimate purposes (file operations, git, etc.)
- Targeted blocking only affects generation scripts
- Clear error message guides agent to use action proposals instead

**Implementation:**

```typescript
// In ai-client.ts
const blockedScripts = [
  'generate-image',
  'generate-video',
  'crop-frames',
  'stitch-videos',
  'resize-frames',
  'apply-speed-curve'
];

hooks: {
  PreToolUse: [{
    matcher: 'Bash',
    hook: async ({ toolInput }) => {
      const command = toolInput.command || '';
      const isBlockedScript = blockedScripts.some(script =>
        command.includes(script)
      );

      if (isBlockedScript) {
        return {
          decision: 'block',
          message: `Direct script execution is not allowed. Please propose an action using the \`\`\`action format instead.`
        };
      }
      return { decision: 'allow' };
    }
  }]
}
```

**Blocked Scripts:**
| Script | Action Template |
|--------|-----------------|
| `generate-image.ts` | `generate_hero`, `generate_contact_sheet` |
| `crop-frames.ts` | `extract_frames` |
| `resize-frames.ts` | `resize_frames` |
| `generate-video.ts` | `generate_video_clip`, `generate_all_clips` |
| `stitch-videos-eased.ts` | `stitch_final` |

#### Decision 3: Server-Side Action Parsing

**Choice:** Parse action blocks in the WebSocket handler before sending to frontend.

**Rationale:**
- Single source of truth for action parsing logic
- Frontend receives clean, pre-processed data
- Server can validate actions against known templates
- Easier to maintain and debug
- Supports future features like action validation, rate limiting

**Implementation Flow:**

```
Agent response text
       ↓
┌──────────────────────────────────────────────────────┐
│ WebSocket Handler (server)                           │
│                                                      │
│  1. parseActionsFromResponse(text, sessionId)        │
│     → Returns ActionInstance[]                       │
│                                                      │
│  2. For each instance:                               │
│     actionsManager.registerInstance(instance)        │
│                                                      │
│  3. stripActionBlocks(text)                          │
│     → Returns clean text for display                 │
│                                                      │
│  4. Send to frontend:                                │
│     { type: 'assistant_message',                     │
│       content: cleanText,                            │
│       actions: instances }                           │
└──────────────────────────────────────────────────────┘
       ↓
Frontend receives ready-to-render data
```

**Benefits:**
- Frontend just renders what it receives
- No parsing logic duplication
- Server has full control over action lifecycle

### Key Components

#### Action Template

```typescript
interface ActionTemplate {
  id: string;                              // Unique identifier
  name: string;                            // Display name
  description: string;                     // What it does
  icon: string;                            // Emoji for UI
  stage: PipelineStage;                    // Where in pipeline
  parameters: Record<string, ParamSchema>; // Configurable params
}

interface ParamSchema {
  type: 'enum' | 'text' | 'boolean' | 'number';
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  options?: { value: string; label: string }[];  // For enum
  min?: number; max?: number; step?: number;     // For number
  placeholder?: string;                          // For text
  locked?: boolean;                              // Non-editable
}
```

#### Action Instance

```typescript
interface ActionInstance {
  instanceId: string;           // Unique per proposal (UUID)
  sessionId: string;            // Which session owns this instance
  templateId: string;           // Which template to use
  label: string;                // Display label for the action card
  params: Record<string, any>;  // Agent's suggested parameter values
  timestamp: Date;              // When proposed
  status?: 'pending' | 'executing' | 'completed' | 'error';  // Execution state
}
```

#### Action Executor

```typescript
interface ActionExecutor {
  template: ActionTemplate;
  execute: (
    params: Record<string, any>,
    context: ExecutionContext
  ) => Promise<ActionResult>;
}

interface ActionContext {
  sessionId: string;

  // File system paths
  cwd: string;                              // agent/ directory
  outputDir: string;                        // agent/outputs/ directory

  // Reference images from user upload
  referenceImages: string[];

  // Pipeline state access
  getAsset(type: 'hero' | 'contactSheet' | 'frames' | 'videos'): string | string[] | null;
  getPipelineStage(): PipelineStage;

  // Progress broadcasting (to WebSocket subscribers)
  emitProgress(stage: string, message: string, progress?: number): void;

  // Script execution (runs pipeline scripts)
  runScript(scriptName: string, args: string[]): Promise<ScriptResult>;

  // Prompt building (uses editorial-photography skill templates)
  buildPrompt(templateName: string, variables: Record<string, string>): string;
}

interface ScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  artifacts?: string[];    // Detected output files
}

interface ActionResult {
  success: boolean;
  artifact?: string;           // Single output file
  artifacts?: string[];        // Multiple output files
  message?: string;            // Success message
  error?: string;              // Error message
}
```

### Instance Lifecycle

Understanding when instances are created, stored, and cleaned up:

```
┌─────────────────────────────────────────────────────────────────────┐
│                      INSTANCE LIFECYCLE                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. CREATION                                                        │
│     └── Agent outputs ```action { ... } ``` block                   │
│     └── Server parses response, extracts JSON                       │
│     └── Server creates ActionInstance with unique instanceId        │
│                                                                      │
│  2. STORAGE                                                         │
│     └── actionsManager.instances Map (keyed by instanceId)          │
│     └── Also attached to the assistant message for frontend         │
│                                                                      │
│  3. EXECUTION                                                       │
│     └── User clicks Generate → execute_action message sent          │
│     └── Server looks up instance by instanceId                      │
│     └── Server looks up template by instance.templateId             │
│     └── Server calls template.execute(instance.params, context)     │
│                                                                      │
│  4. CLEANUP                                                         │
│     └── On successful execution: instance removed from Map          │
│     └── On session end: all session instances cleared               │
│     └── On error: instance kept (allows retry)                      │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Instance Storage:**

```typescript
// In ActionsManager
class ActionsManager {
  private templates: Map<string, ActionExecutor> = new Map();  // Static, loaded at startup
  private instances: Map<string, ActionInstance> = new Map();  // Dynamic, per-conversation

  registerInstance(instance: ActionInstance): void {
    this.instances.set(instance.instanceId, instance);
  }

  getInstance(instanceId: string): ActionInstance | undefined {
    return this.instances.get(instanceId);
  }

  removeInstance(instanceId: string): void {
    this.instances.delete(instanceId);
  }

  clearSessionInstances(sessionId: string): void {
    // Called when session ends
    for (const [id, instance] of this.instances) {
      if (instance.sessionId === sessionId) {
        this.instances.delete(id);
      }
    }
  }
}
```

### File Structure

```
server/
├── actions/
│   ├── types.ts                    # Type definitions
│   ├── index.ts                    # Action manager & registry
│   ├── generate-hero.ts            # Hero shot action
│   ├── generate-contact-sheet.ts   # Contact sheet action
│   ├── extract-frames.ts           # Frame extraction action
│   ├── resize-frames.ts            # Frame resize action
│   ├── generate-video-clip.ts      # Single clip action
│   ├── generate-all-clips.ts       # Batch clips action
│   └── stitch-final.ts             # Final video action
├── lib/
│   ├── ai-client.ts                # (Modified) Remove forced stopping
│   ├── orchestrator-prompt.ts      # (Rewritten) Action proposal prompt
│   └── action-parser.ts            # Parse actions from responses
└── sdk-server.ts                   # (Modified) Add execute_action handler

frontend/
├── components/
│   └── chat/
│       ├── ActionCard.tsx          # (New) Action UI component
│       ├── ChatView.tsx            # (Modified) Render actions
│       └── ...
├── hooks/
│   └── useWebSocket.ts             # (Modified) Action handling
└── lib/
    └── types.ts                    # (Modified) Action types
```

---

## Implementation Plan

### Phase 1: Foundation (Day 1)

#### Task 1.1: Define Types

**File:** `server/actions/types.ts`

**Deliverable:**
- ActionTemplate interface
- ActionInstance interface
- ActionResult interface
- ParamSchema interface
- PipelineStage enum

**Effort:** 1 hour

#### Task 1.2: Create Action Manager

**File:** `server/actions/index.ts`

**Deliverable:**
- Action registry (Map of templateId → executor)
- `getTemplate(id)` function
- `getAllTemplates()` function
- `executeAction(id, params, context)` function
- `createInstance(templateId, params)` function

**Effort:** 1.5 hours

#### Task 1.3: Implement First Action (generate_hero)

**File:** `server/actions/generate-hero.ts`

**Deliverable:**
- Template definition with all parameters
- Execute function that runs generate-image.ts
- Prompt building from presets
- Error handling

**Effort:** 2 hours

### Phase 2: Prompt & Parsing (Day 1-2)

#### Task 2.1: Rewrite Orchestrator Prompt

**File:** `server/lib/orchestrator-prompt.ts`

**Deliverable:**
- New prompt focused on proposing actions
- Clear instructions for action block format
- Examples of good action proposals
- Guidance on conversational flow

**Key Prompt Additions:**

```markdown
## Proposing Actions

When you're ready to generate content, propose an action instead of executing directly.
The user will see your action as an interactive card where they can modify parameters
before clicking "Generate".

**Format your proposal as:**
1. Explain your creative reasoning (2-3 sentences)
2. Output the action in a code block:

\`\`\`action
{
  "templateId": "generate_hero",
  "label": "Generate Hero Shot",
  "params": {
    "pose": "editorial-drama",
    "background": "studio-black",
    "aspectRatio": "3:2",
    "styleNotes": "Deep shadows, dramatic lighting"
  }
}
\`\`\`

**Available Actions:**
| templateId | Description | Key Parameters |
|------------|-------------|----------------|
| generate_hero | Full-body hero shot | pose, background, aspectRatio |
| generate_contact_sheet | 2×3 grid of 6 angles | angleStyle, styleNotes |
| extract_frames | Extract frames from grid | cropMethod |
| resize_frames | Resize for video | targetRatio, fitMode |
| generate_video_clip | Single transition video | clipNumber, motionStyle |
| generate_all_clips | All 5 transition clips | motionStyle, duration |
| stitch_final | Final stitched video | includeLoop, easingCurve |

**IMPORTANT:**
- Do NOT run Bash commands for generation scripts
- Always propose actions and let the user control execution
- After an action completes, comment on the result before proposing the next action
- If the user asks to modify something, propose the appropriate action

**Example Good Response:**

"For your Star Wars theme, I'm envisioning a powerful Sith Lord aesthetic - deep
shadows with dramatic edge lighting to create that classic dark side tension.
The editorial-drama pose will give you that commanding Vader presence.

\`\`\`action
{
  "templateId": "generate_hero",
  "label": "Generate Sith Lord Hero",
  "params": {
    "pose": "editorial-drama",
    "background": "studio-black",
    "aspectRatio": "3:2",
    "styleNotes": "Deep shadows, red accent lighting, dramatic tension"
  }
}
\`\`\`

Feel free to adjust the settings above - once you're happy, click Generate!"
```

**Effort:** 2 hours

#### Task 2.2: Action Parser

**File:** `server/lib/action-parser.ts`

**Deliverable:**
- `parseActionsFromResponse(text)` function
- Extract action JSON from markdown code block
- Validate against known templates
- Handle malformed actions gracefully
- `stripActionBlocks(text)` function to clean displayed text

**Implementation:**

```typescript
// server/lib/action-parser.ts

import crypto from 'crypto';
import { ActionInstance } from '../actions/types';
import { actionsManager } from '../actions';

/**
 * Parse action blocks from agent response text.
 * Looks for ```action { ... } ``` markdown code blocks.
 */
export function parseActionsFromResponse(
  text: string,
  sessionId: string
): ActionInstance[] {
  const actionBlockRegex = /```action\s*([\s\S]*?)```/g;
  const instances: ActionInstance[] = [];

  let match;
  while ((match = actionBlockRegex.exec(text)) !== null) {
    try {
      const json = JSON.parse(match[1].trim());

      // Validate template exists
      const template = actionsManager.getTemplate(json.templateId);
      if (!template) {
        console.warn(`Unknown action template: ${json.templateId}`);
        continue;
      }

      instances.push({
        instanceId: crypto.randomUUID(),
        sessionId,
        templateId: json.templateId,
        label: json.label || template.name,
        params: json.params || {},
        timestamp: new Date()
      });
    } catch (e) {
      console.error('Failed to parse action block:', e);
    }
  }

  return instances;
}

/**
 * Remove action blocks from text for display purposes.
 * The JSON blocks are replaced with empty string so users see clean text.
 */
export function stripActionBlocks(text: string): string {
  return text.replace(/```action\s*[\s\S]*?```/g, '').trim();
}

/**
 * Check if text contains any action blocks.
 */
export function hasActionBlocks(text: string): boolean {
  return /```action\s*[\s\S]*?```/.test(text);
}
```

**Effort:** 1 hour

#### Task 2.3: Update ai-client.ts

**File:** `server/lib/ai-client.ts`

**Deliverable:**
- Remove `{ continue: false }` from PostToolUse
- Keep progress event emission for artifacts
- Clean up checkpoint-related code

**Effort:** 1 hour

### Phase 3: Server Integration (Day 2)

#### Task 3.1: WebSocket Handler for Actions

**File:** `server/sdk-server.ts`

**Deliverable:**
- `execute_action` message handler
- Broadcast `action_start` event
- Execute action with params
- Broadcast `action_complete` or `action_error`
- Trigger agent continuation after result

**Effort:** 2 hours

#### Task 3.2: Agent Continuation Flow

**File:** `server/sdk-server.ts`

**Deliverable:**
- After action completes, inject result message
- Agent sees structured result and continues conversation
- Agent responds naturally and proposes next action

**Agent Continuation Message Format:**

When an action completes, we inject a user message (or system message) to inform the agent:

**Success Message:**
```
[Action Completed: Generate Hero Shot]

Result: SUCCESS
Artifact: outputs/hero.png
Duration: 12.3 seconds

The user can now see the hero image in the chat. Continue the conversation naturally - comment on the result and suggest the next step in the pipeline.
```

**Error Message:**
```
[Action Failed: Generate Hero Shot]

Error: FAL.ai API timeout after 60 seconds
Error Code: TIMEOUT

The generation failed. Suggest troubleshooting steps or offer to retry with different parameters.
```

**Implementation:**

```typescript
// After action execution completes
async function continueAgentAfterAction(
  sessionId: string,
  action: ActionInstance,
  result: ActionResult
): Promise<void> {
  const continuationMessage = result.success
    ? `[Action Completed: ${action.label}]

Result: SUCCESS
${result.artifact ? `Artifact: ${result.artifact}` : ''}
${result.artifacts ? `Artifacts: ${result.artifacts.join(', ')}` : ''}
${result.message || ''}

The user can now see the result. Continue the conversation naturally - comment on the result and suggest the next step.`
    : `[Action Failed: ${action.label}]

Error: ${result.error}

The action failed. Suggest troubleshooting steps or offer to retry with different parameters.`;

  // Resume the SDK session with the continuation message
  await aiClient.continueSession(sessionId, continuationMessage);
}
```

**Effort:** 1.5 hours

### Phase 4: Frontend (Day 2-3)

#### Task 4.1: ActionCard Component

**File:** `frontend/src/components/chat/ActionCard.tsx`

**Deliverable:**
- Render action with icon and label
- Generate form fields from parameter schema
- Handle enum (dropdown), text (textarea), boolean (checkbox)
- Execute button with loading state
- Reset button

**Effort:** 3 hours

#### Task 4.2: Action Detection in useWebSocket

**File:** `frontend/src/hooks/useWebSocket.ts`

**Deliverable:**
- Parse action blocks from assistant messages
- Store pending action in state
- Handle `action_start`, `action_complete`, `action_error` events
- `executeAction(instanceId, params)` function

**Effort:** 2 hours

#### Task 4.3: Integrate into ChatView

**File:** `frontend/src/components/chat/ChatView.tsx`

**Deliverable:**
- Render ActionCard when pending action exists
- Remove action card after execution
- Show action result (artifact) in chat

**Effort:** 1 hour

### Phase 5: Remaining Actions (Day 3)

#### Task 5.1: Implement All Action Templates

**Files:** `server/actions/*.ts`

**Deliverable:**
- generate-contact-sheet.ts
- extract-frames.ts
- resize-frames.ts
- generate-video-clip.ts
- generate-all-clips.ts
- stitch-final.ts

**Effort:** 4 hours (templates are similar structure)

### Phase 6: Testing & Polish (Day 4)

#### Task 6.1: End-to-End Testing

**Deliverable:**
- Test full pipeline flow with action cards
- Test parameter modification
- Test error scenarios
- Test agent continuation

**Effort:** 2 hours

#### Task 6.2: UI Polish

**Deliverable:**
- Loading states and animations
- Error displays
- Responsive design
- Visual feedback

**Effort:** 2 hours

#### Task 6.3: Documentation

**Deliverable:**
- Update ARCHITECTURE_TRANSFORMATION_PLAN.md
- Code comments
- README updates

**Effort:** 1 hour

### Implementation Timeline

```
┌─────────────────────────────────────────────────────────────────────┐
│                      IMPLEMENTATION TIMELINE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  DAY 1 (8 hours)                                                    │
│  ═══════════════                                                    │
│  [████] Task 1.1: Types (1h)                                        │
│  [██████] Task 1.2: Action Manager (1.5h)                           │
│  [████████] Task 1.3: generate_hero action (2h)                     │
│  [████████] Task 2.1: Orchestrator Prompt (2h)                      │
│  [████] Task 2.2: Action Parser (1h)                                │
│                                                                      │
│  DAY 2 (8 hours)                                                    │
│  ═══════════════                                                    │
│  [████] Task 2.3: Update ai-client (1h)                             │
│  [████████] Task 3.1: WebSocket Handler (2h)                        │
│  [██████] Task 3.2: Agent Continuation (1.5h)                       │
│  [████████████] Task 4.1: ActionCard Component (3h)                 │
│                                                                      │
│  DAY 3 (8 hours)                                                    │
│  ═══════════════                                                    │
│  [████████] Task 4.2: useWebSocket updates (2h)                     │
│  [████] Task 4.3: ChatView integration (1h)                         │
│  [████████████████] Task 5.1: All Action Templates (4h)             │
│                                                                      │
│  DAY 4 (5 hours)                                                    │
│  ═══════════════                                                    │
│  [████████] Task 6.1: E2E Testing (2h)                              │
│  [████████] Task 6.2: UI Polish (2h)                                │
│  [████] Task 6.3: Documentation (1h)                                │
│                                                                      │
│  TOTAL: ~29 hours over 4 days                                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

### MVP Success Criteria

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Conversation Quality** | Agent writes 3+ sentences per action | Manual review |
| **User Control** | 100% actions go through ActionCard | No direct Bash execution |
| **Parameter Usage** | Users modify params in 30%+ of actions | Analytics |
| **Pipeline Completion** | Full pipeline works with actions | E2E test |
| **Error Recovery** | Agent suggests fix after errors | Manual test |

### User Experience Goals

1. **Natural Conversation:** Agent explains reasoning like a creative director
2. **Transparent Control:** User sees exactly what will happen before it happens
3. **Easy Modification:** Changing settings is dropdown/click, not re-typing
4. **Smooth Flow:** No jarring stops or confusing states

---

## Risks & Mitigations

### Risk 1: Agent Ignores Action Format

**Risk:** Agent executes Bash directly instead of proposing actions.

**Mitigation:**
- Strong prompt instructions with examples
- PreToolUse hook to block Bash for generation scripts
- Fallback: Parse Bash commands and convert to actions

### Risk 2: Complex Parameter UIs

**Risk:** Some parameters hard to represent in simple form.

**Mitigation:**
- Start with enum/text/boolean only
- Add advanced controls in future iterations
- Allow "Advanced" expansion for power users

### Risk 3: Agent Continuation Breaks

**Risk:** Agent doesn't respond well after action results.

**Mitigation:**
- Clear result message format
- Examples in prompt for post-action responses
- Test extensively with different result types

### Risk 4: Performance Issues

**Risk:** Action execution feels slow or unresponsive.

**Mitigation:**
- Immediate loading state on click
- Progress events during execution
- Optimistic UI updates

---

## Future Roadmap

### Post-MVP Enhancements

#### v1.1: Workflow Templates
- Save successful session as template
- Reuse with new inputs
- Share with team

#### v1.2: Action Marketplace
- Browse community actions
- Install third-party actions
- Rate and review

#### v1.3: Advanced Parameters
- Visual preset pickers (image thumbnails)
- Slider controls for numeric values
- Color pickers for style options

#### v1.4: Multi-Action Proposals
- Agent proposes multiple options
- "Try A or B?" with side-by-side actions
- Parallel execution

#### v1.5: Workflow Builder
- Power user interface
- Define persona, capabilities, constraints
- Create custom workflows

### Long-term Vision

```
┌─────────────────────────────────────────────────────────────────────┐
│                        PRODUCT EVOLUTION                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  MVP                    v1.x                    v2.x                 │
│  ═══                    ════                    ════                 │
│                                                                      │
│  Action Instance   →    Workflow Templates  →   Workflow Platform   │
│  Pattern               & Sharing                & Marketplace        │
│                                                                      │
│  Fashion Shoot     →    Multiple Creative   →   Any Prompt-Driven   │
│  Only                   Workflows                Workflow             │
│                                                                      │
│  Single User       →    Team Collaboration  →   Enterprise &        │
│                                                  Community            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Appendix

### A: Action Template Examples

See implementation tasks for full template definitions.

### B: Prompt Examples

See Task 2.1 for complete orchestrator prompt.

### C: WebSocket Message Types

**Client → Server Messages:**

```typescript
// Execute a proposed action (user clicked Generate)
interface ExecuteActionMessage {
  type: 'execute_action';
  sessionId: string;
  instanceId: string;                    // Which instance to execute
  params: Record<string, any>;           // User-modified params (may differ from original)
}

// Cancel a running action
interface CancelActionMessage {
  type: 'cancel_action';
  sessionId: string;
  instanceId: string;
}

// Dismiss an action card without executing
interface DismissActionMessage {
  type: 'dismiss_action';
  sessionId: string;
  instanceId: string;
}
```

**Server → Client Messages:**

```typescript
// Action execution started
interface ActionStartMessage {
  type: 'action_start';
  sessionId: string;
  instanceId: string;
  templateId: string;
  label: string;
}

// Progress update during execution
interface ActionProgressMessage {
  type: 'action_progress';
  sessionId: string;
  instanceId: string;
  stage: string;                         // e.g., "Uploading to FAL.ai"
  message: string;                       // Human-readable status
  progress?: number;                     // 0-100 percentage (optional)
}

// Action completed successfully
interface ActionCompleteMessage {
  type: 'action_complete';
  sessionId: string;
  instanceId: string;
  result: {
    success: true;
    artifact?: string;                   // Single output file path
    artifacts?: string[];                // Multiple output files
    message?: string;                    // Success message
  };
}

// Action failed
interface ActionErrorMessage {
  type: 'action_error';
  sessionId: string;
  instanceId: string;
  error: {
    code: string;                        // e.g., "TIMEOUT", "API_ERROR"
    message: string;                     // Human-readable error
    retryable: boolean;                  // Can user retry?
  };
}

// Assistant message with embedded actions
interface AssistantMessageWithActions {
  type: 'assistant_message';
  sessionId: string;
  content: string;                       // Text with action blocks stripped
  actions?: ActionInstance[];            // Parsed action instances
}
```

**Message Flow Diagram:**

```
User types prompt
     │
     ▼
┌────────────────────────────────────────────────────────────────┐
│ { type: 'chat', sessionId, content: "Create a moody shoot" }   │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (Agent responds with action block)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'assistant_message',                                    │
│   content: "For a moody aesthetic, I suggest...",              │
│   actions: [{ instanceId: "abc", templateId: "generate_hero",  │
│               params: { pose: "editorial-drama", ... } }] }    │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (User modifies params, clicks Generate)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'execute_action', instanceId: "abc",                   │
│   params: { pose: "relaxed-natural", ... } }  ← user changed   │
└────────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────────┐
│ { type: 'action_start', instanceId: "abc", label: "..." }      │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (Multiple progress updates)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'action_progress', instanceId: "abc",                  │
│   stage: "Generating", message: "Uploading to FAL.ai..." }     │
└────────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────────┐
│ { type: 'action_complete', instanceId: "abc",                  │
│   result: { success: true, artifact: "outputs/hero.png" } }    │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (Agent continues conversation)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'assistant_message',                                    │
│   content: "The moody lighting looks great! Ready for...",     │
│   actions: [{ templateId: "generate_contact_sheet", ... }] }   │
└────────────────────────────────────────────────────────────────┘
```

### D: References

- [Email Agent Architecture Reference](./EMAIL_AGENT_ARCHITECTURE_REFERENCE.md)
- [Current Architecture Plan](./ARCHITECTURE_TRANSFORMATION_PLAN.md)
- [Claude Agent SDK Documentation](https://docs.anthropic.com/claude-agent-sdk)

### E: Complete Type Definitions

For easy copy-paste into `server/actions/types.ts`:

```typescript
// server/actions/types.ts

/**
 * Pipeline stages in order of execution
 */
export type PipelineStage =
  | 'hero'
  | 'contact-sheet'
  | 'frames'
  | 'resize'
  | 'clips'
  | 'final';

/**
 * Parameter types supported in action cards
 */
export type ParamType = 'enum' | 'text' | 'boolean' | 'number';

/**
 * Schema for a single parameter
 */
export interface ParamSchema {
  type: ParamType;
  label: string;
  description?: string;
  required?: boolean;
  default?: any;
  // For enum type
  options?: { value: string; label: string }[];
  // For number type
  min?: number;
  max?: number;
  step?: number;
  // For text type
  placeholder?: string;
  multiline?: boolean;
  // UI hints
  locked?: boolean;          // Non-editable (show but disable)
  advanced?: boolean;        // Hide in collapsed view
}

/**
 * Static template definition (pre-coded in server/actions/)
 */
export interface ActionTemplate {
  id: string;                              // Unique identifier (e.g., "generate_hero")
  name: string;                            // Display name (e.g., "Generate Hero Shot")
  description: string;                     // What this action does
  icon: string;                            // Emoji for UI
  stage: PipelineStage;                    // Pipeline stage
  parameters: Record<string, ParamSchema>; // Configurable parameters
}

/**
 * Runtime instance created when agent proposes an action
 */
export interface ActionInstance {
  instanceId: string;           // Unique UUID
  sessionId: string;            // Owning session
  templateId: string;           // Which template
  label: string;                // Display label
  params: Record<string, any>;  // Agent's suggested values
  timestamp: Date;              // When proposed
  status?: 'pending' | 'executing' | 'completed' | 'error';
}

/**
 * Result of action execution
 */
export interface ActionResult {
  success: boolean;
  artifact?: string;            // Single output file path
  artifacts?: string[];         // Multiple output files
  message?: string;             // Success/info message
  error?: string;               // Error message if failed
  errorCode?: string;           // Machine-readable error code
  retryable?: boolean;          // Can user retry?
  duration?: number;            // Execution time in ms
}

/**
 * Script execution result
 */
export interface ScriptResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  artifacts?: string[];         // Detected output files from JSON events
}

/**
 * Context provided to action executors
 */
export interface ActionContext {
  sessionId: string;

  // File system
  cwd: string;                  // agent/ directory
  outputDir: string;            // agent/outputs/ directory

  // Reference images
  referenceImages: string[];

  // Pipeline state
  getAsset(type: 'hero' | 'contactSheet' | 'frames' | 'videos'): string | string[] | null;
  getPipelineStage(): PipelineStage;

  // Progress broadcasting
  emitProgress(stage: string, message: string, progress?: number): void;

  // Script execution
  runScript(scriptName: string, args: string[]): Promise<ScriptResult>;

  // Prompt building
  buildPrompt(templateName: string, variables: Record<string, string>): string;
}

/**
 * Action executor interface
 */
export interface ActionExecutor {
  template: ActionTemplate;
  execute: (params: Record<string, any>, context: ActionContext) => Promise<ActionResult>;
}
```

---

## Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Engineering Lead | | | |
| Product Owner | | | |
| Design Lead | | | |
