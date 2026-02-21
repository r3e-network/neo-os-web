import { useState } from "react";
import { OperationEntry, OperationParam } from "./types";

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
  title = "Operations",
  showTitle = true,
  className,
}: Props) {
  if (!operations.length) return null;

  return (
    <div className={className}>
      {showTitle && <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">{title}</h3>}
      {operations.map((op) => (
        <OperationCard key={op.method} op={op} onInvoke={onInvoke} />
      ))}
    </div>
  );
}

function OperationCard({ op, onInvoke }: { op: OperationEntry; onInvoke: Props["onInvoke"] }) {
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

  const btnClass =
    op.button_style === "danger"
      ? "bg-red-500 hover:bg-red-600"
      : op.button_style === "success"
        ? "bg-emerald-500 hover:bg-emerald-600"
        : op.button_style === "secondary"
          ? "bg-gray-500 hover:bg-gray-600"
          : "bg-neo hover:bg-neo/90";

  return (
    <div className="bg-gray-50 dark:bg-gray-900/80 rounded-xl p-4 mb-3 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-sm text-gray-900 dark:text-white truncate">{op.name}</span>
        {op.gas_cost && (
          <span className="text-xs text-neo bg-neo/10 px-2 py-0.5 rounded-md shrink-0">{op.gas_cost} GAS</span>
        )}
      </div>
      {op.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{op.description}</p>}
      {(op.params ?? []).map((param) => (
        <ParamInput
          key={param.name}
          param={param}
          value={values[param.name] ?? ""}
          onChange={(value) => setValues({ ...values, [param.name]: value })}
        />
      ))}

      {error && <p className="text-xs text-red-600 dark:text-red-400 mb-2 break-words">{error}</p>}

      <button
        type="button"
        className={`w-full py-2.5 rounded-lg border-none text-white font-semibold text-sm cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${btnClass}`}
        onClick={handleSubmit}
        disabled={submitting}
      >
        {submitting ? "Submitting..." : op.name}
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
      <label className="flex items-center gap-2 text-sm mb-2.5 text-gray-900 dark:text-white">
        <input
          type="checkbox"
          checked={value === "true"}
          onChange={(event) => onChange(String(event.target.checked))}
          className="accent-neo rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        />
        {label}
      </label>
    );
  }

  const inputId = `param-${param.name}`;

  if (param.type === "select" && param.options?.length) {
    return (
      <div className="mb-2.5">
        <label htmlFor={inputId} className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
          {label}
          {param.required && " *"}
        </label>
        <select
          id={inputId}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-transparent text-gray-900 dark:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Select...</option>
          {param.options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="mb-2.5">
      <label htmlFor={inputId} className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
        {label}
        {param.required && " *"}
      </label>
      <input
        id={inputId}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-transparent text-gray-900 dark:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 placeholder-gray-500 dark:placeholder-gray-400"
        type={param.type === "integer" || param.type === "amount" ? "number" : "text"}
        placeholder={param.placeholder || label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
