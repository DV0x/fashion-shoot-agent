import { useState } from 'react';
import type { ContentBlock } from '../../lib/types';
import { Spinner } from '../ui/Spinner';

interface ToolCallBlockProps {
  block: ContentBlock;
}

// Tool name to icon mapping
function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    Bash: '$ ',
    Read: '> ',
    Write: '+ ',
    Edit: '~ ',
    Glob: '* ',
    Grep: '? ',
    Skill: '# ',
    Task: '@ ',
  };
  return icons[toolName] || '> ';
}

// Format tool duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function ToolCallBlock({ block }: ToolCallBlockProps) {
  const [showInput, setShowInput] = useState(false);

  // Don't render if not a tool_use block
  if (block.type !== 'tool_use') {
    return null;
  }

  const toolName = block.toolName || 'Tool';
  const isExecuting = block.isStreaming && !block.isComplete;

  return (
    <div className="border border-surface/50 rounded-lg p-2 bg-surface/30 my-2">
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setShowInput(!showInput)}
      >
        {/* Tool icon and name */}
        <code className="text-xs text-accent font-mono">
          {getToolIcon(toolName)}
        </code>
        <span className="text-xs font-medium text-text-secondary">
          {toolName}
        </span>

        {/* Execution state */}
        {isExecuting && (
          <div className="ml-auto">
            <Spinner size="sm" />
          </div>
        )}

        {/* Duration badge */}
        {block.toolDuration && !isExecuting && (
          <span className="ml-auto text-xs text-text-muted bg-surface/50 px-1.5 py-0.5 rounded">
            {formatDuration(block.toolDuration)}
          </span>
        )}

        {/* Expand/collapse indicator */}
        {block.toolInput && (
          <span className="text-xs text-text-muted">
            {showInput ? 'v' : '>'}
          </span>
        )}
      </div>

      {/* Expandable input details */}
      {showInput && block.toolInput && (
        <div className="mt-2 pt-2 border-t border-surface/30">
          <pre className="text-xs bg-surface/50 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words text-text-muted">
            {JSON.stringify(block.toolInput, null, 2)}
          </pre>
        </div>
      )}

      {/* Tool result preview (if available) */}
      {block.toolResult && (
        <div className="mt-2 pt-2 border-t border-surface/30">
          <p className="text-xs text-text-muted truncate">
            Result: {block.toolResult.substring(0, 100)}
            {block.toolResult.length > 100 ? '...' : ''}
          </p>
        </div>
      )}
    </div>
  );
}
