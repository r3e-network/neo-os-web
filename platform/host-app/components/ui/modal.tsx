/**
 * Modal Component - Enhanced with design system tokens
 * Supports various sizes, animations, and accessibility features
 */

import React, { useEffect, useCallback, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useFocusTrap, keyboardNavigation, generateAriaId } from "@/lib/design-system/a11y";
import { IconButton } from "./button";

export type ModalSize = "sm" | "md" | "lg" | "xl" | "full";
export type ModalAnimation = "fade" | "zoom" | "slide" | "none";

export interface ModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Modal title (for accessibility) */
  title?: React.ReactNode;
  /** Modal content */
  children: React.ReactNode;
  /** Modal size */
  size?: ModalSize;
  /** Whether to show close button */
  showCloseButton?: boolean;
  /** Whether to close on overlay click */
  closeOnOverlayClick?: boolean;
  /** Whether to close on escape key */
  closeOnEscape?: boolean;
  /** Whether to show animation */
  animated?: boolean;
  /** Animation type */
  animation?: ModalAnimation;
  /** Footer content */
  footer?: React.ReactNode;
  /** Whether the modal is a dialog (has focus trap) */
  asDialog?: boolean;
  /** Additional class names */
  className?: string;
  /** Modal ID */
  id?: string;
}

// ============================================================================
// Size Styles
// ============================================================================

const sizeStyles: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
};

// ============================================================================
// Animation Styles
// ============================================================================

const animationStyles = {
  fade: {
    enter: "opacity-0",
    enterActive: "opacity-100",
    exit: "opacity-100",
    exitActive: "opacity-0",
  },
  zoom: {
    enter: "opacity-0 scale-95",
    enterActive: "opacity-100 scale-100",
    exit: "opacity-100 scale-100",
    exitActive: "opacity-0 scale-95",
  },
  slide: {
    enter: "opacity-0 translate-y-4",
    enterActive: "opacity-100 translate-y-0",
    exit: "opacity-100 translate-y-0",
    exitActive: "opacity-0 translate-y-4",
  },
  none: {
    enter: "",
    enterActive: "",
    exit: "",
    exitActive: "",
  },
};

// ============================================================================
// Modal Component
// ============================================================================

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = "md",
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  animated = true,
  animation = "zoom",
  footer,
  asDialog = true,
  className,
  id,
}) => {
  const modalId = useId();
  const titleId = generateAriaId("modal-title");
  const descriptionId = generateAriaId("modal-description");
  const modalRef = useRef<HTMLDivElement | null>(null);

  // Use focus trap for dialog
  const focusTrapRef = useFocusTrap({
    active: isOpen && asDialog,
    initialFocus: "[data-modal-focus]",
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

  // Prevent body scroll when modal is open
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
    [closeOnOverlayClick, onClose]
  );

  // Animation classes
  const animationClass = animated
    ? `transition-all duration-200 ease-out ${animationStyles[animation]?.[isOpen ? "enterActive" : "exitActive"] || ""}`
    : "";

  // If not open, don't render
  if (!isOpen) return null;

  // Render to portal
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-describedby={descriptionId}
    >
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        ref={(node) => {
          modalRef.current = node;
          if (asDialog) {
            focusTrapRef.current = node as HTMLDivElement;
          }
        }}
        id={id || modalId}
        className={cn(
          // Base styles
          "relative w-full bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl",
          // Size
          sizeStyles[size],
          // Animation
          animationClass,
          // Class
          className
        )}
        data-modal-focus
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            {title && (
              <h2
                id={titleId}
                className="text-lg font-semibold text-white"
              >
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
                label="Close modal"
                onClick={onClose}
                size="sm"
              />
            )}
          </div>
        )}

        {/* Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-800">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

Modal.displayName = "Modal";

// ============================================================================
// Confirm Modal (Simple confirmation dialog)
// ============================================================================

export interface ConfirmModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Modal title */
  title: string;
  /** Confirmation message */
  message: string;
  /** Confirm button text */
  confirmText?: string;
  /** Cancel button text */
  cancelText?: string;
  /** Confirm button variant */
  confirmVariant?: "primary" | "danger";
  /** Callback when confirmed */
  onConfirm: () => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}) => {
  const handleConfirm = useCallback(() => {
    onConfirm();
    onCancel();
  }, [onConfirm, onCancel]);

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="sm">
      <p className="text-gray-300 mb-6">{message}</p>
      <div className="flex justify-end gap-3">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
        >
          {cancelText}
        </button>
        <button
          onClick={handleConfirm}
          className={cn(
            "px-4 py-2 text-sm font-semibold rounded-lg transition-colors",
            confirmVariant === "danger"
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-neo hover:bg-neo/90 text-gray-900"
          )}
        >
          {confirmText}
        </button>
      </div>
    </Modal>
  );
};

ConfirmModal.displayName = "ConfirmModal";
