import { useState } from 'react';
import { motion } from 'framer-motion';
import type { CheckpointMessage as CheckpointMessageType } from '../../lib/types';

interface CheckpointMessageProps {
  message: CheckpointMessageType;
  onContinue?: (options?: string) => void;
}

const SPEED_OPTIONS = ['1', '1.25', '1.5', '2'] as const;
type SpeedOption = typeof SPEED_OPTIONS[number];

export function CheckpointMessage({ message, onContinue }: CheckpointMessageProps) {
  const { checkpoint } = message;

  // State for clips checkpoint options
  const [selectedSpeed, setSelectedSpeed] = useState<SpeedOption>('1');
  const [loopEnabled, setLoopEnabled] = useState(false);

  const stageLabels: Record<string, string> = {
    hero: 'Hero Image Ready',
    'contact-sheet': 'Contact Sheet Preview',
    frames: 'Frames Ready',
    clips: 'Video Clips Ready',
    complete: 'Pipeline Complete',
  };

  const stageIcons: Record<string, string> = {
    hero: '📸',
    'contact-sheet': '🎞️',
    frames: '🖼️',
    clips: '🎥',
    complete: '🎬',
  };

  // Don't show Continue button on complete stage
  const showContinue = checkpoint.stage !== 'complete';
  const showAspectRatioOptions = checkpoint.stage === 'frames';
  const showSpeedOptions = checkpoint.stage === 'clips';

  // Handle continue for clips with selected options
  const handleClipsContinue = () => {
    if (loopEnabled) {
      onContinue?.(`${selectedSpeed}x loop`);
    } else if (selectedSpeed !== '1') {
      onContinue?.(`${selectedSpeed}x`);
    } else {
      onContinue?.();
    }
  };

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
          {/* Aspect ratio options for frames checkpoint */}
          {showAspectRatioOptions && (
            <div className="mb-3">
              <p className="text-xs text-text-muted mb-2">Convert aspect ratio (optional):</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => onContinue?.('16:9')}
                  className="px-3 py-1.5 bg-surface hover:bg-surface-elevated border border-border text-text-secondary hover:text-text-primary rounded-full text-xs font-medium transition-colors"
                >
                  16:9 Landscape
                </button>
                <button
                  onClick={() => onContinue?.('9:16')}
                  className="px-3 py-1.5 bg-surface hover:bg-surface-elevated border border-border text-text-secondary hover:text-text-primary rounded-full text-xs font-medium transition-colors"
                >
                  9:16 Portrait
                </button>
                <button
                  onClick={() => onContinue?.('1:1')}
                  className="px-3 py-1.5 bg-surface hover:bg-surface-elevated border border-border text-text-secondary hover:text-text-primary rounded-full text-xs font-medium transition-colors"
                >
                  1:1 Square
                </button>
              </div>
            </div>
          )}

          {/* Speed and loop options for clips checkpoint */}
          {showSpeedOptions && (
            <div className="mb-4 space-y-4">
              {/* Speed Segmented Control */}
              <div>
                <p className="text-xs text-text-muted mb-2">Playback speed</p>
                <div className="inline-flex bg-surface rounded-lg p-1 gap-1">
                  {SPEED_OPTIONS.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => setSelectedSpeed(speed)}
                      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all ${
                        selectedSpeed === speed
                          ? 'bg-accent text-background shadow-sm'
                          : 'text-text-secondary hover:text-text-primary hover:bg-surface-elevated'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* Loop Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-text-muted">Loop video</p>
                  <p className="text-[10px] text-text-muted/60">Seamless 6→1 transition</p>
                </div>
                <button
                  onClick={() => setLoopEnabled(!loopEnabled)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${
                    loopEnabled ? 'bg-accent' : 'bg-surface-elevated'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${
                      loopEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}

          {/* Continue Button */}
          <div className="flex flex-wrap gap-2">
            {showSpeedOptions ? (
              <button
                onClick={handleClipsContinue}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-background rounded-full text-sm font-medium transition-colors"
              >
                Continue
                <span className="ml-1.5 text-xs opacity-80">
                  ({selectedSpeed}x{loopEnabled ? ', Loop' : ''})
                </span>
              </button>
            ) : (
              <button
                onClick={() => onContinue?.()}
                className="px-4 py-1.5 bg-accent hover:bg-accent-hover text-background rounded-full text-sm font-medium transition-colors"
              >
                {showAspectRatioOptions ? 'Continue (Keep Original)' : 'Continue'}
              </button>
            )}
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
