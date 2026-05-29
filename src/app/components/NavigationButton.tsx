import { motion } from 'motion/react';
import { memo } from 'react';
import { ChevronLeft, Home } from 'lucide-react';

interface NavigationButtonProps {
  onClick: () => void;
  type: 'back' | 'home';
  label?: string;
}

export const NavigationButton = memo(function NavigationButton({ onClick, type, label }: NavigationButtonProps) {
  return (
    <motion.button
      className="navigation-button fixed left-8 top-24 z-[200] flex items-center gap-3 rounded-lg bg-white/10 px-6 py-3 font-semibold text-white shadow-lg backdrop-blur-md transition-colors hover:bg-white/20"
      onClick={onClick}
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      style={{
        boxShadow: '0 0 30px rgba(255,255,255,0.1), 0 10px 30px rgba(0,0,0,0.3)'
      }}
    >
      {type === 'back' ? (
        <>
          <ChevronLeft className="w-5 h-5" />
          <span>{label || 'Back'}</span>
        </>
      ) : (
        <>
          <Home className="w-5 h-5" />
          <span>{label || 'Home'}</span>
        </>
      )}
    </motion.button>
  );
});
