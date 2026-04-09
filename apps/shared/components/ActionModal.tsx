import { useEffect, useRef, useId, useCallback, type ReactNode, type KeyboardEvent, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { AppIcon } from "./AppIcon";
import { useI18n } from "@shared/react";
import "./ActionModal.scss";

export type ActionModalVariant = "default" | "success" | "warning" | "danger";
export type ActionModalSize = "sm" | "md" | "lg";

export interface ActionModalProps {
  visible: boolean;
  title?: string;
  /** Description text shown below the header */
  description?: string;
  variant?: ActionModalVariant;
  size?: ActionModalSize;
  closeable?: boolean;
  /** Label for the confirm button (enables default action buttons) */
  confirmLabel?: string;
  /** Label for the cancel button */
  cancelLabel?: string;
  /** Show loading spinner on confirm button */
  confirmLoading?: boolean;
  /** Custom actions slot content */
  actions?: ReactNode;
  children?: ReactNode;
  onClose?: () => void;
  onConfirm?: () => void;
  onCancel?: () => void;
}

export function ActionModal({
  visible,
  title,
  description,
  variant = "default",
  size = "md",
  closeable = true,
  confirmLabel,
  cancelLabel,
  confirmLoading = false,
  actions,
  children,
  onClose,
  onConfirm,
  onCancel,
}: ActionModalProps) {
  const { t } = useI18n();
  const contentRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const reactId = useId();
  const modalId = `action-modal-${reactId}`;

  // Focus management
  useEffect(() => {
    if (visible) {
      previouslyFocusedRef.current = typeof document !== "undefined" ? (document.activeElement as HTMLElement) : null;
      // Focus first focusable element after render
      requestAnimationFrame(() => {
        const focusable = contentRef.current?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        (focusable || contentRef.current)?.focus?.();
      });
    } else if (previouslyFocusedRef.current) {
      previouslyFocusedRef.current.focus?.();
      previouslyFocusedRef.current = null;
    }
  }, [visible]);

  const handleBackdropClick = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget && closeable) {
        onClose?.();
      }
    },
    [closeable, onClose],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape" && closeable) {
        onClose?.();
      }
    },
    [closeable, onClose],
  );

  if (!visible) return null;

  const sizeClass = `action-modal--size-${size}`;

  const modalContent = (
    <div
      className="action-modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? `${modalId}-title` : undefined}
      aria-describedby={description ? `${modalId}-desc` : undefined}
      aria-label={title ? undefined : t("dialogAriaLabel")}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={contentRef}
        className={[
          "action-modal__content",
          variant !== "default" && `action-modal--${variant}`,
          sizeClass,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {(title || closeable) && (
          <div className="action-modal__header">
            {title && (
              <span id={`${modalId}-title`} className="action-modal__title">
                {title}
              </span>
            )}
            {closeable && (
              <button
                type="button"
                className="action-modal__close"
                aria-label={t("close")}
                onClick={onClose}
              >
                <AppIcon name="x" size={20} decorative />
              </button>
            )}
          </div>
        )}

        {description && (
          <div id={`${modalId}-desc`} className="action-modal__description">
            <span>{description}</span>
          </div>
        )}

        <div className="action-modal__body">{children}</div>

        {(actions || confirmLabel) && (
          <div className="action-modal__actions">
            {actions || (
              <div className="action-modal__default-actions">
                {cancelLabel && (
                  <button
                    type="button"
                    className="action-modal__btn action-modal__btn--cancel"
                    onClick={onCancel}
                  >
                    <span>{cancelLabel}</span>
                  </button>
                )}
                <button
                  type="button"
                  className={[
                    "action-modal__btn action-modal__btn--confirm",
                    confirmLoading && "action-modal__btn--loading",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  disabled={confirmLoading}
                  onClick={() => !confirmLoading && onConfirm?.()}
                >
                  {confirmLoading ? (
                    <div className="action-modal__btn-spinner" aria-hidden="true" />
                  ) : (
                    <span>{confirmLabel}</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return modalContent;
  return createPortal(modalContent, document.body);
}

export default ActionModal;
