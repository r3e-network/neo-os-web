import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface MiniAppTransitionProps {
  children: React.ReactNode;
  onTransitionComplete?: () => void;
}

/**
 * MiniAppTransition - Stone drop into water effect for miniapp opening
 * Creates expanding ripples then fades in the miniapp content
 */
export function MiniAppTransition({ children, onTransitionComplete }: MiniAppTransitionProps) {
  const [isAnimating, setIsAnimating] = useState(true);
  const [showContent, setShowContent] = useState(false);

  const handleRippleComplete = useCallback(() => {
    setShowContent(true);
    setTimeout(() => {
      setIsAnimating(false);
      onTransitionComplete?.();
    }, 600);
  }, [onTransitionComplete]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence>{isAnimating && <RippleOverlay onComplete={handleRippleComplete} />}</AnimatePresence>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={showContent ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full h-full"
      >
        {children}
      </motion.div>
    </div>
  );
}

interface RippleOverlayProps {
  onComplete: () => void;
}

const RIPPLE_RING_COUNT = 5;
const RIPPLE_BASE_DELAY_S = 0.3;
const RIPPLE_DELAY_STEP_S = 0.2;
const RIPPLE_DURATION_S = 1.5;
const RIPPLE_TOTAL_MS = Math.round(
  (RIPPLE_BASE_DELAY_S + RIPPLE_DELAY_STEP_S * (RIPPLE_RING_COUNT - 1) + RIPPLE_DURATION_S) * 1000,
);

function RippleOverlay({ onComplete }: RippleOverlayProps) {
  useEffect(() => {
    const timer = window.setTimeout(onComplete, RIPPLE_TOTAL_MS);
    return () => window.clearTimeout(timer);
  }, [onComplete]);

  return (
    <motion.div
      className="absolute inset-0 z-50 flex items-center justify-center bg-background"
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Stone drop effect */}
      <motion.div
        className="absolute w-4 h-4 rounded-full bg-erobo-purple"
        initial={{ y: -100, opacity: 1, scale: 1 }}
        animate={{ y: 0, opacity: 0, scale: 0.5 }}
        transition={{ duration: 0.3, ease: "easeIn" }}
      />

      {/* Concentric ripple rings */}
      {Array.from({ length: RIPPLE_RING_COUNT }, (_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full border-2 border-erobo-purple/40"
          initial={{ width: 0, height: 0, opacity: 0.8 }}
          animate={{
            width: [0, 400 + i * 150],
            height: [0, 400 + i * 150],
            opacity: [0.8, 0],
          }}
          transition={{
            duration: RIPPLE_DURATION_S,
            delay: RIPPLE_BASE_DELAY_S + i * RIPPLE_DELAY_STEP_S,
            ease: "easeOut",
          }}
        />
      ))}

      {/* Center splash */}
      <motion.div
        className="absolute rounded-full bg-gradient-to-br from-erobo-purple/30 to-neo/20"
        initial={{ width: 20, height: 20, opacity: 0.8 }}
        animate={{
          width: [20, 150],
          height: [20, 150],
          opacity: [0.8, 0],
        }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
      />
    </motion.div>
  );
}

export default MiniAppTransition;
