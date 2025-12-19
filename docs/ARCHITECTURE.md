# Fashion Shoot Agent - Architecture Document

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Project Structure](#project-structure)
4. [Core Components](#core-components)
5. [Claude Agent SDK Integration](#claude-agent-sdk-integration)
6. [Data Flow](#data-flow)
7. [Session Management](#session-management)
8. [Instrumentation & Cost Tracking](#instrumentation--cost-tracking)
9. [API Reference](#api-reference)
10. [Configuration](#configuration)
11. [SDK Documentation Reference](#sdk-documentation-reference)
12. [Extension Points](#extension-points)
13. [Current State & Roadmap](#current-state--roadmap)

---

## Overview

The Fashion Shoot Agent is an AI-powered fashion photoshoot generation system built on the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`). It provides a REST API layer that orchestrates multi-turn AI conversations with session persistence, cost tracking, and extensible tool integration.

### Purpose

Transform reference images and prompts into editorial photography and video content through a multi-stage AI pipeline:

1. Reference image analysis
2. Hero image generation
3. Contact sheet creation (2×3 grid of keyframes)
4. Video generation from keyframes
5. Video stitching with easing transitions

### Technology Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js + TypeScript (ES2022) |
| SDK | `@anthropic-ai/claude-agent-sdk` v0.1.73 |
| Web Framework | Express.js 4.x |
| Schema Validation | Zod |
| Build Tool | tsx (TypeScript Execute) |
| Module System | ESNext (ES Modules) |

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              Client Applications                         │
│                     (Web App, CLI, Mobile, Integrations)                │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/REST
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           Express HTTP Server                            │
│                          (sdk-server.ts:3002)                           │
│  ┌─────────────┬─────────────┬──────────────────┬───────────────────┐  │
│  │   /health   │  /sessions  │    /generate     │ /sessions/:id/... │  │
│  └─────────────┴─────────────┴──────────────────┴───────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    │                 │                 │
                    ▼                 ▼                 ▼
         ┌──────────────────┐  ┌─────────────┐  ┌──────────────────┐
         │    AIClient      │  │  Session    │  │  SDKInstrumentor │
         │  (ai-client.ts)  │  │  Manager    │  │ (instrumentor.ts)│
         │                  │  │             │  │                  │
         │ • SDK wrapper    │  │ • Lifecycle │  │ • Event tracking │
         │ • Query exec     │  │ • Persist   │  │ • Cost tracking  │
         │ • MCP servers    │  │ • Forking   │  │ • Token usage    │
         └────────┬─────────┘  └──────┬──────┘  └──────────────────┘
                  │                   │
                  │                   │
                  ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Claude Agent SDK                                  │
│                   (@anthropic-ai/claude-agent-sdk)                      │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  query() - Async generator interface for streaming messages      │   │
│  │  • Session management (resume, fork)                             │   │
│  │  • Built-in tools (Read, Write, Glob, Bash, Task, Skill)        │   │
│  │  • MCP server integration                                        │   │
│  │  • Permission system                                             │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ API Calls
                                      ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         Claude API (Anthropic)                          │
│                        claude-sonnet-4-20250514                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
fashion-shoot-agent/
├── server/                          # HTTP Server Layer
│   ├── sdk-server.ts               # Express app entry point
│   └── lib/                        # Core libraries
│       ├── ai-client.ts            # Claude SDK wrapper
│       ├── session-manager.ts      # Session persistence
│       ├── instrumentor.ts         # Cost & metrics tracking
│       └── orchestrator-prompt.ts  # System prompt definition
│
├── agent/                           # Agent Configuration
│   └── .claude/                    # SDK configuration directory
│       ├── settings.json           # Project-level settings
│       ├── skills/                 # Agent skills (knowledge + actions)
│       └── agents/                 # Subagent definitions
│
├── claude_sdk/                      # SDK Documentation (18 files)
│   ├── overview.md                 # SDK capabilities
│   ├── typescript_sdk.md           # Full API reference
│   ├── session_management.md       # Sessions, resume, fork
│   ├── mcp.md                      # Model Context Protocol
│   ├── custom_tools.md             # Creating MCP tools
│   ├── Agent_skills.md             # Skill system
│   ├── permissions.md              # Permission modes
│   ├── builtinsdktools.md          # Built-in tool reference
│   ├── subagents.md                # Specialized agents
│   └── ...                         # Additional docs
│
├── sessions/                        # Persisted session data (auto-created)
│   └── session_*.json              # Individual session files
│
├── docs/                            # Project documentation
│   ├── ARCHITECTURE.md             # This document
│   ├── IMPLEMENTATION_PLAN.md      # Feature roadmap
│   └── EASING_CURVES.md            # Video transition specs
│
├── workflow-docs/                   # Pipeline specifications
│   ├── workflow.md
│   └── CONTACT_SHEET_*.md          # Contact sheet workflows
│
├── package.json                     # Dependencies & scripts
├── tsconfig.json                    # TypeScript configuration
└── .env                             # Environment variables
```

---

## Core Components

### 1. Express HTTP Server (`sdk-server.ts`)

The main entry point that exposes the agent functionality via REST endpoints.

**Responsibilities:**
- HTTP request/response handling
- CORS configuration for cross-origin access
- Request validation
- Response aggregation from SDK streams
- Error handling and logging

**Key Implementation Details:**

```typescript
// Server initialization
const app = express();
app.use(cors());
app.use(express.json());

// Generation endpoint processes SDK message stream
for await (const result of aiClient.queryWithSession(prompt, sessionId)) {
  const { message } = result;
  messages.push(message);
  instrumentor.processMessage(message);  // Track costs

  // Log assistant messages for debugging
  if (message.type === 'assistant') {
    // Extract and log text content
  }
}
```

---

### 2. AIClient (`ai-client.ts`)

Wrapper class around the Claude Agent SDK that handles configuration and session-aware query execution.

**Class Structure:**

```typescript
class AIClient {
  private defaultOptions: Partial<Options>;
  private sessionManager: SessionManager;

  // Create async generator for SDK prompt input
  private async *createPromptGenerator(prompt: string, signal?: AbortSignal);

  // Session-aware query with automatic session management
  async *queryWithSession(prompt: string, sessionId?: string, metadata?: any);

  // Add MCP server for custom tools
  addMcpServer(name: string, server: any);

  // Access session manager
  getSessionManager(): SessionManager;
}
```

**Default SDK Configuration:**

```typescript
{
  cwd: 'agent/',                      // Project directory with .claude/
  model: 'claude-sonnet-4-20250514',  // Claude Sonnet 4
  maxTurns: 20,                       // Conversation limit
  settingSources: ['user', 'project'], // Load filesystem settings
  allowedTools: [
    'Read',    // File reading
    'Write',   // File writing
    'Glob',    // Pattern-based file search
    'Bash',    // Shell command execution
    'Task',    // Subagent delegation
    'Skill'    // Skill invocation
  ],
  systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT
}
```

**Prompt Generator Pattern:**

The SDK uses async generators for streaming input. The prompt generator:
1. Yields the initial user message
2. Stays alive during tool execution (critical for multi-turn)
3. Aborts cleanly when query completes

```typescript
private async *createPromptGenerator(prompt: string, signal?: AbortSignal) {
  yield {
    type: "user" as const,
    message: { role: "user" as const, content: prompt },
    parent_tool_use_id: null
  };

  // Keep generator alive during tool execution
  if (signal) {
    await new Promise<void>((resolve) => {
      signal.addEventListener('abort', () => resolve());
    });
  } else {
    await new Promise<void>(() => {});
  }
}
```

---

### 3. SessionManager (`session-manager.ts`)

Manages the lifecycle of conversation sessions with persistence and cleanup.

**Session Data Structure:**

```typescript
interface SessionInfo {
  id: string;                    // Custom session ID (session_uuid)
  sdkSessionId?: string;         // SDK-provided session ID
  createdAt: Date;
  lastAccessedAt: Date;
  metadata: {
    url?: string;                // Reference URL
    campaignName?: string;       // Campaign identifier
    status: 'active' | 'completed' | 'error';
    messageCount: number;
    context?: any;               // Custom context data
    // Fork support
    forkedFrom?: string;         // Parent session if forked
    forkTimestamp?: string;
    forkPurpose?: string;        // e.g., "emotional-angle-variant"
  };
  messages: any[];               // Full message history
  turnCount: number;             // Assistant turn counter
}
```

**Key Methods:**

| Method | Purpose |
|--------|---------|
| `createSession(metadata)` | Create new session with UUID |
| `getOrCreateSession(id, metadata)` | Get existing or create new |
| `updateSdkSessionId(id, sdkId)` | Link SDK session to custom session |
| `addMessage(id, message)` | Append message to history |
| `getResumeOptions(id)` | Get SDK resume options |
| `saveSession(id)` | Persist to disk |
| `loadSession(id)` | Load from disk |
| `completeSession(id)` | Mark session complete |
| `getSessionStats(id)` | Get statistics |
| `getSessionForks(baseId)` | Get all forks of a session |
| `getSessionFamily(id)` | Get base + all forks |

**Persistence:**
- Sessions stored in `sessions/` directory as JSON files
- Auto-save every 10 messages
- 24-hour maximum session age
- 1-hour inactivity timeout for non-active sessions
- Hourly cleanup interval

---

### 4. SDKInstrumentor (`instrumentor.ts`)

Tracks events, costs, and metrics from SDK message streams.

**Tracked Data:**

```typescript
class SDKInstrumentor {
  private events: any[];           // Event timeline
  private agentCalls: any[];       // Subagent invocations
  private toolCalls: any[];        // Tool usage
  private campaignId: string;      // Session identifier
  private startTime: number;       // Start timestamp
  private totalCost: number;       // SDK-provided cost
  private processedMessageIds: Set<string>;  // Deduplication
}
```

**Message Processing:**

```typescript
processMessage(message: any): void {
  switch (message.type) {
    case 'system':
      // Track init and tool calls
      if (message.subtype === 'init') {
        this.logEvent('INIT', { sessionId: message.session_id });
      }
      if (message.tool_name) {
        this.toolCalls.push({ timestamp, tool: message.tool_name, details });
      }
      break;

    case 'assistant':
      // Extract token usage
      if (message.usage) {
        this.logEvent('USAGE', {
          tokens: {
            input: message.usage.input_tokens,
            output: message.usage.output_tokens,
            cache_read: message.usage.cache_read_input_tokens,
            cache_write: message.usage.cache_creation_input_tokens
          }
        });
      }
      break;

    case 'result':
      // Extract SDK-provided cost (authoritative source)
      if (message.subtype === 'success') {
        this.totalCost = message.total_cost_usd || 0;
      }
      break;
  }
}
```

**Reports:**

- `getReport()` - Summary with timeline
- `getCostBreakdown()` - Cost analysis
- `getCampaignReport()` - Detailed metrics
- `getEventsTimeline()` - Full event history

---

### 5. System Prompt (`orchestrator-prompt.ts`)

Defines the agent's persona and workflow instructions.

**Current Prompt:**

```typescript
export const ORCHESTRATOR_SYSTEM_PROMPT = `You are a Fashion Shoot Agent.

Your job is to help users create AI-powered fashion photoshoots.

## Available Tools
- Read/Write files
- Generate images via MCP (when configured)

## Workflow
1. Receive user request (photo + costumes + style)
2. Plan the photoshoot (camera angles, poses)
3. Generate contact sheet (2x3 grid of keyframes)
4. Generate videos from keyframes
5. Stitch videos with easing transitions
6. Return results

## For Now
Just acknowledge requests and describe what you would do.
When MCPs are configured, you'll be able to:
- Generate images via nano-banana MCP
- Generate videos via kling-video MCP
- Stitch videos via ffmpeg utility
`;
```

---

## Claude Agent SDK Integration

### SDK Message Types

The SDK returns an async iterator of `SDKMessage` union types:

| Type | Subtype | Description |
|------|---------|-------------|
| `system` | `init` | Session initialization with `session_id` |
| `system` | - | Tool execution notifications |
| `assistant` | - | Model responses with `usage` metrics |
| `user` | - | User input messages |
| `result` | `success` | Completion with `total_cost_usd` |
| `result` | `error` | Error information |

### Key SDK Features Used

#### 1. Async Generator Query Interface

```typescript
import { query } from '@anthropic-ai/claude-agent-sdk';

for await (const message of query({ prompt, options })) {
  // Process each message as it arrives
}
```

#### 2. Session Resumption

```typescript
// Resume existing session
const options = {
  resume: sdkSessionId,  // SDK session ID from previous query
  // ... other options
};
```

#### 3. Built-in Tools

| Tool | Purpose |
|------|---------|
| `Read` | Read files (text, images, PDFs) |
| `Write` | Write/overwrite files |
| `Glob` | Pattern-based file search |
| `Bash` | Execute shell commands |
| `Task` | Delegate to subagents |
| `Skill` | Invoke agent skills |

#### 4. MCP Server Integration

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';

const server = createSdkMcpServer({
  name: 'image-gen',
  tools: [
    tool('generate', 'Generate image', schema, handler)
  ]
});

aiClient.addMcpServer('image-gen', server);
```

#### 5. Skill System

Skills are loaded from `.claude/skills/` directories:

```
agent/.claude/skills/
├── editorial-photography/     # Knowledge skill
│   ├── SKILL.md              # Skill definition
│   └── core/                 # Knowledge files
└── fashion-pipeline/          # Action skill
    ├── SKILL.md
    └── scripts/              # Executable scripts
```

---

## Data Flow

### Generation Request Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ 1. Client POST /generate { prompt, sessionId? }                         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 2. SessionManager.getOrCreateSession()                                  │
│    - Load from memory/disk or create new                                │
│    - Get SDK resume options if session exists                           │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 3. AIClient.queryWithSession()                                          │
│    - Create prompt generator (async iterator)                           │
│    - Configure SDK options with resume if available                     │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 4. SDK query() - Message Stream                                         │
│    ┌────────────────────────────────────────────────────────────────┐  │
│    │ system.init → Capture SDK session ID                           │  │
│    │ assistant   → Process content, extract usage                   │  │
│    │ system      → Tool execution notifications                     │  │
│    │ assistant   → More responses after tool results                │  │
│    │ result      → Extract total_cost_usd                           │  │
│    └────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 5. For each message:                                                    │
│    - SessionManager.addMessage() - Store in history                     │
│    - SDKInstrumentor.processMessage() - Track metrics                   │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ 6. Aggregate Response                                                   │
│    - Extract text from assistant messages                               │
│    - Get session stats and cost breakdown                               │
│    - Return JSON to client                                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Session Continuation Flow

```
POST /sessions/:id/continue
         │
         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Load existing session → Get SDK session ID → Pass as resume option      │
│                                                                         │
│ SDK maintains full conversation context across queries                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Session Management

### Session Lifecycle

```
┌─────────┐    Create     ┌─────────┐    Complete    ┌───────────┐
│   New   │ ───────────▶  │ Active  │ ─────────────▶ │ Completed │
└─────────┘               └─────────┘                └───────────┘
                               │                           │
                               │ Error                     │
                               ▼                           │
                          ┌─────────┐                      │
                          │  Error  │                      │
                          └─────────┘                      │
                               │                           │
                               ▼                           ▼
                          ┌─────────────────────────────────────┐
                          │            Cleanup                  │
                          │  (24h max age, 1h inactive)         │
                          └─────────────────────────────────────┘
```

### Session Forking

Forking allows exploring alternative creative directions:

```typescript
// Session family structure
{
  baseSession: SessionInfo,    // Original session
  forks: SessionInfo[]         // Creative variants
}

// Fork metadata
{
  forkedFrom: 'session_abc123',
  forkTimestamp: '2025-01-15T10:30:00Z',
  forkPurpose: 'emotional-angle-variant'
}
```

### Persistence Strategy

| Event | Action |
|-------|--------|
| Session created | Save immediately |
| SDK session linked | Save immediately |
| Every 10 messages | Auto-save |
| Session completed | Save immediately |
| Server restart | Load from disk on access |

---

## Instrumentation & Cost Tracking

### Metrics Collected

| Metric | Source | Description |
|--------|--------|-------------|
| `total_cost_usd` | `result.success` | SDK-calculated cost |
| `input_tokens` | `assistant.usage` | Input token count |
| `output_tokens` | `assistant.usage` | Output token count |
| `cache_read_input_tokens` | `assistant.usage` | Cached input tokens |
| `cache_creation_input_tokens` | `assistant.usage` | New cache writes |
| `duration_ms` | `result.success` | Total query duration |
| `num_turns` | `result.success` | Number of turns |
| Tool calls | `system` messages | Tool invocations |

### Cost Breakdown Example

```json
{
  "total": 0.0234,
  "totalFormatted": "$0.0234",
  "events": 15,
  "tools": 3,
  "agents": 0
}
```

### Campaign Report Example

```json
{
  "campaignId": "session-1705312800000",
  "startTime": "2025-01-15T10:00:00.000Z",
  "endTime": "2025-01-15T10:00:45.000Z",
  "totalDuration_ms": 45000,
  "totalCost_usd": 0.0234,
  "summary": {
    "totalEvents": 15,
    "totalTools": 3,
    "totalAgents": 0,
    "avgResponseTime_ms": 3000
  }
}
```

---

## API Reference

### Endpoints

#### `GET /health`

Health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "agent": "fashion-shoot-agent",
  "timestamp": "2025-01-15T10:00:00.000Z",
  "config": {
    "hasAnthropicKey": true,
    "hasFalKey": true,
    "port": 3002
  }
}
```

#### `GET /sessions`

List all active sessions.

**Response:**
```json
{
  "success": true,
  "count": 2,
  "sessions": [
    {
      "id": "session_abc123",
      "sdkSessionId": "sdk_xyz789",
      "createdAt": "2025-01-15T10:00:00.000Z",
      "lastAccessedAt": "2025-01-15T10:30:00.000Z",
      "metadata": {
        "status": "active",
        "messageCount": 25
      },
      "turnCount": 5
    }
  ]
}
```

#### `GET /sessions/:id`

Get session statistics.

**Response:**
```json
{
  "success": true,
  "session": {
    "id": "session_abc123",
    "sdkSessionId": "sdk_xyz789",
    "duration": 1800000,
    "messageCount": 25,
    "turnCount": 5,
    "status": "active",
    "lastActive": "2025-01-15T10:30:00.000Z",
    "isFork": false
  }
}
```

#### `POST /generate`

Main generation endpoint.

**Request:**
```json
{
  "prompt": "Create a fashion photoshoot with a model in a red dress",
  "sessionId": "optional-session-id"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session-1705312800000",
  "response": "Final assistant response text",
  "fullResponse": "All responses joined with ---",
  "sessionStats": {
    "id": "session-1705312800000",
    "turnCount": 3,
    "messageCount": 8
  },
  "instrumentation": {
    "campaignId": "session-1705312800000",
    "totalCost_usd": 0.0234,
    "costBreakdown": {
      "total": 0.0234,
      "tools": 2
    }
  }
}
```

#### `POST /sessions/:id/continue`

Continue an existing session with a new prompt.

**Request:**
```json
{
  "prompt": "Now generate videos from the contact sheet"
}
```

**Response:**
```json
{
  "success": true,
  "sessionId": "session_abc123",
  "response": "Latest assistant response",
  "sessionStats": { ... },
  "messageCount": 12
}
```

---

## Configuration

### Environment Variables (`.env`)

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...      # Claude API key

# Optional
FAL_KEY=...                        # FAL.ai API key (for image/video gen)
PORT=3002                          # Server port
CLAUDE_CODE_MAX_OUTPUT_TOKENS=16384
NODE_ENV=development
```

### TypeScript Configuration (`tsconfig.json`)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist"
  },
  "include": ["server/**/*", "agent/**/*"]
}
```

### SDK Options

| Option | Default | Description |
|--------|---------|-------------|
| `cwd` | `agent/` | Working directory for `.claude/` |
| `model` | `claude-sonnet-4-20250514` | Claude model to use |
| `maxTurns` | `20` | Maximum conversation turns |
| `settingSources` | `['user', 'project']` | Settings file locations |
| `allowedTools` | See above | Enabled tool list |
| `systemPrompt` | `ORCHESTRATOR_SYSTEM_PROMPT` | Agent instructions |

---

## SDK Documentation Reference

The `claude_sdk/` directory contains 18 documentation files:

### Core Concepts

| File | Content |
|------|---------|
| `overview.md` | SDK capabilities and use cases |
| `typescript_sdk.md` | Complete TypeScript API reference |
| `session_management.md` | Sessions, resume, and forking |

### Tool Integration

| File | Content |
|------|---------|
| `mcp.md` | Model Context Protocol overview |
| `custom_tools.md` | Creating SDK MCP servers |
| `builtinsdktools.md` | Built-in tool documentation |

### Advanced Features

| File | Content |
|------|---------|
| `Agent_skills.md` | Skill system configuration |
| `subagents.md` | Specialized agent delegation |
| `permissions.md` | Permission modes and hooks |
| `streaming_input.md` | Async generator patterns |
| `tracking_costs.md` | Token usage and cost analysis |
| `system_prompts.md` | Customizing Claude behavior |

### Operations

| File | Content |
|------|---------|
| `sdk_hosting.md` | Deployment strategies |
| `skills_troubleshooting.md` | Common issues and solutions |
| `migration_to_agent_sdk.md` | Upgrading from old SDK |

---

## Extension Points

### 1. Adding MCP Servers

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

const imageGenServer = createSdkMcpServer({
  name: 'image-gen',
  tools: [
    tool(
      'generate_image',
      'Generate an image from a prompt',
      { prompt: z.string(), style: z.string().optional() },
      async ({ prompt, style }) => {
        // Call FAL.ai or other image generation API
        return { imageUrl: '...' };
      }
    )
  ]
});

aiClient.addMcpServer('image-gen', imageGenServer);
```

### 2. Adding Skills

Create `.claude/skills/my-skill/SKILL.md`:

```markdown
---
name: my-skill
description: Does something useful
tools:
  - Bash
  - Read
---

# My Skill Instructions

When invoked, do the following...
```

### 3. Adding Subagents

Create `.claude/agents/my-agent.md`:

```markdown
---
name: my-agent
description: Specialized agent for X
tools:
  - Read
  - Write
---

# Agent Instructions

You are a specialized agent for...
```

### 4. Custom Permission Logic

```typescript
const options = {
  canUseTool: (tool, input) => {
    // Custom permission logic
    if (tool === 'Bash' && input.command.includes('rm')) {
      return false;  // Deny destructive commands
    }
    return true;
  }
};
```

---

## Current State & Roadmap

### Current Implementation Status

| Component | Status | Notes |
|-----------|--------|-------|
| HTTP Server | ✅ Complete | All endpoints functional |
| AIClient | ✅ Complete | SDK integration working |
| SessionManager | ✅ Complete | Persistence and forking |
| Instrumentor | ✅ Complete | Cost tracking working |
| System Prompt | ⚠️ Placeholder | Describes workflow only |
| Image Generation | ❌ Not Started | MCP server needed |
| Video Generation | ❌ Not Started | MCP server needed |
| Video Stitching | ❌ Not Started | FFmpeg integration needed |
| Skills | ❌ Not Started | Directory structure planned |

### Planned Implementation (from `IMPLEMENTATION_PLAN.md`)

**Phase 1:** Project Setup
- Skill directory structure
- Dependency configuration

**Phase 2:** Knowledge Skill (`editorial-photography`)
- Camera fundamentals
- Prompt assembly patterns
- Style templates

**Phase 3:** Action Skill (`fashion-pipeline`)
- Image generation (FAL.ai)
- Video generation (Kling 2.6)
- Video stitching (FFmpeg)

**Phase 4:** Orchestrator Enhancement
- Updated system prompt
- Pipeline coordination

**Phase 5:** Session Integration
- Asset tracking
- Multi-stage workflow state

**Phase 6:** Testing & Validation

---

## Summary

The Fashion Shoot Agent demonstrates a production-ready architecture for building AI agents on the Claude Agent SDK:

- **Robust session management** with persistence and forking
- **Complete instrumentation** for monitoring and cost tracking
- **Extensible architecture** via MCP servers and Skills
- **Clean separation** between HTTP layer and SDK integration
- **RESTful API** for easy integration with clients

The infrastructure is complete and ready for implementing the fashion photoshoot pipeline through MCP server integrations and skill definitions.
