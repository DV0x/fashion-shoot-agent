import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VideoMessage as VideoMessageType } from '../../lib/types';

interface VideoGridProps {
  videos: VideoMessageType[];
}

// Frame pair labels for 5-clip grid (6 frames → 5 videos)
const FRAME_PAIR_LABELS = ['1→2', '2→3', '3→4', '4→5', '5→6'];

export function VideoGrid({ videos }: VideoGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);
  const thumbnailRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const handleDownload = useCallback((src: string, index: number) => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `clip-${index + 1}.mp4`;
    link.click();
  }, []);

  const navigateTo = useCallback((direction: 'prev' | 'next') => {
    if (selectedIndex === null) return;
    const newIndex = direction === 'prev'
      ? (selectedIndex - 1 + videos.length) % videos.length
      : (selectedIndex + 1) % videos.length;
    setSelectedIndex(newIndex);
    setIsPlaying(false);
  }, [selectedIndex, videos.length]);

  // Keyboard support for lightbox
  useEffect(() => {
    if (selectedIndex === null) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          setSelectedIndex(null);
          break;
        case 'ArrowLeft':
          navigateTo('prev');
          break;
        case 'ArrowRight':
          navigateTo('next');
          break;
        case ' ':
          e.preventDefault();
          togglePlay();
          break;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, navigateTo]);

  // Auto-play when lightbox opens
  useEffect(() => {
    if (selectedIndex !== null && lightboxVideoRef.current) {
      lightboxVideoRef.current.play();
      setIsPlaying(true);
    }
  }, [selectedIndex]);

  const togglePlay = () => {
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

  const closeLightbox = () => {
    setSelectedIndex(null);
    setIsPlaying(false);
  };

  const selectedVideo = selectedIndex !== null ? videos[selectedIndex] : null;

  // Play thumbnail on hover
  const handleThumbnailHover = (index: number, isHovering: boolean) => {
    const video = thumbnailRefs.current[index];
    if (video) {
      if (isHovering) {
        video.play().catch(() => {}); // Ignore autoplay errors
      } else {
        video.pause();
        video.currentTime = 0;
      }
    }
  };

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-lg">
        {/* Grid container - 2x3 for videos */}
        <div className="grid grid-cols-2 gap-2">
          {videos.map((video, index) => (
            <motion.div
              key={video.id}
              className="relative aspect-video bg-surface-elevated rounded overflow-hidden cursor-pointer group"
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedIndex(index)}
              onMouseEnter={() => handleThumbnailHover(index, true)}
              onMouseLeave={() => handleThumbnailHover(index, false)}
            >
              <video
                ref={(el) => { thumbnailRefs.current[index] = el; }}
                src={video.src}
                poster={video.poster}
                className="w-full h-full object-cover"
                muted
                loop
                playsInline
              />

              {/* Play icon overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-background/20 group-hover:bg-background/10 transition-colors">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-accent/80 group-hover:bg-accent transition-colors">
                  <svg className="w-5 h-5 text-background ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>

              {/* Clip number badge with frame pair label */}
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/70 text-[10px] font-mono text-text-secondary">
                {video.label || (
                  videos.length === 5 && FRAME_PAIR_LABELS[index]
                    ? `Clip ${index + 1} (${FRAME_PAIR_LABELS[index]})`
                    : `Clip ${index + 1}`
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Caption */}
        <p className="text-xs text-text-secondary mt-3 text-center font-mono uppercase tracking-wider">
          {videos.length} Clips
        </p>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4"
            onClick={closeLightbox}
          >
            <motion.div
              key={selectedVideo.src}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-4xl w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <video
                ref={lightboxVideoRef}
                src={selectedVideo.src}
                poster={selectedVideo.poster}
                className="w-full rounded-lg"
                playsInline
                loop
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
                <div className={`flex items-center justify-center w-16 h-16 rounded-full transition-colors ${
                  isPlaying ? 'bg-black/30' : 'bg-accent/90'
                }`}>
                  {isPlaying ? (
                    <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                    </svg>
                  ) : (
                    <svg className="w-8 h-8 text-background ml-1" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                </div>
              </button>
            </motion.div>

            {/* Navigation arrows */}
            <button
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-surface/80 text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                navigateTo('prev');
              }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-surface/80 text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                navigateTo('next');
              }}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {/* Top right controls */}
            <div className="absolute top-4 right-4 flex items-center gap-3">
              {/* Counter */}
              <span className="px-3 py-2 rounded-lg bg-surface/80 text-text-secondary text-sm font-mono">
                {selectedIndex! + 1} / {videos.length}
              </span>

              {/* Download button */}
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface/80 text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedVideo.src, selectedIndex!);
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
                onClick={closeLightbox}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Clip label with frame pair */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-surface/80 text-text-secondary text-sm font-mono">
              {selectedVideo.label || (
                videos.length === 5 && FRAME_PAIR_LABELS[selectedIndex!]
                  ? `Clip ${selectedIndex! + 1} (frames ${FRAME_PAIR_LABELS[selectedIndex!]})`
                  : `Clip ${selectedIndex! + 1}`
              )}
            </div>

            {/* Keyboard hint */}
            <div className="absolute bottom-4 right-4 text-xs text-text-muted">
              Space to play/pause • Arrows to navigate • ESC to close
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
