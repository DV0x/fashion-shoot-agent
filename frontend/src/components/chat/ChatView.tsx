import { useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ChatMessage, ImageMessage as ImageMessageType } from '../../lib/types';
import { TextMessage } from './TextMessage';
import { ThinkingMessage } from './ThinkingMessage';
import { ImageMessage } from './ImageMessage';
import { ImageGrid } from './ImageGrid';
import { CheckpointMessage } from './CheckpointMessage';
import { ProgressMessage } from './ProgressMessage';
import { VideoMessage } from './VideoMessage';

interface ChatViewProps {
  messages: ChatMessage[];
  isGenerating: boolean;
  activity?: string | null;
  onContinue?: (options?: string) => void;
}

// Group consecutive image messages for grid display
type MessageGroup =
  | { type: 'single'; message: ChatMessage }
  | { type: 'image-grid'; images: ImageMessageType[] };

function groupMessages(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  let currentImageGroup: ImageMessageType[] = [];

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

  for (const message of messages) {
    if (message.type === 'image') {
      currentImageGroup.push(message);
    } else {
      flushImageGroup();
      groups.push({ type: 'single', message });
    }
  }
  flushImageGroup();

  return groups;
}

export function ChatView({ messages, isGenerating, activity, onContinue }: ChatViewProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group consecutive images for grid display
  const messageGroups = useMemo(() => groupMessages(messages), [messages]);

  // DEBUG: Log messages and groups
  console.log('[CHATVIEW DEBUG] Messages:', messages.map(m => ({ id: m.id, type: m.type })));
  console.log('[CHATVIEW DEBUG] Message groups:', messageGroups.map(g => g.type === 'image-grid' ? { type: 'image-grid', count: g.images.length } : { type: 'single', messageType: g.message.type }));

  const renderMessage = (message: ChatMessage) => {
    switch (message.type) {
      case 'text':
        return <TextMessage message={message} />;
      case 'thinking':
        return <ThinkingMessage message={message} />;
      case 'image':
        return <ImageMessage message={message} />;
      case 'checkpoint':
        return <CheckpointMessage message={message} onContinue={onContinue} />;
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
          key={`grid-${group.images[0].id}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          <ImageGrid images={group.images} />
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
