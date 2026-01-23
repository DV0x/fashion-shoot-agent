import { motion } from 'framer-motion';

interface ContinueButtonProps {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}

export function ContinueButton({ onClick, disabled = false, label = 'Continue' }: ContinueButtonProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="flex justify-center py-2"
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className="group flex items-center gap-2 bg-accent/10 hover:bg-accent/20 border border-accent/30
                   text-accent font-medium py-2.5 px-6 rounded-full
                   transition-all duration-200 active:scale-[0.98]
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span>{label}</span>
        <svg
          className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </motion.div>
  );
}
