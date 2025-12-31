import { motion } from 'framer-motion';
import type { ProgressMessage as ProgressMessageType } from '../../lib/types';

interface ProgressMessageProps {
  message: ProgressMessageType;
}

export function ProgressMessage({ message }: ProgressMessageProps) {
  const percentage = Math.round((message.current / message.total) * 100);

  return (
    <div className="bg-surface border border-border rounded-xl p-4">
      {/* Label */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-text-primary">{message.label}</span>
        <span className="text-xs font-mono text-text-secondary">
          {message.current}/{message.total}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-surface-elevated rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-accent rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        />
      </div>

      {/* Stage info */}
      <p className="text-xs text-text-muted mt-2 font-mono uppercase tracking-wider">
        {message.stage}
      </p>
    </div>
  );
}
