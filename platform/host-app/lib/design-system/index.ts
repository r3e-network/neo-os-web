/**
 * Design System - Unified Design Tokens and Components
 * 
 * This module exports all design system utilities and components:
 * - tokens: Design tokens (colors, spacing, typography, etc.)
 * - theme: Theme configuration and switching (dark/light mode)
 * - animations: Animation and transition utilities
 * - a11y: Accessibility helpers and ARIA utilities
 */

// ============================================================================
// Tokens Export
// ============================================================================

export * from "./tokens";

// ============================================================================
// Theme Export
// ============================================================================

export * from "./theme";

// ============================================================================
// Animations Export
// ============================================================================

export * from "./animations";

// ============================================================================
// A11y Export
// ============================================================================

export * from "./a11y";

// ============================================================================
// Re-export commonly used items for convenience
// ============================================================================

export { cn } from "@/lib/utils";
export { useTheme, ThemeProvider } from "./theme";
export { useReducedMotion, useLiveAnnouncement, useFocusTrap, keyboardNavigation } from "./a11y";
export { transitions, keyframes, easings, durations } from "./animations";
