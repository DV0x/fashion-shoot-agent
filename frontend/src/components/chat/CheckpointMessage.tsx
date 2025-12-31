import { motion } from 'framer-motion';
import type { CheckpointMessage as CheckpointMessageType } from '../../lib/types';

interface CheckpointMessageProps {
  message: CheckpointMessageType;
  onContinue?: () => void;
}

export function CheckpointMessage({ message, onContinue }: CheckpointMessageProps) {
  const { checkpoint } = message;

  const stageLabels: Record<string, string> = {
    hero: 'Hero Image Ready',
    frames: 'Frames Ready',
    videos: 'Videos Ready',
    complete: 'Pipeline Complete',
  };

  const stageIcons: Record<string, string> = {
    hero: '📸',
    frames: '🎞️',
    videos: '🎥',
    complete: '🎬',
  };

  // Don't show Continue button on complete stage
  const showContinue = checkpoint.stage !== 'complete';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-gradient-to-r from-accent/10 to-transparent border-l-2 border-accent rounded-r-xl p-4 max-w-md"
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{stageIcons[checkpoint.stage] || '✨'}</span>
        <span className="text-sm font-medium text-accent">
          {stageLabels[checkpoint.stage] || 'Checkpoint'}
        </span>
      </div>

      {/* Message */}
      <p className="text-sm text-text-secondary mb-4">{checkpoint.message}</p>

      {/* Actions */}
      {showContinue && (
        <>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={onContinue}
              className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-background rounded-full text-sm font-medium transition-colors"
            >
              Continue
            </button>
          </div>

          {/* Hint text */}
          <p className="text-xs text-text-muted mt-3">
            Or type in the input box below to modify
          </p>
        </>
      )}
    </motion.div>
  );
}
