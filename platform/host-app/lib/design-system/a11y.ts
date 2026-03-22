/**
 * Accessibility (A11y) System
 * Provides ARIA helpers, keyboard navigation, focus management, and screen reader support
 */

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// ARIA Attributes Types
// ============================================================================

export interface AriaAttributes {
  /** Identifies the element that provides an accessible description */
  ariaDescribedBy?: string;
  /** Indicates whether the element is exposed to an accessibility API */
  ariaHidden?: boolean;
  /** Indicates the input purpose */
  ariaLabel?: string;
  /** Identifies the element (or elements) that labels the current element */
  ariaLabelledBy?: string;
  /** Indicates that the element is not visible to screen readers */
  ariaLive?: "polite" | "assertive" | "off";
  /** Indicates that updates to the region should be announced */
  ariaRelevant?: "additions text" | "removals" | "text" | "all";
  /** Indicates the current value of a component */
  ariaValueNow?: number | string;
  /** Defines the maximum value for a range component */
  ariaValueMax?: number;
  /** Defines the minimum value for a range component */
  ariaValueMin?: number;
  /** Defines the human readable text alternative of aria-valuenow */
  ariaValueText?: string;
  /** Indicates whether the element is checked */
  ariaChecked?: boolean | "mixed";
  /** Indicates whether a component is disabled */
  ariaDisabled?: boolean;
  /** Indicates whether a form element is expanded */
  ariaExpanded?: boolean;
  /** Identifies the currently active element */
  ariaActiveDescendant?: string;
  /** Indicates if a gridcell is selected */
  ariaSelected?: boolean;
  /** Indicates the level of a heading element */
  ariaLevel?: number;
  /** Indicates whether the element is pressed */
  ariaPressed?: boolean;
}

export interface RoleAttributes {
  role?: string;
}

// ============================================================================
// Focus Management
// ============================================================================

/**
 * Focus trap configuration
 */
export interface FocusTrapOptions {
  /** Whether the trap is active */
  active: boolean;
  /** Initial focus element selector */
  initialFocus?: string;
  /** Whether to return focus on trap deactivate */
  returnFocus?: boolean;
}

/**
 * Hook to trap focus within an element
 */
export function useFocusTrap(options: FocusTrapOptions) {
  const { active, initialFocus = "[data-focus]", returnFocus = true } = options;
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store the currently focused element
    previousActiveElement.current = document.activeElement as HTMLElement;

    // Focus the initial focus element or first focusable element
    const focusableSelector = 
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
    
    const focusableElements = containerRef.current?.querySelectorAll(focusableSelector);
    const firstFocusable = containerRef.current?.querySelector(initialFocus) || 
      focusableElements?.[0] as HTMLElement;

    const focusTimer = setTimeout(() => (firstFocusable as HTMLElement | undefined)?.focus(), 0);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = containerRef.current?.querySelectorAll(focusableSelector);
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0] as HTMLElement;
      const last = focusable[focusable.length - 1] as HTMLElement;

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      if (returnFocus && previousActiveElement.current) {
        previousActiveElement.current.focus();
      }
    };
  }, [active, initialFocus, returnFocus]);

  return containerRef;
}

// ============================================================================
// Keyboard Navigation
// ============================================================================

/**
 * Keyboard event handler type
 */
export type KeyboardEventHandler = (event: React.KeyboardEvent) => void;

/**
 * Common keyboard navigation patterns
 */
export const keyboardNavigation = {
  /** Arrow keys navigation */
  arrowKeys: (handler: (key: "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight") => void) => 
    (e: React.KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        handler(e.key as "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight");
      }
    },

  /** Enter and Space for activation */
  activate: (handler: () => void) => 
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handler();
      }
    },

  /** Escape for closing/canceling */
  escape: (handler: () => void) => 
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handler();
      }
    },

  /** Home and End for jumping */
  jump: (handler: (key: "Home" | "End") => void) => 
    (e: React.KeyboardEvent) => {
      if (e.key === "Home" || e.key === "End") {
        e.preventDefault();
        handler(e.key as "Home" | "End");
      }
    },

  /** Arrow keys for list navigation with Home/End */
  listNavigation: (handler: (key: string, shiftKey: boolean) => void) => 
    (e: React.KeyboardEvent) => {
      if (["ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
        e.preventDefault();
        handler(e.key, e.shiftKey);
      }
    },
};

/**
 * Generate ID for keyboard navigation
 */
export function generateNavId(prefix: string, index: number): string {
  return `${prefix}-${index}`;
}

// ============================================================================
// Screen Reader Only Content
// ============================================================================

/**
 * Get screen reader only styles
 */
export function getScreenReaderOnlyStyles(): React.CSSProperties {
  return {
    position: "absolute",
    width: "1px",
    height: "1px",
    padding: 0,
    margin: "-1px",
    overflow: "hidden",
    clip: "rect(0, 0, 0, 0)",
    whiteSpace: "nowrap",
    border: 0,
  };
}

/**
 * Props for screen reader only content
 */
export interface VisuallyHiddenProps {
  children: React.ReactNode;
  /** Whether to show visually but still accessible */
  as?: React.ElementType;
}

// ============================================================================
// Live Region (for announcements)
// ============================================================================

/**
 * Live region announcement configuration
 */
export interface LiveRegionConfig {
  /** Announcement priority */
  priority?: "polite" | "assertive";
  /** Whether to disable announcements */
  disabled?: boolean;
}

/**
 * Hook for managing live region announcements
 */
export function useLiveAnnouncement() {
  const [announcement, setAnnouncement] = useState("");
  const [priority, setPriority] = useState<"polite" | "assertive">("polite");
  const announceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (announceTimerRef.current) {
        clearTimeout(announceTimerRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string, newPriority: "polite" | "assertive" = "polite") => {
    setPriority(newPriority);
    // Clear and reset to trigger re-announcement
    setAnnouncement("");
    if (announceTimerRef.current) {
      clearTimeout(announceTimerRef.current);
    }
    announceTimerRef.current = setTimeout(() => setAnnouncement(message), 50);
  }, []);

  const clear = useCallback(() => {
    setAnnouncement("");
  }, []);

  return {
    announcement,
    priority,
    announce,
    clear,
    role: "status" as const,
    "aria-live": priority,
    "aria-atomic": true,
  };
}

// ============================================================================
// Focus Visible Management
// ============================================================================

/**
 * Hook to track if keyboard is being used
 */
export function useKeyboardNavigation() {
  const [isKeyboard, setIsKeyboard] = useState(false);

  useEffect(() => {
    const handleMouseDown = () => setIsKeyboard(false);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Tab") {
        setIsKeyboard(true);
      }
    };

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return isKeyboard;
}

/**
 * Generate focus visible class based on input type
 */
export function getFocusVisibleClass(isKeyboard: boolean, baseClass: string, focusClass: string = "focus-visible"): string {
  return isKeyboard ? `${baseClass} ${focusClass}` : baseClass;
}

// ============================================================================
// Skip Link
// ============================================================================

/**
 * Skip link configuration
 */
export interface SkipLinkConfig {
  /** Target element ID to skip to */
  targetId: string;
  /** Label for the skip link */
  label: string;
  /** Additional styles */
  className?: string;
}

// ============================================================================
// Reduced Motion Detection
// ============================================================================

/**
 * Hook to detect reduced motion preference
 */
export function useReducedMotion(): boolean {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return prefersReducedMotion;
}

// ============================================================================
// Color Contrast Helpers
// ============================================================================

/**
 * Calculate relative luminance
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;

  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((c) => {
    const sRGB = c / 255;
    return sRGB <= 0.03928 ? sRGB / 12.92 : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Calculate contrast ratio between two colors
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check if contrast ratio meets WCAG requirements
 */
export function meetsWCAGContrast(
  hex1: string, 
  hex2: string, 
  level: "AA" | "AAA" = "AA",
  isLargeText: boolean = false
): boolean {
  const ratio = getContrastRatio(hex1, hex2);
  
  if (level === "AAA") {
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
  }
  
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/**
 * Convert hex to RGB
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Merge ARIA attributes
 */
export function mergeAriaProps(
  ...attrs: (AriaAttributes | undefined)[]
): AriaAttributes {
  return Object.assign({}, ...attrs.filter(Boolean)) as AriaAttributes;
}

/**
 * Generate unique ID for ARIA
 */
let ariaIdCounter = 0;
export function generateAriaId(prefix: string = "aria"): string {
  return `${prefix}-${++ariaIdCounter}`;
}

/**
 * Check if element is focusable
 */
export function isFocusable(element: HTMLElement): boolean {
  if (element.tabIndex > 0 || (element.tabIndex === 0 && element.getAttribute("tabIndex") !== null)) {
    return true;
  }

  const tagName = element.tagName.toLowerCase();
  if (["input", "select", "textarea", "button", "a", "area"].includes(tagName)) {
    return true;
  }

  return false;
}

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = 
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  
  return Array.from(container.querySelectorAll(selector))
    .filter((el): el is HTMLElement => el instanceof HTMLElement && isFocusable(el));
}

// ============================================================================
// High Contrast Mode Detection
// ============================================================================

/**
 * Hook to detect high contrast mode
 */
export function useHighContrastMode(): boolean {
  const [isHighContrast, setIsHighContrast] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-contrast: more)");
    
    setIsHighContrast(mediaQuery.matches);

    const handler = (event: MediaQueryListEvent) => {
      setIsHighContrast(event.matches);
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return isHighContrast;
}

// ============================================================================
// Focus Ring Helper
// ============================================================================

/**
 * Get focus ring styles
 */
export function getFocusRingStyles(color: string = "#00E599"): React.CSSProperties {
  return {
    outline: "none",
    boxShadow: `0 0 0 2px ${color}, 0 0 0 4px rgba(255, 255, 255, 0.5)`,
  };
}

/**
 * Get focus ring inset styles
 */
export function getFocusRingInsetStyles(color: string = "#00E599"): React.CSSProperties {
  return {
    outline: "none",
    boxShadow: `inset 0 0 0 2px ${color}`,
  };
}
