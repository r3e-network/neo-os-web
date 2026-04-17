import { useState } from "react";
import { OperationEntry, OperationParam } from "./types";
import { cn } from "@/lib/utils";

type Props = {
  operations: OperationEntry[];
  onInvoke: (operation: OperationEntry, params: Record<string, string>) => Promise<void> | void;
  title?: string;
  showTitle?: boolean;
  className?: string;
};

export function OperationPanel({
  operations,
  onInvoke,
  title = "Trade",
  showTitle = true,
  className,
}: Props) {
  const [activeTabIdx, setActiveTabIdx] = useState(0);

  if (!operations.length) return null;

  const activeOp = operations[activeTabIdx];

  return (
    <div className={cn("bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden", className)}>
      {showTitle && (
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-lg font-bold text-gray-900 m-0">{title}</h3>
        </div>
      )}

      {/* Segmented Control for Operations */}
      {operations.length > 1 && (
        <div className="p-2">
          <div className="flex p-1 space-x-1 bg-gray-100 rounded-xl">
            {operations.map((op, idx) => (
              <button
                key={op.name + idx}
                onClick={() => setActiveTabIdx(idx)}
                className={cn(
                  "flex-1 py-2 text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer border-none focus-visible:outline-none",
                  activeTabIdx === idx
                    ? getTabActiveColor(op.button_style)
                    : "text-gray-500 hover:text-gray-700 bg-transparent"
                )}
              >
                {op.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Active Operation Form */}
      <div className="p-5">
        <OperationForm op={activeOp} onInvoke={onInvoke} />
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

function OperationForm({ op, onInvoke }: { op: OperationEntry; onInvoke: Props["onInvoke"] }) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const p of op.params ?? []) {
      init[p.name] = p.default_value ?? "";
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
      setError(invokeError instanceof Error ? invokeError.message : "Operation failed");
    } finally {
      setSubmitting(false);
    }
  };

  const getBtnClass = () => {
    if (op.button_style === "danger") return "bg-red-500 hover:bg-red-600 text-white";
    if (op.button_style === "success") return "bg-emerald-500 hover:bg-emerald-600 text-white";
    if (op.button_style === "secondary") return "bg-gray-200 hover:bg-gray-300 text-gray-900";
    return "bg-neo hover:bg-neo/90 text-black";
  };

  return (
    <div className="flex flex-col space-y-4">
      {op.description && (
        <p className="text-sm text-gray-500 mb-2 leading-relaxed">
          {op.description}
        </p>
      )}
      
      {(op.params ?? []).filter((param) => !param.hidden).map((param) => (
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
          <span className="text-sm font-medium text-gray-900">{op.gas_cost} GAS</span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 text-red-600 rounded-xl text-sm break-words">
          {error}
        </div>
      )}

      <button
        type="button"
        className={cn(
          "w-full py-3.5 mt-2 rounded-xl font-bold text-base cursor-pointer transition-all border-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-neo",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          getBtnClass()
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
      <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 cursor-pointer hover:border-neo/50 transition-colors">
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
    const options = param.options;
    if (!options) return null;

    let parsedOptions: Array<{ label: string; value: string }> = [];
    if (typeof options === "string") {
      try {
        parsedOptions = JSON.parse(options);
      } catch {
        parsedOptions = (options as string).split(",").map((s) => ({ label: s.trim(), value: s.trim() }));
      }
    } else if (Array.isArray(options)) {
      parsedOptions = options;
    }

    const selectId = `select-${label.toLowerCase().replace(/\s+/g, '-')}`;
    return (
      <div className="flex flex-col space-y-1.5">
        <label htmlFor={selectId} className="text-sm font-medium text-gray-700">{label}</label>
        <div className="relative">
          <select
            id={selectId}
            className="w-full appearance-none bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neo/50 focus:border-neo transition-all"
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
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  const inputId = param.name || label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="flex flex-col space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">{label}</label>
      <input
        id={inputId}
        type={param.type === "amount" || param.type === "integer" ? "number" : "text"}
        step={param.type === "amount" ? "any" : "1"}
        className="w-full bg-gray-50 border border-gray-200 text-gray-900 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-neo/50 focus:border-neo transition-all placeholder:text-gray-400"
        placeholder={param.placeholder || `Enter ${label.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}