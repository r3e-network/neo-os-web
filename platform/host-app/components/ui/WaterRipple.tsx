import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface WaterRippleProps {
  children: React.ReactNode;
  className?: string;
  onRippleComplete?: () => void;
  rippleColor?: string;
  disabled?: boolean;
}

/**
 * WaterRipple - Realistic SVG-based water distortion effect
 * Uses SVG filters to physically distort (refract) the DOM content beneath it.
 */
export function WaterRipple({
  children,
  className = "",
  onRippleComplete,
  rippleColor = "rgba(159, 157, 243, 0.4)",
  disabled = false,
}: WaterRippleProps) {
  const [isDistorting, setIsDistorting] = useState(false);
  const filterId = useRef(`water-filter-${Math.random().toString(36).substr(2, 9)}`);
  const turbulenceRef = useRef<SVGFETurbulenceElement>(null);
  const displacementRef = useRef<SVGFEDisplacementMapElement>(null);
  const animationRef = useRef<number>();

  // Ripples overlay state (visual rings)
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const rippleIdCounter = useRef(0);

  const animateWater = (startTime: number) => {
    const elapsed = Date.now() - startTime;
    const duration = 1500;
    const progress = Math.min(elapsed / duration, 1);

    if (turbulenceRef.current && displacementRef.current) {
      // Animate base frequency to create "flow"
      const freq = 0.02 + progress * 0.05;
      turbulenceRef.current.setAttribute("baseFrequency", `${freq} ${freq}`);

      // Animate displacement scale: 0 -> 30 -> 0
      // Creates a strong distortion pulse
      let scale = 0;
      if (progress < 0.2) {
        scale = (progress / 0.2) * 20; // Ramp up
      } else {
        scale = 20 * (1 - (progress - 0.2) / 0.8); // Ramp down
      }
      displacementRef.current.setAttribute("scale", scale.toString());
    }

    if (progress < 1) {
      animationRef.current = requestAnimationFrame(() => animateWater(startTime));
    } else {
      setIsDistorting(false);
      if (displacementRef.current) displacementRef.current.setAttribute("scale", "0");
      onRippleComplete?.();
    }
  };

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled) return;

      // 1. Trigger Overlay Ripples
      const rect = e.currentTarget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const id = ++rippleIdCounter.current;
      setRipples((prev) => [...prev, { id, x, y }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== id));
      }, 1200);

      // 2. Trigger Distortion (Bending)
      setIsDistorting(true);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      animateWater(Date.now());
    },
    [disabled, onRippleComplete],
  );

  useEffect(() => {
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onClick={handleClick}
      style={{
        // Apply the filter to the container. 
        // Note: This distorts EVERYTHING inside (text, images, borders).
        filter: isDistorting ? `url(#${filterId.current})` : 'none',
        willChange: isDistorting ? 'filter' : 'auto' // optimize rendering
      }}
    >
      {/* SVG Filter Definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0, pointerEvents: 'none' }}>
        <defs>
          <filter id={filterId.current} x="-20%" y="-20%" width="140%" height="140%" filterUnits="objectBoundingBox" primitiveUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
            {/* Generate water texture noise */}
            <feTurbulence
              ref={turbulenceRef}
              type="fractalNoise"
              baseFrequency="0.02 0.02"
              numOctaves="1"
              seed="5"
              stitchTiles="stitch"
              result="noise"
            />
            {/* Displace the source graphic using the noise */}
            <feDisplacementMap
              ref={displacementRef}
              in="SourceGraphic"
              in2="noise"
              scale="0"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

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
      {[0, 1].map((i) => (
        <motion.div
          key={i}
          className="absolute pointer-events-none rounded-full"
          style={{
            left: x,
            top: y,
            transform: "translate(-50%, -50%)",
            border: `1.5px solid ${color}`,
            boxShadow: `0 0 20px ${color}`,
          }}
          initial={{ width: 0, height: 0, opacity: 0.6 }}
          animate={{
            width: [0, 400 + i * 100],
            height: [0, 400 + i * 100],
            opacity: [0.6, 0],
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: 1.5,
            delay: i * 0.2,
            ease: "easeOut",
          }}
        />
      ))}
    </>
  );
}

export default WaterRipple;

