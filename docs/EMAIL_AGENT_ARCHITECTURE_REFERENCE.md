# Email Agent Architecture Reference

A detailed breakdown of the email-agent codebase structure and how all pieces connect.

---

## Table of Contents

1. [Quick Overview](#quick-overview)
2. [Templates vs Instances (Beginner Guide)](#templates-vs-instances-beginner-guide)
3. [How the Agent "Creates" Buttons](#how-the-agent-creates-buttons)
4. [What is a Handler?](#what-is-a-handler)
5. [ccsdk/ Files Explained](#ccsdk-files-explained)
6. [How ccsdk Connects to custom_scripts](#how-ccsdk-connects-to-custom_scripts)
7. [server/ Files](#server-files)
8. [Complete Data Flow Diagram](#complete-data-flow-diagram)
9. [Key Architectural Insights](#key-architectural-insights)
10. [Implementation Status](#implementation-status)

---

## Quick Overview

```
email-agent/
├── agent/                    # Agent's workspace (cwd)
│   ├── .claude/              # Skills & subagents
│   │   ├── skills/           # Documentation for agent
│   │   └── agents/           # Subagent definitions
│   └── custom_scripts/       # Handler code (agent creates these)
│       ├── actions/          # User-triggered handlers (TEMPLATES)
│       ├── listeners/        # Event-triggered handlers
│       └── ui-states/        # Persistent state definitions
│
├── ccsdk/                    # Server orchestration layer
│   ├── ai-client.ts          # SDK wrapper
│   ├── session.ts            # Conversation state
│   ├── websocket-handler.ts  # WebSocket + action execution
│   ├── actions-manager.ts    # Load/execute actions
│   ├── listeners-manager.ts  # Load/trigger listeners
│   ├── ui-state-manager.ts   # Persistent UI state
│   ├── custom-tools.ts       # MCP tools for agent
│   └── email-agent-prompt.ts # System prompt
│
├── server/                   # HTTP server + endpoints
│   └── endpoints/            # REST API handlers
│
├── client/                   # React frontend
│   └── components/           # UI components
│
└── database/                 # SQLite + IMAP layer
```

---

## Templates vs Instances (Beginner Guide)

This is the most important concept to understand.

### Simple Analogy: Pizza Ordering

**Template = Menu Item (what you CAN order)**
```
┌─────────────────────────────┐
│  PEPPERONI PIZZA            │
│                             │
│  Options:                   │
│  - Size: ___                │
│  - Crust: ___               │
│  - Extra toppings: ___      │
└─────────────────────────────┘
```

**Instance = Your Actual Order (specific choices)**
```
┌─────────────────────────────┐
│  ORDER #1234                │
│                             │
│  Pepperoni Pizza            │
│  - Size: Large              │
│  - Crust: Thin              │
│  - Extra: Mushrooms         │
└─────────────────────────────┘
```

### In Code Terms

| Aspect | Template | Instance |
|--------|----------|----------|
| **What** | Reusable definition | Specific invocation |
| **Where** | `.ts` file on disk | Memory (server-side) |
| **Created by** | Agent via Write tool | Agent during conversation |
| **Contains** | Schema + handler function | Concrete parameter values |
| **Lifetime** | Permanent (until deleted) | Per-conversation |
| **Example** | "Forward bugs to engineering" | "Forward Alice's bug about login (P1)" |

### Template (File on Disk)

```
Location: agent/custom_scripts/actions/forward-bugs.ts
```

```typescript
// This is a TEMPLATE - describes what CAN be done
export const config = {
  id: "forward_bugs",                    // Unique identifier
  name: "Forward Bug Reports",           // Display name
  description: "Forward bugs to engineering",
  icon: "🐛",

  // What information is NEEDED? (blanks to fill in)
  parameterSchema: {
    properties: {
      emailId: { type: "string" },       // Which email?
      priority: { type: "string" },      // How urgent?
      feature: { type: "string" }        // What's broken?
    }
  }
};

// This runs when executed
export async function handler(params, context) {
  // params come from the INSTANCE
  await context.sendEmail({ ... });
  return { success: true };
}
```

**The template says:** "I can forward bugs, but I need to know: which email? what priority? what feature?"

### Instance (In Memory)

```
Location: Server memory (ActionsManager.instances Map)
Created: During conversation when agent proposes an action
```

```typescript
// This is an INSTANCE - specific values for THIS action
{
  instanceId: "act_abc123",              // Unique ID for this instance
  templateId: "forward_bugs",            // Which template to use

  label: "Forward Alice's bug (P1)",     // Button text

  // The ACTUAL VALUES (blanks filled in!)
  params: {
    emailId: "<alice@example.com>",      // THIS email
    priority: "P1 - High",               // THIS priority
    feature: "Login"                     // THIS feature
  }
}
```

**The instance says:** "Use the 'forward_bugs' template with Alice's email, P1 priority, and Login feature."

### Visual Comparison

```
TEMPLATE (file on disk)                 INSTANCE (in memory)
═══════════════════════                 ════════════════════

forward-bugs.ts                         Created during chat

┌─────────────────────────────┐         ┌─────────────────────────────┐
│ id: "forward_bugs"          │         │ instanceId: "act_abc123"    │
│ name: "Forward Bug Reports" │         │ templateId: "forward_bugs"  │
│                             │         │                             │
│ parameterSchema:            │         │ params:                     │
│   emailId: ???              │ ──────► │   emailId: "alice@..."      │
│   priority: ???             │         │   priority: "P1"            │
│   feature: ???              │         │   feature: "Login"          │
│                             │         │                             │
│ + handler function          │         │ label: "Forward Alice's bug"│
└─────────────────────────────┘         └─────────────────────────────┘

"I CAN forward bugs"                    "Forward THIS bug from Alice"
(no button yet)                         (button appears!)
```

### When Do Buttons Appear?

```
Phase 1: Template Created (NO BUTTON)
═════════════════════════════════════
User: "Create an action to forward bugs"
Agent: [Uses Write tool to create .ts file]
Server: [Loads template, stores in memory]
Result: Template exists, but NO BUTTON in UI

Phase 2: Instance Created (BUTTON APPEARS!)
═══════════════════════════════════════════
User: "I found a bug report from Alice"
Agent: [Recognizes template fits, creates instance]
Server: [Registers instance, sends to frontend]
Result: Button appears in chat!
```

---

## How the Agent "Creates" Buttons

**Key insight: The agent doesn't "know" about buttons. It just outputs text.**

### The Agent is Just an LLM

The agent outputs text. It has no concept of "buttons" or "UI components". So how does a button appear?

**Answer:** The agent is instructed to output JSON in a specific format. Other code (server + frontend) parses that JSON and renders a button.

### The Mechanism

```
┌─────────────────────────────────────────────────────────────┐
│  1. SYSTEM PROMPT tells agent the format                    │
│                                                             │
│     "When you want to offer an action, output JSON like:    │
│      { 'actions': [{ templateId, label, params }] }"        │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  2. AGENT outputs text with JSON embedded                   │
│                                                             │
│     "I found Alice's bug report. Here's what I can do:      │
│                                                             │
│      { 'actions': [{                                        │
│          'templateId': 'forward_bugs',                      │
│          'label': 'Forward to Engineering (P1)',            │
│          'params': { 'emailId': '...', 'priority': 'P1' }   │
│      }] }"                                                  │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  3. SERVER PARSES the agent's text                          │
│                                                             │
│     - Detect JSON blocks in the text                        │
│     - Extract action instances                              │
│     - Register: actionsManager.registerInstance(instance)   │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  4. SERVER SENDS to frontend                                │
│                                                             │
│     WebSocket: {                                            │
│       type: 'assistant_message',                            │
│       content: "I found Alice's bug report...",             │
│       actions: [{ instanceId, label, params }]              │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  5. FRONTEND RENDERS button                                 │
│                                                             │
│     if (message.actions) {                                  │
│       message.actions.map(a => <ActionButton ... />)        │
│     }                                                       │
└─────────────────────────────────────────────────────────────┘
```

### The Chef and Waiter Analogy

- **Agent (Chef)**: Writes "SOUP: Tomato Bisque" on a slip
- **Server (Kitchen Manager)**: Reads slip, formats it for the menu board
- **Frontend (Menu Board)**: Displays "Soup of the Day" with nice styling

The chef doesn't know about the menu board's design. They just write in the agreed format. The system transforms it.

### What the Agent Actually Outputs

```
─────────────────────────────────────────────────────────
I found Alice's bug report about the login feature.
This looks like a P1 priority issue. I can forward this
to the engineering team.

{
  "actions": [
    {
      "templateId": "forward_bugs",
      "label": "Forward to Engineering (P1)",
      "params": {
        "emailId": "<msg123@example.com>",
        "priority": "P1 - High",
        "feature": "Login"
      }
    }
  ]
}
─────────────────────────────────────────────────────────
```

The agent just outputs this text. It doesn't "create a button" - it outputs structured data that gets transformed into a button.

### What the User Sees

```
┌─────────────────────────────────────────────────────────────┐
│  🤖 Assistant                                               │
│                                                             │
│  I found Alice's bug report about the login feature.        │
│  This looks like a P1 priority issue. I can forward this    │
│  to the engineering team.                                   │
│                                                             │
│  ┌───────────────────────────────────┐                      │
│  │  🐛 Forward to Engineering (P1)   │  ← Button!           │
│  └───────────────────────────────────┘                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

The JSON is stripped from the displayed text, and a button is rendered instead.

---

## What is a Handler?

A **handler** is a TypeScript function that performs work. Two types exist:

### Action Handler (User-Triggered)

```typescript
// agent/custom_scripts/actions/archive-old-newsletters.ts

// CONFIG: Metadata describing the action (the TEMPLATE)
export const config: ActionTemplate = {
  id: "archive_old_newsletters",      // Unique identifier
  name: "Archive Old Newsletters",    // Display name
  description: "Archive newsletters older than X days",
  icon: "📰",
  parameterSchema: {                  // What params user can set
    type: "object",
    properties: {
      daysOld: {
        type: "number",
        description: "Archive newsletters older than this many days",
        default: 30
      }
    }
  }
};

// HANDLER: The actual execution logic
export async function handler(
  params: Record<string, any>,    // Values from the INSTANCE
  context: ActionContext          // Capabilities from the SERVER
): Promise<ActionResult> {

  const { daysOld = 30 } = params;

  // Use context to do work
  const emails = await context.emailAPI.searchWithGmailQuery(
    `label:newsletter older_than:${daysOld}d`
  );

  for (const email of emails) {
    await context.archiveEmail(email.messageId);
  }

  context.notify(`Archived ${emails.length} newsletters`, { type: "success" });

  return {
    success: true,
    message: `Archived ${emails.length} newsletters`,
    refreshInbox: true
  };
}
```

### Listener Handler (Event-Triggered)

```typescript
// agent/custom_scripts/listeners/finance-tracker.ts

export const config: ListenerConfig = {
  id: 'finance_email_tracker',
  name: 'Finance Email Tracker',
  enabled: true,
  event: 'email_received'           // When to trigger
};

export async function handler(
  email: Email,                      // The triggering email
  context: ListenerContext
): Promise<ListenerResult> {

  // Use AI to classify
  const result = await context.callAgent<FinanceResult>({
    prompt: `Is this email about money? ${email.subject}`,
    schema: { type: "object", properties: { isFinancial: { type: "boolean" } } },
    model: 'haiku'
  });

  if (result.isFinancial) {
    await context.addLabel(email.messageId, 'Finance');

    // Update persistent UI state
    const state = await context.uiState.get<DashboardState>('financial_dashboard');
    state.transactions.push({ ... });
    await context.uiState.set('financial_dashboard', state);
  }

  return { executed: true, reason: "Processed finance email" };
}
```

### Key Difference: `params` vs `context`

| Aspect | `params` | `context` |
|--------|----------|-----------|
| **What** | User input data | System capabilities |
| **Source** | Instance (agent's decision) | Server injection |
| **Example** | `{ daysOld: 30 }` | `{ archiveEmail(), callAgent(), notify() }` |
| **Varies by** | Each invocation | Handler type (Action vs Listener) |

### ActionContext Capabilities

```typescript
interface ActionContext {
  sessionId: string;

  // Email operations (backed by database)
  emailAPI: {
    getInbox(): Promise<Email[]>;
    searchWithGmailQuery(query: string): Promise<Email[]>;
    getEmailById(id: string): Promise<Email>;
  };

  // Direct mutations
  archiveEmail(id: string): Promise<void>;
  starEmail(id: string): Promise<void>;
  addLabel(id: string, label: string): Promise<void>;
  sendEmail(options: SendEmailOptions): Promise<{ messageId: string }>;

  // AI capabilities (via Anthropic SDK)
  callAgent<T>(options: AgentOptions): Promise<T>;

  // Notifications
  notify(message: string, options?: NotifyOptions): void;
  log(message: string, level?: LogLevel): void;

  // Persistent state
  uiState: {
    get<T>(stateId: string): Promise<T | null>;
    set<T>(stateId: string, data: T): Promise<void>;
  };
}
```

---

## ccsdk/ Files Explained

### `ai-client.ts` - SDK Wrapper

**Purpose:** Wraps Claude Agent SDK's `query()` function.

```typescript
export class AIClient {
  private defaultOptions = {
    maxTurns: 100,
    cwd: path.join(process.cwd(), 'agent'),  // Agent workspace
    model: "opus",
    allowedTools: [
      "Task", "Bash", "Read", "Write", "Edit", "Glob", "Grep",
      "mcp__email__search_inbox",    // Custom MCP
      "mcp__email__read_emails",     // Custom MCP
      "Skill"
    ],
    appendSystemPrompt: EMAIL_AGENT_PROMPT,
    mcpServers: { "email": customServer },
    hooks: {
      PreToolUse: [{
        matcher: "Write|Edit",
        hooks: [/* Block writes outside custom_scripts/ */]
      }]
    }
  };

  // Streaming query
  async *queryStream(prompt, options) {
    for await (const msg of query({ prompt, options })) {
      yield msg;
    }
  }
}
```

**Connections:** Used by `Session` to talk to Claude.

---

### `session.ts` - Conversation Manager

**Purpose:** Manages one conversation, handles multi-turn via SDK resume.

```typescript
export class Session {
  public readonly id: string;
  private aiClient: AIClient;
  private sdkSessionId: string | null = null;  // For resume
  private subscribers: Set<WSClient> = new Set();

  async addUserMessage(content: string) {
    const options = this.sdkSessionId
      ? { resume: this.sdkSessionId }  // Continue conversation
      : {};

    for await (const message of this.aiClient.queryStream(content, options)) {
      // Capture session ID for next turn
      if (message.type === 'system' && message.subtype === 'init') {
        this.sdkSessionId = message.session_id;
      }

      this.broadcastToSubscribers(message);
    }
  }
}
```

**Connections:** Created by `WebSocketHandler`, uses `AIClient`.

---

### `websocket-handler.ts` - Main Connection Handler

**Purpose:** Routes WebSocket messages, executes actions, manages sessions.

```typescript
export class WebSocketHandler {
  private sessions: Map<string, Session> = new Map();
  private actionsManager: ActionsManager;
  private uiStateManager: UIStateManager;

  async onMessage(ws, message) {
    const data = JSON.parse(message);

    switch (data.type) {
      case 'chat':
        const session = this.getOrCreateSession(data.sessionId);
        await session.addUserMessage(data.content);
        break;

      case 'execute_action':
        const context = this.createActionContext(sessionId);
        const result = await this.actionsManager.executeAction(
          data.instanceId,
          context
        );
        ws.send(JSON.stringify({ type: 'action_result', result }));
        break;
    }
  }

  // Create ActionContext with all capabilities
  private createActionContext(sessionId): ActionContext {
    return {
      sessionId,
      emailAPI: {
        getInbox: async () => this.db.prepare('SELECT...').all(),
        searchWithGmailQuery: async (q) => { ... }
      },
      archiveEmail: async (id) => {
        this.db.prepare('UPDATE emails SET folder=?').run('Archive', id);
      },
      callAgent: async (options) => {
        // Uses Anthropic SDK directly (not Claude Code SDK)
        const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        return anthropic.messages.create({ ... });
      },
      notify: (msg) => this.broadcast({ type: 'notification', msg }),
      uiState: {
        get: (id) => this.uiStateManager.getState(id),
        set: (id, data) => this.uiStateManager.setState(id, data)
      }
    };
  }
}
```

**Connections:**
- Creates `Session` instances
- Uses `ActionsManager` to execute actions
- Creates `ActionContext` with database/API access

---

### `actions-manager.ts` - Action Loading & Execution

**Purpose:** Loads handler files (TEMPLATES), stores instances, executes on demand.

```typescript
export class ActionsManager {
  private actionsDir = "agent/custom_scripts/actions";
  private templates: Map<string, { config, handler }> = new Map();  // TEMPLATES
  private instances: Map<string, ActionInstance> = new Map();       // INSTANCES

  // Load all .ts files (TEMPLATES)
  async loadAllTemplates() {
    const files = await readdir(this.actionsDir);
    for (const file of files.filter(f => f.endsWith('.ts'))) {
      // Dynamic import with cache busting for hot reload
      const module = await import(`${filePath}?t=${Date.now()}`);

      if (module.config?.id && typeof module.handler === 'function') {
        this.templates.set(module.config.id, {
          config: module.config,
          handler: module.handler
        });
      }
    }
  }

  // Register an instance (created during conversation)
  registerInstance(instance: ActionInstance) {
    this.instances.set(instance.instanceId, instance);
  }

  // Execute an action instance
  async executeAction(instanceId, context): Promise<ActionResult> {
    const instance = this.instances.get(instanceId);      // Get INSTANCE
    const template = this.templates.get(instance.templateId);  // Get TEMPLATE

    return await template.handler(instance.params, context);
  }

  // Watch for file changes (hot reload)
  async watchTemplates(onChange) {
    const watcher = watch(this.actionsDir);
    for await (const event of watcher) {
      if (event.filename?.endsWith('.ts')) {
        await this.loadAllTemplates();
        onChange(this.getTemplates());
      }
    }
  }
}
```

**Key insight:** `?t=${Date.now()}` busts Node's import cache for hot reload.

---

### `listeners-manager.ts` - Event-Triggered Automation

**Purpose:** Loads listeners, triggers them when events occur.

```typescript
export class ListenersManager {
  private listenersDir = "agent/custom_scripts/listeners";
  private listeners: Map<string, { config, handler }> = new Map();

  // Trigger listeners for an event
  async checkEvent(event: EventType, data: any) {
    const matching = [...this.listeners.values()]
      .filter(l => l.config.event === event && l.config.enabled);

    for (const listener of matching) {
      const context = this.createContext(listener.config);
      const result = await listener.handler(data, context);

      // Log execution
      this.logWriter.appendLog(listener.config.id, {
        timestamp: new Date().toISOString(),
        executed: result.executed,
        reason: result.reason
      });
    }
  }

  // Context includes IMAP operations (real email mutations)
  private createContext(config): ListenerContext {
    return {
      archiveEmail: async (id) => {
        await this.imapManager.archiveEmail(uid, folder);
        this.db.updateEmailFlags(id, { folder: 'Archive' });
      },
      addLabel: async (id, label) => {
        await this.imapManager.addLabel(uid, label, folder);
      },
      callAgent: async (options) => { /* Anthropic SDK */ },
      uiState: { get, set }
    };
  }
}
```

**Triggered by:** `EmailSyncService` when IMAP IDLE detects new emails.

---

### `ui-state-manager.ts` - Persistent State

**Purpose:** Manages state that survives across sessions (e.g., dashboards).

```typescript
export class UIStateManager {
  private uiStatesDir = "agent/custom_scripts/ui-states";
  private templates: Map<string, UIStateTemplate> = new Map();

  async getState<T>(stateId: string): Promise<T | null> {
    const result = this.db.getUIState(stateId);
    if (!result) {
      // Return initial state from template
      return this.templates.get(stateId)?.initialState;
    }
    return result;
  }

  async setState<T>(stateId: string, data: T) {
    await this.db.setUIState(stateId, data);
    this.notifySubscribers(stateId, data);  // Broadcast to UI
  }
}
```

**Used by:** Actions and listeners via `context.uiState`.

---

### `custom-tools.ts` - MCP Tools for Agent

**Purpose:** Defines tools the agent can use during conversation.

```typescript
import { tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";

export const customServer = createSdkMcpServer({
  name: "email",
  version: "1.0.0",
  tools: [
    tool(
      "search_inbox",
      "Search emails using Gmail query syntax",
      { gmailQuery: z.string() },
      async (args) => {
        const results = await emailAPI.searchEmails(args.gmailQuery);
        // Write to log file (too much data for response)
        fs.writeFileSync(logPath, JSON.stringify(results));
        return { content: [{ type: "text", text: `Found ${results.length} emails` }] };
      }
    ),

    tool(
      "read_emails",
      "Read emails by IDs",
      { ids: z.array(z.string()) },
      async (args) => {
        const emails = await emailAPI.getEmailsByIds(args.ids);
        return { content: [{ type: "text", text: JSON.stringify(emails) }] };
      }
    )
  ]
});
```

**Available as:** `mcp__email__search_inbox`, `mcp__email__read_emails`

**Key insight:** Agent can SEARCH and READ emails, but NOT send/archive/mutate.

---

### `email-agent-prompt.ts` - System Prompt

```typescript
export const EMAIL_AGENT_PROMPT = `You are a helpful email assistant...

# Creating Email Listeners
When user wants automated email monitoring, use the **listener-creator** skill.

# Creating One-Click Actions
When user wants reusable user-triggered actions, use the **action-creator** skill.

**Key difference**:
- **Listeners** = Automatic (run when emails arrive)
- **Actions** = User-triggered (run when user clicks button)
`;
```

---

## How ccsdk Connects to custom_scripts

### Loading Flow (Templates)

```
Server Startup
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ ActionsManager.loadAllTemplates()                                │
│                                                                  │
│   readdir("agent/custom_scripts/actions/")                       │
│        │                                                         │
│        ▼                                                         │
│   For each .ts file:                                            │
│        │                                                         │
│        ▼                                                         │
│   import(`${path}?t=${Date.now()}`)  ← Cache busting            │
│        │                                                         │
│        ▼                                                         │
│   Validate: has config.id + handler function?                    │
│        │                                                         │
│        ▼                                                         │
│   templates.set(config.id, { config, handler })                  │
└─────────────────────────────────────────────────────────────────┘
```

### Hot Reload Flow

```
Agent writes new file via Write tool
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ fs.watch() detects change                                        │
│      │                                                           │
│      ▼                                                           │
│ ActionsManager.loadAllTemplates()  ← Re-import all files        │
│      │                                                           │
│      ▼                                                           │
│ onChange(templates)  ← Notify WebSocket                          │
│      │                                                           │
│      ▼                                                           │
│ Broadcast to clients: { type: 'action_templates', templates }    │
└─────────────────────────────────────────────────────────────────┘
```

### Instance Creation Flow (How Buttons Appear)

```
User: "I found a bug from Alice about login"
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Agent recognizes a template fits this situation                  │
│      │                                                           │
│      ▼                                                           │
│ Agent outputs JSON in its response:                              │
│                                                                  │
│   "I can forward this to engineering.                            │
│    { 'actions': [{                                               │
│        templateId: 'forward_bugs',                               │
│        label: 'Forward to Engineering (P1)',                     │
│        params: { emailId: '...', priority: 'P1' }                │
│    }] }"                                                         │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Server parses agent's text output                                │
│      │                                                           │
│      ▼                                                           │
│ Detects JSON block, extracts action instances                    │
│      │                                                           │
│      ▼                                                           │
│ actionsManager.registerInstance(instance)                        │
│      │                                                           │
│      ▼                                                           │
│ Sends to frontend with actions attached to message               │
└─────────────────────────────────────────────────────────────────┘
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ Frontend receives message with actions array                     │
│      │                                                           │
│      ▼                                                           │
│ Renders <ActionButton> for each action                           │
│      │                                                           │
│      ▼                                                           │
│ User sees button in chat!                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Execution Flow (When Button Clicked)

```
User clicks action button
      │
      ▼
WebSocket: { type: 'execute_action', instanceId: 'abc123' }
      │
      ▼
┌─────────────────────────────────────────────────────────────────┐
│ WebSocketHandler.onMessage()                                     │
│      │                                                           │
│      ▼                                                           │
│ createActionContext(sessionId)                                   │
│      │                                                           │
│      │  Creates context with:                                    │
│      │  - emailAPI (database queries)                            │
│      │  - archiveEmail (database mutations)                      │
│      │  - callAgent (Anthropic API)                              │
│      │  - notify (WebSocket broadcast)                           │
│      │  - uiState (state manager)                                │
│      │                                                           │
│      ▼                                                           │
│ actionsManager.executeAction(instanceId, context)                │
│      │                                                           │
│      ▼                                                           │
│ instance = instances.get(instanceId)   ← Get INSTANCE            │
│ template = templates.get(instance.templateId)  ← Get TEMPLATE    │
│      │                                                           │
│      ▼                                                           │
│ result = await template.handler(instance.params, context)        │
│      │                                                           │
│      ▼                                                           │
│ WebSocket: { type: 'action_result', result }                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## server/ Files

### `server.ts` - Main Entry Point

```typescript
// Initialize all managers
const dbManager = DatabaseManager.getInstance();
const imapManager = ImapManager.getInstance();
const actionsManager = new ActionsManager();
const uiStateManager = new UIStateManager(dbManager);
const listenersManager = new ListenersManager(imapManager, dbManager, uiStateManager);

// Create WebSocket handler with dependencies
const wsHandler = new WebSocketHandler(dbPath, actionsManager, uiStateManager);

// Load all templates at startup
await actionsManager.loadAllTemplates();
await listenersManager.loadAllListeners();
await uiStateManager.loadAllTemplates();

// Start file watchers for hot reload
actionsManager.watchTemplates(onChange);
listenersManager.watchListeners(onChange);

// Start IMAP IDLE monitoring
await imapManager.startIdleMonitoring("INBOX", async (count) => {
  // New emails detected, trigger listeners
  await syncService.handleIdleNewEmails(count, "INBOX");
});

// Bun.serve handles HTTP + WebSocket
const server = Bun.serve({
  port: 3000,
  websocket: {
    open: (ws) => wsHandler.onOpen(ws),
    message: (ws, msg) => wsHandler.onMessage(ws, msg),
    close: (ws) => wsHandler.onClose(ws)
  },
  fetch: async (req, server) => {
    // WebSocket upgrade
    if (url.pathname === '/ws') {
      server.upgrade(req);
      return;
    }

    // REST endpoints
    if (url.pathname === '/api/emails/inbox') return handleInboxEndpoint(req);
    if (url.pathname === '/api/sync') return handleSyncEndpoint(req);
    // ... more endpoints
  }
});
```

### REST Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/emails/inbox` | Get inbox emails |
| `POST /api/emails/search` | Search emails |
| `GET /api/email/:id` | Get single email |
| `POST /api/sync` | Trigger email sync |
| `GET /api/sync/status` | Get sync status |
| `GET /api/listeners` | List all listeners |
| `GET /api/listener/:id` | Get listener details |
| `GET /api/listener/:id/logs` | Get listener logs |
| `GET /api/ui-state/:id` | Get UI state |
| `PUT /api/ui-state/:id` | Update UI state |
| `GET /api/ui-states` | List all states |

---

## Complete Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND                                    │
│   ┌─────────────┐  ┌─────────────────┐  ┌──────────────────────────┐    │
│   │ Chat Input  │  │ Action Buttons  │  │  Custom UI (Dashboards)  │    │
│   └──────┬──────┘  └────────┬────────┘  └────────────┬─────────────┘    │
└──────────┼──────────────────┼───────────────────────┼───────────────────┘
           │                  │                       │
           │ WebSocket        │ execute_action        │ ui_state reads
           ▼                  ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              CCSDK                                       │
│                                                                         │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                     WebSocketHandler                             │   │
│   │  • Routes messages                                               │   │
│   │  • Parses agent output for action JSON                           │   │
│   │  • Creates ActionContext                                         │   │
│   │  • Manages sessions                                              │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│            │                    │                       │               │
│            ▼                    ▼                       ▼               │
│   ┌──────────────┐    ┌──────────────────┐    ┌─────────────────┐      │
│   │   Session    │    │  ActionsManager  │    │ UIStateManager  │      │
│   │              │    │                  │    │                 │      │
│   │  AIClient ───┼───►│ templates Map    │    │ states in DB    │      │
│   │  ↓           │    │ instances Map    │    │                 │      │
│   │  SDK query() │    │                  │    │                 │      │
│   └──────────────┘    └────────┬─────────┘    └─────────────────┘      │
│                                │                                        │
│                                │ loads TEMPLATES / stores INSTANCES     │
│                                ▼                                        │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │              agent/custom_scripts/                               │   │
│   │                                                                  │   │
│   │   actions/              listeners/            ui-states/         │   │
│   │   ├── archive.ts        ├── tracker.ts        ├── dashboard.ts   │   │
│   │   └── forward.ts        └── watcher.ts        └── ...            │   │
│   │                                                                  │   │
│   │   These are TEMPLATES (files)                                    │   │
│   │   Agent CREATES them via Write tool + Skills                     │   │
│   │   Server LOADS and EXECUTES them                                 │   │
│   └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
           │
           │ database/IMAP
           ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATABASE / IMAP                                 │
│   ┌──────────────────┐    ┌──────────────────────────────────────────┐  │
│   │ DatabaseManager  │    │            ImapManager                    │  │
│   │ (SQLite)         │    │ (Real email operations)                   │  │
│   │ • emails table   │    │ • IDLE monitoring                         │  │
│   │ • ui_states      │    │ • archive/label/send                      │  │
│   └──────────────────┘    └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Architectural Insights

1. **Agent creates code, Server executes it**
   - Agent uses Skills to learn patterns
   - Agent uses Write tool to create handler files (TEMPLATES)
   - Server hot-reloads and executes handlers

2. **Templates vs Instances**
   - TEMPLATE = File on disk describing what CAN be done
   - INSTANCE = In-memory object with specific values for THIS invocation
   - Templates are permanent; Instances are per-conversation

3. **Agent doesn't "know" about buttons**
   - Agent outputs JSON in a specific format
   - Server parses JSON, creates instances
   - Frontend renders buttons from instances

4. **Context injection is the security boundary**
   - Handlers only get capabilities the server provides
   - No database access without context
   - No email sending without context

5. **MCP tools are read-only for agent**
   - Agent can search/read emails
   - Agent cannot mutate (send, archive, label)
   - Mutations require user-triggered actions

6. **Hot reload enables live development**
   - `?t=${Date.now()}` busts import cache
   - File watcher detects changes
   - Templates reloaded automatically

7. **Listeners run server-side, not in agent**
   - IMAP IDLE triggers listener checks
   - Server executes handlers with ListenerContext
   - Agent doesn't need to be running

---

## Implementation Status

The email-agent has the infrastructure for action buttons, but some bridging code is incomplete:

| Step | What's Needed | Status |
|------|---------------|--------|
| System prompt with format | Tell agent HOW to output actions | ❌ Missing |
| Parser function | Extract JSON from agent text | ❌ Missing |
| Register instances | `actionsManager.registerInstance()` | ✅ Exists (not called) |
| Send to frontend | `sendActionInstances()` | ✅ Exists (not called) |
| Frontend handler | Handle `action_instances` message | ❌ Missing |
| Button component | `<ActionButton>` | ✅ Exists |
| Execute handler | Handle click, run action | ✅ Exists |

### To Complete the Implementation

1. **Add to system prompt:**
```typescript
// In email-agent-prompt.ts
`When you want to offer an action button, output JSON:
{ "actions": [{ templateId, label, params }] }`
```

2. **Parse agent output (server):**
```typescript
function parseActionsFromText(text: string): ActionInstance[] {
  const match = text.match(/\{\s*"actions"\s*:\s*\[[\s\S]*?\]\s*\}/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);
  return parsed.actions.map(a => ({
    instanceId: crypto.randomUUID(),
    ...a
  }));
}
```

3. **Register and send (server):**
```typescript
const actions = parseActionsFromText(agentText);
for (const action of actions) {
  actionsManager.registerInstance(action);
}
ws.send(JSON.stringify({
  type: 'assistant_message',
  content: agentText.replace(/\{.*"actions".*\}/s, ''),
  actions: actions
}));
```

4. **Handle in frontend:**
```typescript
case 'assistant_message':
  setMessages(prev => [...prev, {
    ...message,
    actions: message.actions || []
  }]);
```

---

*Document Version: 2.0*
*Last Updated: January 2026*
