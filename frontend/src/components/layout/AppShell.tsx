import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

interface AppShellProps {
  children: ReactNode;
  onReset?: () => void;
}

export function AppShell({ children, onReset }: AppShellProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 h-14 max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-lg font-semibold text-text-primary"
          >
            Fashion Shoot Agent
          </motion.h1>

          {onReset && (
            <button
              onClick={onReset}
              className="text-text-secondary hover:text-text-primary transition-colors text-sm"
            >
              New Session
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full">
        {children}
      </main>

      {/* Footer - minimal */}
      <footer className="border-t border-border py-2 px-4">
        <p className="text-center text-xs text-text-muted">
          Powered by Claude Agent SDK
        </p>
      </footer>
    </div>
  );
}
