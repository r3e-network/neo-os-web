/**
 * WaterWaveBackground - E-Robo Style Dynamic Background
 *
 * Efficient animated water wave effect using CSS animations
 * and minimal DOM elements for performance.
 */

import React, { memo } from "react";

interface WaterWaveBackgroundProps {
  className?: string;
  intensity?: "subtle" | "medium" | "strong";
  colorScheme?: "neo" | "purple" | "mixed";
}

export const WaterWaveBackground = memo(function WaterWaveBackground({
  className = "",
  intensity = "medium",
  colorScheme = "mixed",
}: WaterWaveBackgroundProps) {
  const opacityMap = {
    subtle: { primary: 0.03, secondary: 0.02 },
    medium: { primary: 0.06, secondary: 0.04 },
    strong: { primary: 0.1, secondary: 0.06 },
  };

  const colors = {
    neo: { primary: "0, 229, 153", secondary: "0, 229, 153" },
    purple: { primary: "159, 157, 243", secondary: "123, 121, 209" },
    mixed: { primary: "159, 157, 243", secondary: "0, 229, 153" },
  };

  const opacity = opacityMap[intensity];
  const color = colors[colorScheme];

  return (
    <div className={`water-wave-container ${className}`}>
      {/* Primary wave layer */}
      <div
        className="water-wave-layer water-wave-primary"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% 50%, rgba(${color.primary}, ${opacity.primary}) 0%, transparent 70%)`,
        }}
      />
      {/* Secondary wave layer */}
      <div
        className="water-wave-layer water-wave-secondary"
        style={{
          background: `radial-gradient(ellipse 60% 40% at 30% 70%, rgba(${color.secondary}, ${opacity.secondary}) 0%, transparent 60%)`,
        }}
      />
      {/* Tertiary accent */}
      <div
        className="water-wave-layer water-wave-tertiary"
        style={{
          background: `radial-gradient(circle at 70% 30%, rgba(${color.primary}, ${opacity.secondary * 0.5}) 0%, transparent 40%)`,
        }}
      />

      <style jsx>{`
        .water-wave-container {
          position: absolute;
          inset: 0;
          overflow: hidden;
          pointer-events: none;
          z-index: 0;
        }

        .water-wave-layer {
          position: absolute;
          width: 200%;
          height: 200%;
          top: -50%;
          left: -50%;
          will-change: transform;
        }

        .water-wave-primary {
          animation: waterWavePrimary 12s ease-in-out infinite;
        }

        .water-wave-secondary {
          animation: waterWaveSecondary 15s ease-in-out infinite;
        }

        .water-wave-tertiary {
          animation: waterWaveTertiary 18s ease-in-out infinite;
        }

        @keyframes waterWavePrimary {
          0%,
          100% {
            transform: translate(0, 0) scale(1);
          }
          25% {
            transform: translate(-15px, 8px) scale(1.02);
          }
          50% {
            transform: translate(-25px, 15px) scale(1);
          }
          75% {
            transform: translate(-10px, 5px) scale(0.98);
          }
        }

        @keyframes waterWaveSecondary {
          0%,
          100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(20px, -10px) rotate(1deg);
          }
          66% {
            transform: translate(-15px, 12px) rotate(-1deg);
          }
        }

        @keyframes waterWaveTertiary {
          0%,
          100% {
            transform: scale(1) translate(0, 0);
          }
          50% {
            transform: scale(1.1) translate(10px, -10px);
          }
        }
      `}</style>
    </div>
  );
});

export default WaterWaveBackground;
