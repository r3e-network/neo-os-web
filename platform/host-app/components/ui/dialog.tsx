"use client";

import { type ReactNode, useEffect, useId, useCallback, useRef, createContext, useContext } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Focus-trap hook (WCAG 2.1 Level A -- modal dialog requirement)
// ---------------------------------------------------------------------------

const FOCUSABLE_SELECTOR = [
  'a[href]:not([tabindex="-1"])',
  'button:not([disabled]):not([tabindex="-1"])',
  'input:not([disabled]):not([tabindex="-1"])',
  'select:not([disabled]):not([tabindex="-1"])',
  'textarea:not([disabled]):not([tabindex="-1"])',
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function useFocusTrap(active: boolean) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Store the element that had focus before the dialog opened
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    // Focus the first focusable element inside the dialog
    const focusFirst = () => {
      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length > 0) {
        focusable[0].focus();
      } else {
        // Fallback: make the container itself focusable so focus stays inside
        container.setAttribute("tabindex", "-1");
        container.focus();
      }
    };

    // Small delay to let the DOM settle after render
    const rafId = requestAnimationFrame(focusFirst);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const focusable = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        // Shift+Tab: wrap from first to last
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap from last to first
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(rafId);
      container.removeEventListener("keydown", handleKeyDown);

      // Restore focus to the previously focused element
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [active]);

  return containerRef;
}

// ---------------------------------------------------------------------------
// Dialog label context -- allows DialogTitle to register its id automatically
// ---------------------------------------------------------------------------

const DialogLabelContext = createContext<string | undefined>(undefined);

// ---------------------------------------------------------------------------
// Dialog
// ---------------------------------------------------------------------------

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  const titleId = useId();

  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    },
    [onOpenChange],
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, handleEscape]);

  const focusTrapRef = useFocusTrap(open);

  if (!open) return null;

  return (
    <DialogLabelContext.Provider value={titleId}>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => onOpenChange(false)} />
        <div ref={focusTrapRef} className="relative z-50" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          {children}
        </div>
      </div>
    </DialogLabelContext.Provider>
  );
}

/** Context-free unique ID hook for dialog labelling */
export { useId as useDialogId };

// ---------------------------------------------------------------------------
// DialogContent
// ---------------------------------------------------------------------------

interface DialogContentProps {
  children: ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div className={cn("bg-white dark:bg-erobo-bg-card rounded-lg p-6 max-w-md w-full mx-4 shadow-xl", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// DialogHeader
// ---------------------------------------------------------------------------

interface DialogHeaderProps {
  children: ReactNode;
  className?: string;
}

export function DialogHeader({ children, className }: DialogHeaderProps) {
  return <div className={cn("mb-4", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// DialogTitle
// ---------------------------------------------------------------------------

interface DialogTitleProps {
  children: ReactNode;
  className?: string;
}

export function DialogTitle({ children, className }: DialogTitleProps) {
  const titleId = useContext(DialogLabelContext);
  return (
    <h3 id={titleId} className={cn("text-lg font-semibold text-erobo-ink dark:text-white", className)}>
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// DialogDescription
// ---------------------------------------------------------------------------

interface DialogDescriptionProps {
  children: ReactNode;
  className?: string;
}

export function DialogDescription({ children, className }: DialogDescriptionProps) {
  return <p className={cn("text-sm text-erobo-ink-soft dark:text-slate-300 mt-1", className)}>{children}</p>;
}
