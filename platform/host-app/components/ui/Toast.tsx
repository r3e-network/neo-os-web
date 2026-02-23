/**
 * Toast Component - Notification system with various types and animations
 * Supports auto-dismiss, stacking, and custom actions
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useId,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";

export type ToastType = "success" | "error" | "warning" | "info" | "default";
export type ToastPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  dismissible?: boolean;
}

export interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, "id">) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
  success: (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) => string;
  error: (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) => string;
  warning: (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) => string;
  info: (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) => string;
}

// ============================================================================
// Toast Context
// ============================================================================

const ToastContext = createContext<ToastContextValue | null>(null);

// ============================================================================
// Toast Provider
// ============================================================================

export interface ToastProviderProps {
  children: React.ReactNode;
  /** Default toast duration in ms */
  defaultDuration?: number;
  /** Maximum number of toasts to show */
  maxToasts?: number;
  /** Toast position */
  position?: ToastPosition;
}

export const ToastProvider: React.FC<ToastProviderProps> = ({
  children,
  defaultDuration = 5000,
  maxToasts = 5,
  position = "top-right",
}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Add toast
  const addToast = useCallback(
    (toast: Omit<Toast, "id">): string => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newToast: Toast = {
        ...toast,
        id,
        duration: toast.duration ?? defaultDuration,
      };

      setToasts((prev) => {
        const updated = [...prev, newToast];
        return updated.slice(-maxToasts);
      });

      return id;
    },
    [defaultDuration, maxToasts]
  );

  // Remove toast
  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Clear all toasts
  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Helper methods
  const success = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) =>
      addToast({ type: "success", message, ...options }),
    [addToast]
  );

  const error = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) =>
      addToast({ type: "error", message, duration: 8000, ...options }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) =>
      addToast({ type: "warning", message, ...options }),
    [addToast]
  );

  const info = useCallback(
    (message: string, options?: Partial<Omit<Toast, "id" | "type" | "message">>) =>
      addToast({ type: "info", message, ...options }),
    [addToast]
  );

  const value: ToastContextValue = {
    toasts,
    addToast,
    removeToast,
    clearAll,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} position={position} />
    </ToastContext.Provider>
  );
};

// ============================================================================
// Hook to use Toast
// ============================================================================

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

// ============================================================================
// Toast Icon
// ============================================================================

const toastIcons: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  default: (
    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
};

// ============================================================================
// Toast Container
// ============================================================================

interface ToastContainerProps {
  toasts: Toast[];
  position: ToastPosition;
}

const positionStyles: Record<ToastPosition, string> = {
  "top-left": "top-4 left-4",
  "top-center": "top-4 left-1/2 -translate-x-1/2",
  "top-right": "top-4 right-4",
  "bottom-left": "bottom-4 left-4",
  "bottom-center": "bottom-4 left-1/2 -translate-x-1/2",
  "bottom-right": "bottom-4 right-4",
};

const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, position }) => {
  return createPortal(
    <div
      className={cn(
        "fixed z-[1700] flex flex-col gap-2 pointer-events-none",
        positionStyles[position]
      )}
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>,
    document.body
  );
};

// ============================================================================
// Individual Toast
// ============================================================================

interface ToastItemProps {
  toast: Toast;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast }) => {
  const { removeToast } = useToast();
  const [isExiting, setIsExiting] = useState(false);

  // Auto dismiss
  useEffect(() => {
    if (!toast.duration || toast.duration <= 0) return;

    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => removeToast(toast.id), 200);
    }, toast.duration);

    return () => clearTimeout(timer);
  }, [toast.duration, toast.id, removeToast]);

  const handleDismiss = () => {
    setIsExiting(true);
    setTimeout(() => removeToast(toast.id), 200);
  };

  return (
    <div
      className={cn(
        "pointer-events-auto w-80 max-w-[calc(100vw-2rem)]",
        "bg-gray-800 border border-gray-700 rounded-xl shadow-lg",
        "flex items-start gap-3 p-4",
        "transition-all duration-200 ease-out",
        isExiting
          ? "opacity-0 translate-x-4"
          : "animate-fade-in-up"
      )}
      role="alert"
      aria-live="polite"
    >
      {/* Icon */}
      <div className="shrink-0">{toastIcons[toast.type]}</div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {toast.title && (
          <p className="font-semibold text-white text-sm">{toast.title}</p>
        )}
        <p className="text-sm text-gray-300">{toast.message}</p>
        {toast.action && (
          <button
            onClick={toast.action.onClick}
            className="mt-2 text-sm font-medium text-neo hover:text-neo/80 transition-colors"
          >
            {toast.action.label}
          </button>
        )}
      </div>

      {/* Dismiss button */}
      {(toast.dismissible !== false) && (
        <button
          onClick={handleDismiss}
          className="shrink-0 text-gray-400 hover:text-white transition-colors"
          aria-label="Dismiss notification"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};

// ============================================================================
// Standalone Toast (non-provider based)
// ============================================================================

export interface StandaloneToastProps extends Toast {
  onClose: () => void;
}

export const StandaloneToast: React.FC<StandaloneToastProps> = ({
  type,
  title,
  message,
  action,
  dismissible = true,
  onClose,
}) => {
  return (
    <div
      className={cn(
        "w-80 max-w-[calc(100vw-2rem)]",
        "bg-gray-800 border border-gray-700 rounded-xl shadow-lg",
        "flex items-start gap-3 p-4",
        "animate-fade-in-up"
      )}
      role="alert"
      aria-live="polite"
    >
      <div className="shrink-0">{toastIcons[type]}</div>
      <div className="flex-1 min-w-0">
        {title && <p className="font-semibold text-white text-sm">{title}</p>}
        <p className="text-sm text-gray-300">{message}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="mt-2 text-sm font-medium text-neo hover:text-neo/80"
          >
            {action.label}
          </button>
        )}
      </div>
      {dismissible && (
        <button
          onClick={onClose}
          className="shrink-0 text-gray-400 hover:text-white"
          aria-label="Dismiss"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
};
