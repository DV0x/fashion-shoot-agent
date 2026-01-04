import { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VideoMessage as VideoMessageType } from '../../lib/types';

interface VideoMessageProps {
  message: VideoMessageType;
}

export function VideoMessage({ message }: VideoMessageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [aspectRatio, setAspectRatio] = useState<'portrait' | 'landscape' | 'square'>('landscape');

  // Detect video aspect ratio on load
  useEffect(() => {
    const video = document.createElement('video');
    video.src = message.src;
    video.onloadedmetadata = () => {
      const ratio = video.videoWidth / video.videoHeight;
      if (ratio < 0.9) {
        setAspectRatio('portrait');
      } else if (ratio > 1.1) {
        setAspectRatio('landscape');
      } else {
        setAspectRatio('square');
      }
    };
  }, [message.src]);

  // Handle ESC key to close lightbox
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isLightboxOpen) {
        closeLightbox();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLightboxOpen]);

  const openLightbox = () => {
    setIsLightboxOpen(true);
    // Pause thumbnail video
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const closeLightbox = () => {
    setIsLightboxOpen(false);
    // Pause lightbox video
    if (lightboxVideoRef.current) {
      lightboxVideoRef.current.pause();
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (lightboxVideoRef.current) {
      if (lightboxVideoRef.current.paused) {
        lightboxVideoRef.current.play();
        setIsPlaying(true);
      } else {
        lightboxVideoRef.current.pause();
        setIsPlaying(false);
      }
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = message.src;
    // Use label for filename if available, otherwise default to fashion-video
    const filename = message.label
      ? `${message.label.toLowerCase().replace(/\s+/g, '-')}.mp4`
      : 'fashion-video.mp4';
    link.download = filename;
    link.click();
  };

  // Aspect ratio classes for thumbnail
  const aspectClasses = {
    portrait: 'aspect-[9/16] max-w-[200px]',
    landscape: 'aspect-video max-w-md',
    square: 'aspect-square max-w-[280px]',
  };

  // Lightbox video sizing
  const lightboxVideoClasses = {
    portrait: 'max-h-[85vh] w-auto',
    landscape: 'max-w-[90vw] h-auto',
    square: 'max-w-[80vh] max-h-[80vh]',
  };

  return (
    <>
      {/* Thumbnail in chat */}
      <div className="flex justify-start">
        <div className={aspectClasses[aspectRatio]}>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="film-frame p-3 cursor-pointer group"
            onClick={openLightbox}
          >
            <div className="relative bg-surface-elevated rounded overflow-hidden">
              <video
                ref={videoRef}
                src={message.src}
                poster={message.poster}
                className="w-full h-full object-cover"
                playsInline
                muted
                loop
              />

              {/* Play overlay - click to open lightbox */}
              <div className="absolute inset-0 flex items-center justify-center bg-background/30 group-hover:bg-background/40 transition-colors">
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-accent/90 group-hover:bg-accent transition-colors">
                  <svg className="w-7 h-7 text-background ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              {/* Expand icon */}
              <div className="absolute top-2 right-2 p-1.5 rounded bg-background/50 opacity-0 group-hover:opacity-100 transition-opacity">
                <svg className="w-4 h-4 text-text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
              </div>
            </div>
          </motion.div>

          {/* Actions */}
          <div className="flex items-center justify-between mt-3 px-1">
            <span className="text-xs font-mono uppercase tracking-wider text-accent">
              {message.label || 'Final Video'}
            </span>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                />
              </svg>
              Download
            </button>
          </div>

          {/* Timestamp */}
          <time className="block text-[10px] text-text-muted mt-2 text-center">
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </time>
        </div>
      </div>

      {/* Lightbox Modal */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm"
            onClick={closeLightbox}
          >
            {/* Close button */}
            <button
              onClick={closeLightbox}
              className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
            >
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Video container */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                ref={lightboxVideoRef}
                src={message.src}
                poster={message.poster}
                className={`${lightboxVideoClasses[aspectRatio]} rounded-lg shadow-2xl`}
                playsInline
                loop
                autoPlay
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
              />

              {/* Play/Pause overlay */}
              <button
                onClick={togglePlay}
                className={`absolute inset-0 flex items-center justify-center transition-opacity rounded-lg ${
                  isPlaying ? 'opacity-0 hover:opacity-100' : 'opacity-100'
                }`}
              >
                <div className={`flex items-center justify-center w-20 h-20 rounded-full transition-colors ${
                  isPlaying ? 'bg-black/30' : 'bg-accent/90'
                }`}>
                  {isPlaying ? (
                    <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-10 h-10 text-background ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
              </button>

              {/* Bottom controls */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent rounded-b-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono uppercase tracking-wider text-accent">
                    {message.label || 'Final Video'}
                  </span>
                  <button
                    onClick={handleDownload}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full text-sm text-white transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                      />
                    </svg>
                    Download
                  </button>
                </div>
              </div>
            </motion.div>

            {/* Keyboard hint */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-white/50">
              Press ESC or click outside to close
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
