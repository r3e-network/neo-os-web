import {
  useId,
  type ChangeEvent,
  type FocusEvent,
} from "react";
import "./NeoInput.scss";
import "./NeoSelect.scss";

export interface NeoSelectOption {
  value: string;
  label: string;
}

export interface NeoSelectProps {
  value?: string;
  options: NeoSelectOption[];
  label?: string;
  placeholder?: string;
  hint?: string;
  error?: string;
  disabled?: boolean;
  required?: boolean;
  "aria-label"?: string;
  className?: string;
  onChange?: (value: string) => void;
  onFocus?: (event: FocusEvent<HTMLSelectElement>) => void;
  onBlur?: (event: FocusEvent<HTMLSelectElement>) => void;
}

export function NeoSelect({
  value = "",
  options,
  label,
  placeholder,
  hint = "",
  error = "",
  disabled = false,
  required = false,
  "aria-label": ariaLabel,
  className,
  onChange,
  onFocus,
  onBlur,
}: NeoSelectProps) {
  const reactId = useId();
  const selectId = `neo-select-${reactId}`;

  const rootClasses = [
    "neo-input",
    "neo-select",
    error && "neo-input--error",
    disabled && "neo-input--disabled",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const describedBy = error
    ? `${selectId}-error`
    : hint
      ? `${selectId}-hint`
      : undefined;

  function handleChange(event: ChangeEvent<HTMLSelectElement>) {
    onChange?.(event.target.value);
  }

  return (
    <div className={rootClasses}>
      {label && (
        <span id={`${selectId}-label`} className="neo-input__label">
          {label}
        </span>
      )}
      <div className="neo-input__wrapper neo-select__wrapper">
        <select
          id={selectId}
          value={value ?? ""}
          disabled={disabled}
          aria-label={ariaLabel || (!label ? placeholder : undefined)}
          aria-labelledby={label ? `${selectId}-label` : undefined}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          onChange={handleChange}
          onFocus={onFocus}
          onBlur={onBlur}
          className="neo-input__field neo-select__field"
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <span className="neo-select__chevron" aria-hidden="true">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M3 4.5L6 7.5L9 4.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </div>
      {error ? (
        <span
          id={`${selectId}-error`}
          className="neo-input__error"
          role="alert"
          aria-live="assertive"
        >
          {error}
        </span>
      ) : hint ? (
        <span id={`${selectId}-hint`} className="neo-input__hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}
