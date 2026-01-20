import { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, ImageMessage as ImageMessageType, VideoMessage as VideoMessageType, ContentBlock } from '../../lib/types';
import { TextMessage } from './TextMessage';
import { ThinkingMessage } from './ThinkingMessage';
import { ImageMessage } from './ImageMessage';
import { ImageGrid } from './ImageGrid';
import { VideoGrid } from './VideoGrid';
import { ProgressMessage } from './ProgressMessage';
import { VideoMessage } from './VideoMessage';
import { ToolCallBlock } from './ToolCallBlock';

interface ChatViewProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  activity?: string | null;
  currentBlocks?: Map<number, ContentBlock>;  // Phase 7: Streaming blocks
}

// Group consecutive image/video messages for grid display
type MessageGroup =
  | { type: 'single'; message: ChatMessage }
  | { type: 'image-grid'; images: ImageMessageType[] }
  | { type: 'video-grid'; videos: VideoMessageType[] };

function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentImageGroup: ImageMessageType[] = [];
  let currentVideoGroup: VideoMessageType[] = [];

  const flushImageGroup = () => {
    if (currentImageGroup.length >= 3) {
      // 3+ consecutive images → show as grid
      groups.push({ type: 'image-grid', images: [...currentImageGroup] });
    } else {
      // 1-2 images → show individually
      currentImageGroup.forEach((img) => {
        groups.push({ type: 'single', message: img });
      });
    }
    currentImageGroup = [];
  };

  const flushVideoGroup = () => {
    if (currentVideoGroup.length >= 3) {
      // 3+ consecutive videos → show as grid
      groups.push({ type: 'video-grid', videos: [...currentVideoGroup] });
    } else {
      // 1-2 videos → show individually
      currentVideoGroup.forEach((vid) => {
        groups.push({ type: 'single', message: vid });
      });
    }
    currentVideoGroup = [];
  };

  for (const message of messages) {
    if (message.type === 'image') {
      flushVideoGroup(); // Flush any pending videos first
      currentImageGroup.push(message);
    } else if (message.type === 'video') {
      flushImageGroup(); // Flush any pending images first
      currentVideoGroup.push(message);
    } else {
      flushImageGroup();
      flushVideoGroup();
      groups.push({ type: 'single', message });
    }
  }
  flushImageGroup();
  flushVideoGroup();

  return groups;
}

export function ChatView({ messages, isGenerating, activity, currentBlocks }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Phase 7: Convert currentBlocks to array for rendering
  const streamingBlocks = useMemo(() => {
    if (!currentBlocks || currentBlocks.size === 0) return [];
    return Array.from(currentBlocks.values()).sort((a, b) => a.index - b.index);
  }, [currentBlocks]);

  // Group consecutive images for grid display
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  // DEBUG: Log messages and groups
  console.log('[CHATVIEW DEBUG] Messages:', messages.map(m => ({ id: m.id, type: m.type })));
  console.log('[CHATVIEW DEBUG] Message groups:', messageGroups.map(g => {
    if (g.type === 'image-grid') return { type: 'image-grid', count: g.images.length };
    if (g.type === 'video-grid') return { type: 'video-grid', count: g.videos.length };
    return { type: 'single', messageType: g.message.type };
  }));

  const renderMessage = (message: ChatMessage) => {
    switch (message.type) {
      case 'text':
        return <TextMessage message={message} />;
      case 'thinking':
        return <ThinkingMessage message={message} />;
      case 'image':
        return <ImageMessage message={message} />;
      case 'progress':
        return <ProgressMessage message={message} />;
      case 'video':
        return <VideoMessage message={message} />;
      default:
        return null;
    }
  };

  const renderGroup = (group: MessageGroup) => {
    if (group.type === 'image-grid') {
      return (
        <motion.div
          key={`image-grid-${group.images[0].id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <ImageGrid images={group.images} />
        </motion.div>
      );
    }
    if (group.type === 'video-grid') {
      return (
        <motion.div
          key={`video-grid-${group.videos[0].id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <VideoGrid videos={group.videos} />
        </motion.div>
      );
    }
    return (
      <motion.div
        key={group.message.id}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {renderMessage(group.message)}
      </motion.div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-8">
      <div className="space-y-5 max-w-2xl mx-auto">
        {/* Welcome message when empty */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center py-12"
          >
            <h2 className="font-display text-2xl text-text-primary mb-3">
              Create Your Fashion Shoot
            </h2>
            <p className="text-text-secondary max-w-md mx-auto">
              Upload reference images and describe your vision. The AI will generate a complete
              editorial photoshoot with hero shots, contact sheets, and video content.
            </p>
          </motion.div>
        )}

        {/* Messages - grouped for image grid display */}
        <AnimatePresence initial={false}>
          {messageGroups.map((group) => renderGroup(group))}
        </AnimatePresence>

        {/* Phase 7: Streaming blocks display during generation */}
        {isGenerating && streamingBlocks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-[75%]"
          >
            <div className="thinking-message">
              {/* Text blocks */}
              {streamingBlocks
                .filter(b => b.type === 'text' || b.type === 'thinking')
                .map(block => (
                  <p key={block.id} className="text-sm text-text-muted whitespace-pre-wrap break-words">
                    {block.content}
                    {block.isStreaming && <span className="animate-pulse">|</span>}
                  </p>
                ))}

              {/* Tool blocks */}
              {streamingBlocks
                .filter(b => b.type === 'tool_use')
                .map(block => (
                  <ToolCallBlock key={block.id} block={block} />
                ))}
            </div>
          </motion.div>
        )}

        {/* Thinking/Activity indicator with 3-dot animation */}
        {isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex items-center gap-3 px-4 py-3 bg-surface/50 rounded-2xl backdrop-blur-sm max-w-fit"
          >
            <div className="thinking-dots">
              <div className="thinking-dot" />
              <div className="thinking-dot" />
              <div className="thinking-dot" />
            </div>
            <span className="text-sm text-text-secondary">{activity || 'Thinking...'}</span>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
