import React, { useId, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from "react";

/**
 * Lightweight semantic controls for the embedded registry desk. They keep the
 * established mx2/Semi-compatible class contract used by the design system,
 * while avoiding the full Semi JavaScript runtime for two native primitives.
 */
export function OpenUiProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function OpenUiTextField({
  className,
  inputClassName,
  label,
  mono,
  ...inputProps
}: InputHTMLAttributes<HTMLInputElement> & {
  className?: string;
  inputClassName?: string;
  label: ReactNode;
  mono?: boolean;
}) {
  const generatedId = useId();
  const id = inputProps.id ?? `neo-ns-field-${generatedId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  return (
    <label
      className={["mx2-open-field", mono ? "mx2-open-field--mono" : "", className].filter(Boolean).join(" ")}
      htmlFor={id}
    >
      <span className="mx2-open-field__label">{label}</span>
      <span className={["mx2-open-field__control", inputClassName].filter(Boolean).join(" ")}>
        {React.createElement("input", { ...inputProps, id, className: "semi-input" })}
      </span>
    </label>
  );
}

export function OpenUiSegmented({
  className,
  segmentedClassName,
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  className?: string;
  segmentedClassName?: string;
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: ReactNode }>;
  disabled?: boolean;
}) {
  const labelId = useId();
  const handleArrowNavigation = (event: KeyboardEvent<HTMLDivElement>) => {
    const direction = event.key === "ArrowRight" || event.key === "ArrowDown"
      ? 1
      : event.key === "ArrowLeft" || event.key === "ArrowUp"
        ? -1
        : 0;
    if (!direction) return;
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]:not(:disabled)'));
    if (radios.length === 0) return;
    const current = radios.indexOf(document.activeElement as HTMLButtonElement);
    const next = radios[(Math.max(current, 0) + direction + radios.length) % radios.length];
    if (!next) return;
    event.preventDefault();
    next.focus();
    onChange(next.dataset.value ?? "");
  };
  return (
    <div className={["mx2-open-field", "mx2-open-field--segmented", className].filter(Boolean).join(" ")}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <div
        className={["mx2-open-segmented", "semi-radioGroup", segmentedClassName].filter(Boolean).join(" ")}
        role="radiogroup"
        aria-labelledby={labelId}
        onKeyDown={handleArrowNavigation}
      >
        {options.map((option, index) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              className={[
                "semi-radio",
                checked ? "semi-radio-checked" : "",
                disabled ? "semi-radio-disabled" : "",
              ].filter(Boolean).join(" ")}
              role="radio"
              aria-checked={checked}
              data-value={option.value}
              tabIndex={checked || (!value && index === 0) ? 0 : -1}
              disabled={disabled}
              onClick={() => onChange(option.value)}
            >
              <span className="semi-radio-inner-buttonRadio" aria-hidden="true" />
              <span className="semi-radio-content">
                <span className="semi-radio-addon-buttonRadio">{option.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
