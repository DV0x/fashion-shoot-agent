import { useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { VideoMessage as VideoMessageType } from '../../lib/types';

interface VideoMessageProps {
  message: VideoMessageType;
}

export function VideoMessage({ message }: VideoMessageProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = message.src;
    link.download = 'fashion-video.mp4';
    link.click();
  };

  return (
    <div className="flex justify-start">
      <div className="max-w-md w-full">
        {/* Video container with film frame effect */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="film-frame p-3"
        >
          <div className="relative aspect-video bg-surface-elevated rounded overflow-hidden">
            <video
              ref={videoRef}
              src={message.src}
              poster={message.poster}
              className="w-full h-full object-cover"
              playsInline
              loop
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
            />

            {/* Play/Pause overlay - always visible when paused, show on hover when playing */}
            <button
              onClick={togglePlay}
              className={`absolute inset-0 flex items-center justify-center transition-opacity ${
                isPlaying ? 'opacity-0 hover:opacity-100 bg-background/20' : 'opacity-100 bg-background/30'
              }`}
            >
              <div className={`flex items-center justify-center w-16 h-16 rounded-full ${
                isPlaying ? 'bg-background/50' : 'bg-accent/90'
              }`}>
                {isPlaying ? (
                  <svg className="w-8 h-8 text-text-primary" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
                  </svg>
                ) : (
                  <svg className="w-8 h-8 text-background ml-1" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </div>
            </button>
          </div>
        </motion.div>

        {/* Actions */}
        <div className="flex items-center justify-between mt-3 px-1">
          <span className="text-xs font-mono uppercase tracking-wider text-accent">
            Final Video
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
  );
}
