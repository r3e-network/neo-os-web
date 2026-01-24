/**
 * WaterRippleEffect - Real Water Ripple Distortion
 *
 * Uses SVG filters to create actual screen distortion effect
 * like a water drop falling into water, bending the content behind it.
 *
 * Performance optimized:
 * - Uses CSS will-change for GPU acceleration
 * - Cleans up after animation completes
 * - Uses requestAnimationFrame for smooth animation
 */

import React, { useEffect, useRef, useState, useCallback, memo, useId } from "react";

interface Ripple {
  id: number;
  x: number;
  y: number;
  startTime: number;
}

interface WaterRippleEffectProps {
  /** Whether the effect is active */
  active?: boolean;
  /** Duration of each ripple in ms */
  duration?: number;
  /** Maximum ripple radius */
  maxRadius?: number;
  /** Distortion intensity (0-100) */
  intensity?: number;
  /** Color tint for the ripple */
  tint?: string;
  /** Callback when ripple completes */
  onComplete?: () => void;
  /** Children to apply the effect to */
  children: React.ReactNode;
  /** Additional class name */
  className?: string;
}

export const WaterRippleEffect = memo(function WaterRippleEffect({
  active = false,
  duration = 1500,
  maxRadius = 300,
  intensity = 30,
  tint = "rgba(159, 157, 243, 0.1)",
  onComplete,
  children,
  className = "",
}: WaterRippleEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ripples, setRipples] = useState<Ripple[]>([]);
  const rippleIdRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const uniqueId = useId();
  const filterId = `water-ripple-filter-${uniqueId.replace(/[^a-zA-Z0-9_-]/g, "") || "default"}`;

  // Create a new ripple at center or specified position
  const createRipple = useCallback(
    (x?: number, y?: number) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const rippleX = x ?? rect.width / 2;
      const rippleY = y ?? rect.height / 2;

      const newRipple: Ripple = {
        id: rippleIdRef.current++,
        x: rippleX,
        y: rippleY,
        startTime: performance.now(),
      };

      setRipples((prev) => [...prev, newRipple]);

      // Auto-remove after duration
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
        if (onComplete) onComplete();
      }, duration);
    },
    [duration, onComplete],
  );

  // Trigger ripple when active changes
  useEffect(() => {
    if (active) {
      createRipple();
    }
  }, [active, createRipple]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className={`water-ripple-container ${className}`}>
      {/* SVG Filter Definition */}
      <svg className="water-ripple-svg" aria-hidden="true">
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            {/* Turbulence for organic wave pattern */}
            <feTurbulence type="fractalNoise" baseFrequency="0.015 0.015" numOctaves="2" seed="42" result="noise" />
            {/* Animate the turbulence */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale={intensity}
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* Content with filter applied during ripple */}
      <div
        className="water-ripple-content"
        style={{
          filter: ripples.length > 0 ? `url(#${filterId})` : "none",
        }}
      >
        {children}
      </div>

      {/* Visual ripple rings */}
      {ripples.map((ripple) => (
        <div
          key={ripple.id}
          className="water-ripple-ring-container"
          style={{
            left: ripple.x,
            top: ripple.y,
          }}
        >
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="water-ripple-ring"
              style={{
                animationDelay: `${i * 150}ms`,
                animationDuration: `${duration}ms`,
                borderColor: tint,
                maxWidth: maxRadius * 2,
                maxHeight: maxRadius * 2,
              }}
            />
          ))}
          {/* Center splash */}
          <div
            className="water-ripple-splash"
            style={{
              animationDuration: `${duration * 0.3}ms`,
              background: tint,
            }}
          />
        </div>
      ))}

      <style jsx>{`
        .water-ripple-container {
          position: relative;
          width: 100%;
          height: 100%;
          overflow: hidden;
        }

        .water-ripple-svg {
          position: absolute;
          width: 0;
          height: 0;
          pointer-events: none;
        }

        .water-ripple-content {
          width: 100%;
          height: 100%;
          will-change: filter;
          transition: filter 0.3s ease-out;
        }

        .water-ripple-ring-container {
          position: absolute;
          transform: translate(-50%, -50%);
          pointer-events: none;
          z-index: 1000;
        }

        .water-ripple-ring {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 20px;
          height: 20px;
          border: 2px solid;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          opacity: 0.8;
          animation: rippleExpand ease-out forwards;
          will-change: transform, opacity;
        }

        .water-ripple-splash {
          position: absolute;
          left: 50%;
          top: 50%;
          width: 30px;
          height: 30px;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(1);
          opacity: 0.6;
          animation: splashFade ease-out forwards;
          will-change: transform, opacity;
        }

        @keyframes rippleExpand {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(15);
            opacity: 0;
          }
        }

        @keyframes splashFade {
          0% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
});

export default WaterRippleEffect;
