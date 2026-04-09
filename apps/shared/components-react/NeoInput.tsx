import {
  useId,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import "./NeoInput.scss";

export interface NeoInputProps {
  value?: string | number;
  type?: "text" | "number" | "password" | "textarea";
  label?: string;
  placeholder?: string;
  suffix?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  min?: number;
  max?: number;
  /** Accessibility label for screen readers -- use when no visible label is provided */
  "aria-label"?: string;
  className?: string;
  onChange?: (value: string) => void;
  onFocus?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
}

export function NeoInput({
  value = "",
  type = "text",
  label,
  placeholder = "",
  suffix = "",
  hint = "",
  error = "",
  disabled = false,
  required = false,
  min,
  max,
  "aria-label": ariaLabel,
  className,
  onChange,
  onFocus,
  onBlur,
}: NeoInputProps) {
  const reactId = useId();
  const inputId = `neo-input-${reactId}`;

  const rootClasses = [
    "neo-input",
    error && "neo-input--error",
    disabled && "neo-input--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const describedBy = error
    ? `${inputId}-error`
    : hint
      ? `${inputId}-hint`
      : undefined;

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    onChange?.(event.target.value);
  }

  const sharedProps = {
    id: inputId,
    value: value ?? "",
    placeholder,
    disabled,
    "aria-label": ariaLabel || (!label ? placeholder : undefined),
    "aria-labelledby": label ? `${inputId}-label` : undefined,
    "aria-describedby": describedBy,
    "aria-invalid": error ? (true as const) : undefined,
    "aria-required": required || undefined,
    onChange: handleChange,
    onFocus,
    onBlur,
  };

  return (
    <div className={rootClasses}>
      {label && (
        <span id={`${inputId}-label`} className="neo-input__label">
          {label}
        </span>
      )}
      <div className="neo-input__wrapper">
        {type === "textarea" ? (
          <textarea
            {...sharedProps}
            className="neo-input__field neo-input__textarea"
          />
        ) : (
          <input
            {...sharedProps}
            type={type}
            min={min}
            max={max}
            className="neo-input__field"
          />
        )}
        {suffix && (
          <div className="neo-input__suffix">
            <span>{suffix}</span>
          </div>
        )}
      </div>
      {error ? (
        <span
          id={`${inputId}-error`}
          className="neo-input__error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </span>
      ) : hint ? (
        <span id={`${inputId}-hint`} className="neo-input__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
