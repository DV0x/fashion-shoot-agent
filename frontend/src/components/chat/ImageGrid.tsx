import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { ImageMessage as ImageMessageType } from '../../lib/types';

interface ImageGridProps {
  images: ImageMessageType[];
}

export function ImageGrid({ images }: ImageGridProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index));
  };

  const handleDownload = useCallback((src: string) => {
    const link = document.createElement('a');
    link.href = src;
    const filename = src.split('/').pop() || 'image.png';
    link.download = filename;
    link.click();
  }, []);

  const navigateTo = useCallback((direction: 'prev' | 'next') => {
    if (selectedIndex === null) return;
    const newIndex = direction === 'prev'
      ? (selectedIndex - 1 + images.length) % images.length
      : (selectedIndex + 1) % images.length;
    setSelectedIndex(newIndex);
  }, [selectedIndex, images.length]);

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
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedIndex, navigateTo]);

  const selectedImage = selectedIndex !== null ? images[selectedIndex] : null;

  return (
    <div className="flex justify-start">
      <div className="w-full max-w-lg">
        {/* Grid container */}
        <div className="image-grid">
          {images.map((image, index) => (
            <motion.div
              key={image.id}
              className="relative aspect-square bg-surface-elevated rounded overflow-hidden cursor-pointer"
              whileHover={{ scale: 1.02 }}
              onClick={() => setSelectedIndex(index)}
            >
              {!loadedImages.has(index) && <div className="absolute inset-0 skeleton" />}
              <img
                src={image.src}
                alt={image.caption || `Frame ${index + 1}`}
                className={`w-full h-full object-cover transition-opacity duration-300 ${
                  loadedImages.has(index) ? 'opacity-100' : 'opacity-0'
                }`}
                onLoad={() => handleImageLoad(index)}
              />
              {/* Frame number badge */}
              <div className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-background/70 text-[10px] font-mono text-text-secondary">
                {index + 1}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Caption */}
        <p className="text-xs text-text-secondary mt-3 text-center font-mono uppercase tracking-wider">
          {images.length} Frames
        </p>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center p-4"
            onClick={() => setSelectedIndex(null)}
          >
            <motion.img
              key={selectedImage.src}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={selectedImage.src}
              alt={selectedImage.caption || `Frame ${selectedIndex! + 1}`}
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />

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
                {selectedIndex! + 1} / {images.length}
              </span>

              {/* Download button */}
              <button
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface/80 text-text-secondary hover:text-text-primary hover:bg-surface transition-colors"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(selectedImage.src);
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
                onClick={() => setSelectedIndex(null)}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Caption */}
            {selectedImage.caption && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg bg-surface/80 text-text-secondary text-sm">
                {selectedImage.caption}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
