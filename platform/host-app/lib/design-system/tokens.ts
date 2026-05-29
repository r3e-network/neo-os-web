/**
 * Design Tokens - Centralized Design System Values
 * Unified design tokens for colors, spacing, typography, and more
 */

// ============================================================================
// Color Tokens
// ============================================================================

export const colors = {
  // Primary Colors — Neo brand green
  primary: {
    DEFAULT: "#16C784",
    50: "#e9faf2",
    100: "#d6f7ec",
    200: "#aef0d8",
    300: "#6fe3b8",
    400: "#34d399",
    500: "#16C784",
    600: "#0fb174",
    700: "#0c9c66",
    800: "#0a7d52",
    900: "#08603f",
  },

  // Secondary Colors — Neo Soft violet
  secondary: {
    DEFAULT: "#7B61FF",
    50: "#f3f0ff",
    100: "#eeeaff",
    200: "#ddd4ff",
    300: "#c4b5ff",
    400: "#a48dff",
    500: "#7B61FF",
    600: "#6a4df4",
    700: "#5b3fe0",
    800: "#4a32bd",
    900: "#3a2899",
  },

  // Accent/Neo Brand Color
  neo: {
    DEFAULT: "#16C784",
    hover: "#0fb174",
    glow: "rgba(22, 199, 132, 0.4)",
    muted: "rgba(22, 199, 132, 0.1)",
  },

  // Interactive Violet
  electric: {
    DEFAULT: "#7B61FF",
    glow: "rgba(123, 97, 255, 0.4)",
    muted: "rgba(123, 97, 255, 0.1)",
  },

  // Semantic Colors
  success: {
    DEFAULT: "#16C784",
    light: "#E4F8F0",
    dark: "#0c9c66",
  },
  warning: {
    DEFAULT: "#F5A623",
    light: "#FFF3DD",
    dark: "#B45309",
  },
  error: {
    DEFAULT: "#EA3943",
    light: "#FDE7E9",
    dark: "#B91C1C",
  },
  info: {
    DEFAULT: "#3E8CFF",
    light: "#E6F0FF",
    dark: "#1D4ED8",
  },

  // Neutral Colors
  gray: {
    50: "#F9FAFB",
    100: "#F3F4F6",
    200: "#E5E7EB",
    300: "#D1D5DB",
    400: "#9CA3AF",
    500: "#6B7280",
    600: "#4B5563",
    700: "#374151",
    800: "#1F2937",
    900: "#111827",
    950: "#030712",
  },

  // Background
  background: {
    DEFAULT: "#F4F5F7",
    light: "#F4F5F7",
  },

  // Foreground
  foreground: {
    DEFAULT: "#1E1E2E",
    light: "#1E1E2E",
  },

  // Border
  border: {
    DEFAULT: "#E6E8EE",
    light: "#E6E8EE",
  },

  // Input
  input: {
    DEFAULT: "#E6E8EE",
    light: "#E6E8EE",
  },

  // Ring
  ring: {
    DEFAULT: "#7B61FF",
    light: "#7B61FF",
  },

  // Card
  card: {
    DEFAULT: "#FFFFFF",
    light: "#FFFFFF",
    foreground: "#1E1E2E",
  },
} as const;

// ============================================================================
// Spacing Tokens
// ============================================================================

export const spacing = {
  0: "0",
  0.5: "0.125rem",   // 2px
  1: "0.25rem",      // 4px
  1.5: "0.375rem",  // 6px
  2: "0.5rem",      // 8px
  2.5: "0.625rem",  // 10px
  3: "0.75rem",     // 12px
  3.5: "0.875rem",  // 14px
  4: "1rem",        // 16px
  5: "1.25rem",     // 20px
  6: "1.5rem",      // 24px
  7: "1.75rem",     // 28px
  8: "2rem",        // 32px
  9: "2.25rem",     // 36px
  10: "2.5rem",     // 40px
  11: "2.75rem",    // 44px
  12: "3rem",       // 48px
  14: "3.5rem",     // 56px
  16: "4rem",       // 64px
  20: "5rem",       // 80px
  24: "6rem",       // 96px
  28: "7rem",       // 112px
  32: "8rem",       // 128px
  36: "9rem",       // 144px
  40: "10rem",      // 160px
} as const;

// ============================================================================
// Typography Tokens
// ============================================================================

export const typography = {
  // Font Family
  fontFamily: {
    sans: ["Inter", "system-ui", "sans-serif"],
    mono: ["JetBrains Mono", "monospace"],
    display: ["Space Grotesk", "sans-serif"],
  },

  // Font Size
  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],      // 12px
    sm: ["0.875rem", { lineHeight: "1.25rem" }],  // 14px
    base: ["1rem", { lineHeight: "1.5rem" }],      // 16px
    lg: ["1.125rem", { lineHeight: "1.75rem" }],  // 18px
    xl: ["1.25rem", { lineHeight: "1.75rem" }],  // 20px
    "2xl": ["1.5rem", { lineHeight: "2rem" }],    // 24px
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }], // 30px
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }],   // 36px
    "5xl": ["3rem", { lineHeight: "1" }],            // 48px
  },

  // Font Weight
  fontWeight: {
    thin: "100",
    extralight: "200",
    light: "300",
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
    extrabold: "800",
    black: "900",
  },

  // Letter Spacing
  letterSpacing: {
    tighter: "-0.05em",
    tight: "-0.025em",
    normal: "0",
    wide: "0.025em",
    wider: "0.05em",
    widest: "0.1em",
  },

  // Line Height
  lineHeight: {
    none: "1",
    tight: "1.25",
    snug: "1.375",
    normal: "1.5",
    relaxed: "1.625",
    loose: "2",
  },
} as const;

// ============================================================================
// Border Radius Tokens
// ============================================================================

export const borderRadius = {
  none: "0",
  sm: "0.125rem",    // 2px
  DEFAULT: "0.25rem", // 4px
  md: "0.375rem",    // 6px
  lg: "0.5rem",      // 8px
  xl: "0.75rem",     // 12px
  "2xl": "1.5rem",   // 24px
  "3xl": "2rem",     // 32px
  full: "9999px",
} as const;

// ============================================================================
// Shadow Tokens
// ============================================================================

export const shadows = {
  none: "none",
  sm: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
  DEFAULT: "0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)",
  md: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  lg: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
  xl: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  "2xl": "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
  inner: "inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)",
  glow: "0 0 15px rgba(22, 199, 132, 0.4)",
  "glow-lg": "0 0 30px rgba(22, 199, 132, 0.5)",
  "glow-secondary": "0 0 15px rgba(112, 0, 255, 0.4)",
  "glow-error": "0 0 15px rgba(239, 68, 68, 0.4)",
} as const;

// ============================================================================
// Z-Index Scale
// ============================================================================

export const zIndex = {
  0: 0,
  10: 10,
  20: 20,
  30: 30,
  40: 40,
  50: 50,
  dropdown: 1000,
  sticky: 1100,
  fixed: 1200,
  modalBackdrop: 1300,
  modal: 1400,
  popover: 1500,
  tooltip: 1600,
  toast: 1700,
} as const;

// ============================================================================
// Breakpoints
// ============================================================================

export const breakpoints = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const;

// ============================================================================
// Transitions
// ============================================================================

export const transitions = {
  none: "none",
  fast: "75ms",
  DEFAULT: "150ms",
  normal: "200ms",
  slow: "300ms",
  slower: "500ms",
} as const;

// ============================================================================
// Motion (Animation Durations)
// ============================================================================

export const motion = {
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
// Utility Type Helpers
// ============================================================================

export type ColorKey = keyof typeof colors;
export type SpacingKey = keyof typeof spacing;
export type BorderRadiusKey = keyof typeof borderRadius;
export type ShadowKey = keyof typeof shadows;
export type ZIndexKey = keyof typeof zIndex;
export type BreakpointKey = keyof typeof breakpoints;
export type TransitionKey = keyof typeof transitions;
export type MotionKey = keyof typeof motion;
