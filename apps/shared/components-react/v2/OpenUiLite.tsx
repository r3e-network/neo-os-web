import {
  useId,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";

/**
 * Semantic, dependency-light Open UI adapters.
 *
 * They preserve the shared mx2 + Semi-compatible class contract used by the
 * design-system stylesheet, but render native controls and do not ship the
 * full Semi UI JavaScript runtime into every focused MiniApp.
 */
export function OpenUiLiteProvider({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function OpenUiLitePanel({
  className,
  icon,
  title,
  subtitle,
  titleId,
  children,
}: {
  className?: string;
  icon?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  titleId?: string;
  children?: ReactNode;
}) {
  const generatedTitleId = `mx2-lite-panel-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  const resolvedTitleId = titleId || generatedTitleId;
  return (
    <section
      className={["mx2-open-panel", "semi-card", className].filter(Boolean).join(" ")}
      role="group"
      aria-labelledby={resolvedTitleId}
    >
      <header className="semi-card-header">
        <div className="semi-card-header-wrapper">
          <div className="semi-card-header-wrapper-title">
            <div className="mx2-open-panel__head">
              {icon ? <span className="mx2-open-panel__icon">{icon}</span> : null}
              <span className="mx2-open-panel__copy">
                <strong id={resolvedTitleId}>{title}</strong>
                {subtitle ? <span>{subtitle}</span> : null}
              </span>
            </div>
          </div>
        </div>
      </header>
      <div className="semi-card-body">{children}</div>
    </section>
  );
}

export function OpenUiLiteNotice({
  className,
  icon,
  title,
  children,
  type = "info",
}: {
  className?: string;
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  type?: "info" | "warning" | "error";
}) {
  return (
    <div
      className={["mx2-open-notice", "semi-banner", `semi-banner-${type}`, className].filter(Boolean).join(" ")}
      role={type === "error" ? "alert" : "status"}
    >
      <div className="semi-banner-content-wrapper">
        <div className="semi-banner-content">
          {icon ? <span className="semi-banner-icon mx2-open-notice__icon">{icon}</span> : null}
          <div className="semi-banner-content-body">
            <div className="semi-banner-title">{title}</div>
            {children ? <div className="semi-banner-description">{children}</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OpenUiLiteTextField({
  className,
  hint,
  inputClassName,
  label,
  mono = false,
  ...inputProps
}: Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  className?: string;
  hint?: ReactNode;
  inputClassName?: string;
  label: ReactNode;
  mono?: boolean;
}) {
  const reactId = useId();
  const id = inputProps.id ?? `mx2-lite-field-${reactId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label
      className={["mx2-open-field", mono ? "mx2-open-field--mono" : "", className].filter(Boolean).join(" ")}
      htmlFor={id}
    >
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <span className={["mx2-open-field__control", "semi-input-wrapper", inputClassName].filter(Boolean).join(" ")}>
        <input
          {...inputProps}
          id={id}
          className="semi-input"
          aria-labelledby={inputProps["aria-labelledby"] ?? labelId}
          aria-describedby={inputProps["aria-describedby"] ?? hintId}
        />
      </span>
      {hint ? <span id={hintId} className="mx2-open-field__hint">{hint}</span> : null}
    </label>
  );
}

export function OpenUiLiteTextArea({
  className,
  hint,
  label,
  textareaClassName,
  ...textareaProps
}: Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "className"> & {
  className?: string;
  hint?: ReactNode;
  label: ReactNode;
  textareaClassName?: string;
}) {
  const reactId = useId();
  const id = textareaProps.id ?? `mx2-lite-textarea-${reactId.replace(/[^A-Za-z0-9_-]/g, "")}`;
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <label className={["mx2-open-field", "mx2-open-field--textarea", className].filter(Boolean).join(" ")} htmlFor={id}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <span className={[
        "mx2-open-field__control",
        "mx2-open-field__control--textarea",
        "semi-input-textarea-wrapper",
        textareaClassName,
      ].filter(Boolean).join(" ")}>
        <textarea
          {...textareaProps}
          id={id}
          className="semi-input-textarea"
          aria-labelledby={textareaProps["aria-labelledby"] ?? labelId}
          aria-describedby={textareaProps["aria-describedby"] ?? hintId}
        />
      </span>
      {hint ? <span id={hintId} className="mx2-open-field__hint">{hint}</span> : null}
    </label>
  );
}

export function OpenUiLiteSegmented({
  className,
  label,
  onChange,
  options,
  segmentedClassName,
  value,
}: {
  className?: string;
  label: ReactNode;
  onChange?: (value: string) => void;
  options: Array<{ disabled?: boolean; label: ReactNode; value: string }>;
  segmentedClassName?: string;
  value?: string;
}) {
  const labelId = `mx2-lite-segmented-${useId().replace(/[^A-Za-z0-9_-]/g, "")}`;
  return (
    <div className={["mx2-open-field", "mx2-open-field--segmented", className].filter(Boolean).join(" ")}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <div
        className={["mx2-open-segmented", "semi-radioGroup", segmentedClassName].filter(Boolean).join(" ")}
        role="radiogroup"
        aria-labelledby={labelId}
        /**
         * v2.scss sizes each segment from the real option count. Publish it so a
         * two-option toggle claims half the row instead of the hardcoded third
         * that used to force it to wrap into a vertical stack.
         */
        style={{ "--mx2-segmented-count": options.length } as CSSProperties}
      >
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <label
              key={option.value}
              className={["semi-radio", checked ? "semi-radio-checked" : "", option.disabled ? "semi-radio-disabled" : ""].filter(Boolean).join(" ")}
            >
              <input
                type="radio"
                value={option.value}
                checked={checked}
                disabled={option.disabled}
                onChange={() => onChange?.(option.value)}
              />
              <span className="semi-radio-addon-buttonRadio">{option.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

export function OpenUiLiteCardCheckbox({
  checked,
  className,
  children,
  label,
  onChange,
}: {
  checked: boolean;
  className?: string;
  children: ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={[
      "semi-checkbox",
      "semi-checkbox-cardType",
      checked ? "semi-checkbox-checked" : "",
      className,
    ].filter(Boolean).join(" ")}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="semi-checkbox-inner" aria-hidden="true" />
      <span className="semi-checkbox-content semi-checkbox-addon">{children}</span>
    </label>
  );
}
