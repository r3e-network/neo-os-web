/**
 * RippleTransition - Stone Drop Water Ripple Effect
 *
 * Creates a ripple animation when opening MiniApps,
 * simulating a stone dropping into water.
 */

import React, { useState, useCallback } from "react";
import { createPortal } from "react-dom";



interface RippleState {
  active: boolean;
  x: number;
  y: number;
}

export function useRippleTransition() {
  const [ripple, setRipple] = useState<RippleState>({
    active: false,
    x: 0,
    y: 0,
  });

  const triggerRipple = useCallback((x: number, y: number, callback?: () => void) => {
    setRipple({ active: true, x, y });

    // Execute callback after animation
    setTimeout(() => {
      callback?.();
    }, 400);

    // Reset after full animation
    setTimeout(() => {
      setRipple({ active: false, x: 0, y: 0 });
    }, 1000);
  }, []);

  return { ripple, triggerRipple };
}

export function RippleOverlay({
  active,
  x,
  y,
  color = "rgba(159, 157, 243, 0.3)",
}: {
  active: boolean;
  x: number;
  y: number;
  color?: string;
}) {
  if (!active || typeof document === "undefined") return null;

  return createPortal(
    <div className="ripple-overlay">
      {/* Multiple concentric rings */}
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="ripple-ring"
          style={{
            left: x,
            top: y,
            animationDelay: `${i * 100}ms`,
            borderColor: color,
          }}
        />
      ))}

      {/* Center splash */}
      <div className="ripple-splash" style={{ left: x, top: y, backgroundColor: color }} />

      <style jsx>{`
        .ripple-overlay {
          position: fixed;
          inset: 0;
          pointer-events: none;
          z-index: 9999;
          overflow: hidden;
        }

        .ripple-ring {
          position: absolute;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 2px solid;
          transform: translate(-50%, -50%) scale(0);
          animation: rippleExpand 0.8s ease-out forwards;
        }

        .ripple-splash {
          position: absolute;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          transform: translate(-50%, -50%) scale(0);
          animation: splashPulse 0.6s ease-out forwards;
        }

        @keyframes rippleExpand {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0.8;
          }
          100% {
            transform: translate(-50%, -50%) scale(25);
            opacity: 0;
          }
        }

        @keyframes splashPulse {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          50% {
            transform: translate(-50%, -50%) scale(3);
            opacity: 0.6;
          }
          100% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}

export default RippleOverlay;
