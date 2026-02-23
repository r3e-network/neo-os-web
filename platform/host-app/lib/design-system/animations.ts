/**
 * Animation System - Smooth Transitions and Effects
 * Provides animation utilities, keyframes, and transition helpers
 */

// ============================================================================
// Animation Keyframes (CSS-in-JS compatible)
// ============================================================================

export const keyframes = {
  // Fade animations
  fadeIn: {
    from: { opacity: "0" },
    to: { opacity: "1" },
  },
  fadeOut: {
    from: { opacity: "1" },
    to: { opacity: "0" },
  },
  fadeInUp: {
    from: { opacity: "0", transform: "translateY(10px)" },
    to: { opacity: "1", transform: "translateY(0)" },
  },
  fadeInDown: {
    from: { opacity: "0", transform: "translateY(-10px)" },
    to: { opacity: "1", transform: "translateY(0)" },
  },
  fadeInLeft: {
    from: { opacity: "0", transform: "translateX(-10px)" },
    to: { opacity: "1", transform: "translateX(0)" },
  },
  fadeInRight: {
    from: { opacity: "0", transform: "translateX(10px)" },
    to: { opacity: "1", transform: "translateX(0)" },
  },

  // Scale animations
  scaleIn: {
    from: { opacity: "0", transform: "scale(0.95)" },
    to: { opacity: "1", transform: "scale(1)" },
  },
  scaleOut: {
    from: { opacity: "1", transform: "scale(1)" },
    to: { opacity: "0", transform: "scale(0.95)" },
  },
  scaleInCenter: {
    from: { opacity: "0", transform: "scale(0)" },
    to: { opacity: "1", transform: "scale(1)" },
  },

  // Slide animations
  slideInUp: {
    from: { transform: "translateY(100%)" },
    to: { transform: "translateY(0)" },
  },
  slideInDown: {
    from: { transform: "translateY(-100%)" },
    to: { transform: "translateY(0)" },
  },
  slideInLeft: {
    from: { transform: "translateX(-100%)" },
    to: { transform: "translateX(0)" },
  },
  slideInRight: {
    from: { transform: "translateX(100%)" },
    to: { transform: "translateX(0)" },
  },

  // Shimmer effect
  shimmer: {
    from: { backgroundPosition: "200% 0" },
    to: { backgroundPosition: "-200% 0" },
  },

  // Pulse glow
  pulseGlow: {
    "0%, 100%": { boxShadow: "0 0 5px rgba(0, 229, 153, 0.4)" },
    "50%": { boxShadow: "0 0 20px rgba(0, 229, 153, 0.8)" },
  },

  // Border glow
  borderGlow: {
    "0%, 100%": { borderColor: "rgba(0, 229, 153, 0.2)" },
    "50%": { borderColor: "rgba(112, 0, 255, 0.5)" },
  },

  // Spin (for loading)
  spin: {
    from: { transform: "rotate(0deg)" },
    to: { transform: "rotate(360deg)" },
  },

  // Bounce
  bounce: {
    "0%, 100%": { transform: "translateY(0)" },
    "50%": { transform: "translateY(-10%)" },
  },

  // Shake
  shake: {
    "0%, 100%": { transform: "translateX(0)" },
    "10%, 30%, 50%, 70%, 90%": { transform: "translateX(-5px)" },
    "20%, 40%, 60%, 80%": { transform: "translateX(5px)" },
  },

  // Wiggle
  wiggle: {
    "0%, 100%": { transform: "rotate(-3deg)" },
    "50%": { transform: "rotate(3deg)" },
  },

  // Float
  float: {
    "0%, 100%": { transform: "translateY(0px)" },
    "50%": { transform: "translateY(-10px)" },
  },

  // Progress bar indeterminate
  progressIndeterminate: {
    "0%": { transform: "translateX(-100%)" },
    "50%": { transform: "translateX(100%)" },
    "100%": { transform: "translateX(-100%)" },
  },
} as const;

// ============================================================================
// Animation Durations
// ============================================================================

export const durations = {
  instant: "0ms",
  fastest: "75ms",
  faster: "100ms",
  fast: "150ms",
  normal: "200ms",
  slow: "300ms",
  slower: "500ms",
  slowest: "700ms",
} as const;

// ============================================================================
// Easing Functions
// ============================================================================

export const easings = {
  // Cubic Bezier
  linear: "linear",
  ease: "ease",
  easeIn: "ease-in",
  easeOut: "ease-out",
  easeInOut: "ease-in-out",
  
  // Custom
  easeInQuad: "cubic-bezier(0.55, 0.085, 0.68, 0.53)",
  easeOutQuad: "cubic-bezier(0.25, 0.46, 0.45, 0.94)",
  easeInOutQuad: "cubic-bezier(0.455, 0.03, 0.515, 0.955)",
  
  easeInCubic: "cubic-bezier(0.55, 0.055, 0.675, 0.19)",
  easeOutCubic: "cubic-bezier(0.215, 0.61, 0.355, 1)",
  easeInOutCubic: "cubic-bezier(0.645, 0.045, 0.355, 1)",
  
  easeInQuart: "cubic-bezier(0.895, 0.03, 0.685, 0.22)",
  easeOutQuart: "cubic-bezier(0.165, 0.84, 0.44, 1)",
  easeInOutQuart: "cubic-bezier(0.77, 0, 0.175, 1)",
  
  easeInQuint: "cubic-bezier(0.755, 0.05, 0.855, 0.06)",
  easeOutQuint: "cubic-bezier(0.23, 1, 0.32, 1)",
  easeInOutQuint: "cubic-bezier(0.86, 0, 0.07, 1)",
  
  easeInExpo: "cubic-bezier(0.95, 0.05, 0.795, 0.035)",
  easeOutExpo: "cubic-bezier(0.19, 1, 0.22, 1)",
  easeInOutExpo: "cubic-bezier(1, 0, 0, 1)",
  
  easeInBack: "cubic-bezier(0.6, -0.28, 0.735, 0.045)",
  easeOutBack: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  easeInOutBack: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  
  // Spring-like (custom)
  spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  springBounce: "cubic-bezier(0.68, -0.55, 0.265, 1.55)",
} as const;

// ============================================================================
// Animation Configuration
// ============================================================================

export interface AnimationConfig {
  keyframes: keyof typeof keyframes | string[];
  duration: keyof typeof durations | number;
  easing?: keyof typeof easings | string;
  delay?: keyof typeof durations | number;
  iterations?: number;
  direction?: "normal" | "reverse" | "alternate" | "alternate-reverse";
  fill?: "none" | "forwards" | "backwards" | "both";
}

export const defaultAnimationConfig: AnimationConfig = {
  keyframes: "fadeIn",
  duration: "normal",
  easing: "easeOut",
  fill: "forwards",
};

export const springAnimationConfig: AnimationConfig = {
  keyframes: "fadeInUp",
  duration: "slow",
  easing: "spring",
  fill: "forwards",
};

// ============================================================================
// Transition Presets
// ============================================================================

export const transitions = {
  // Base transitions
  none: "none",
  
  // Fast transitions
  fast: "75ms ease-out",
  "fast-in": "75ms ease-in",
  "fast-in-out": "75ms ease-in-out",
  
  // Normal transitions
  normal: "150ms ease-out",
  "normal-in": "150ms ease-in",
  "normal-out": "150ms ease-out",
  "normal-in-out": "150ms ease-in-out",
  
  // Slow transitions
  slow: "200ms ease-out",
  "slow-in": "200ms ease-in",
  "slow-out": "200ms ease-out",
  "slow-in-out": "200ms ease-in-out",
  
  // Slower transitions
  slower: "300ms ease-out",
  "slower-in": "300ms ease-in",
  "slower-out": "300ms ease-out",
  "slower-in-out": "300ms ease-in-out",
  
  // Smooth transitions with custom easing
  smooth: "300ms cubic-bezier(0.4, 0, 0.2, 1)",
  "smooth-in": "300ms cubic-bezier(0.4, 0, 1, 1)",
  "smooth-out": "300ms cubic-bezier(0, 0, 0.2, 1)",
  "smooth-in-out": "300ms cubic-bezier(0.4, 0, 0.2, 1)",
  
  // Bouncy transitions
  bouncy: "500ms cubic-bezier(0.68, -0.55, 0.265, 1.55)",
  "bouncy-in": "500ms cubic-bezier(0.55, 0.055, 0.675, 0.19)",
  "bouncy-out": "500ms cubic-bezier(0.175, 0.885, 0.32, 1.275)",
  
  // Page transitions
  pageIn: "200ms ease-out",
  pageOut: "150ms ease-in",
  
  // Modal transitions
  modalIn: "300ms cubic-bezier(0.16, 1, 0.3, 1)",
  modalOut: "200ms cubic-bezier(0.7, 0, 0.84, 0)",
  
  // Drawer transitions
  drawerIn: "300ms cubic-bezier(0.32, 1, 0.23, 1)",
  drawerOut: "250ms cubic-bezier(0.32, 1, 0.23, 1)",
  
  // Color transitions
  color: "150ms ease",
  "color-slow": "300ms ease",
  
  // Transform transitions
  transform: "150ms ease-out",
  "transform-slow": "300ms ease-out",
} as const;

// ============================================================================
// Transition Helper Functions
// ============================================================================

/**
 * Generate a CSS transition string
 */
export function createTransition(
  properties: string | string[],
  duration: keyof typeof durations | number = "normal",
  easing: keyof typeof easings | string = "easeOut",
  delay: keyof typeof durations | number = "instant"
): string {
  const durationValue = typeof duration === "number" ? `${duration}ms` : durations[duration];
  const delayValue = typeof delay === "number" ? `${delay}ms` : durations[delay];
  const easingValue = typeof easing === "string" ? (easings[easing as keyof typeof easings] || easing) : easings[easing as keyof typeof easings];
  
  const props = Array.isArray(properties) ? properties.join(", ") : properties;
  
  return `${props} ${durationValue} ${easingValue} ${delayValue}`;
}

/**
 * Generate a CSS animation string
 */
export function createAnimation(
  keyframesName: string,
  duration: keyof typeof durations | number = "normal",
  easing: keyof typeof easings | string = "easeOut",
  delay: keyof typeof durations | number = "instant",
  iterations: number | "infinite" = 1,
  direction: AnimationConfig["direction"] = "normal",
  fill: AnimationConfig["fill"] = "forwards"
): string {
  const durationValue = typeof duration === "number" ? `${duration}ms` : durations[duration];
  const delayValue = typeof delay === "number" ? `${delay}ms` : durations[delay];
  const easingValue = typeof easing === "string" ? (easings[easing as keyof typeof easings] || easing) : easings[easing as keyof typeof easings];
  
  return `${keyframesName} ${durationValue} ${easingValue} ${delayValue} ${iterations} ${direction} ${fill}`;
}

// ============================================================================
// Predefined Animation Classes (for Tailwind/CSS)
// ============================================================================

export const animationClasses = {
  // Fade animations
  "animate-fade-in": "animate-fade-in",
  "animate-fade-out": "animate-fade-out",
  "animate-fade-in-up": "animate-fade-in-up",
  "animate-fade-in-down": "animate-fade-in-down",
  "animate-fade-in-left": "animate-fade-in-left",
  "animate-fade-in-right": "animate-fade-in-right",
  
  // Scale animations
  "animate-scale-in": "animate-scale-in",
  "animate-scale-out": "animate-scale-out",
  "animate-scale-in-center": "animate-scale-in-center",
  
  // Slide animations
  "animate-slide-in-up": "animate-slide-in-up",
  "animate-slide-in-down": "animate-slide-in-down",
  "animate-slide-in-left": "animate-slide-in-left",
  "animate-slide-in-right": "animate-slide-in-right",
  
  // Special effects
  "animate-shimmer": "animate-shimmer",
  "animate-pulse-glow": "animate-pulse-glow",
  "animate-border-glow": "animate-border-glow",
  "animate-float": "animate-float",
  "animate-bounce": "animate-bounce",
  "animate-shake": "animate-shake",
  
  // Loading states
  "animate-spin": "animate-spin",
  "animate-pulse": "animate-pulse",
} as const;

// ============================================================================
// Reduced Motion Support
// ============================================================================

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Get animation value based on reduced motion preference
 */
export function getAnimationWithReducedMotion(
  normalAnimation: string,
  reducedMotionValue: string = "none"
): string {
  return prefersReducedMotion() ? reducedMotionValue : normalAnimation;
}

// ============================================================================
// Utility: Animate Number (for counters)
// ============================================================================

/**
 * Easing function for number animation
 */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/**
 * Easing function for number animation (quartic)
 */
export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

/**
 * Linear interpolation
 */
export function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

/**
 * Clamp a value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
