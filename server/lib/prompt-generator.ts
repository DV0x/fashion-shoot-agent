/**
 * Prompt Generator
 * Generates dynamic system prompts from workflow configuration files.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';
import { resolve } from 'path';

// ============================================================================
// Types
// ============================================================================

export interface WorkflowConfig {
  id: string;
  name: string;
  description: string;
  skills: {
    content: string;
    actions: string;
  };
  setup: {
    directories: string[];
    workingDir: string;
  };
  presetMatching?: Record<string, { pose: string; background: string }>;
  phases: Phase[];
  rules: string[];
}

export interface Phase {
  name: string;
  description: string;
  promptFile?: string;
  script?: {
    command: string;
    inputPath?: string;
    outputPath?: string;
    outputDir?: string;
    inputs?: string[];
    inputPattern?: string;
    outputPattern?: string;
    repeat?: number;
    options?: Record<string, any>;
  };
  checkpoint?: CheckpointConfig | null;
}

export interface CheckpointConfig {
  detect: DetectionRule | DetectionRule[];
  artifacts: string[];
  type: 'image' | 'image-grid' | 'video' | 'video-grid';
  message: string;
  isFinal?: boolean;
  modifications?: {
    description: string;
    patterns?: Record<string, string>;
    supportedRatios?: string[];
    defaultStitchSettings?: Record<string, any>;
    examples?: string[];
  };
}

export interface DetectionRule {
  command_contains?: string;
  output_contains?: string;
}

// ============================================================================
// Main Generator Function
// ============================================================================

export function generatePrompt(config: WorkflowConfig): string {
  const sections = [
    generateHeader(config),
    generateBashSection(config),
    generateSkillChainSection(config),
    generatePhasesSection(config),
    config.presetMatching ? generatePresetSection(config.presetMatching) : '',
    generateModificationSection(config.phases),
    generateRulesSection(config.rules)
  ];

  return sections.filter(Boolean).join('\n');
}

// ============================================================================
// Section Generators
// ============================================================================

function generateHeader(config: WorkflowConfig): string {
  return `You are a ${config.name} pipeline executor.

`;
}

function generateBashSection(config: WorkflowConfig): string {
  const workingDir = config.setup.workingDir || 'agent';
  const dirs = config.setup.directories.join(' ');

  return `## BASH COMMANDS - IMPORTANT

All Bash commands MUST run from the ${workingDir}/ directory. Always prefix with \`cd ${workingDir} &&\`:
\`\`\`bash
cd ${workingDir} && mkdir -p ${dirs}
cd ${workingDir} && npx tsx .claude/skills/${config.skills.actions}/scripts/generate-image.ts ...
\`\`\`

`;
}

function generateSkillChainSection(config: WorkflowConfig): string {
  return `## SKILL CHAIN (MANDATORY)

You MUST use the Skill tool to activate skills in this order:

1. **Skill tool** → \`${config.skills.content}\` → Get presets and prompt templates
2. **Skill tool** → \`${config.skills.actions}\` → Get script commands to execute

NEVER improvise prompts or script commands. ALWAYS activate skills via Skill tool.

`;
}

function generatePhasesSection(config: WorkflowConfig): string {
  let output = '## WORKFLOW PHASES\n\n';

  config.phases.forEach((phase, index) => {
    const phaseNum = index + 1;
    const hasCheckpoint = phase.checkpoint !== null && phase.checkpoint !== undefined;

    output += `### Phase ${phaseNum}: ${capitalize(phase.name)}`;
    if (hasCheckpoint) {
      output += ' → CHECKPOINT';
    }
    output += '\n';

    output += `${phase.description}\n`;

    if (phase.promptFile) {
      output += `- Read \`${phase.promptFile}\` from content skill\n`;
    }

    if (phase.script) {
      output += `- Execute \`${phase.script.command}\`\n`;
    }

    if (hasCheckpoint && phase.checkpoint) {
      const artifacts = phase.checkpoint.artifacts;
      const artifactLine = artifacts.length === 1
        ? `artifact: ${artifacts[0]}`
        : `artifacts: ${artifacts.join(',')}`;

      const stageName = phase.checkpoint.isFinal ? 'complete' : phase.name;

      output += `
**Checkpoint:** Stop and output:
\`\`\`
---CHECKPOINT---
stage: ${stageName}
status: complete
${artifactLine}
message: ${phase.checkpoint.message}
---END CHECKPOINT---
\`\`\`
`;
    }

    output += '\n';
  });

  return output;
}

function generatePresetSection(presetMatching: Record<string, any>): string {
  let output = '## PRESET SELECTION\n\n';
  output += 'Match user\'s words to presets:\n\n';
  output += '| User Says | Pose Preset | Background Preset |\n';
  output += '|-----------|-------------|-------------------|\n';

  for (const [keywords, presets] of Object.entries(presetMatching)) {
    const keywordDisplay = keywords === 'default' ? '*(no preference)*' : keywords;
    output += `| ${keywordDisplay} | \`${presets.pose}\` | \`${presets.background}\` |\n`;
  }

  output += '\n';
  return output;
}

function generateModificationSection(phases: Phase[]): string {
  const checkpointPhases = phases.filter(
    p => p.checkpoint?.modifications
  );

  if (checkpointPhases.length === 0) {
    return `## CHECKPOINT MODIFICATION HANDLING

At any checkpoint, user can request changes. Regenerate and show checkpoint again until user says "continue".

`;
  }

  let output = '## CHECKPOINT MODIFICATION HANDLING\n\n';

  for (const phase of checkpointPhases) {
    const mods = phase.checkpoint!.modifications!;

    output += `### At Checkpoint: ${capitalize(phase.name)}\n\n`;
    output += `${mods.description}\n\n`;

    if (mods.patterns) {
      output += '**Supported patterns:**\n';
      for (const [patternType, pattern] of Object.entries(mods.patterns)) {
        output += `- ${patternType}: \`${pattern}\`\n`;
      }
      output += '\n';
    }

    if (mods.supportedRatios) {
      output += `**Supported ratios:** ${mods.supportedRatios.join(', ')}\n\n`;
    }

    if (mods.examples) {
      output += '**Examples:**\n';
      for (const example of mods.examples) {
        output += `- "${example}"\n`;
      }
      output += '\n';
    }

    output += '→ Show CHECKPOINT again. Loop until user says "continue".\n\n';
  }

  return output;
}

function generateRulesSection(rules: string[]): string {
  let output = '## RULES\n\n';

  for (const rule of rules) {
    output += `- ${rule}\n`;
  }

  output += '\n';
  return output;
}

// ============================================================================
// Utilities
// ============================================================================

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ');
}

// ============================================================================
// Config Loader
// ============================================================================

export function loadWorkflowConfig(workflowId: string): WorkflowConfig {
  const configPath = resolve(process.cwd(), 'workflows', `${workflowId}.json`);

  if (!existsSync(configPath)) {
    throw new Error(`Workflow config not found: ${configPath}`);
  }

  const configContent = readFileSync(configPath, 'utf-8');
  return JSON.parse(configContent) as WorkflowConfig;
}

export function listAvailableWorkflows(): string[] {
  const workflowsDir = resolve(process.cwd(), 'workflows');

  if (!existsSync(workflowsDir)) {
    return [];
  }

  const files = readdirSync(workflowsDir) as string[];

  return files
    .filter((f: string) => f.endsWith('.json') && f !== 'index.json')
    .map((f: string) => f.replace('.json', ''));
}
