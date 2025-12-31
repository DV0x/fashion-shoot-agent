import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import type { ImageMessage as ImageMessageType } from '../../lib/types';

interface ImageMessageProps {
  message: ImageMessageType;
}

export function ImageMessage({ message }: ImageMessageProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = message.src;
    const filename = message.src.split('/').pop() || 'image.png';
    link.download = filename;
    link.click();
  }, [message.src]);

  // Keyboard support for lightbox
  useEffect(() => {
    if (!isExpanded) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsExpanded(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  return (
    <div className="flex justify-start">
      <div className="max-w-sm">
        {/* Film frame container */}
        <motion.div
          className="film-frame p-3 cursor-pointer"
          whileHover={{ scale: 1.02 }}
          onClick={() => setIsExpanded(true)}
        >
          <div className="relative aspect-[3/2] bg-surface-elevated rounded overflow-hidden">
            {!isLoaded && <div className="absolute inset-0 skeleton" />}
            <img
              src={message.src}
              alt={message.caption || 'Generated image'}
              className={`w-full h-full object-cover transition-opacity duration-300 ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              onLoad={() => setIsLoaded(true)}
            />
          </div>
        </motion.div>

        {/* Caption */}
        {message.caption && (
          <p className="text-xs text-text-secondary mt-2 text-center font-mono uppercase tracking-wider">
            {message.caption}
          </p>
        )}

        {/* Timestamp */}
        <time className="block text-[10px] text-text-muted mt-1 text-center">
          {message.timestamp.toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </time>
      </div>

      {/* Expanded lightbox */}
      {isExpanded && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4"
          onClick={() => setIsExpanded(false)}
        >
          <motion.img
            initial={{ scale: 0.9 }}
            animate={{ scale: 1 }}
            src={message.src}
            alt={message.caption || 'Generated image'}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />

          {/* Top right controls */}
          <div className="absolute top-4 right-4 flex items-center gap-3">
            {/* Download button */}
            <button
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface/80 text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleDownload();
              }}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              <span className="text-sm">Download</span>
            </button>

            {/* Close button */}
            <button
              className="p-2 rounded-lg bg-surface/80 text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              onClick={() => setIsExpanded(false)}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Caption */}
          {message.caption && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-surface/80 text-text-secondary text-sm">
              {message.caption}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
