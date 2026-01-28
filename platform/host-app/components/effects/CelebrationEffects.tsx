/**
 * CelebrationEffects - Unified Celebration Effects System
 *
 * Provides various celebration effects for miniapp operations:
 * - Fireworks: For winning, jackpots, achievements
 * - Confetti: For success, completion, milestones
 * - CoinRain: For rewards, earnings, bonuses
 * - Sparkle: For subtle highlights, selections
 *
 * All effects are GPU-accelerated and auto-cleanup after completion.
 */

import React, { useEffect, useRef, useCallback, memo } from "react";

export type EffectType = "fireworks" | "confetti" | "coinrain" | "sparkle" | "none";

interface CelebrationEffectsProps {
  type: EffectType;
  active: boolean;
  duration?: number;
  intensity?: "low" | "medium" | "high";
  onComplete?: () => void;
}

// Particle base class
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  rotation?: number;
  rotationSpeed?: number;
}

// Color palettes for different effects
const PALETTES: Record<Exclude<EffectType, "none">, string[]> = {
  fireworks: ["#FF4D4D", "#FFDE59", "#00E599", "#A855F7", "#FF6B9D", "#00D4FF"],
  confetti: ["#9F9DF3", "#F7AAC7", "#00E599", "#FFDE59", "#FF6B9D", "#A855F7"],
  coinrain: ["#FFD700", "#FFA500", "#FFDE59", "#F4C430", "#DAA520"],
  sparkle: ["#FFFFFF", "#9F9DF3", "#00E599", "#F7AAC7"],
};

export const CelebrationEffects = memo(function CelebrationEffects({
  type,
  active,
  duration = 3000,
  intensity = "medium",
  onComplete,
}: CelebrationEffectsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const intensityMap = { low: 0.5, medium: 1, high: 1.5 };
  const multiplier = intensityMap[intensity];

  // Create particles based on effect type
  const createParticles = useCallback(
    (canvas: HTMLCanvasElement) => {
      const particles: Particle[] = [];
      if (type === "none") return particles;
      const palette = PALETTES[type];

      switch (type) {
        case "fireworks":
          // Create multiple explosion points
          for (let burst = 0; burst < 3 * multiplier; burst++) {
            const cx = Math.random() * canvas.width;
            const cy = Math.random() * canvas.height * 0.6 + canvas.height * 0.1;
            const count = Math.floor(40 * multiplier);

            for (let i = 0; i < count; i++) {
              const angle = (Math.PI * 2 * i) / count + Math.random() * 0.3;
              const speed = 2 + Math.random() * 4;
              particles.push({
                x: cx,
                y: cy,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1,
                maxLife: 1,
                color: palette[Math.floor(Math.random() * palette.length)],
                size: 2 + Math.random() * 2,
              });
            }
          }
          break;

        case "confetti": {
          const confettiCount = Math.floor(60 * multiplier);
          for (let i = 0; i < confettiCount; i++) {
            particles.push({
              x: Math.random() * canvas.width,
              y: -20 - Math.random() * 100,
              vx: (Math.random() - 0.5) * 2,
              vy: 2 + Math.random() * 3,
              life: 1,
              maxLife: 1,
              color: palette[Math.floor(Math.random() * palette.length)],
              size: 6 + Math.random() * 4,
              rotation: Math.random() * 360,
              rotationSpeed: (Math.random() - 0.5) * 10,
            });
          }
          break;
        }

        case "coinrain": {
          const coinCount = Math.floor(25 * multiplier);
          for (let i = 0; i < coinCount; i++) {
            particles.push({
              x: Math.random() * canvas.width,
              y: -30 - Math.random() * 200,
              vx: (Math.random() - 0.5) * 1,
              vy: 3 + Math.random() * 2,
              life: 1,
              maxLife: 1,
              color: palette[Math.floor(Math.random() * palette.length)],
              size: 12 + Math.random() * 8,
              rotation: 0,
              rotationSpeed: 5 + Math.random() * 5,
            });
          }
          break;
        }

        case "sparkle": {
          const sparkleCount = Math.floor(30 * multiplier);
          for (let i = 0; i < sparkleCount; i++) {
            particles.push({
              x: Math.random() * canvas.width,
              y: Math.random() * canvas.height,
              vx: 0,
              vy: -0.5 - Math.random() * 0.5,
              life: Math.random(),
              maxLife: 1,
              color: palette[Math.floor(Math.random() * palette.length)],
              size: 2 + Math.random() * 3,
            });
          }
          break;
        }
      }

      return particles;
    },
    [type, multiplier],
  );

  // Animation loop
  const animate = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update and draw particles
      const particles = particlesRef.current;
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];

        // Update position
        p.x += p.vx;
        p.y += p.vy;

        // Apply physics based on type
        switch (type) {
          case "fireworks":
            p.vy += 0.08; // gravity
            p.life -= 0.02;
            break;
          case "confetti":
            p.vx += (Math.random() - 0.5) * 0.1; // flutter
            p.rotation = (p.rotation || 0) + (p.rotationSpeed || 0);
            if (p.y > canvas.height) p.life = 0;
            break;
          case "coinrain":
            p.rotation = (p.rotation || 0) + (p.rotationSpeed || 0);
            if (p.y > canvas.height + 50) p.life = 0;
            break;
          case "sparkle":
            p.life -= 0.015;
            p.size *= 0.99;
            break;
        }

        // Remove dead particles
        if (p.life <= 0) {
          particles.splice(i, 1);
          continue;
        }

        // Draw particle
        ctx.save();
        ctx.globalAlpha = p.life * (1 - progress * 0.3);
        ctx.fillStyle = p.color;

        if (type === "confetti") {
          ctx.translate(p.x, p.y);
          ctx.rotate(((p.rotation || 0) * Math.PI) / 180);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (type === "coinrain") {
          // Draw coin with 3D rotation effect
          ctx.translate(p.x, p.y);
          const scaleX = Math.abs(Math.cos(((p.rotation || 0) * Math.PI) / 180));
          ctx.scale(scaleX, 1);
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
          // Coin shine
          ctx.fillStyle = "rgba(255,255,255,0.4)";
          ctx.beginPath();
          ctx.arc(-p.size / 6, -p.size / 6, p.size / 4, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Fireworks and sparkle - circular
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();

          // Add glow for fireworks
          if (type === "fireworks") {
            ctx.shadowColor = p.color;
            ctx.shadowBlur = 10;
            ctx.fill();
          }
        }

        ctx.restore();
      }

      // Continue animation or complete
      if (progress < 1 && particles.length > 0) {
        animationRef.current = requestAnimationFrame(() => animate(ctx, canvas));
      } else {
        onComplete?.();
      }
    },
    [type, duration, onComplete],
  );

  // Start effect
  useEffect(() => {
    if (!active || type === "none") return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize
    startTimeRef.current = performance.now();
    particlesRef.current = createParticles(canvas);

    // Start animation
    animate(ctx, canvas);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [active, type, createParticles, animate]);

  if (!active || type === "none") return null;

  return (
    <canvas
      ref={canvasRef}
      className="celebration-canvas"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        zIndex: 9999,
      }}
    />
  );
});

export default CelebrationEffects;
