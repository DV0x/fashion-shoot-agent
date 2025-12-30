/**
 * SDKInstrumentor - Comprehensive instrumentation for Claude Agent SDK
 * Tracks events, costs, tool calls, and metrics from SDK messages
 *
 * SDK Message Structure:
 * - SDKAssistantMessage: { type: 'assistant', message: { content: [...], usage: {...} } }
 * - SDKUserMessage: { type: 'user', message: { content: [...] } }
 * - SDKSystemMessage: { type: 'system', subtype: 'init' | 'compact_boundary', ... }
 * - SDKResultMessage: { type: 'result', subtype: 'success' | 'error_*', usage: {...} }
 * - SDKPartialAssistantMessage: { type: 'stream_event', event: {...} }
 */

interface ToolCall {
  id: string;
  name: string;
  input: any;
  invokedAt: number;
  completedAt: number | null;
  result: any;
  error: boolean;
  duration_ms: number | null;
}

interface TraceEvent {
  timestamp: number;
  relativeMs: number;
  type: string;
  data: any;
}

export class SDKInstrumentor {
  private events: TraceEvent[] = [];
  private toolCalls: Map<string, ToolCall> = new Map();
  private completedToolCalls: ToolCall[] = [];
  private campaignId: string;
  private startTime: number;
  private totalCost: number = 0;
  private totalTokens = {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0
  };
  private processedMessageIds = new Set<string>();
  private sessionId: string = '';
  private turnCount: number = 0;

  constructor(campaignId: string, _prompt?: string) {
    this.campaignId = campaignId;
    this.startTime = Date.now();
    // Note: prompt parameter preserved for API compatibility but not currently used
  }

  /**
   * Add event to timeline
   */
  private addEvent(type: string, data: any): void {
    const timestamp = Date.now();
    this.events.push({
      timestamp,
      relativeMs: timestamp - this.startTime,
      type,
      data
    });
  }

  /**
   * Format timestamp for logging
   */
  private getTimestamp(): string {
    return new Date().toISOString().split('T')[1].split('.')[0];
  }

  /**
   * Process SDK messages - handles all message types with correct field paths
   */
  processMessage(message: any): void {
    // Deduplicate by uuid (SDK uses uuid, not id)
    const messageId = message.uuid || message.id;
    if (messageId && this.processedMessageIds.has(messageId)) {
      return;
    }

    const ts = this.getTimestamp();

    switch (message.type) {
      case 'system':
        this.handleSystemMessage(message, ts);
        break;

      case 'assistant':
        this.handleAssistantMessage(message, ts);
        break;

      case 'user':
        this.handleUserMessage(message, ts);
        break;

      case 'result':
        this.handleResultMessage(message, ts);
        break;

      case 'stream_event':
        // Stream events are too frequent to log individually
        // Just track that streaming is happening
        break;

      default:
        console.log(`[${ts}] 📨 UNKNOWN: ${message.type}`);
    }

    if (messageId) {
      this.processedMessageIds.add(messageId);
    }
  }

  /**
   * Handle system messages (init, compact_boundary)
   */
  private handleSystemMessage(message: any, ts: string): void {
    if (message.subtype === 'init') {
      this.sessionId = message.session_id || '';
      console.log(`[${ts}] 🚀 SESSION INIT`);
      console.log(`[${ts}]    Session: ${message.session_id}`);
      console.log(`[${ts}]    Model: ${message.model}`);
      console.log(`[${ts}]    Tools: ${message.tools?.slice(0, 5).join(', ')}${message.tools?.length > 5 ? '...' : ''}`);

      this.addEvent('SESSION_INIT', {
        sessionId: message.session_id,
        model: message.model,
        tools: message.tools,
        mcpServers: message.mcp_servers
      });
    } else if (message.subtype === 'compact_boundary') {
      console.log(`[${ts}] 📦 CONTEXT COMPACTED`);
      this.addEvent('CONTEXT_COMPACTED', {
        trigger: message.compact_metadata?.trigger,
        preTokens: message.compact_metadata?.pre_tokens
      });
    }
  }

  /**
   * Handle assistant messages (text, tool_use)
   * SDK structure: message.message.content = array of blocks
   */
  private handleAssistantMessage(message: any, ts: string): void {
    this.turnCount++;

    // Content is at message.message.content (Anthropic API structure)
    const content = message.message?.content;

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'text') {
          const text = block.text || '';
          const preview = text.substring(0, 150).replace(/\n/g, ' ');
          console.log(`[${ts}] 🤖 ASSISTANT: ${preview}${text.length > 150 ? '...' : ''}`);

          this.addEvent('ASSISTANT_TEXT', {
            preview: text.substring(0, 500),
            length: text.length
          });
        } else if (block.type === 'tool_use') {
          console.log(`[${ts}] 🔧 TOOL CALL: ${block.name}`);

          // Log input preview for important tools
          if (block.input) {
            const inputStr = JSON.stringify(block.input);
            if (inputStr.length < 200) {
              console.log(`[${ts}]    Input: ${inputStr}`);
            } else {
              console.log(`[${ts}]    Input: ${inputStr.substring(0, 150)}...`);
            }
          }

          // Track tool call for correlation with result
          this.toolCalls.set(block.id, {
            id: block.id,
            name: block.name,
            input: block.input,
            invokedAt: Date.now(),
            completedAt: null,
            result: null,
            error: false,
            duration_ms: null
          });

          this.addEvent('TOOL_INVOKED', {
            toolId: block.id,
            toolName: block.name,
            input: block.input
          });
        }
      }
    }

    // Usage is at message.message.usage (Anthropic API structure)
    const usage = message.message?.usage;
    if (usage) {
      this.totalTokens.input += usage.input_tokens || 0;
      this.totalTokens.output += usage.output_tokens || 0;
      this.totalTokens.cacheRead += usage.cache_read_input_tokens || 0;
      this.totalTokens.cacheWrite += usage.cache_creation_input_tokens || 0;

      console.log(`[${ts}] 📊 TOKENS: in=${usage.input_tokens || 0} out=${usage.output_tokens || 0} cache_read=${usage.cache_read_input_tokens || 0}`);
    }
  }

  /**
   * Handle user messages (tool_result, text, image)
   * SDK structure: message.message.content = array of blocks
   */
  private handleUserMessage(message: any, ts: string): void {
    const content = message.message?.content;

    if (Array.isArray(content)) {
      for (const block of content) {
        if (block.type === 'tool_result') {
          const toolCall = this.toolCalls.get(block.tool_use_id);
          const toolName = toolCall?.name || 'unknown';
          const duration = toolCall ? Date.now() - toolCall.invokedAt : 0;

          // Update tool call with result
          if (toolCall) {
            toolCall.completedAt = Date.now();
            toolCall.result = block.content;
            toolCall.error = block.is_error || false;
            toolCall.duration_ms = duration;
            this.completedToolCalls.push(toolCall);
            this.toolCalls.delete(block.tool_use_id);
          }

          const resultStr = typeof block.content === 'string'
            ? block.content
            : JSON.stringify(block.content);
          const preview = resultStr.substring(0, 100);

          if (block.is_error) {
            console.log(`[${ts}] ❌ TOOL ERROR: ${toolName} (${duration}ms)`);
            console.log(`[${ts}]    ${preview}${resultStr.length > 100 ? '...' : ''}`);
          } else {
            console.log(`[${ts}] ✅ TOOL RESULT: ${toolName} (${duration}ms)`);
            if (resultStr.length < 200) {
              console.log(`[${ts}]    ${resultStr}`);
            } else {
              console.log(`[${ts}]    ${preview}... (${resultStr.length} chars)`);
            }
          }

          this.addEvent('TOOL_RESULT', {
            toolId: block.tool_use_id,
            toolName,
            duration_ms: duration,
            isError: block.is_error || false,
            resultPreview: preview
          });
        } else if (block.type === 'text') {
          console.log(`[${ts}] 👤 USER: ${block.text?.substring(0, 100) || ''}`);
        } else if (block.type === 'image') {
          console.log(`[${ts}] 🖼️  IMAGE: ${block.source?.media_type || 'unknown'}`);
        }
      }
    }
  }

  /**
   * Handle result messages (success, error_*)
   * SDK structure: usage and cost are directly on the message
   */
  private handleResultMessage(message: any, ts: string): void {
    if (message.subtype === 'success') {
      this.totalCost = message.total_cost_usd || 0;

      console.log(`[${ts}] ✨ SESSION COMPLETE`);
      console.log(`[${ts}]    Duration: ${message.duration_ms}ms`);
      console.log(`[${ts}]    Cost: $${this.totalCost.toFixed(4)}`);
      console.log(`[${ts}]    Turns: ${message.num_turns || 0}`);
      console.log(`[${ts}]    Tools used: ${this.completedToolCalls.length}`);

      if (message.usage) {
        console.log(`[${ts}]    Total tokens: in=${message.usage.input_tokens || 0} out=${message.usage.output_tokens || 0}`);
      }

      this.addEvent('SESSION_COMPLETE', {
        duration_ms: message.duration_ms,
        duration_api_ms: message.duration_api_ms,
        num_turns: message.num_turns,
        total_cost_usd: this.totalCost,
        usage: message.usage,
        toolCallCount: this.completedToolCalls.length
      });
    } else {
      console.log(`[${ts}] ❌ SESSION ERROR: ${message.subtype}`);
      if (message.errors) {
        message.errors.forEach((err: string) => {
          console.log(`[${ts}]    ${err}`);
        });
      }

      this.addEvent('SESSION_ERROR', {
        subtype: message.subtype,
        errors: message.errors,
        duration_ms: message.duration_ms
      });
    }
  }

  /**
   * Get simple report
   */
  getReport(): any {
    const duration = Date.now() - this.startTime;

    return {
      campaignId: this.campaignId,
      sessionId: this.sessionId,
      totalEvents: this.events.length,
      toolCalls: this.completedToolCalls.length,
      totalCost: `$${this.totalCost.toFixed(4)}`,
      duration: `${duration}ms`,
      tokens: this.totalTokens,
      timeline: this.events
    };
  }

  /**
   * Get cost breakdown
   */
  getCostBreakdown(): any {
    return {
      total: this.totalCost,
      totalFormatted: `$${this.totalCost.toFixed(4)}`,
      events: this.events.length,
      tools: this.completedToolCalls.length,
      tokens: this.totalTokens
    };
  }

  /**
   * Get detailed campaign report
   */
  getCampaignReport(): any {
    const duration = Date.now() - this.startTime;

    return {
      campaignId: this.campaignId,
      sessionId: this.sessionId,
      startTime: new Date(this.startTime).toISOString(),
      endTime: new Date().toISOString(),
      totalDuration_ms: duration,
      totalCost_usd: this.totalCost,
      tokens: this.totalTokens,
      summary: {
        totalEvents: this.events.length,
        totalTools: this.completedToolCalls.length,
        totalTurns: this.turnCount
      },
      toolCalls: this.completedToolCalls.map(t => ({
        name: t.name,
        duration_ms: t.duration_ms,
        error: t.error
      }))
    };
  }

  /**
   * Get events timeline
   */
  getEventsTimeline(): TraceEvent[] {
    return [...this.events];
  }

  /**
   * Get tool calls summary
   */
  getToolCallsSummary(): { name: string; count: number; totalDuration: number; errors: number }[] {
    const summary = new Map<string, { count: number; totalDuration: number; errors: number }>();

    for (const tool of this.completedToolCalls) {
      const existing = summary.get(tool.name) || { count: 0, totalDuration: 0, errors: 0 };
      existing.count++;
      existing.totalDuration += tool.duration_ms || 0;
      if (tool.error) existing.errors++;
      summary.set(tool.name, existing);
    }

    return Array.from(summary.entries()).map(([name, stats]) => ({
      name,
      ...stats
    }));
  }
}
