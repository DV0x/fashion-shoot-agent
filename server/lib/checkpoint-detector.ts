/**
 * Checkpoint Detector
 * Detects workflow checkpoints by matching tool output against config rules.
 */

import type { WorkflowConfig, DetectionRule } from './prompt-generator.js';

// ============================================================================
// Types
// ============================================================================

export interface CheckpointData {
  stage: string;
  status: 'complete' | 'error';
  artifact?: string;
  artifacts?: string[];
  type: 'image' | 'image-grid' | 'video' | 'video-grid';
  message: string;
  isFinal?: boolean;
}

// ============================================================================
// Detector Class
// ============================================================================

export class CheckpointDetector {
  private config: WorkflowConfig;

  constructor(config: WorkflowConfig) {
    this.config = config;
  }

  /**
   * Detect if a tool execution triggered a checkpoint
   */
  detect(toolName: string, toolInput: any, toolResponse: any): CheckpointData | null {
    // Only check Bash and TaskOutput tools
    if (toolName !== 'Bash' && toolName !== 'TaskOutput') {
      return null;
    }

    const command = toolName === 'Bash' ? (toolInput?.command || '') : '';
    const output = typeof toolResponse === 'string'
      ? toolResponse
      : JSON.stringify(toolResponse);

    // Debug logging
    console.log(`🔍 [CHECKPOINT] Checking ${toolName}:`);
    console.log(`   Command: ${command.substring(0, 100)}${command.length > 100 ? '...' : ''}`);
    console.log(`   Output: ${output.substring(0, 100)}${output.length > 100 ? '...' : ''}`);

    // Check phases in reverse order (later phases take priority)
    // This handles cases like stitch (which logs video-*.mp4) before clips
    const phasesWithCheckpoints = this.config.phases
      .filter(p => p.checkpoint !== null && p.checkpoint !== undefined)
      .reverse();

    for (const phase of phasesWithCheckpoints) {
      const checkpoint = phase.checkpoint!;
      const rules = Array.isArray(checkpoint.detect)
        ? checkpoint.detect
        : [checkpoint.detect];

      for (const rule of rules) {
        if (this.matchesRule(rule, command, output)) {
          console.log(`✅ [CHECKPOINT] Matched: ${phase.name}`);

          return {
            stage: checkpoint.isFinal ? 'complete' : phase.name,
            status: 'complete',
            artifact: checkpoint.artifacts.length === 1 ? checkpoint.artifacts[0] : undefined,
            artifacts: checkpoint.artifacts.length > 1 ? checkpoint.artifacts : undefined,
            type: checkpoint.type,
            message: checkpoint.message,
            isFinal: checkpoint.isFinal
          };
        }
      }
    }

    return null;
  }

  /**
   * Check if a detection rule matches the command and output
   */
  private matchesRule(rule: DetectionRule, command: string, output: string): boolean {
    const commandMatch = !rule.command_contains || command.includes(rule.command_contains);
    const outputMatch = !rule.output_contains || output.includes(rule.output_contains);

    return commandMatch && outputMatch;
  }

  /**
   * Get checkpoint config for a specific phase
   */
  getPhaseCheckpoint(phaseName: string): CheckpointData | null {
    const phase = this.config.phases.find(p => p.name === phaseName);

    if (!phase?.checkpoint) {
      return null;
    }

    const checkpoint = phase.checkpoint;

    return {
      stage: checkpoint.isFinal ? 'complete' : phase.name,
      status: 'complete',
      artifact: checkpoint.artifacts.length === 1 ? checkpoint.artifacts[0] : undefined,
      artifacts: checkpoint.artifacts.length > 1 ? checkpoint.artifacts : undefined,
      type: checkpoint.type,
      message: checkpoint.message,
      isFinal: checkpoint.isFinal
    };
  }

  /**
   * Get all checkpoint stages in order
   */
  getCheckpointStages(): string[] {
    return this.config.phases
      .filter(p => p.checkpoint !== null && p.checkpoint !== undefined)
      .map(p => p.checkpoint!.isFinal ? 'complete' : p.name);
  }

  /**
   * Get workflow ID
   */
  getWorkflowId(): string {
    return this.config.id;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

export function createCheckpointDetector(config: WorkflowConfig): CheckpointDetector {
  return new CheckpointDetector(config);
}
