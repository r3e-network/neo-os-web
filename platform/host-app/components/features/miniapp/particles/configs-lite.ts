/**
 * Lightweight Particle Configurations
 * Optimized for performance - reduced particles, no shadows, simpler animations
 */

import type { ISourceOptions } from "@tsparticles/engine";

const baseLiteConfig: Partial<ISourceOptions> = {
  fullScreen: { enable: false },
  fpsLimit: 30, // Reduced from 60
  detectRetina: false, // Disable for performance
  background: { color: "transparent" },
};

// Gaming - Simplified sparkles
export const gamingParticlesLite: ISourceOptions = {
  ...baseLiteConfig,
  particles: {
    number: { value: 8, density: { enable: false } },
    color: { value: ["#a855f7", "#c084fc"] },
    shape: { type: "circle" },
    opacity: { value: 0.6 },
    size: { value: { min: 1, max: 3 } },
    move: {
      enable: true,
      speed: 0.5,
      direction: "none",
      random: true,
      outModes: { default: "out" },
    },
  },
};

// DeFi - Simple dots
export const defiParticlesLite: ISourceOptions = {
  ...baseLiteConfig,
  particles: {
    number: { value: 10, density: { enable: false } },
    color: { value: "#06b6d4" },
    shape: { type: "circle" },
    opacity: { value: 0.5 },
    size: { value: 2 },
    move: {
      enable: true,
      speed: 0.3,
      outModes: { default: "bounce" },
    },
    links: {
      enable: true,
      distance: 80,
      color: "#06b6d4",
      opacity: 0.2,
      width: 1,
    },
  },
};

// Social - Floating dots
export const socialParticlesLite: ISourceOptions = {
  ...baseLiteConfig,
  particles: {
    number: { value: 6, density: { enable: false } },
    color: { value: "#ec4899" },
    shape: { type: "circle" },
    opacity: { value: 0.5 },
    size: { value: { min: 2, max: 5 } },
    move: {
      enable: true,
      speed: 0.4,
      direction: "top",
      outModes: { default: "out" },
    },
  },
};

// Governance - Grid dots
export const governanceParticlesLite: ISourceOptions = {
  ...baseLiteConfig,
  particles: {
    number: { value: 8, density: { enable: false } },
    color: { value: "#10b981" },
    shape: { type: "circle" },
    opacity: { value: 0.5 },
    size: { value: 2 },
    move: {
      enable: true,
      speed: 0.3,
      outModes: { default: "bounce" },
    },
    links: {
      enable: true,
      distance: 70,
      color: "#10b981",
      opacity: 0.2,
      width: 1,
    },
  },
};

// NFT - Color dots
export const nftParticlesLite: ISourceOptions = {
  ...baseLiteConfig,
  particles: {
    number: { value: 8, density: { enable: false } },
    color: { value: ["#8b5cf6", "#06b6d4", "#f59e0b"] },
    shape: { type: "circle" },
    opacity: { value: 0.6 },
    size: { value: { min: 1, max: 3 } },
    move: {
      enable: true,
      speed: 0.5,
      random: true,
      outModes: { default: "out" },
    },
  },
};

// Utility - Minimal dots
export const utilityParticlesLite: ISourceOptions = {
  ...baseLiteConfig,
  particles: {
    number: { value: 6, density: { enable: false } },
    color: { value: "#64748b" },
    shape: { type: "circle" },
    opacity: { value: 0.4 },
    size: { value: 2 },
    move: {
      enable: true,
      speed: 0.2,
      outModes: { default: "bounce" },
    },
  },
};

// Category mapping for lite configs
export const categoryParticlesLite: Record<string, ISourceOptions> = {
  gaming: gamingParticlesLite,
  defi: defiParticlesLite,
  social: socialParticlesLite,
  governance: governanceParticlesLite,
  nft: nftParticlesLite,
  utility: utilityParticlesLite,
};
