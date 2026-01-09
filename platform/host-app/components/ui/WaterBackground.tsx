import React, { useEffect, useRef } from "react";
import { motion } from "framer-motion";

interface WaterBackgroundProps {
  className?: string;
  intensity?: "low" | "medium" | "high";
  primaryColor?: string;
  secondaryColor?: string;
}

/**
 * WaterBackground - E-Robo style animated water wave background
 * Efficient CSS-based animation with optional canvas enhancement
 */
export function WaterBackground({
  className = "",
  intensity = "medium",
  primaryColor = "rgba(159, 157, 243, 0.08)",
  secondaryColor = "rgba(0, 229, 153, 0.05)",
}: WaterBackgroundProps) {
  const intensityConfig = {
    low: { waves: 2, speed: 15 },
    medium: { waves: 3, speed: 12 },
    high: { waves: 4, speed: 8 },
  };

  const config = intensityConfig[intensity];

  return (
    <div className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {/* Animated wave layers */}
      {Array.from({ length: config.waves }).map((_, i) => (
        <WaveLayer
          key={i}
          index={i}
          speed={config.speed + i * 3}
          primaryColor={primaryColor}
          secondaryColor={secondaryColor}
        />
      ))}

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(159, 157, 243, 0.3) 1px, transparent 0)`,
          backgroundSize: "40px 40px",
        }}
      />
    </div>
  );
}

interface WaveLayerProps {
  index: number;
  speed: number;
  primaryColor: string;
  secondaryColor: string;
}

function WaveLayer({ index, speed, primaryColor, secondaryColor }: WaveLayerProps) {
  const isEven = index % 2 === 0;
  const color = isEven ? primaryColor : secondaryColor;
  const scale = 1 + index * 0.3;

  return (
    <motion.div
      className="absolute"
      style={{
        width: `${200 * scale}%`,
        height: `${200 * scale}%`,
        top: "-50%",
        left: "-50%",
        background: `radial-gradient(ellipse at center, ${color} 0%, transparent 50%)`,
      }}
      animate={{
        x: isEven ? [0, -25, 0] : [0, 25, 0],
        y: isEven ? [0, 10, 0] : [0, -10, 0],
      }}
      transition={{
        duration: speed,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

export default WaterBackground;
