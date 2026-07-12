import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";

function useFieldId(prefix: string, provided?: string) {
  const id = useId();
  return provided || `${prefix}-${id.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

export function OpenUiProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  className?: string;
  hint?: ReactNode;
  inputClassName?: string;
  label: ReactNode;
  mono?: boolean;
}

export function OpenUiTextField({
  className,
  hint,
  inputClassName,
  label,
  mono = false,
  id: providedId,
  ...inputProps
}: TextFieldProps) {
  const id = useFieldId("certificate-field", providedId);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label
      className={["mx2-open-field", mono ? "mx2-open-field--mono" : "", className].filter(Boolean).join(" ")}
      htmlFor={id}
    >
      <span className="mx2-open-field__label">{label}</span>
      <input
        {...inputProps}
        id={id}
        aria-describedby={[inputProps["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined}
        className={["mx2-open-field__control", "semi-input", inputClassName].filter(Boolean).join(" ")}
      />
      {hint && <span id={hintId} className="mx2-open-field__hint">{hint}</span>}
    </label>
  );
}

interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> {
  className?: string;
  hint?: ReactNode;
  label: ReactNode;
  textareaClassName?: string;
}

export function OpenUiTextArea({
  className,
  hint,
  label,
  textareaClassName,
  id: providedId,
  ...textareaProps
}: TextAreaProps) {
  const id = useFieldId("certificate-textarea", providedId);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label className={["mx2-open-field", "mx2-open-field--textarea", className].filter(Boolean).join(" ")} htmlFor={id}>
      <span className="mx2-open-field__label">{label}</span>
      <textarea
        {...textareaProps}
        id={id}
        aria-describedby={[textareaProps["aria-describedby"], hintId].filter(Boolean).join(" ") || undefined}
        className={["mx2-open-field__control", "mx2-open-field__control--textarea", "semi-input", "semi-input-textarea", textareaClassName].filter(Boolean).join(" ")}
      />
      {hint && <span id={hintId} className="mx2-open-field__hint">{hint}</span>}
    </label>
  );
}

interface SegmentedOption {
  disabled?: boolean;
  label: ReactNode;
  value: string;
}

interface SegmentedProps {
  className?: string;
  label: ReactNode;
  onChange?: (value: string) => void;
  options: SegmentedOption[];
  segmentedClassName?: string;
  value?: string;
}

export function OpenUiSegmented({
  className,
  label,
  onChange,
  options,
  segmentedClassName,
  value,
}: SegmentedProps) {
  const labelId = useFieldId("certificate-segmented");
  return (
    <div className={["mx2-open-field", "mx2-open-field--segmented", className].filter(Boolean).join(" ")}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <div
        className={["mx2-open-segmented", "semi-radioGroup", segmentedClassName].filter(Boolean).join(" ")}
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {options.map((option) => {
          const checked = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              className={["semi-radio", checked ? "semi-radio-checked" : ""].filter(Boolean).join(" ")}
              disabled={option.disabled}
              onClick={() => onChange?.(option.value)}
            >
              <span className="semi-radio-addon-buttonRadio">{option.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

interface PanelProps {
  className?: string;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  children?: ReactNode;
}

export function OpenUiPanel({ className, icon, title, subtitle, titleId, children }: PanelProps) {
  const resolvedTitleId = useFieldId("certificate-panel", titleId);
  return (
    <div
      role="group"
      aria-labelledby={resolvedTitleId}
      className={["mx2-open-panel", "semi-card", className].filter(Boolean).join(" ")}
    >
      <div className="semi-card-header">
        <div className="semi-card-header-wrapper">
          <div className="semi-card-header-wrapper-title">
            <div className="mx2-open-panel__head">
              {icon && <span className="mx2-open-panel__icon">{icon}</span>}
              <div className="mx2-open-panel__copy">
                <strong id={resolvedTitleId}>{title}</strong>
                {subtitle && <span>{subtitle}</span>}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="semi-card-body">{children}</div>
    </div>
  );
}
