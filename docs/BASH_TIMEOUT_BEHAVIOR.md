# Bash Tool Timeout & Background Behavior

## Overview

The Claude Agent SDK's Bash tool has automatic timeout handling that converts long-running commands to background tasks. This document explains the behavior observed during video generation in the fashion shoot pipeline.

## Default Timeout

| Setting | Value |
|---------|-------|
| Default timeout | 120,000ms (2 minutes) |
| Maximum timeout | 600,000ms (10 minutes) |

## Auto-Background Behavior

When a Bash command exceeds the timeout, the SDK **automatically converts it to a background task** instead of failing. The agent then uses the `TaskOutput` tool to poll for results.

### Flow Diagram

```
Bash command starts
       │
       ▼
┌──────────────────────────────────────────────┐
│  Command runs...                             │
│  2 minutes pass (default timeout)            │
│  Command still running                       │
└──────────────────────────────────────────────┘
       │
       ▼
Bash tool auto-converts to background mode
       │
       ▼
Returns immediately with:
  "Command running in background with ID: <task_id>"
  "Output is being written to: /tmp/claude/.../tasks/<task_id>.output"
       │
       ▼
Agent calls TaskOutput tool to poll for results
       │
       ▼
TaskOutput returns status + output when command completes
```

## Real Example from Video Generation

From `output.md` during video generation (~2 min per video):

```
[06:51:27] 🔧 TOOL CALL: Bash
           Input: generate-video.ts command

[06:53:29] ✅ TOOL RESULT: Bash (121675ms ≈ 2 min)
           "Command running in background with ID: b4003ee.
            Output is being written to: /tmp/claude/.../tasks/b4003ee.output"
           ↑ Hit 2-min timeout, auto-backgrounded

[06:53:33] 🔧 TOOL CALL: TaskOutput
           Input: {"task_id":"b4003ee","block":false,"timeout":30000}
           ↑ Agent polls for the result

[06:53:33] ✅ TOOL RESULT: TaskOutput (25ms)
           <retrieval_status>success</retrieval_status>
           ↑ Task already completed, result returned instantly
```

## TaskOutput Tool

Used to retrieve output from background Bash tasks.

### Parameters

```typescript
{
  "task_id": "b4003ee",    // Task ID from backgrounded Bash command
  "block": false,          // false = check once, true = wait until done
  "timeout": 30000         // Max wait time in milliseconds
}
```

### Response

```xml
<retrieval_status>success</retrieval_status>
<task_id>b4003ee</task_id>
<task_type>local_bash</task_type>
<status>completed</status>
<exit_code>0</exit_code>
<output>... command output ...</output>
```

## Tool Naming Clarification

| Tool | Purpose |
|------|---------|
| `Task` | Spawn a subagent to handle complex tasks |
| `TaskOutput` | Poll/retrieve output from background Bash commands |

These are different tools despite similar naming.

## Configuring Longer Timeouts

To avoid auto-backgrounding, set a longer timeout in the Bash command:

### Option 1: In System Prompt

Instruct the agent to use longer timeouts for specific commands:

```
When running video generation commands (generate-video.ts, ffmpeg):
- Set timeout to 300000 (5 minutes)
- Example: {"command": "...", "timeout": 300000}
```

### Option 2: Agent Decides Per-Command

The agent can specify timeout per Bash call:

```typescript
{
  "command": "npx tsx generate-video.ts ...",
  "timeout": 300000,  // 5 minutes
  "description": "Generate video from frame"
}
```

### Option 3: PreToolUse Hook (Programmatic)

Auto-extend timeout for matching commands:

```typescript
hooks: {
  PreToolUse: [{
    matcher: 'Bash',
    hooks: [async (input) => {
      if (input.tool_input.command.includes('generate-video')) {
        return {
          continue: true,
          hookSpecificOutput: {
            updatedInput: { ...input.tool_input, timeout: 360000 }
          }
        };
      }
      return { continue: true };
    }]
  }]
}
```

## When Auto-Background is Fine

The auto-background + TaskOutput polling approach works correctly. It adds:

- 1 extra tool call per long command (TaskOutput)
- Minimal token overhead
- Slight complexity

For the fashion shoot pipeline, this behavior is acceptable since all 6 videos generated successfully despite hitting the timeout.

## When to Extend Timeout

Consider extending timeout if:

- You want cleaner logs (fewer tool calls)
- You want simpler agent behavior
- Commands consistently take 2-5 minutes

The 10-minute maximum (600,000ms) covers most use cases.
