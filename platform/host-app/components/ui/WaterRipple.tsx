import React, { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface RipplePoint {
  id: number;
  x: number;
  y: number;
}

interface WaterRippleProps {
  children: React.ReactNode;
  className?: string;
  onRippleComplete?: () => void;
  rippleColor?: string;
  disabled?: boolean;
}

/**
 * WaterRipple - E-Robo style water ripple effect component
 * Creates concentric ripple rings on click, like a stone dropping into water
 */
export function WaterRipple({
  children,
  className = "",
  onRippleComplete,
  rippleColor = "rgba(159, 157, 243, 0.4)",
  disabled = false,
}: WaterRippleProps) {
  const [ripples, setRipples] = useState<RipplePoint[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const rippleIdRef = useRef(0);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++rippleIdRef.current;

      setRipples((prev) => [...prev, { id, x, y }]);

      // Remove ripple after animation completes
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
        onRippleComplete?.();
      }, 1200);
    },
    [disabled, onRippleComplete],
  );

  return (
    <div ref={containerRef} className={`relative overflow-hidden ${className}`} onClick={handleClick}>
      {children}
      <AnimatePresence>
        {ripples.map((ripple) => (
          <RippleEffect key={ripple.id} x={ripple.x} y={ripple.y} color={rippleColor} />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface RippleEffectProps {
  x: number;
  y: number;
  color: string;
}

function RippleEffect({ x, y, color }: RippleEffectProps) {
  return (
    <>
      {/* Multiple concentric rings for water effect */}
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: x,
            top: y,
            transform: "translate(-50%, -50%)",
            border: `2px solid ${color}`,
          }}
          initial={{ width: 0, height: 0, opacity: 0.8 }}
          animate={{
            width: [0, 300 + i * 80],
            height: [0, 300 + i * 80],
            opacity: [0.8, 0],
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.2,
            delay: i * 0.15,
            ease: "easeOut",
          }}
        />
      ))}
      {/* Center splash effect */}
      <motion.div
        className="absolute pointer-events-none rounded-full"
        style={{
          left: x,
          top: y,
          transform: "translate(-50%, -50%)",
          background: color,
        }}
        initial={{ width: 20, height: 20, opacity: 0.6 }}
        animate={{
          width: [20, 60],
          height: [20, 60],
          opacity: [0.6, 0],
        }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      />
    </>
  );
}

export default WaterRipple;
