import { useState } from "react";
import { OperationEntry, OperationParam } from "./types";

type Props = {
  operations: OperationEntry[];
  contractHash?: string;
  onInvoke: (method: string, params: Record<string, string>) => void;
};

export function OperationPanel({ operations, contractHash, onInvoke }: Props) {
  if (!operations.length) return null;
  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Operations</h3>
      {operations.map((op, i) => (
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

  const handleSubmit = () => {
    if (op.confirm_message && !window.confirm(op.confirm_message)) return;
    onInvoke(op.method, values);
  };

  const btnClass = op.button_style === "danger" ? "bg-red-500 hover:bg-red-600"
    : op.button_style === "success" ? "bg-emerald-500 hover:bg-emerald-600"
    : op.button_style === "secondary" ? "bg-gray-500 hover:bg-gray-600"
    : "bg-neo hover:bg-neo/90";

  return (
    <div className="bg-gray-50 dark:bg-gray-900/80 rounded-xl p-4 mb-3 border border-gray-200 dark:border-gray-700">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-sm text-gray-900 dark:text-white">{op.name}</span>
        {op.gas_cost && <span className="text-xs text-neo bg-neo/10 px-2 py-0.5 rounded-md">{op.gas_cost} GAS</span>}
      </div>
      {op.description && <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{op.description}</p>}
      {(op.params ?? []).map((p) => (
        <ParamInput key={p.name} param={p} value={values[p.name] ?? ""} onChange={v => setValues({ ...values, [p.name]: v })} />
      ))}
      <button
        type="button"
        className={`w-full py-2.5 rounded-lg border-none text-white font-semibold text-sm cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 ${btnClass}`}
        onClick={handleSubmit}
      >
        {op.name}
      </button>
    </div>
  );
}

function ParamInput({ param, value, onChange }: { param: OperationParam; value: string; onChange: (v: string) => void }) {
  const label = param.label || param.name;

  if (param.type === "boolean") {
    return (
      <label className="flex items-center gap-2 text-sm mb-2.5 text-gray-900 dark:text-white">
        <input type="checkbox" checked={value === "true"} onChange={e => onChange(String(e.target.checked))} className="accent-neo rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50" />
        {label}
      </label>
    );
  }

  const inputId = `param-${param.name}`;

  if (param.type === "select" && param.options?.length) {
    return (
      <div className="mb-2.5">
        <label htmlFor={inputId} className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}{param.required && " *"}</label>
        <select
          id={inputId}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-transparent text-gray-900 dark:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          value={value}
          onChange={e => onChange(e.target.value)}
        >
          <option value="">Select...</option>
          {param.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div className="mb-2.5">
      <label htmlFor={inputId} className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}{param.required && " *"}</label>
      <input
        id={inputId}
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm bg-transparent text-gray-900 dark:text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 placeholder-gray-500 dark:placeholder-gray-400"
        type={param.type === "integer" || param.type === "amount" ? "number" : "text"}
        placeholder={param.placeholder || label}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
