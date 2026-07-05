import React from "react";
import Banner from "@douyinfe/semi-ui/lib/es/banner";
import Card from "@douyinfe/semi-ui/lib/es/card";
import ConfigProvider from "@douyinfe/semi-ui/lib/es/configProvider";
import Input from "@douyinfe/semi-ui/lib/es/input";
import RadioGroup from "@douyinfe/semi-ui/lib/es/radio/radioGroup";
import Select from "@douyinfe/semi-ui/lib/es/select";
import TextArea from "@douyinfe/semi-ui/lib/es/input/textarea";
import type { BannerProps } from "@douyinfe/semi-ui/lib/es/banner";
import type { InputProps } from "@douyinfe/semi-ui/lib/es/input";
import type { TextAreaProps } from "@douyinfe/semi-ui/lib/es/input/textarea";
import type { OptionItem, RadioGroupProps } from "@douyinfe/semi-ui/lib/es/radio/radioGroup";
import type { SelectProps, SelectValue } from "@douyinfe/semi-ui/lib/es/select";

function useOpenUiId(prefix: string, providedId?: string) {
  const reactId = React.useId();
  return providedId ?? `${prefix}-${reactId.replace(/[^A-Za-z0-9_-]/g, "")}`;
}

function normalizeSelectValue(value: SelectValue<string>) {
  if (Array.isArray(value)) {
    return value[0] === undefined ? "" : String(value[0]);
  }

  return value === undefined ? "" : String(value);
}

function mergeAriaIds(...ids: Array<string | undefined>) {
  const merged = ids.filter(Boolean).join(" ");
  return merged || undefined;
}

export interface OpenUiProviderProps {
  children?: React.ReactNode;
}

export function OpenUiProvider({ children }: OpenUiProviderProps) {
  return <ConfigProvider>{children}</ConfigProvider>;
}

export interface OpenUiPanelProps {
  className?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  titleId?: string;
  children?: React.ReactNode;
}

export function OpenUiPanel({
  className,
  icon,
  title,
  subtitle,
  titleId,
  children,
}: OpenUiPanelProps) {
  return (
    <Card
      {...({
        role: "group",
        "aria-labelledby": titleId,
      } as React.HTMLAttributes<HTMLDivElement>)}
      bordered
      className={["mx2-open-panel", className].filter(Boolean).join(" ")}
      header={(
        <div className="mx2-open-panel__head">
          {icon && <span className="mx2-open-panel__icon">{icon}</span>}
          <div className="mx2-open-panel__copy">
            <strong id={titleId}>{title}</strong>
            {subtitle && <span>{subtitle}</span>}
          </div>
        </div>
      )}
    >
      {children}
    </Card>
  );
}

export interface OpenUiNoticeProps {
  className?: string;
  icon?: React.ReactNode;
  title: React.ReactNode;
  children?: React.ReactNode;
  type?: BannerProps["type"] | "error";
}

export function OpenUiNotice({
  className,
  icon,
  title,
  children,
  type = "info",
}: OpenUiNoticeProps) {
  const semiType = type === "error" ? "danger" : type;

  return (
    <Banner
      bordered
      className={["mx2-open-notice", className].filter(Boolean).join(" ")}
      closeIcon={null}
      icon={icon ? <span className="mx2-open-notice__icon">{icon}</span> : undefined}
      type={semiType}
      title={title}
      description={children}
    />
  );
}

export interface OpenUiTextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "className" | "onChange" | "size"> {
  className?: string;
  hint?: React.ReactNode;
  inputClassName?: string;
  label: React.ReactNode;
  mono?: boolean;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
}

export function OpenUiTextField({
  className,
  hint,
  inputClassName,
  label,
  mono = false,
  ...inputProps
}: OpenUiTextFieldProps) {
  const id = useOpenUiId("mx2-open-field", inputProps.id);
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const { onChange, ...restInputProps } = inputProps;

  return (
    <label
      className={[
        "mx2-open-field",
        mono ? "mx2-open-field--mono" : "",
        className,
      ].filter(Boolean).join(" ")}
      htmlFor={id}
    >
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <Input
        {...(restInputProps as Omit<InputProps, "className" | "forwardRef" | "onChange" | "size">)}
        id={id}
        aria-describedby={mergeAriaIds(inputProps["aria-describedby"], hintId)}
        aria-labelledby={mergeAriaIds(inputProps["aria-labelledby"], labelId)}
        className={["mx2-open-field__control", inputClassName].filter(Boolean).join(" ")}
        onChange={(_value, event) => onChange?.(event)}
      />
      {hint && <span id={hintId} className="mx2-open-field__hint">{hint}</span>}
    </label>
  );
}

export interface OpenUiSelectOption {
  disabled?: boolean;
  label: React.ReactNode;
  value: string;
}

export interface OpenUiSelectProps extends Omit<SelectProps<string>, "className" | "defaultValue" | "dropdownMatchSelectWidth" | "onChange" | "optionList" | "size" | "value"> {
  className?: string;
  hint?: React.ReactNode;
  label: React.ReactNode;
  defaultValue?: string;
  dropdownMatchSelectWidth?: boolean;
  onChange?: (value: string) => void;
  options?: OpenUiSelectOption[];
  popupMatchSelectWidth?: boolean;
  selectClassName?: string;
  value?: string;
}

export function OpenUiSelect({
  className,
  dropdownMatchSelectWidth,
  hint,
  label,
  onChange,
  options,
  popupMatchSelectWidth,
  selectClassName,
  value,
  ...selectProps
}: OpenUiSelectProps) {
  const id = useOpenUiId("mx2-open-select", selectProps.id);
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const optionList = options?.map((option) => ({
    disabled: option.disabled,
    label: option.label,
    value: option.value,
  }));

  // Semi's Select is generic over BasicSelectValue (string | number | ...). This
  // adapter is string-only, but the spread's inferred onSelect/onChange narrow to
  // `string`, which Semi's own broader signature rejects. Route the Select props
  // through a single cast so the adapter surface stays string-typed for callers
  // while Semi receives its expected shape.
  const semiSelectProps = {
    ...selectProps,
    id,
    "aria-describedby": mergeAriaIds(selectProps["aria-describedby"], hintId),
    "aria-labelledby": mergeAriaIds(selectProps["aria-labelledby"], labelId),
    className: ["mx2-open-field__control", "mx2-open-field__control--select", selectClassName]
      .filter(Boolean)
      .join(" "),
    dropdownMatchSelectWidth: dropdownMatchSelectWidth ?? popupMatchSelectWidth ?? false,
    onChange: (nextValue: SelectValue<string>) => onChange?.(normalizeSelectValue(nextValue)),
    optionList,
    value,
  } as unknown as SelectProps;

  return (
    <label
      className={["mx2-open-field", "mx2-open-field--select", className].filter(Boolean).join(" ")}
      htmlFor={id}
    >
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <Select {...semiSelectProps} />
      {hint && <span id={hintId} className="mx2-open-field__hint">{hint}</span>}
    </label>
  );
}

export interface OpenUiSegmentedOption {
  disabled?: boolean;
  label: React.ReactNode;
  value: string;
}

export interface OpenUiSegmentedProps extends Omit<RadioGroupProps, "className" | "defaultValue" | "onChange" | "options" | "type" | "value"> {
  className?: string;
  defaultValue?: string;
  hint?: React.ReactNode;
  label: React.ReactNode;
  onChange?: (value: string) => void;
  options: OpenUiSegmentedOption[];
  segmentedClassName?: string;
  value?: string;
}

export function OpenUiSegmented({
  className,
  defaultValue,
  hint,
  label,
  onChange,
  options,
  segmentedClassName,
  value,
  ...segmentedProps
}: OpenUiSegmentedProps) {
  const labelId = useOpenUiId("mx2-open-segmented-label");
  const hintId = hint ? `${labelId}-hint` : undefined;
  const semiOptions: OptionItem[] = options.map((option) => ({
    ...option,
  }));

  return (
    <div className={["mx2-open-field", "mx2-open-field--segmented", className].filter(Boolean).join(" ")}>
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <RadioGroup
        {...segmentedProps}
        aria-labelledby={labelId}
        aria-describedby={hintId ?? segmentedProps["aria-describedby"]}
        buttonSize="middle"
        className={["mx2-open-segmented", segmentedClassName].filter(Boolean).join(" ")}
        defaultValue={defaultValue}
        onChange={(event) => onChange?.(String(event.target.value))}
        options={semiOptions}
        type="button"
        value={value}
      />
      {hint && <span id={hintId} className="mx2-open-field__hint">{hint}</span>}
    </div>
  );
}

export interface OpenUiTextAreaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "className" | "onChange"> {
  className?: string;
  hint?: React.ReactNode;
  label: React.ReactNode;
  onChange?: React.ChangeEventHandler<HTMLTextAreaElement>;
  textareaClassName?: string;
}

export function OpenUiTextArea({
  className,
  hint,
  label,
  textareaClassName,
  ...textareaProps
}: OpenUiTextAreaProps) {
  const id = useOpenUiId("mx2-open-textarea", textareaProps.id);
  const labelId = `${id}-label`;
  const hintId = hint ? `${id}-hint` : undefined;
  const { onChange, ...restTextareaProps } = textareaProps;

  return (
    <label
      className={["mx2-open-field", "mx2-open-field--textarea", className].filter(Boolean).join(" ")}
      htmlFor={id}
    >
      <span id={labelId} className="mx2-open-field__label">{label}</span>
      <TextArea
        {...(restTextareaProps as Omit<TextAreaProps, "className" | "forwardRef" | "onChange">)}
        id={id}
        aria-describedby={mergeAriaIds(textareaProps["aria-describedby"], hintId)}
        aria-labelledby={mergeAriaIds(textareaProps["aria-labelledby"], labelId)}
        className={["mx2-open-field__control", "mx2-open-field__control--textarea", textareaClassName].filter(Boolean).join(" ")}
        onChange={(_value, event) => onChange?.(event as unknown as React.ChangeEvent<HTMLTextAreaElement>)}
      />
      {hint && <span id={hintId} className="mx2-open-field__hint">{hint}</span>}
    </label>
  );
}
