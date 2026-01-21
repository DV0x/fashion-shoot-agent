import { useState } from 'react';
import type { ToolUseMessage } from '../../lib/types';
import { Spinner } from '../ui/Spinner';

interface ToolUseBlockProps {
  message: ToolUseMessage;
  isExecuting?: boolean;
}

// Tool name to icon mapping
function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    Bash: '$',
    Read: '>',
    Write: '+',
    Edit: '~',
    Glob: '*',
    Grep: '?',
    Skill: '#',
    Task: '@',
  };
  return icons[toolName] || '>';
}

// Tool name to friendly label
function getToolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    Bash: 'Running command',
    Read: 'Reading file',
    Write: 'Writing file',
    Edit: 'Editing file',
    Glob: 'Searching files',
    Grep: 'Searching content',
    Skill: 'Loading skill',
    Task: 'Processing task',
  };
  return labels[toolName] || toolName;
}

export function ToolUseBlock({ message, isExecuting = false }: ToolUseBlockProps) {
  const [isExpanded, setIsExpanded] = useState(message.isExpanded ?? false);

  const toolName = message.toolName || 'Tool';
  const hasInput = message.toolInput && Object.keys(message.toolInput).length > 0;

  return (
    <div className="my-2 border border-surface/40 rounded-lg overflow-hidden bg-surface/20">
      {/* Header - clickable to expand */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface/30 transition-colors text-left"
      >
        {/* Tool icon */}
        <code className="text-accent font-mono text-sm font-semibold">
          {getToolIcon(toolName)}
        </code>

        {/* Tool label */}
        <span className="text-sm text-text-secondary flex-1">
          {getToolLabel(toolName)}
        </span>

        {/* Execution indicator */}
        {isExecuting && (
          <Spinner size="sm" />
        )}

        {/* Expand/collapse chevron */}
        {hasInput && (
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </button>

      {/* Expanded input details */}
      {isExpanded && hasInput && (
        <div className="border-t border-surface/30 px-3 py-2 bg-surface/10">
          <pre className="text-xs font-mono text-text-muted overflow-x-auto whitespace-pre-wrap break-words">
            {JSON.stringify(message.toolInput, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
