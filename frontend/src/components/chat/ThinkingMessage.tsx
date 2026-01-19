import { useState } from 'react';
import type { ThinkingMessage as ThinkingMessageType } from '../../lib/types';
import { ToolCallBlock } from './ToolCallBlock';

interface ThinkingMessageProps {
  message: ThinkingMessageType;
}

export function ThinkingMessage({ message }: ThinkingMessageProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Separate blocks by type for rendering
  const textBlocks = message.blocks?.filter(b => b.type === 'text' || b.type === 'thinking') || [];
  const toolBlocks = message.blocks?.filter(b => b.type === 'tool_use') || [];

  // Don't render if no content and no tool blocks
  if (!message.content.trim() && toolBlocks.length === 0) {
    return null;
  }

  // Truncate content for collapsed view
  const maxPreviewLength = 80;
  const isLong = message.content.length > maxPreviewLength;
  const previewContent = isLong
    ? message.content.substring(0, maxPreviewLength) + '...'
    : message.content;

  return (
    <div className="flex justify-start">
      <div className="max-w-[75%] thinking-message">
        {/* Header with collapse toggle */}
        <div
          className="flex items-center gap-2 cursor-pointer py-1"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="text-text-muted text-sm shrink-0">
            {isCollapsed ? '>' : 'v'}
          </span>
          <span className="text-sm text-text-muted">
            {toolBlocks.length > 0
              ? `Thinking... (${toolBlocks.length} tool${toolBlocks.length > 1 ? 's' : ''})`
              : 'Thinking...'}
          </span>
        </div>

        {/* Collapsed: Show preview and tool summary */}
        {isCollapsed && (
          <div className="ml-5">
            {/* Text preview */}
            {previewContent && (
              <p className="text-sm text-text-muted truncate opacity-70">
                {previewContent}
              </p>
            )}

            {/* Tool badges */}
            {toolBlocks.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {toolBlocks.map(block => (
                  <span
                    key={block.id}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-surface/50 text-text-muted rounded"
                  >
                    <code className="text-accent">{block.toolName}</code>
                    {block.toolDuration && (
                      <span className="text-text-muted/50">
                        {block.toolDuration < 1000
                          ? `${block.toolDuration}ms`
                          : `${(block.toolDuration / 1000).toFixed(1)}s`}
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Expanded: Show full content */}
        {!isCollapsed && (
          <div className="mt-2 ml-5 space-y-2">
            {/* Text content from blocks or fallback to message.content */}
            {textBlocks.length > 0 ? (
              textBlocks.map(block => (
                <p key={block.id} className="text-sm text-text-muted whitespace-pre-wrap break-words">
                  {block.content}
                </p>
              ))
            ) : message.content ? (
              <p className="text-sm text-text-muted whitespace-pre-wrap break-words">
                {message.content}
              </p>
            ) : null}

            {/* Tool calls */}
            {toolBlocks.map(block => (
              <ToolCallBlock key={block.id} block={block} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
