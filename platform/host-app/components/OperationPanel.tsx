import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { OperationEntry, OperationParam } from "./types";
import { cn } from "@/lib/utils";

type Props = {
  operations: OperationEntry[];
  onInvoke: (
    operation: OperationEntry,
    params: Record<string, string>,
  ) => Promise<void> | void;
  title?: string;
  showTitle?: boolean;
  className?: string;
  variant?: "card" | "embedded";
};

export function OperationPanel({
  operations,
  onInvoke,
  title = "Trade",
  showTitle = true,
  className,
  variant = "card",
}: Props) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  if (!operations.length) return null;

  const activeOp = operations[activeTabIdx];
  const embedded = variant === "embedded";

  return (
    <div
      className={cn(
        embedded
          ? "overflow-hidden rounded-lg bg-transparent"
          : "overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm",
        className,
      )}
    >
      {showTitle && (
        <div
          className={cn(
            "border-b border-gray-100",
            embedded ? "px-0 pb-3" : "px-5 py-4",
          )}
        >
          <h3 className="text-lg font-bold text-gray-900 m-0">{title}</h3>
        </div>
      )}

      {/* Segmented Control for Operations */}
      {operations.length > 1 && (
        <div className={embedded ? "pb-3" : "p-2"}>
          <div
            className={cn(
              "grid gap-1 rounded-lg bg-gray-100 p-1",
              operations.length > 3
                ? "grid-cols-2"
                : "grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))]",
            )}
          >
            {operations.map((op, idx) => (
              <button
                key={op.name + idx}
                type="button"
                onClick={() => setActiveTabIdx(idx)}
                className={cn(
                  "min-h-10 cursor-pointer rounded-md border-none px-2 py-2 text-center text-xs font-semibold leading-tight transition-all duration-200 focus-visible:outline-none sm:text-sm",
                  activeTabIdx === idx
                    ? getTabActiveColor(op.button_style)
                    : "text-gray-500 hover:text-gray-700 bg-transparent",
                )}
              >
                {op.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Operation Form */}
      <div className={embedded ? "pt-1" : "p-5"}>
        <OperationForm
          key={`${activeTabIdx}:${activeOp.method || activeOp.name}`}
          op={activeOp}
          onInvoke={onInvoke}
        />
      </div>
    </div>
  );
}

function getTabActiveColor(style?: string) {
  if (style === "danger") return "bg-white text-red-500 shadow-sm";
  if (style === "success") return "bg-white text-emerald-500 shadow-sm";
  if (style === "secondary") return "bg-white text-gray-900 shadow-sm";
  return "bg-white text-neo shadow-sm";
}

function getInitialParamValue(param: OperationParam): string {
  if (param.default_value !== undefined && param.default_value !== null) {
    return String(param.default_value);
  }

  if (param.type === "select") {
    return parseSelectOptions(param.options)[0]?.value ?? "";
  }

  return "";
}

function parseSelectOptions(options: OperationParam["options"]): Array<{ label: string; value: string }> {
  if (!options) return [];

  if (typeof options === "string") {
    try {
      const parsed = JSON.parse(options);
      if (Array.isArray(parsed)) return normalizeSelectOptions(parsed);
    } catch {
      return options
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => ({ label: s, value: s }));
    }
    return [];
  }

  if (Array.isArray(options)) return normalizeSelectOptions(options);
  return [];
}

function normalizeSelectOptions(options: unknown[]): Array<{ label: string; value: string }> {
  return options
    .map((option) => {
      if (typeof option === "string") {
        const value = option.trim();
        return value ? { label: value, value } : null;
      }
      if (!option || typeof option !== "object") return null;
      const entry = option as { label?: unknown; value?: unknown };
      const value = String(entry.value ?? "").trim();
      if (!value) return null;
      const label = String(entry.label ?? value).trim() || value;
      return { label, value };
    })
    .filter((option): option is { label: string; value: string } => Boolean(option));
}

function OperationForm({
  op,
  onInvoke,
}: {
  op: OperationEntry;
  onInvoke: Props["onInvoke"];
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of op.params ?? []) {
      init[p.name] = getInitialParamValue(p);
    }
    return init;
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (submitting) return;

    const missingRequired = (op.params ?? []).find(
      (param) => param.required && !String(values[param.name] ?? "").trim(),
    );
    if (missingRequired) {
      setError(`${missingRequired.label || missingRequired.name} is required.`);
      return;
    }

    if (op.confirm_message && !window.confirm(op.confirm_message)) return;

    try {
      setSubmitting(true);
      setError(null);
      await onInvoke(op, values);
    } catch (invokeError) {
      setError(
        invokeError instanceof Error ? invokeError.message : "Operation failed",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const getBtnClass = () => {
    if (op.button_style === "danger")
      return "bg-red-500 hover:bg-red-600 text-white";
    if (op.button_style === "success")
      return "bg-emerald-500 hover:bg-emerald-600 text-white";
    if (op.button_style === "secondary")
      return "bg-gray-200 hover:bg-gray-300 text-gray-900";
    return "bg-neo hover:bg-neo/90 text-black";
  };

  return (
    <div className="flex flex-col space-y-4">
      {op.description && (
        <p className="text-sm text-gray-500 mb-2 leading-relaxed">
          {op.description}
        </p>
      )}

      {(op.params ?? [])
        .filter((param) => !param.hidden)
        .map((param) => (
          <ParamInput
            key={param.name}
            param={param}
            value={values[param.name] ?? ""}
            onChange={(value) => setValues({ ...values, [param.name]: value })}
          />
        ))}

      {op.gas_cost && (
        <div className="flex justify-between items-center py-3 border-t border-gray-100 mt-2">
          <span className="text-sm text-gray-500">Network Fee</span>
          <span className="text-sm font-medium text-gray-900">
            {op.gas_cost} GAS
          </span>
        </div>
      )}

      {error && (
        <div className="break-words rounded-lg bg-red-50 p-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <button
        type="button"
        className={cn(
          "mt-2 w-full cursor-pointer rounded-lg border-none py-3.5 text-base font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neo",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          getBtnClass(),
        )}
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "Processing..." : op.name}
      </button>
    </div>
  );
}

function ParamInput({
  param,
  value,
  onChange,
}: {
  param: OperationParam;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = param.label || param.name;

  if (param.type === "boolean") {
    return (
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3 transition-colors hover:border-neo/50">
        <input
          type="checkbox"
          className="w-5 h-5 rounded border-gray-300 text-neo focus:ring-neo focus:ring-offset-gray-900"
          checked={value === "true"}
          onChange={(e) => onChange(e.target.checked ? "true" : "false")}
        />
        <span className="text-sm font-medium text-gray-900">{label}</span>
      </label>
    );
  }

  if (param.type === "select") {
    const parsedOptions = parseSelectOptions(param.options);
    if (parsedOptions.length === 0) return null;

    const selectId = `select-${label.toLowerCase().replace(/\s+/g, "-")}`;
    return (
      <div className="flex flex-col space-y-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700">
          {label}
        </label>
        <div className="relative">
          <select
            id={selectId}
            className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-all focus:border-neo focus:outline-none focus:ring-2 focus:ring-neo/50"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          >
            {parsedOptions.map((opt, i) => (
              <option key={i} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-gray-500">
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </div>
        </div>
      </div>
    );
  }

  const inputId = param.name || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={inputId}
        type={
          param.type === "amount" || param.type === "integer"
            ? "number"
            : "text"
        }
        step={param.type === "amount" ? "any" : "1"}
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-neo focus:outline-none focus:ring-2 focus:ring-neo/50"
        placeholder={param.placeholder || `Enter ${label.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
