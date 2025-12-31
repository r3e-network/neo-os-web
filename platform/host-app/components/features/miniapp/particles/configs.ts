/**
 * Professional Particle Configurations
 * Industry-standard particle effects for each category
 * Optimized for performance and visual appeal
 */

import type { ISourceOptions } from "@tsparticles/engine";

// Base config optimized for banner size
const baseConfig: Partial<ISourceOptions> = {
  fullScreen: { enable: false },
  fpsLimit: 60,
  detectRetina: true,
  background: { color: "transparent" },
};

// Gaming - Premium sparkle effect with glow
export const gamingParticles: ISourceOptions = {
  ...baseConfig,
  particles: {
    number: { value: 25, density: { enable: true, width: 300, height: 200 } },
    color: { value: ["#a855f7", "#c084fc", "#e879f9", "#f0abfc"] },
    shape: { type: "circle" },
    opacity: {
      value: { min: 0.4, max: 1 },
      animation: { enable: true, speed: 0.8, sync: false, startValue: "random" },
    },
    size: {
      value: { min: 1, max: 4 },
      animation: { enable: true, speed: 2, sync: false, startValue: "random" },
    },
    move: {
      enable: true,
      speed: { min: 0.5, max: 1.5 },
      direction: "none",
      random: true,
      straight: false,
      outModes: { default: "out" },
      attract: { enable: true, rotate: { x: 600, y: 1200 } },
    },
    shadow: { enable: true, color: "#a855f7", blur: 10, offset: { x: 0, y: 0 } },
  },
  interactivity: {
    events: {
      onHover: { enable: true, mode: ["grab", "bubble"] },
    },
    modes: {
      grab: { distance: 100, links: { opacity: 0.5, color: "#c084fc" } },
      bubble: { distance: 150, size: 6, duration: 0.3, opacity: 0.8 },
    },
  },
};

// DeFi - Neural network / data flow effect
export const defiParticles: ISourceOptions = {
  ...baseConfig,
  particles: {
    number: { value: 30, density: { enable: true, width: 300, height: 200 } },
    color: { value: ["#06b6d4", "#22d3ee", "#67e8f9"] },
    shape: { type: "circle" },
    opacity: { value: { min: 0.3, max: 0.7 } },
    size: { value: { min: 1, max: 2.5 } },
    move: {
      enable: true,
      speed: { min: 0.3, max: 0.8 },
      direction: "none",
      random: false,
      straight: false,
      outModes: { default: "bounce" },
    },
    links: {
      enable: true,
      distance: 100,
      color: "#06b6d4",
      opacity: 0.25,
      width: 1,
      triangles: { enable: true, opacity: 0.05 },
    },
    shadow: { enable: true, color: "#06b6d4", blur: 8, offset: { x: 0, y: 0 } },
  },
  interactivity: {
    events: { onHover: { enable: true, mode: "grab" } },
    modes: { grab: { distance: 120, links: { opacity: 0.4 } } },
  },
};

// Social - Soft floating orbs
export const socialParticles: ISourceOptions = {
  ...baseConfig,
  particles: {
    number: { value: 20, density: { enable: true, width: 300, height: 200 } },
    color: { value: ["#ec4899", "#f472b6", "#fb7185", "#fda4af"] },
    shape: { type: "circle" },
    opacity: {
      value: { min: 0.3, max: 0.6 },
      animation: { enable: true, speed: 0.5, sync: false },
    },
    size: {
      value: { min: 3, max: 8 },
      animation: { enable: true, speed: 1.5, sync: false },
    },
    move: {
      enable: true,
      speed: { min: 0.3, max: 0.8 },
      direction: "top",
      random: true,
      straight: false,
      outModes: { default: "out", bottom: "out", top: "out" },
    },
    shadow: { enable: true, color: "#ec4899", blur: 15, offset: { x: 0, y: 0 } },
  },
  interactivity: {
    events: { onHover: { enable: true, mode: "bubble" } },
    modes: { bubble: { distance: 100, size: 12, duration: 0.4, opacity: 0.7 } },
  },
};

// Governance - Professional grid network
export const governanceParticles: ISourceOptions = {
  ...baseConfig,
  particles: {
    number: { value: 25, density: { enable: true, width: 300, height: 200 } },
    color: { value: ["#10b981", "#34d399", "#6ee7b7"] },
    shape: { type: "circle" },
    opacity: { value: 0.6 },
    size: { value: 2 },
    move: {
      enable: true,
      speed: 0.4,
      direction: "none",
      random: false,
      straight: false,
      outModes: { default: "bounce" },
    },
    links: {
      enable: true,
      distance: 90,
      color: "#10b981",
      opacity: 0.3,
      width: 1,
    },
    shadow: { enable: true, color: "#10b981", blur: 6, offset: { x: 0, y: 0 } },
  },
  interactivity: {
    events: { onHover: { enable: true, mode: "repulse" } },
    modes: { repulse: { distance: 80, duration: 0.4 } },
  },
};

// NFT - Creative multi-color sparkles
export const nftParticles: ISourceOptions = {
  ...baseConfig,
  particles: {
    number: { value: 30, density: { enable: true, width: 300, height: 200 } },
    color: {
      value: ["#8b5cf6", "#a78bfa", "#c4b5fd", "#06b6d4", "#f59e0b", "#fbbf24"],
      animation: { enable: true, speed: 20, sync: false },
    },
    shape: { type: "circle" },
    opacity: {
      value: { min: 0.4, max: 0.9 },
      animation: { enable: true, speed: 1, sync: false },
    },
    size: {
      value: { min: 1, max: 4 },
      animation: { enable: true, speed: 2, sync: false },
    },
    move: {
      enable: true,
      speed: { min: 0.5, max: 1.2 },
      direction: "none",
      random: true,
      straight: false,
      outModes: { default: "out" },
    },
    shadow: { enable: true, color: "#8b5cf6", blur: 12, offset: { x: 0, y: 0 } },
  },
  interactivity: {
    events: { onHover: { enable: true, mode: "bubble" } },
    modes: { bubble: { distance: 120, size: 6, duration: 0.3, opacity: 1 } },
  },
};

// Utility - Minimal tech dots
export const utilityParticles: ISourceOptions = {
  ...baseConfig,
  particles: {
    number: { value: 20, density: { enable: true, width: 300, height: 200 } },
    color: { value: ["#64748b", "#94a3b8", "#cbd5e1"] },
    shape: { type: "circle" },
    opacity: { value: { min: 0.3, max: 0.5 } },
    size: { value: { min: 1, max: 2 } },
    move: {
      enable: true,
      speed: 0.3,
      direction: "none",
      random: false,
      straight: false,
      outModes: { default: "bounce" },
    },
    links: {
      enable: true,
      distance: 80,
      color: "#64748b",
      opacity: 0.2,
      width: 1,
    },
  },
  interactivity: {
    events: { onHover: { enable: true, mode: "grab" } },
    modes: { grab: { distance: 100, links: { opacity: 0.4 } } },
  },
};

// Category mapping
export const categoryParticles: Record<string, ISourceOptions> = {
  gaming: gamingParticles,
  defi: defiParticles,
  social: socialParticles,
  governance: governanceParticles,
  nft: nftParticles,
  utility: utilityParticles,
};
