import type { ReactNode } from "react";
import { useI18n } from "@shared/react";
import "./FormCard.scss";

export interface FormCardProps {
  title?: string;
  /** Description text below the title */
  description?: string;
  loading?: boolean;
  /** Label for the built-in submit button */
  submitLabel?: string;
  /** Show loading spinner on submit button */
  submitLoading?: boolean;
  /** Disable the submit button */
  submitDisabled?: boolean;
  /** Validation error message */
  error?: string;
  /** Custom actions slot */
  actions?: ReactNode;
  /** Extra header content */
  headerExtra?: ReactNode;
  className?: string;
  children?: ReactNode;
  onSubmit?: () => void;
}

export function FormCard({
  title,
  description,
  loading = false,
  submitLabel,
  submitLoading = false,
  submitDisabled = false,
  error,
  actions,
  headerExtra,
  className,
  children,
  onSubmit,
}: FormCardProps) {
  const { t } = useI18n();

  const classes = ["form-card", className].filter(Boolean).join(" ");

  return (
    <div className={classes} role="form" aria-label={title || t("formLabel")}>
      {(title || description) && (
        <div className="form-card__header">
          <div className="form-card__header-text">
            {title && <span className="form-card__title">{title}</span>}
            {description && <span className="form-card__description">{description}</span>}
          </div>
          {headerExtra}
        </div>
      )}

      <div className={["form-card__body", loading && "form-card__body--loading"].filter(Boolean).join(" ")}>
        {children}
        {loading && (
          <div className="form-card__overlay" role="status" aria-label={t("loading")}>
            <div className="form-card__spinner" aria-hidden="true" />
          </div>
        )}
      </div>

      {error && (
        <div className="form-card__error" role="alert">
          <span className="form-card__error-text">{error}</span>
        </div>
      )}

      {(actions || submitLabel) && (
        <div className="form-card__actions">
          {actions || (
            <button
              type="button"
              className={[
                "form-card__submit",
                submitLoading && "form-card__submit--loading",
                submitDisabled && "form-card__submit--disabled",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={submitLoading || submitDisabled}
              onClick={() => !submitLoading && !submitDisabled && onSubmit?.()}
            >
              {submitLoading ? (
                <div className="form-card__submit-spinner" aria-hidden="true" />
              ) : (
                <span>{submitLabel}</span>
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default FormCard;
