import { query } from '@anthropic-ai/claude-agent-sdk';
import type { Options } from '@anthropic-ai/claude-agent-sdk';
import { resolve } from 'path';
import { SessionManager } from './session-manager.js';
import { ORCHESTRATOR_SYSTEM_PROMPT } from './orchestrator-prompt.js';

/**
 * AIClient - Wrapper for Claude SDK
 * Handles SDK configuration, streaming, and session management
 */
export class AIClient {
  private defaultOptions: Partial<Options>;
  private sessionManager: SessionManager;

  constructor(sessionManager?: SessionManager) {
    // Ensure cwd points to agent directory where .claude/ is located
    const projectRoot = process.cwd().endsWith('/server')
      ? resolve(process.cwd(), '..', 'agent')
      : resolve(process.cwd(), 'agent');

    this.defaultOptions = {
      cwd: projectRoot,
      model: 'claude-sonnet-4-20250514',
      maxTurns: 20,
      settingSources: ['user', 'project'],
      allowedTools: [
        "Read",
        "Write",
        "Glob",
        "Bash",
        "Task",
        "Skill"
      ],
      systemPrompt: ORCHESTRATOR_SYSTEM_PROMPT
    };

    this.sessionManager = sessionManager || new SessionManager();
    console.log(`🎬 AI Client initialized with cwd: ${projectRoot}`);
  }

  /**
   * Create async generator for SDK prompt
   * Critical: Generator must stay alive during tool execution
   */
  private async *createPromptGenerator(prompt: string, signal?: AbortSignal) {
    yield {
      type: "user" as const,
      message: { role: "user" as const, content: prompt },
      parent_tool_use_id: null
    } as any;

    // Keep generator alive during tool execution
    if (signal) {
      await new Promise<void>((resolve) => {
        signal.addEventListener('abort', () => resolve());
      });
    } else {
      await new Promise<void>(() => {});
    }
  }

  /**
   * Session-aware query with automatic session management
   */
  async *queryWithSession(prompt: string, sessionId?: string, metadata?: any) {
    const session = await this.sessionManager.getOrCreateSession(sessionId, metadata);
    const resumeOptions = this.sessionManager.getResumeOptions(session.id);
    const abortController = new AbortController();

    const queryOptions = {
      ...this.defaultOptions,
      ...resumeOptions,
      abortController
    };

    console.log(`🔄 Query with session ${session.id}`, {
      hasResume: !!resumeOptions.resume,
      turnCount: session.turnCount
    });

    try {
      const promptGenerator = this.createPromptGenerator(prompt, abortController.signal);

      for await (const message of query({ prompt: promptGenerator, options: queryOptions })) {
        // Capture SDK session ID from init message
        if (message.type === 'system' && message.subtype === 'init' && message.session_id) {
          await this.sessionManager.updateSdkSessionId(session.id, message.session_id);
        }

        await this.sessionManager.addMessage(session.id, message);
        yield { message, sessionId: session.id };
      }

      abortController.abort();
    } catch (error) {
      abortController.abort();
      throw error;
    }
  }

  /**
   * Get session manager
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Add MCP server to the client
   */
  addMcpServer(name: string, server: any) {
    if (!this.defaultOptions.mcpServers) {
      this.defaultOptions.mcpServers = {};
    }
    this.defaultOptions.mcpServers[name] = server;

    // Also add to allowed tools
    if (!this.defaultOptions.allowedTools) {
      this.defaultOptions.allowedTools = [];
    }

    console.log(`✅ Added MCP server: ${name}`);
  }
}

// Export singleton instances
export const sessionManager = new SessionManager();
export const aiClient = new AIClient(sessionManager);
