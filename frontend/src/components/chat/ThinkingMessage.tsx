import { useState } from 'react';
import type { ThinkingMessage as ThinkingMessageType } from '../../lib/types';

interface ThinkingMessageProps {
  message: ThinkingMessageType;
}

export function ThinkingMessage({ message }: ThinkingMessageProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Don't render empty messages
  if (!message.content.trim()) {
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
        <div
          className="flex items-start gap-2 cursor-pointer"
          onClick={() => setIsCollapsed(!isCollapsed)}
        >
          <span className="text-text-muted text-sm shrink-0">
            {isCollapsed ? '>' : 'v'}
          </span>
          <div className="flex-1 min-w-0">
            {isCollapsed ? (
              <p className="text-sm text-text-muted truncate">
                {previewContent}
              </p>
            ) : (
              <p className="text-sm text-text-muted whitespace-pre-wrap break-words">
                {message.content}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
