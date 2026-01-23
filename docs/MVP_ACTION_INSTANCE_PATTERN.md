# MVP: Action Instance Pattern for Fashion Shoot Agent

## Document Info

| Field | Value |
|-------|-------|
| Version | 2.0 |
| Created | January 20, 2026 |
| Updated | January 22, 2026 |
| Status | Approved for Implementation |
| Author | Engineering Team |

> **Reference:** This document is informed by the [Email Agent Architecture](./EMAIL_AGENT_ARCHITECTURE_REFERENCE.md) which implements a similar action instance pattern.

---

## Key Decisions Summary

The following decisions were finalized during the planning interview:

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **YOLO Mode** | Remove completely | All generations require user approval via ActionCards |
| **Action Delivery** | Hybrid: Skill-based tool + Form UI | Structured WebSocket (no text parsing) + editable form cards |
| **ProposeAction Implementation** | New standalone skill | `agent/.claude/skills/action-proposer/` |
| **Parameter Display** | All template parameters | Full form with agent values as defaults |
| **User Modifications** | Notify agent of changes | Agent sees what user changed before execution |
| **Continuation Flow** | Wait for user | After action completes, user must click Continue or type |
| **Error Handling** | Auto-retry once | Then show error for manual retry |
| **Artifact Detection** | Remove old system | Only actions for generations (no PostToolUse detection) |
| **Checkpoint System** | Remove entirely | Clean slate - all through action system |
| **Multiple Actions** | One at a time (MVP) | Design system to support multiple later |
| **Batch Operations** | Single action with progress | generate_all_clips shows 1/5, 2/5... |
| **Git Strategy** | Incremental commits | Commit after each phase |

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

#### FR-1: Two-Step Creative Flow (Discuss → Propose)

**Description:** Agent first discusses creative options with user, THEN proposes action with full prompt embedded.

**Two-Step Flow:**
1. **Discuss**: Agent suggests creative directions, user chooses
2. **Propose**: Agent creates action with complete prompt based on user's choice

**Acceptance Criteria:**
- [ ] Agent discusses creative options BEFORE proposing any action
- [ ] User selects direction or provides feedback
- [ ] Agent then calls `action-proposer` skill with full prompt embedded
- [ ] Full prompt is visible and editable in ActionCard
- [ ] Agent does NOT execute Bash commands for generation scripts

**Example Agent Flow:**

```
STEP 1: CREATIVE DISCUSSION (No action yet)
═══════════════════════════════════════════

User: "Create a Star Wars themed shoot"

Agent: "For a Star Wars theme, I have a few directions:

        🔴 Sith Lord - Deep shadows, red accent lighting, commanding presence
        🔵 Jedi Serenity - Soft ethereal glow, peaceful stance, earth tones
        🟤 Bounty Hunter - Gritty industrial, weathered textures, moody greens

        Which direction resonates? Or describe something different!"

User: "Sith Lord looks perfect"


STEP 2: ACTION PROPOSAL (Full prompt embedded)
═══════════════════════════════════════════════

Agent: "Great choice! Here's the Sith Lord hero shot:"

Agent calls:  Skill("action-proposer", {
                templateId: "generate_hero",
                label: "Generate Sith Lord Hero",
                params: {
                  prompt: "Full-body fashion photograph, powerful Sith Lord
                          aesthetic, editorial-drama pose, studio-black
                          background, deep shadows with red accent lighting,
                          dramatic tension, commanding presence, Fuji Velvia
                          film treatment, slight overexposure, film grain,
                          oversaturated colors",
                  aspectRatio: "3:2"
                }
              })

Server sends: { type: 'action_instance', ... }

Frontend:     Renders ActionCard with:
              - Full prompt (editable text area)
              - Aspect ratio dropdown
              - Generate button
```

**Why This Flow:**
- AI creativity happens in conversation (natural, iterative)
- User makes informed creative choices
- Full prompt visible = full transparency
- User can tweak prompt before execution
- No AI needed at execution time (just runs the prompt)

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
│ 🎬 Generate Sith Lord Hero                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Prompt                                                         │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Full-body fashion photograph, powerful Sith Lord        │   │
│  │ aesthetic, editorial-drama pose, studio-black           │   │
│  │ background, deep shadows with red accent lighting,      │   │
│  │ dramatic tension, commanding presence, Fuji Velvia      │   │
│  │ film treatment, slight overexposure, film grain...      │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ↑ Editable - modify the prompt before generating              │
│                                                                 │
│  Aspect Ratio [3:2 Standard        ▼]                          │
│                                                                 │
│  [        Generate        ]  [ Reset ]                         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Note:** The full prompt is visible and editable. User can:
- Tweak wording ("commanding" → "menacing")
- Add details ("add cape flowing in wind")
- Remove elements they don't want
- Or accept agent's suggestion as-is

#### FR-3: Action Execution

**Description:** When user clicks "Generate", action executes and result is shown.

**Acceptance Criteria:**
- [ ] WebSocket message sent with action instanceId and final params
- [ ] Server executes appropriate script with params
- [ ] Progress/loading state broadcast to client
- [ ] Result (artifact) displayed in chat
- [ ] Errors displayed gracefully
- [ ] Agent receives result and can respond

#### FR-4: Agent Response to Results (User-Triggered)

**Description:** After action executes, result is displayed. Agent responds ONLY when user triggers continuation.

**Acceptance Criteria:**
- [ ] Action result (artifact) displayed as new message in chat
- [ ] ActionCard shows 'completed' status
- [ ] Agent is notified of: result, artifact path, user's parameter changes
- [ ] Agent does NOT auto-respond - waits for user action
- [ ] User must click "Continue" or type message to trigger agent response
- [ ] Agent then provides commentary and proposes next action

**Example Flow:**
```
[User clicks Generate on ActionCard]
[Action executes, hero.png generated]
[ActionCard shows "Completed ✓"]
[New ImageMessage appears showing hero.png]

--- USER MUST ACT ---

[User clicks "Continue" button OR types "looks good"]

Agent: "The industrial backdrop adds great texture! The 9:16 format
        is perfect for TikTok. I noticed you changed the background
        from studio-black to industrial - great choice for streetwear!

        Ready for the contact sheet?"

        [Calls action-proposer skill for Generate Contact Sheet]
```

**Rationale for Wait-for-User:**
- User has full control over pacing
- Can review artifact before proceeding
- Can type feedback/changes instead of continuing
- Prevents runaway agent responses

#### FR-5: Full Pipeline Support

**Description:** All pipeline stages available as actions.

**Actions Required:**
| Action | Stage | Key Parameters |
|--------|-------|----------------|
| `generate_hero` | hero | **prompt** (full text), aspectRatio |
| `generate_contact_sheet` | contact-sheet | **prompt** (full text), aspectRatio |
| `extract_frames` | frames | cropMethod |
| `resize_frames` | resize | targetRatio, fitMode |
| `generate_video_clip` | clips | clipNumber, **motionPrompt**, duration |
| `generate_all_clips` | clips | **motionPrompt**, duration |
| `stitch_final` | final | includeLoop, easingCurve, clipDuration |

**Note:** Generation actions (hero, contact-sheet, clips) include the full prompt as an editable parameter. Agent crafts the prompt based on creative discussion, user can modify before execution.

#### FR-6: Modification Actions

**Description:** User can regenerate/modify any previous output.

**Acceptance Criteria:**
- [ ] Agent can propose modification actions at any time
- [ ] `regenerate_hero` available after hero exists
- [ ] `modify_frame` available after frames extracted
- [ ] `regenerate_clip` available after clips generated
- [ ] Modified assets replace previous versions

#### FR-7: User-Controlled Continuation

**Description:** User controls when agent responds after action completion.

**Acceptance Criteria:**
- [ ] After action completes, "Continue" button appears
- [ ] Agent does NOT auto-respond - waits for user
- [ ] User can click "Continue" to trigger agent response
- [ ] User can type message instead (counts as continuation)
- [ ] Agent receives: result, artifact, user's parameter changes
- [ ] Agent then comments and proposes next action

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│ After action completes:                                         │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ 🎬 Generate Hero Shot                    Completed ✓        │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │                    [hero.png image]                         │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                                                                 │
│                    [ Continue → ]                               │
│                                                                 │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Type a message or click Continue...               [Send]    │ │
│ └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Non-Functional Requirements

#### NFR-1: Response Time

- Action card render: < 100ms after message received
- Action execution feedback: < 500ms to show loading state
- Script execution: Depends on FAL/Kling APIs (show progress)

#### NFR-2: Error Handling

- Auto-retry once for transient failures (API timeouts, network errors)
- If retry fails, show error in ActionCard with manual "Retry" button
- All errors shown in UI (not silent failures)
- Agent notified of errors when user triggers continuation
- Error includes: code, message, whether it was auto-retried

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

### Data Flow (Hybrid Approach)

```
┌─────────────────────────────────────────────────────────────────────┐
│                    DATA FLOW (SKILL-BASED)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  1. USER INPUT                                                      │
│     └── "Create an edgy streetwear shoot"                          │
│                    ↓                                                 │
│  2. AGENT REASONING                                                 │
│     └── Analyzes request, selects presets, formulates approach     │
│                    ↓                                                 │
│  3. AGENT RESPONSE + SKILL CALL                                     │
│     └── Agent writes: "For streetwear, I suggest..."               │
│     └── Agent calls: Skill("action-proposer", args)                │
│         OR uses ProposeAction tool directly                         │
│                    ↓                                                 │
│  4. SKILL/TOOL EXECUTION (Server-side)                              │
│     └── Creates ActionInstance with UUID                           │
│     └── Registers in ActionsManager                                │
│     └── Sends via WebSocket: { type: 'action_instance', ... }      │
│                    ↓                                                 │
│  5. FRONTEND RENDERING                                              │
│     └── Displays assistant text                                    │
│     └── Renders ActionCard with ALL template params                │
│     └── Agent's values shown as defaults                           │
│                    ↓                                                 │
│  6. USER INTERACTION                                                │
│     └── Reviews ALL params in form card                            │
│     └── Modifies if desired (dropdowns, text fields)               │
│     └── Clicks "Generate"                                          │
│                    ↓                                                 │
│  7. EXECUTE_ACTION MESSAGE                                          │
│     └── { type: 'execute_action', instanceId, params }             │
│     └── Includes diff of what user changed                         │
│                    ↓                                                 │
│  8. SERVER EXECUTION                                                │
│     └── Auto-retry once on transient failure                       │
│     └── Looks up action template                                   │
│     └── Runs executor with user's final params                     │
│     └── Broadcasts progress/result                                 │
│                    ↓                                                 │
│  9. RESULT DISPLAY                                                  │
│     └── ActionCard shows 'completed' status                        │
│     └── NEW artifact message appears in chat                       │
│     └── Agent notified of result + user's param changes            │
│                    ↓                                                 │
│  10. WAIT FOR USER                                                  │
│      └── User clicks "Continue" or types to proceed                │
│      └── Agent then comments and proposes next action              │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**Key Differences from Text-Parsing Approach:**
- No regex parsing of response text - actions created via explicit tool/skill call
- More reliable - structured data, not text extraction
- Agent text and action are separate concerns
- Frontend receives clean, pre-validated action instances

### Hybrid Approach: Email-Agent Pattern + Form UI

This implementation combines the best of both approaches:

**From Email-Agent (adopted):**
- Skill-based action proposal (not text parsing)
- Structured WebSocket delivery
- Clean separation: agent text is conversational, action is structured data
- Reliable - no regex parsing of markdown

**From MVP Vision (adopted):**
- Form card UI with editable parameters
- User can modify any parameter before executing
- Full creative control over pipeline settings

**Differences from Email-Agent:**

| Aspect | Email Agent | Fashion-Shoot Agent |
|--------|-------------|---------------------|
| Template creation | Agent writes .ts files at runtime | Pre-coded at build time |
| Hot reload | Yes (file watcher) | No (restart required) |
| Template count | Unlimited | Fixed (7 pipeline actions) |
| UI Component | Simple button | Form card with all params |
| User editing | None - click only | Full parameter editing |
| Continuation | Auto-continues | Waits for user |

This simplification is appropriate because:
1. Fashion pipeline has fixed stages (no runtime template creation needed)
2. Creative work benefits from parameter tweaking (form UI > button)
3. User pacing matters for reviewing visual outputs (wait for Continue)

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

#### Decision 3: Skill-Based Action Proposal (Hybrid Approach)

**Choice:** Agent proposes actions via a dedicated `action-proposer` skill, not by embedding JSON in response text.

**Rationale:**
- No fragile text parsing (regex on markdown code blocks)
- Explicit, structured action creation
- Clean separation: agent text is conversational, action is structured data
- More reliable than parsing - tool calls are validated by SDK
- Matches email-agent's proven pattern

**Implementation Flow:**

```
Agent reasoning + Skill call
       ↓
┌──────────────────────────────────────────────────────┐
│ Agent calls Skill("action-proposer") or             │
│ uses ProposeAction tool                              │
│                                                      │
│  1. Skill/tool receives:                            │
│     { templateId, label, params }                   │
│                                                      │
│  2. Server validates against known templates         │
│                                                      │
│  3. Creates ActionInstance with UUID                 │
│     actionsManager.registerInstance(instance)        │
│                                                      │
│  4. Broadcasts via WebSocket:                        │
│     { type: 'action_instance',                       │
│       instance: { instanceId, templateId, ... } }   │
└──────────────────────────────────────────────────────┘
       ↓
Frontend receives structured action instance
       ↓
┌──────────────────────────────────────────────────────┐
│ Frontend renders ActionCard with:                    │
│ - ALL template parameters as form fields             │
│ - Agent's suggested values as defaults               │
│ - User can modify any parameter                      │
└──────────────────────────────────────────────────────┘
```

**Benefits:**
- No regex parsing, no text manipulation
- Actions are explicitly created, never inferred
- Frontend receives validated, complete action data
- Agent's conversational text stays clean

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
│  1. CREATION (via Skill)                                            │
│     └── Agent calls action-proposer skill                           │
│     └── Skill validates templateId against known templates          │
│     └── Skill creates ActionInstance with unique UUID               │
│     └── Server broadcasts { type: 'action_instance', ... }          │
│                                                                      │
│  2. STORAGE                                                         │
│     └── actionsManager.instances Map (keyed by instanceId)          │
│     └── Template schema sent with instance for form rendering       │
│                                                                      │
│  3. EXECUTION                                                       │
│     └── User reviews form, modifies params if desired               │
│     └── User clicks Generate → execute_action message sent          │
│     └── Server auto-retries once on transient failure               │
│     └── Server looks up instance and template                       │
│     └── Server calls template.execute(userParams, context)          │
│     └── Server stores user's param changes for agent notification   │
│                                                                      │
│  4. WAITING (User-Controlled)                                       │
│     └── Result displayed, ActionCard shows "Completed"              │
│     └── Server sends 'awaiting_continuation' signal                 │
│     └── Agent does NOT auto-respond                                 │
│     └── User clicks Continue or types message                       │
│                                                                      │
│  5. CLEANUP                                                         │
│     └── On user continuation: instance removed, agent notified      │
│     └── On session end: all session instances cleared               │
│     └── On error after auto-retry: instance kept (manual retry)     │
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
agent/
├── .claude/
│   └── skills/
│       └── action-proposer/         # (New) Action proposal skill
│           ├── SKILL.md             # Skill definition
│           └── propose-action.ts    # Creates ActionInstance

server/
├── actions/
│   ├── types.ts                    # Type definitions
│   ├── index.ts                    # Action manager & registry
│   ├── generate-hero.ts            # Hero shot action executor
│   ├── generate-contact-sheet.ts   # Contact sheet action executor
│   ├── extract-frames.ts           # Frame extraction action executor
│   ├── resize-frames.ts            # Frame resize action executor
│   ├── generate-video-clip.ts      # Single clip action executor
│   ├── generate-all-clips.ts       # Batch clips action executor
│   └── stitch-final.ts             # Final video action executor
├── lib/
│   ├── ai-client.ts                # (Modified) Add PreToolUse block, remove YOLO
│   ├── orchestrator-prompt.ts      # (Modified) Add skill instructions, remove YOLO
│   └── session-manager.ts          # (Modified) Remove checkpoint state
└── sdk-server.ts                   # (Modified) Add execute_action handler, remove YOLO

frontend/
├── components/
│   └── chat/
│       ├── ActionCard.tsx          # (New) Form-based action UI
│       ├── ContinueButton.tsx      # (New) Trigger agent continuation
│       ├── ChatView.tsx            # (Modified) Render actions
│       └── ...
├── hooks/
│   └── useWebSocket.ts             # (Modified) Action handling, remove checkpoint
└── lib/
    └── types.ts                    # (Modified) Action types

Files to REMOVE:
├── server/lib/action-parser.ts     # Not needed - using skill instead
└── Any checkpoint-related code
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

### Phase 2: Skill & Prompt (Day 1-2)

#### Task 2.1: Create action-proposer Skill

**Directory:** `agent/.claude/skills/action-proposer/`

**Files to Create:**
- `SKILL.md` - Skill definition and usage instructions
- `propose-action.ts` - Script that creates and broadcasts ActionInstance

**Deliverable:**
- Skill that agent can invoke to propose actions
- Validates templateId against known templates
- Creates ActionInstance with UUID
- Broadcasts to frontend via WebSocket
- Returns confirmation to agent

**SKILL.md Content:**

```markdown
# Action Proposer Skill

Use this skill to propose actions to the user instead of executing scripts directly.

## Usage

When you want to generate content (images, videos, etc.), call this skill instead of
running Bash commands. The user will see an interactive card where they can review
and modify parameters before clicking "Generate".

## Command

\`\`\`bash
npx ts-node propose-action.ts --templateId <id> --label "<label>" --params '<json>'
\`\`\`

## Available Templates

| templateId | Description |
|------------|-------------|
| generate_hero | Full-body hero shot |
| generate_contact_sheet | 2×3 grid of 6 angles |
| extract_frames | Extract frames from contact sheet |
| resize_frames | Resize frames for video |
| generate_video_clip | Single transition video |
| generate_all_clips | All 5 transition clips |
| stitch_final | Final stitched video |

## Example

\`\`\`bash
npx ts-node propose-action.ts \
  --templateId generate_hero \
  --label "Generate Moody Hero Shot" \
  --params '{"pose": "editorial-drama", "background": "studio-black", "styleNotes": "Deep shadows"}'
\`\`\`

## IMPORTANT

- ALWAYS explain your creative reasoning BEFORE calling this skill
- NEVER run generation scripts (generate-image, generate-video, etc.) directly
- The user controls when actions execute - you just propose
```

**Effort:** 2 hours

#### Task 2.2: Update Orchestrator Prompt

**File:** `server/lib/orchestrator-prompt.ts`

**Deliverable:**
- Keep existing creative director persona and preset matching
- Add two-step creative flow instructions
- Add instructions for using action-proposer skill with full prompt
- Remove any YOLO/autonomous mode instructions
- Add guidance on waiting for user continuation

**Key Additions:**

```markdown
## Two-Step Creative Flow (MANDATORY)

You MUST follow this two-step flow for all generation tasks:

### Step 1: Discuss Creative Direction
Before proposing any action, have a conversation about creative options:
- Suggest 2-3 creative directions based on user's request
- Explain the aesthetic/mood of each option
- Ask user to choose or provide feedback
- Do NOT propose an action yet

### Step 2: Propose Action with Full Prompt
Once user chooses a direction:
- Craft the complete prompt based on their choice
- Call the action-proposer skill with the full prompt embedded
- The user will see and can edit the prompt before generating

**Example Flow:**

User: "Create a Star Wars themed shoot"

You (Step 1 - Discuss):
"For a Star Wars theme, I have a few directions:

🔴 **Sith Lord** - Deep shadows, red accent lighting, commanding presence
🔵 **Jedi Serenity** - Soft ethereal glow, peaceful stance, earth tones
🟤 **Bounty Hunter** - Gritty industrial, weathered textures, moody greens

Which direction resonates with you?"

User: "Sith Lord"

You (Step 2 - Propose):
"Perfect! Here's the Sith Lord hero shot:"
[Call action-proposer with full prompt]

**IMPORTANT:**
- NEVER propose an action without discussing creative direction first
- ALWAYS include the complete prompt in the action params
- WAIT for user after action completes - do not auto-continue
```

**Effort:** 1.5 hours

#### Task 2.3: Cleanup ai-client.ts

**File:** `server/lib/ai-client.ts`

**Deliverable:**
- Remove YOLO/autonomous mode injection
- Remove PostToolUse artifact detection (actions handle this now)
- Remove checkpoint-related code
- Add PreToolUse hook to block direct generation script execution
- Keep basic progress event emission

**Effort:** 1.5 hours

#### Task 2.4: Remove Checkpoint System

**Files:**
- `server/lib/session-manager.ts` - Remove checkpoint state
- `frontend/src/hooks/useWebSocket.ts` - Remove checkpoint handling
- `frontend/src/components/chat/` - Remove any checkpoint UI

**Deliverable:**
- Clean removal of all checkpoint-related code
- No artifact detection via PostToolUse hooks
- All artifacts come through action system

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

#### Task 3.2: Agent Continuation Flow (User-Triggered)

**File:** `server/sdk-server.ts`

**Deliverable:**
- After action completes, store result but DO NOT auto-continue
- Wait for user to click "Continue" or send a message
- When user triggers, inject result context and continue agent

**Key Principle:** Agent does NOT auto-respond after action completion. User controls pacing.

**Stored Result Format:**

When action completes, store this for later injection when user continues:

```typescript
interface PendingContinuation {
  sessionId: string;
  action: ActionInstance;
  result: ActionResult;
  userParamChanges?: Record<string, { from: any; to: any }>;  // What user modified
  timestamp: Date;
}
```

**Continuation Message (injected when user triggers):**

```
[Action Completed: Generate Hero Shot]

Result: SUCCESS
Artifact: outputs/hero.png
Duration: 12.3 seconds

User Parameter Changes:
- background: "studio-black" → "industrial" (user modified)

The user has reviewed the result and wants to continue. Comment on the result
(acknowledge their parameter changes if any) and suggest the next step.
```

**Error Message (if action failed after auto-retry):**

```
[Action Failed: Generate Hero Shot]

Error: FAL.ai API timeout after 60 seconds
Error Code: TIMEOUT
Auto-retry: Attempted once, still failed

The generation failed. Suggest troubleshooting steps or offer to retry with
different parameters.
```

**Implementation:**

```typescript
// Store pending continuation (don't auto-send)
function storePendingContinuation(
  sessionId: string,
  action: ActionInstance,
  result: ActionResult,
  userChanges?: Record<string, { from: any; to: any }>
): void {
  pendingContinuations.set(sessionId, {
    sessionId,
    action,
    result,
    userParamChanges: userChanges,
    timestamp: new Date()
  });
}

// Called when user clicks Continue or sends message
async function triggerAgentContinuation(
  sessionId: string,
  userMessage?: string
): Promise<void> {
  const pending = pendingContinuations.get(sessionId);
  if (!pending) {
    // No pending continuation, just send user message normally
    return aiClient.continueSession(sessionId, userMessage);
  }

  // Build continuation context
  const context = buildContinuationMessage(pending);
  const fullMessage = userMessage
    ? `${context}\n\nUser says: "${userMessage}"`
    : context;

  pendingContinuations.delete(sessionId);
  await aiClient.continueSession(sessionId, fullMessage);
}
```

**Effort:** 2 hours

### Phase 4: Frontend (Day 2-3)

#### Task 4.1: ActionCard Component

**File:** `frontend/src/components/chat/ActionCard.tsx`

**Deliverable:**
- Render action with icon and label
- Generate form fields from ALL template parameters (not just agent-specified)
- Handle enum (dropdown), text (textarea), boolean (checkbox), number (input)
- Agent's suggested values shown as defaults
- "Generate" button with loading state
- "Reset" button to restore agent's original values
- "Completed" state after execution
- Track which params user modified (for reporting to agent)

**Effort:** 3 hours

#### Task 4.1b: ContinueButton Component

**File:** `frontend/src/components/chat/ContinueButton.tsx`

**Deliverable:**
- Appears after action completes
- Clicking triggers agent continuation
- Hidden when user types in chat input (typing counts as continuation)
- Clean visual design, prominent but not intrusive

**Effort:** 0.5 hours

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
│  DAY 1 (8 hours) - Foundation & Skill                               │
│  ═══════════════════════════════════════                            │
│  [████] Task 1.1: Types (1h)                                        │
│  [██████] Task 1.2: Action Manager (1.5h)                           │
│  [████████] Task 1.3: generate_hero executor (2h)                   │
│  [████████] Task 2.1: action-proposer skill (2h)                    │
│  [██████] Task 2.2: Orchestrator Prompt update (1.5h)               │
│                                                                      │
│  DAY 2 (8.5 hours) - Server & Cleanup                               │
│  ═══════════════════════════════════════                            │
│  [██████] Task 2.3: ai-client cleanup (1.5h)                        │
│  [████] Task 2.4: Remove checkpoint system (1h)                     │
│  [████████] Task 3.1: WebSocket Handler (2h)                        │
│  [████████] Task 3.2: User-triggered continuation (2h)              │
│  [████████] Task 4.1: ActionCard Component (2h) [start]             │
│                                                                      │
│  DAY 3 (8 hours) - Frontend                                         │
│  ═══════════════════════════════                                    │
│  [████] Task 4.1: ActionCard Component (1h) [finish]                │
│  [██] Task 4.1b: ContinueButton Component (0.5h)                    │
│  [████████] Task 4.2: useWebSocket updates (2h)                     │
│  [████] Task 4.3: ChatView integration (1h)                         │
│  [██████████████] Task 5.1: All Action Templates (3.5h)             │
│                                                                      │
│  DAY 4 (5.5 hours) - Testing & Polish                               │
│  ═══════════════════════════════════════                            │
│  [████████] Task 6.1: E2E Testing (2h)                              │
│  [████████] Task 6.2: UI Polish (2h)                                │
│  [██████] Task 6.3: Documentation + Commits (1.5h)                  │
│                                                                      │
│  TOTAL: ~30 hours over 4 days                                       │
│                                                                      │
│  GIT COMMITS (Incremental):                                         │
│  ─────────────────────────                                          │
│  Day 1 end: "feat: Add action types, manager, and proposer skill"   │
│  Day 2 end: "feat: WebSocket action handling, remove YOLO/checkpoint"│
│  Day 3 end: "feat: ActionCard UI with user continuation"            │
│  Day 4 end: "feat: Complete action instance pattern MVP"            │
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

### Risk 1: Agent Ignores Action Skill

**Risk:** Agent executes Bash directly instead of using action-proposer skill.

**Mitigation:**
- PreToolUse hook BLOCKS Bash calls containing generation scripts
- Agent receives clear error: "Use action-proposer skill instead"
- Strong prompt instructions with examples
- No fallback needed - blocking is enforced

### Risk 2: Complex Parameter UIs

**Risk:** Some parameters hard to represent in simple form.

**Mitigation:**
- Start with enum/text/boolean/number only
- Show ALL template parameters (not just agent-specified)
- Add advanced controls in future iterations

### Risk 3: Agent Continuation Context

**Risk:** Agent doesn't respond well when user triggers continuation.

**Mitigation:**
- Clear result message format includes artifact + param changes
- Examples in prompt for post-continuation responses
- User can type specific feedback instead of just clicking Continue
- Test extensively with different scenarios

### Risk 4: Performance Issues

**Risk:** Action execution feels slow or unresponsive.

**Mitigation:**
- Immediate loading state on click
- Progress events during execution (especially for long video generation)
- Auto-retry once for transient failures (user doesn't see first failure)
- Clear progress indication: "Generating (1/5 clips)..."

### Risk 5: User Doesn't Know to Continue

**Risk:** User waits for agent response, not realizing they need to click Continue.

**Mitigation:**
- Prominent "Continue" button after action completes
- Visual indication that agent is waiting
- Chat input placeholder changes to "Type or click Continue..."
- Consider: auto-continue after timeout (future enhancement)

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
  params: Record<string, any>;           // User's final params (may differ from agent's)
  originalParams: Record<string, any>;   // Agent's original params (for diff)
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

// Trigger agent continuation (user clicked Continue or sent message)
interface ContinueMessage {
  type: 'continue';
  sessionId: string;
  content?: string;                      // Optional user message
}
```

**Server → Client Messages:**

```typescript
// New action instance created (from action-proposer skill)
interface ActionInstanceMessage {
  type: 'action_instance';
  sessionId: string;
  instance: ActionInstance;              // Full instance with template info
  template: ActionTemplate;              // Template schema for form rendering
}

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
  retryAttempt?: number;                 // 1 if auto-retrying
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
    duration?: number;                   // Execution time in ms
  };
}

// Action failed (after auto-retry if applicable)
interface ActionErrorMessage {
  type: 'action_error';
  sessionId: string;
  instanceId: string;
  error: {
    code: string;                        // e.g., "TIMEOUT", "API_ERROR"
    message: string;                     // Human-readable error
    retryable: boolean;                  // Can user manually retry?
    autoRetried: boolean;                // Was auto-retry attempted?
  };
}

// Continuation ready signal (after action complete, waiting for user)
interface AwaitingContinuationMessage {
  type: 'awaiting_continuation';
  sessionId: string;
  instanceId: string;                    // Which action completed
}
```

**Message Flow Diagram (Two-Step Creative Flow):**

```
═══════════════════════════════════════════════════════════════════
STEP 1: CREATIVE DISCUSSION (No action yet)
═══════════════════════════════════════════════════════════════════

User types prompt
     │
     ▼
┌────────────────────────────────────────────────────────────────┐
│ { type: 'chat', content: "Create a Star Wars themed shoot" }   │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (Agent discusses options - NO action proposed)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'assistant_message',                                    │
│   content: "For Star Wars, I have a few directions:            │
│             🔴 Sith Lord - deep shadows, red lighting...       │
│             🔵 Jedi Serenity - ethereal glow...                │
│             Which resonates?" }                                 │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (User chooses direction)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'chat', content: "Sith Lord looks perfect" }           │
└────────────────────────────────────────────────────────────────┘


═══════════════════════════════════════════════════════════════════
STEP 2: ACTION PROPOSAL (Full prompt embedded)
═══════════════════════════════════════════════════════════════════
     │
     ▼ (Agent responds + calls action-proposer with FULL prompt)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'assistant_message',                                    │
│   content: "Great choice! Here's the Sith Lord hero:" }        │
└────────────────────────────────────────────────────────────────┘
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'action_instance',                                      │
│   instance: {                                                   │
│     instanceId: "abc",                                          │
│     templateId: "generate_hero",                                │
│     label: "Generate Sith Lord Hero",                           │
│     params: {                                                   │
│       prompt: "Full-body fashion photograph, powerful Sith     │
│                Lord aesthetic, editorial-drama pose, deep       │
│                shadows with red accent lighting...",            │
│       aspectRatio: "3:2"                                        │
│     }                                                           │
│   },                                                            │
│   template: { parameters: { prompt: {...}, aspectRatio: {...} }}│
│ }                                                               │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (Frontend renders ActionCard with editable prompt)
     ▼ (User tweaks prompt: adds "cape flowing in wind")
     ▼ (User clicks Generate)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'execute_action', instanceId: "abc",                   │
│   params: { prompt: "...cape flowing in wind...", ... },       │
│   originalParams: { prompt: "...(original)...", ... } }        │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (Execution with progress)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'action_start' } → { type: 'action_progress' } →       │
│ { type: 'action_complete', artifact: "outputs/hero.png" }      │
└────────────────────────────────────────────────────────────────┘
     │
     ▼
┌────────────────────────────────────────────────────────────────┐
│ { type: 'awaiting_continuation', instanceId: "abc" }           │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (User reviews artifact, clicks Continue)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'continue', content: "love it!" }                      │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (Agent notified of result + prompt changes)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'assistant_message',                                    │
│   content: "The cape adds great movement! Ready for the        │
│             contact sheet? Same Sith Lord energy..." }         │
└────────────────────────────────────────────────────────────────┘
     │
     ▼ (Agent proposes next action with full prompt)
     │
┌────────────────────────────────────────────────────────────────┐
│ { type: 'action_instance',                                      │
│   instance: { templateId: "generate_contact_sheet",             │
│               params: { prompt: "...", ... } } }                │
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
