import ReactMarkdown from 'react-markdown';
import type { TextMessage as TextMessageType } from '../../lib/types';

interface TextMessageProps {
  message: TextMessageType;
}

export function TextMessage({ message }: TextMessageProps) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isStreaming = message.isStreaming === true;

  // Don't render empty messages (but show cursor if streaming)
  if (!message.content.trim() && !isStreaming) {
    return null;
  }

  return (
    <div className={`group flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[75%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-accent/90 text-background rounded-br-sm'
            : isSystem
              ? 'bg-error/10 text-error border border-error/20 rounded-bl-sm'
              : 'bg-surface/80 backdrop-blur-sm border border-border/50 text-text-primary rounded-bl-sm'
        }`}
      >
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <div className="prose prose-sm prose-invert max-w-none">
            {message.content ? (
              <ReactMarkdown
                components={{
                  p: ({ children }) => <p className="text-sm mb-2 last:mb-0 text-text-primary">{children}</p>,
                  ul: ({ children }) => <ul className="text-sm list-disc pl-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="text-sm list-decimal pl-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                  h1: ({ children }) => <h1 className="text-base font-semibold mb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-sm font-semibold mb-2">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-sm font-medium mb-1">{children}</h3>,
                  code: ({ children, className }) => {
                    const isInline = !className;
                    return isInline ? (
                      <code className="bg-surface-elevated px-1 py-0.5 rounded text-xs font-mono">{children}</code>
                    ) : (
                      <code className="block bg-surface-elevated p-2 rounded text-xs font-mono overflow-x-auto">{children}</code>
                    );
                  },
                  pre: ({ children }) => <pre className="bg-surface-elevated p-2 rounded overflow-x-auto mb-2">{children}</pre>,
                  strong: ({ children }) => <strong className="font-semibold text-accent">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            ) : (
              <span className="text-text-muted text-sm">...</span>
            )}
          </div>
        )}
        {/* Timestamp - visible on hover */}
        <time
          className={`block text-[10px] mt-2 transition-opacity ${
            isUser
              ? 'text-background/60'
              : 'text-text-muted opacity-0 group-hover:opacity-100'
          }`}
        >
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>
    </div>
  );
}
