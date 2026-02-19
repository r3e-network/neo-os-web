import React, { useState } from "react";
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

  const btnColor = op.button_style === "danger" ? "#ef4444"
    : op.button_style === "success" ? "#22c55e"
    : op.button_style === "secondary" ? "#6b7280"
    : "#00d4aa";

  return (
    <div className="bg-gray-50 dark:bg-gray-900/80 rounded-xl p-4 mb-3 border border-gray-200 dark:border-white/[0.08]">
      <div className="flex justify-between items-center mb-2">
        <span className="font-semibold text-[15px] text-gray-900 dark:text-white">{op.name}</span>
        {op.gas_cost && <span className="text-[11px] text-neo bg-neo/10 px-2 py-0.5 rounded-md">{op.gas_cost} GAS</span>}
      </div>
      {op.description && <p className="text-[13px] text-gray-500 dark:text-gray-400 mb-3">{op.description}</p>}
      {(op.params ?? []).map((p) => (
        <ParamInput key={p.name} param={p} value={values[p.name] ?? ""} onChange={v => setValues({ ...values, [p.name]: v })} />
      ))}
      <button
        type="button"
        className="w-full py-2.5 rounded-lg border-none text-white font-semibold text-sm cursor-pointer"
        style={{ background: btnColor }}
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
        <input type="checkbox" checked={value === "true"} onChange={e => onChange(String(e.target.checked))} />
        {label}
      </label>
    );
  }

  if (param.type === "select" && param.options?.length) {
    return (
      <div className="mb-2.5">
        <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}{param.required && " *"}</label>
        <select
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.08] text-sm bg-transparent text-gray-900 dark:text-white"
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
      <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">{label}{param.required && " *"}</label>
      <input
        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-white/[0.08] text-sm bg-transparent text-gray-900 dark:text-white"
        type={param.type === "integer" || param.type === "amount" ? "number" : "text"}
        placeholder={param.placeholder || label}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
