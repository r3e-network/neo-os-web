import React, { useState } from "react";
import { OperationEntry, OperationParam } from "./types";
import { colors } from "./styles";

type Props = {
  operations: OperationEntry[];
  contractHash?: string;
  onInvoke: (method: string, params: Record<string, string>) => void;
};

export function OperationPanel({ operations, contractHash, onInvoke }: Props) {
  if (!operations.length) return null;
  return (
    <div style={container}>
      <h3 style={heading}>Operations</h3>
      {operations.map((op, i) => (
        <OperationCard key={i} op={op} onInvoke={onInvoke} />
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
    : colors.primary;

  return (
    <div style={card}>
      <div style={cardHeader}>
        <span style={opName}>{op.name}</span>
        {op.gas_cost && <span style={gasBadge}>{op.gas_cost} GAS</span>}
      </div>
      {op.description && <p style={desc}>{op.description}</p>}
      {(op.params ?? []).map((p) => (
        <ParamInput key={p.name} param={p} value={values[p.name] ?? ""} onChange={v => setValues({ ...values, [p.name]: v })} />
      ))}
      <button style={{ ...invokeBtn, background: btnColor }} onClick={handleSubmit}>
        {op.name}
      </button>
    </div>
  );
}

function ParamInput({ param, value, onChange }: { param: OperationParam; value: string; onChange: (v: string) => void }) {
  const label = param.label || param.name;

  if (param.type === "boolean") {
    return (
      <label style={boolLabel}>
        <input type="checkbox" checked={value === "true"} onChange={e => onChange(String(e.target.checked))} />
        {label}
      </label>
    );
  }

  if (param.type === "select" && param.options?.length) {
    return (
      <div style={fieldWrap}>
        <label style={fieldLabel}>{label}{param.required && " *"}</label>
        <select style={selectStyle} value={value} onChange={e => onChange(e.target.value)}>
          <option value="">Select...</option>
          {param.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    );
  }

  return (
    <div style={fieldWrap}>
      <label style={fieldLabel}>{label}{param.required && " *"}</label>
      <input
        style={inputStyle}
        type={param.type === "integer" || param.type === "amount" ? "number" : "text"}
        placeholder={param.placeholder || label}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}

const container: React.CSSProperties = { marginTop: 24 };
const heading: React.CSSProperties = { fontSize: 18, fontWeight: 600, marginBottom: 12 };
const card: React.CSSProperties = { background: colors.bgCard, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${colors.border}` };
const cardHeader: React.CSSProperties = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 };
const opName: React.CSSProperties = { fontWeight: 600, fontSize: 15 };
const gasBadge: React.CSSProperties = { fontSize: 11, color: colors.primary, background: "rgba(0,212,170,0.12)", padding: "2px 8px", borderRadius: 6 };
const desc: React.CSSProperties = { fontSize: 13, color: colors.textMuted, margin: "0 0 12px 0" };
const fieldWrap: React.CSSProperties = { marginBottom: 10 };
const fieldLabel: React.CSSProperties = { display: "block", fontSize: 12, color: colors.textMuted, marginBottom: 4 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${colors.border}`, fontSize: 14, background: "transparent", color: colors.text };
const selectStyle: React.CSSProperties = { ...inputStyle };
const boolLabel: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, fontSize: 14, marginBottom: 10 };
const invokeBtn: React.CSSProperties = { width: "100%", padding: 10, borderRadius: 8, border: "none", color: "#fff", fontWeight: 600, fontSize: 14, cursor: "pointer" };
