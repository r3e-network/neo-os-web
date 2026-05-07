import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Edit3, ShieldCheck } from "lucide-react";
import { MiniAppLaunchContext, OperationEntry, OperationParam } from "./types";
import { cn } from "@/lib/utils";
import { buildLaunchParamValues } from "@/lib/miniapp-launch-params";

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
  disabledReason?: string | null;
  launchContext?: MiniAppLaunchContext | null;
};

export function OperationPanel({
  operations,
  onInvoke,
  title = "Trade",
  showTitle = true,
  className,
  variant = "card",
  disabledReason = null,
  launchContext = null,
}: Props) {
  const requestedOperationIndex = useMemo(
    () => resolveRequestedOperationIndex(operations, launchContext?.operation),
    [launchContext?.operation, operations],
  );
  const [activeTabIdx, setActiveTabIdx] = useState(requestedOperationIndex);

  if (!operations.length) return null;

  useEffect(() => {
    setActiveTabIdx(requestedOperationIndex);
  }, [requestedOperationIndex]);

  const activeOp = operations[Math.min(activeTabIdx, operations.length - 1)] ?? operations[0];
  const embedded = variant === "embedded";
  const shellClass = embedded
    ? "overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-sm"
    : "overflow-hidden rounded-[22px] border border-gray-200 bg-white shadow-lg shadow-gray-950/5";

  return (
    <div
      className={cn(shellClass, className)}
      data-testid="operation-panel-shell"
    >
      {showTitle && (
        <div
          className={cn(
            "border-b border-gray-100 px-5 py-4",
          )}
        >
          <h3 className="m-0 text-lg font-black tracking-tight text-gray-950">{title}</h3>
        </div>
      )}

      {operations.length > 1 && (
        <div className="border-b border-gray-100 px-4 pt-3">
          <div
            className={cn(
              "grid gap-1",
              operations.length > 3
                ? "grid-cols-2"
                : "grid-cols-[repeat(auto-fit,minmax(6.5rem,1fr))]",
            )}
            data-testid="operation-tab-grid"
          >
            {operations.map((op, idx) => (
              <button
                key={op.name + idx}
                type="button"
                onClick={() => setActiveTabIdx(idx)}
                className={cn(
                  "relative min-h-12 cursor-pointer border-0 border-b-2 bg-transparent px-2 py-2 text-center text-sm font-black leading-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
                  activeTabIdx === idx
                    ? getTabActiveColor(op.button_style)
                    : "border-transparent text-gray-400 hover:text-gray-700",
                )}
              >
                {op.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="p-4 sm:p-5">
        <OperationForm
          key={`${activeTabIdx}:${activeOp.method || activeOp.name}`}
          op={activeOp}
          onInvoke={onInvoke}
          disabledReason={disabledReason}
          launchContext={launchContext}
        />
      </div>
    </div>
  );
}

function resolveRequestedOperationIndex(
  operations: OperationEntry[],
  requested?: string | null,
): number {
  const needle = String(requested || "").trim().toLowerCase();
  if (!needle) return 0;
  const index = operations.findIndex((operation) =>
    [operation.method, operation.name]
      .map((value) => String(value || "").trim().toLowerCase())
      .includes(needle),
  );
  return index >= 0 ? index : 0;
}

function getTabActiveColor(style?: string) {
  if (style === "danger") return "border-red-500 text-red-600";
  if (style === "success") return "border-emerald-500 text-emerald-700";
  if (style === "secondary") return "border-gray-950 text-gray-950";
  return "border-emerald-500 text-gray-950";
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
  disabledReason,
  launchContext,
}: {
  op: OperationEntry;
  onInvoke: Props["onInvoke"];
  disabledReason?: string | null;
  launchContext?: MiniAppLaunchContext | null;
}) {
  const initialValues = useMemo(
    () =>
      buildLaunchParamValues(
        op.params ?? [],
        launchContext?.params,
      ),
    [launchContext?.signature, op],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const visibleParams = useMemo(
    () => (op.params ?? []).filter((param) => !param.hidden),
    [op.params],
  );
  const firstChoiceParam = visibleParams.find(
    (param) => param.type === "select" && parseSelectOptions(param.options).length > 0,
  );
  const primaryValueParam = visibleParams.find(
    (param) =>
      param.type === "amount" ||
      param.type === "integer" ||
      /amount|stake|bet|total|claim|min|max|keys|count|slots/i.test(param.name),
  );
  const secondaryParams = visibleParams.filter(
    (param) =>
      param.name !== firstChoiceParam?.name &&
      param.name !== primaryValueParam?.name,
  );

  useEffect(() => {
    setValues(initialValues);
    setError(null);
  }, [initialValues]);

  const handleSubmit = async () => {
    if (submitting) return;
    if (disabledReason) {
      setError(disabledReason);
      return;
    }

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

  const tone = operationTone(op);
  const visibleParamCount = visibleParams.length;
  const serverPayoutOperation = op.method === "claimOneGateVault";

  return (
    <div className="flex flex-col space-y-4">
      {op.description && (
        <p className="mb-0 text-sm leading-relaxed text-gray-500">
          {op.description}
        </p>
      )}

      {firstChoiceParam && (
        <ChoiceParam
          param={firstChoiceParam}
          value={values[firstChoiceParam.name] ?? ""}
          tone={tone}
          onChange={(value) =>
            setValues((current) => ({
              ...current,
              [firstChoiceParam.name]: value,
            }))
          }
        />
      )}

      {primaryValueParam && (
        <PrimaryValueParam
          param={primaryValueParam}
          value={values[primaryValueParam.name] ?? ""}
          onChange={(value) =>
            setValues((current) => ({
              ...current,
              [primaryValueParam.name]: value,
            }))
          }
        />
      )}

      {secondaryParams.length > 0 && (
        <div className="space-y-3">
          {secondaryParams.map((param) => (
          <ParamInput
            key={param.name}
            param={param}
            value={values[param.name] ?? ""}
            onChange={(value) =>
              setValues((current) => ({ ...current, [param.name]: value }))
            }
          />
          ))}
        </div>
      )}

      <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs">
        <SummaryRow label="Mode" value={serverPayoutOperation ? "Server payout" : "Wallet signed"} />
        <SummaryRow label="Method" value={op.method || op.name} />
        <SummaryRow label="Fields" value={visibleParamCount ? `${visibleParamCount} required inputs` : "No inputs"} />
        {op.gas_cost && <SummaryRow label="Network fee" value={`${op.gas_cost} GAS`} />}
      </div>

      <div className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs leading-5 text-gray-500">
        <div className="flex items-start gap-2">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
          <span>
            {serverPayoutOperation
              ? "OneGate provides the wallet address; the reward server sends GAS and this page tracks the payout."
              : "Transaction is prepared here, then signed by OneGate / NEP-21 wallet."}
          </span>
        </div>
      </div>

      {error && (
        <div
          aria-live="polite"
          className="break-words rounded-lg bg-red-50 p-3 text-sm text-red-600"
        >
          {error}
        </div>
      )}

      {disabledReason && !error && (
        <div
          aria-live="polite"
          className="break-words rounded-lg bg-amber-50 p-3 text-sm text-amber-700"
        >
          {disabledReason}
        </div>
      )}

      <button
        type="button"
        className={cn(
          "mt-1 w-full cursor-pointer rounded-xl border-none py-4 text-sm font-black transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:text-base",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          tone.submitClass,
        )}
        onClick={handleSubmit}
        aria-disabled={submitting || Boolean(disabledReason)}
        title={disabledReason || undefined}
        disabled={submitting || Boolean(disabledReason)}
      >
        {submitting ? "Processing..." : op.name}
      </button>
    </div>
  );
}

function operationTone(op: OperationEntry) {
  const text = `${op.button_style || ""} ${op.name || ""} ${op.method || ""}`.toLowerCase();
  if (/danger|withdraw|refund|cancel|remove|delete/.test(text)) {
    return {
      activeChoice: "border-red-500 bg-red-500 text-white shadow-sm shadow-red-500/20",
      inactiveChoice: "border-gray-200 bg-gray-100 text-gray-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700",
      submitClass: "bg-red-600 text-white shadow-sm shadow-red-600/15 hover:bg-red-700 focus-visible:ring-red-500",
    };
  }
  if (/secondary|edit|view|read|search|query/.test(text)) {
    return {
      activeChoice: "border-gray-950 bg-gray-950 text-white shadow-sm shadow-gray-950/15",
      inactiveChoice: "border-gray-200 bg-gray-100 text-gray-500 hover:border-gray-300 hover:bg-white hover:text-gray-900",
      submitClass: "bg-gray-950 text-white shadow-sm shadow-gray-950/15 hover:bg-gray-800 focus-visible:ring-gray-950",
    };
  }
  return {
    activeChoice: "border-emerald-500 bg-emerald-600 text-white shadow-sm shadow-emerald-600/20",
    inactiveChoice: "border-gray-200 bg-gray-100 text-gray-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700",
    submitClass: "bg-emerald-600 text-white shadow-sm shadow-emerald-600/15 hover:bg-emerald-700 focus-visible:ring-emerald-500",
  };
}

function ChoiceParam({
  param,
  value,
  tone,
  onChange,
}: {
  param: OperationParam;
  value: string;
  tone: ReturnType<typeof operationTone>;
  onChange: (v: string) => void;
}) {
  const options = parseSelectOptions(param.options);
  const label = param.label || param.name;
  const selectId = `choice-${param.name}`;

  return (
    <div className="space-y-2">
      <label htmlFor={selectId} className="text-sm font-bold text-gray-900">
        {label}
      </label>
      <select
        id={selectId}
        className="sr-only"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <div
        className={cn(
          "grid gap-2",
          options.length <= 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-16 cursor-pointer rounded-xl border px-3 py-3 text-center text-lg font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30",
                active ? tone.activeChoice : tone.inactiveChoice,
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PrimaryValueParam({
  param,
  value,
  onChange,
}: {
  param: OperationParam;
  value: string;
  onChange: (v: string) => void;
}) {
  const label = param.label || param.name;
  const presets = quickPresetsFor(param);
  const inputId = param.name || label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={inputId} className="text-sm font-black text-gray-900">
          {label}
        </label>
        <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-400">
          <Edit3 className="h-3.5 w-3.5" aria-hidden="true" />
          Edit
        </span>
      </div>
      <input
        id={inputId}
        type={
          param.type === "amount" || param.type === "integer"
            ? "number"
            : "text"
        }
        step={param.type === "amount" ? "any" : "1"}
        className="h-12 w-full rounded-xl border border-gray-200 bg-gray-50 px-4 text-lg font-black text-gray-950 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        placeholder={param.placeholder || `Enter ${label.toLowerCase()}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {presets.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {presets.map((preset) => (
            <button
              key={preset.value}
              type="button"
              onClick={() => onChange(preset.value)}
              className="min-h-14 cursor-pointer rounded-xl border border-gray-200 bg-white px-2 py-2 text-center transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30"
            >
              <span className="block text-base font-black text-gray-950">
                {preset.label}
              </span>
              {preset.helper && (
                <span className="block text-[11px] font-bold text-emerald-700">
                  {preset.helper}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function quickPresetsFor(param: OperationParam): Array<{ label: string; value: string; helper?: string }> {
  const text = `${param.name} ${param.label || ""}`.toLowerCase();
  if (/key|count|slot|packet|claim/.test(text) && param.type !== "amount") {
    return [
      { label: "1", value: "1" },
      { label: "5", value: "5" },
      { label: "10", value: "10" },
    ];
  }
  if (/neo|stake/.test(text)) {
    return [
      { label: "5", value: "5", helper: "NEO" },
      { label: "25", value: "25", helper: "NEO" },
      { label: "100", value: "100", helper: "NEO" },
    ];
  }
  if (param.type === "amount" || /amount|stake|bet|total|min|max/.test(text)) {
    return [
      { label: "1", value: "1", helper: "GAS" },
      { label: "5", value: "5", helper: "GAS" },
      { label: "25", value: "25", helper: "GAS" },
    ];
  }
  return [];
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-gray-500">{label}</span>
      <span className="min-w-0 break-words text-right font-bold text-gray-900">
        {value}
      </span>
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
      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 transition-colors hover:border-emerald-300 hover:bg-white">
        <input
          type="checkbox"
          className="h-5 w-5 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
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
            className="w-full appearance-none rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-all focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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
        className="w-full rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
        placeholder={param.placeholder || `Enter ${label.toLowerCase()}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
