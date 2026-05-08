/**
 * Drawer Component - Slide-in panel for side navigation and content
 * Supports various positions, sizes, and animations
 */

import React, { useEffect, useCallback, useId } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useFocusTrap, generateAriaId } from "@/lib/design-system/a11y";
import { IconButton } from "./button";

export type DrawerPosition = "left" | "right" | "top" | "bottom";
export type DrawerSize = "sm" | "md" | "lg" | "xl" | "full";

export interface DrawerProps {
  /** Whether the drawer is open */
  isOpen: boolean;
  /** Callback when drawer should close */
  onClose: () => void;
  /** Drawer title (for accessibility) */
  title?: React.ReactNode;
  /** Drawer content */
  children?: React.ReactNode;
  /** Drawer position */
  position?: DrawerPosition;
  /** Drawer size */
  size?: DrawerSize;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether to close on overlay click */
  closeOnOverlayClick?: boolean;
  /** Whether to close on escape key */
  closeOnEscape?: boolean;
  /** Whether to show backdrop */
  showBackdrop?: boolean;
  /** Whether the drawer is a dialog */
  asDialog?: boolean;
  /** Footer content */
  footer?: React.ReactNode;
  /** Additional class names */
  className?: string;
  /** Drawer ID */
  id?: string;
}

// ============================================================================
// Position & Size Styles
// ============================================================================

const positionStyles: Record<DrawerPosition, string> = {
  left: "left-0 top-0 h-full",
  right: "right-0 top-0 h-full",
  top: "top-0 left-0 w-full",
  bottom: "bottom-0 left-0 w-full",
};

const sizeStyles: Record<DrawerSize, { width: string; height: string }> = {
  sm: { width: "max-w-sm", height: "max-h-[40vh]" },
  md: { width: "max-w-md", height: "max-h-[60vh]" },
  lg: { width: "max-w-lg", height: "max-h-[80vh]" },
  xl: { width: "max-w-xl", height: "max-h-[90vh]" },
  full: { width: "w-full", height: "h-full" },
};

// ============================================================================
// Transform Styles
// ============================================================================

const transformStyles: Record<DrawerPosition, { enter: string; exit: string }> =
  {
    left: {
      enter: "-translate-x-full",
      exit: "translate-x-0",
    },
    right: {
      enter: "translate-x-full",
      exit: "-translate-x-0",
    },
    top: {
      enter: "-translate-y-full",
      exit: "translate-y-0",
    },
    bottom: {
      enter: "translate-y-full",
      exit: "-translate-y-0",
    },
  };

// ============================================================================
// Drawer Component
// ============================================================================

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  children,
  position = "right",
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  showBackdrop = true,
  asDialog = true,
  footer,
  className,
  id,
}) => {
  const drawerId = useId();
  const titleId = generateAriaId("drawer-title");

  // Use focus trap for dialog
  const focusTrapRef = useFocusTrap({
    active: isOpen && asDialog,
    initialFocus: "[data-drawer-focus]",
    returnFocus: true,
  });

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Handle overlay click
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (closeOnOverlayClick && e.target === e.currentTarget) {
        onClose();
      }
    },
    [closeOnOverlayClick, onClose],
  );

  // Get size styles based on position
  const isHorizontal = position === "left" || position === "right";
  const sizeValue = sizeStyles[size];
  const sizeClass = isHorizontal ? sizeValue.width : sizeValue.height;

  // Animation classes
  const transformValue = isOpen
    ? transformStyles[position].exit
    : transformStyles[position].enter;

  // If not open, don't render
  if (!isOpen) return null;

  // Render to portal
  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex"
      role="dialog"
      aria-modal={asDialog}
      aria-labelledby={title ? titleId : undefined}
    >
      {/* Backdrop */}
      {showBackdrop && (
        <div
          className={cn(
            "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
            isOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={handleOverlayClick}
          aria-hidden="true"
        />
      )}

      {/* Drawer Container */}
      <div
        id={id || drawerId}
        className={cn(
          // Base styles
          "relative bg-gray-900 border-gray-800 shadow-2xl",
          // Position
          positionStyles[position],
          // Size
          sizeClass,
          // Animation
          "transition-transform duration-300 ease-out",
          transformValue,
          // Direction-specific border
          position === "right" && "border-l",
          position === "left" && "border-r",
          position === "top" && "border-b",
          position === "bottom" && "border-t",
          // Class
          className,
        )}
        data-drawer-focus
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
            {title && (
              <h2 id={titleId} className="text-lg font-semibold text-white">
                {title}
              </h2>
            )}
            {showCloseButton && (
              <IconButton
                icon={
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                }
                label="Close drawer"
                onClick={onClose}
                size="sm"
              />
            )}
          </div>
        )}

        {/* Content */}
        <div
          className={cn(
            "px-6 py-4 overflow-y-auto",
            position === "left" || position === "right"
              ? "h-[calc(100%-65px)]"
              : "",
          )}
        >
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

Drawer.displayName = "Drawer";

// ============================================================================
// Sheet (Alternative name with different API)
// ============================================================================

export interface SheetProps extends Omit<
  DrawerProps,
  "title" | "isOpen" | "onClose"
> {
  /** Trigger element */
  trigger?: React.ReactNode;
  /** Sheet content */
  content?: React.ReactNode;
  /** Whether sheet is controlled externally */
  open?: boolean;
  /** onOpenChange callback */
  onOpenChange?: (open: boolean) => void;
}

export const Sheet: React.FC<SheetProps> = ({
  open,
  onOpenChange,
  children,
  ...props
}) => {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;

  const handleClose = useCallback(() => {
    if (isControlled) {
      onOpenChange?.(false);
    } else {
      setInternalOpen(false);
    }
  }, [isControlled, onOpenChange]);

  return (
    <>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(
              child as React.ReactElement<Record<string, unknown>>,
              {
                onClick: () => {
                  if (!isControlled) {
                    setInternalOpen(true);
                  }
                  const props = child.props as Record<string, unknown>;
                  if (typeof props.onClick === "function") props.onClick();
                },
              },
            )
          : child,
      )}
      <Drawer isOpen={isOpen} onClose={handleClose} {...props} />
    </>
  );
};

Sheet.displayName = "Sheet";
