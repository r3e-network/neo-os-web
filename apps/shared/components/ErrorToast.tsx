import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@shared/react";
import type { StatusType } from "@shared/react";
import "./ErrorToast.scss";

type ToastType = StatusType;

const DEFAULT_AUTO_HIDE_DURATION_MS = 5000;

const iconMap: Record<ToastType, string> = {
  error: "\u2715",
  success: "\u2713",
  warning: "\u26A0",
  info: "\u2139",
  danger: "\u26A1",
  loading: "\u27F3",
};

export interface ErrorToastProps {
  message: string;
  type?: ToastType;
  show: boolean;
  autoHideDuration?: number;
  onClose?: () => void;
}

export function ErrorToast({
  message,
  type = "error",
  show,
  autoHideDuration = DEFAULT_AUTO_HIDE_DURATION_MS,
  onClose,
}: ErrorToastProps) {
  const { t } = useI18n();
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>();

  useEffect(() => {
    if (timerRef.current !== undefined) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
    if (show && autoHideDuration > 0) {
      timerRef.current = setTimeout(() => onClose?.(), autoHideDuration);
    }
    return () => {
      if (timerRef.current !== undefined) {
        clearTimeout(timerRef.current);
      }
    };
  }, [show, autoHideDuration, onClose]);

  if (!show) return null;

  const content = (
    <div className={`error-toast error-toast--${type}`} role="alert">
      <div className="error-toast__content">
        <span className="error-toast__icon" aria-hidden="true">
          {iconMap[type]}
        </span>
        <span className="error-toast__message">{message}</span>
      </div>
      <button type="button" className="error-toast__close" aria-label={t("close")} onClick={onClose}>
        &times;
      </button>
    </div>
  );

  if (typeof document === "undefined") return content;
  return createPortal(content, document.body);
}

export default ErrorToast;
