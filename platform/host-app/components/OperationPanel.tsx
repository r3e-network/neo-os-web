import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { ChevronDown, Edit3 } from "lucide-react";
import { MiniAppLaunchContext, OperationEntry, OperationParam } from "./types";
import { cn } from "@/lib/utils";
import { ConfirmModal } from "@/components/ui/modal";
import { buildLaunchParamValues } from "@/lib/miniapp-launch-params";
import { isSensitiveFrontendOperationParam } from "@/lib/miniapp-detail-helpers";

type WorkflowStage = "configure" | "preview" | "submit" | "result";

const WORKFLOW_STEPS: Array<{ label: string; stage: WorkflowStage }> = [
  { label: "Configure", stage: "configure" },
  { label: "Preview", stage: "preview" },
  { label: "Submit", stage: "submit" },
  { label: "Result", stage: "result" },
];

const WORKFLOW_STAGE_INDEX: Record<WorkflowStage, number> = {
  configure: 0,
  preview: 1,
  submit: 2,
  result: 3,
};

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
  getDisabledReason?: (operation: OperationEntry) => string | null;
  onActiveOperationChange?: (operation: OperationEntry) => void;
  launchContext?: MiniAppLaunchContext | null;
  showInvokeError?: boolean;
};

export function OperationPanel({
  operations,
  onInvoke,
  title = "Trade",
  showTitle = true,
  className,
  variant = "card",
  disabledReason = null,
  getDisabledReason,
  onActiveOperationChange,
  launchContext = null,
  showInvokeError = true,
}: Props) {
  const panelIdPrefix = useFieldIdPrefix("operation-panel");
  const requestedOperationIndex = useMemo(
    () => resolveRequestedOperationIndex(operations, launchContext?.operation),
    [launchContext?.operation, operations],
  );
  const [activeTabIdx, setActiveTabIdx] = useState(requestedOperationIndex);
  const [workflowStage, setWorkflowStage] =
    useState<WorkflowStage>("configure");

  useEffect(() => {
    setActiveTabIdx(requestedOperationIndex);
  }, [requestedOperationIndex]);

  const handleWorkflowStageChange = useCallback((stage: WorkflowStage) => {
    setWorkflowStage(stage);
  }, []);

  const tabGroups = useMemo(
    () => splitOperationTabs(operations, requestedOperationIndex),
    [operations, requestedOperationIndex],
  );
  const showPrimaryTabs =
    tabGroups.primary.length > 0 &&
    (tabGroups.primary.length > 1 || tabGroups.secondary.length > 0);

  const activeOp =
    operations[Math.min(activeTabIdx, operations.length - 1)] ??
    operations[0] ??
    null;

  useEffect(() => {
    if (activeOp) onActiveOperationChange?.(activeOp);
  }, [activeOp, onActiveOperationChange]);

  if (!operations.length || !activeOp) return null;

  const embedded = variant === "embedded";
  const shellClass = embedded
    ? "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-950/5"
    : "overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-950/5";

  return (
    <div
      className={cn(shellClass, className)}
      data-testid="operation-panel-shell"
    >
      {showTitle && (
        <div className={cn("border-b border-gray-100 px-4 py-3")}>
          <h3 className="m-0 text-base font-semibold tracking-normal text-gray-900">
            {title}
          </h3>
        </div>
      )}

      {operations.length > 1 && (
        <div className="border-b border-gray-100 px-3 py-2.5">
          {showPrimaryTabs && (
            <div
              className="flex flex-wrap gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1"
              data-testid="operation-tab-grid"
            >
              {tabGroups.primary.map((idx) => {
                const op = operations[idx];
                return (
                  <button
                    key={op.name + idx}
                    type="button"
                    onClick={() => setActiveTabIdx(idx)}
                    className={cn(
                      "relative min-h-8 max-w-full cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 text-center text-xs font-semibold leading-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30",
                      activeTabIdx === idx
                        ? getTabActiveColor(op.button_style)
                        : "text-gray-600 hover:bg-white/70 hover:text-gray-900",
                    )}
                  >
                    {op.name}
                  </button>
                );
              })}
            </div>
          )}
          {tabGroups.secondary.length > 0 && (
            <details
              className={cn(
                "rounded-xl border border-gray-200 bg-white",
                tabGroups.primary.length > 1 && "mt-2",
              )}
            >
              <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-normal text-gray-500">
                More actions
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </summary>
              <div className="flex flex-wrap gap-1 border-t border-gray-100 p-1">
                {tabGroups.secondary.map((idx) => {
                  const op = operations[idx];
                  return (
                    <button
                      key={op.name + idx}
                      type="button"
                      onClick={() => setActiveTabIdx(idx)}
                      className={cn(
                        "min-h-8 max-w-full cursor-pointer rounded-md border-0 bg-transparent px-3 py-1.5 text-center text-xs font-semibold leading-tight transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30",
                        activeTabIdx === idx
                          ? getTabActiveColor(op.button_style)
                          : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                      )}
                    >
                      {op.name}
                    </button>
                  );
                })}
              </div>
            </details>
          )}
        </div>
      )}

      <div className="sr-only">
        <div
          className="flex flex-wrap gap-1.5"
          aria-label="Transaction workflow steps"
        >
          {WORKFLOW_STEPS.map((step, index) => {
            const reached = index <= WORKFLOW_STAGE_INDEX[workflowStage];
            return (
              <div
                key={step.label}
                className={cn(
                  "inline-flex min-h-6 min-w-0 items-center gap-1.5 rounded-full border px-2 text-[10px] font-semibold uppercase tracking-normal",
                  reached
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-gray-200 bg-white text-gray-400",
                )}
                data-testid={`workflow-step-${step.stage}`}
                aria-current={
                  index === WORKFLOW_STAGE_INDEX[workflowStage]
                    ? "step"
                    : undefined
                }
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 shrink-0 rounded-full",
                    reached ? "bg-emerald-600" : "bg-gray-300",
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{step.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <OperationForm
          key={`${activeTabIdx}:${activeOp.method || activeOp.name}`}
          op={activeOp}
          onInvoke={onInvoke}
          disabledReason={disabledReason}
          getDisabledReason={getDisabledReason}
          launchContext={launchContext}
          compact={embedded}
          fieldIdPrefix={panelIdPrefix}
          showInvokeError={showInvokeError}
          onWorkflowStageChange={handleWorkflowStageChange}
        />
      </div>
    </div>
  );
}

function useFieldIdPrefix(prefix: string) {
  const reactId = useId();
  return useMemo(
    () => `${prefix}-${reactId.replace(/[^a-zA-Z0-9_-]/g, "")}`,
    [prefix, reactId],
  );
}

function buildFieldId(prefix: string, ...parts: Array<string | undefined>) {
  const suffix = parts
    .map((part) => String(part || "field").trim())
    .join("-")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${prefix}-${suffix || "field"}`;
}

function splitOperationTabs(
  operations: OperationEntry[],
  requestedOperationIndex: number,
) {
  const primary = operations
    .map((operation, index) => ({ operation, index }))
    .filter(({ operation, index }) =>
      isPrimaryOperationTab(operation, index === requestedOperationIndex),
    )
    .map(({ index }) => index);
  const secondary = operations
    .map((_, index) => index)
    .filter((index) => !primary.includes(index));

  return { primary, secondary };
}

function isPrimaryOperationTab(
  operation: OperationEntry,
  requested: boolean,
): boolean {
  if (requested) return true;
  if (operation.priority === "primary") return true;
  if (operation.priority === "secondary" || operation.priority === "operator")
    return false;

  const text = `${operation.method || ""} ${operation.name || ""}`;
  if (
    /transferAgent|setAgentCandidate|voteAgent|registerAgent|operator|admin/i.test(
      text,
    )
  ) {
    return false;
  }
  if (/claim|stake|withdraw|buy|open|pay|send/i.test(text)) return true;
  return operation.button_style !== "secondary";
}

function resolveRequestedOperationIndex(
  operations: OperationEntry[],
  requested?: string | null,
): number {
  const needle = String(requested || "")
    .trim()
    .toLowerCase();
  if (!needle) return 0;
  const index = operations.findIndex((operation) =>
    [operation.method, operation.name]
      .map((value) =>
        String(value || "")
          .trim()
          .toLowerCase(),
      )
      .includes(needle),
  );
  return index >= 0 ? index : 0;
}

function getTabActiveColor(style?: string) {
  if (style === "danger") return "bg-red-50 text-red-700 ring-1 ring-red-200";
  if (style === "success") {
    return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
  }
  if (style === "secondary") return "bg-gray-100 text-gray-900";
  return "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200";
}

function parseSelectOptions(
  options: OperationParam["options"],
): Array<{ label: string; value: string }> {
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

function normalizeSelectOptions(
  options: unknown[],
): Array<{ label: string; value: string }> {
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
    .filter((option): option is { label: string; value: string } =>
      Boolean(option),
    );
}

function OperationForm({
  op,
  onInvoke,
  disabledReason,
  getDisabledReason,
  launchContext,
  compact,
  fieldIdPrefix,
  showInvokeError,
  onWorkflowStageChange,
}: {
  op: OperationEntry;
  onInvoke: Props["onInvoke"];
  disabledReason?: string | null;
  getDisabledReason?: (operation: OperationEntry) => string | null;
  launchContext?: MiniAppLaunchContext | null;
  compact?: boolean;
  fieldIdPrefix: string;
  showInvokeError: boolean;
  onWorkflowStageChange?: (stage: WorkflowStage) => void;
}) {
  const initialValues = useMemo(
    () => buildLaunchParamValues(op.params ?? [], launchContext?.params),
    [launchContext?.params, op],
  );
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<{
    resolve: (approved: boolean) => void;
  } | null>(null);
  const serverPayoutOperation = isServerPayoutOperation(op);
  const submitLabel = submitting
    ? operationSubmittingLabel(op)
    : operationSubmitLabel(op);
  const visibleParams = useMemo(
    () =>
      (op.params ?? []).filter((param) => !param.hidden),
    [op.params],
  );
  const firstChoiceParam = visibleParams.find(
    (param) =>
      param.type === "select" && parseSelectOptions(param.options).length > 0,
  );
  const primaryValueParam = visibleParams.find(
    (param) =>
      param.type === "amount" ||
      param.type === "integer" ||
      /amount|stake|bet|total|min|max|keys|count|slots/i.test(param.name),
  );
  const secondaryParams = visibleParams.filter(
    (param) =>
      param.name !== firstChoiceParam?.name &&
      param.name !== primaryValueParam?.name,
  );
  const secondaryNeedsInput = secondaryParams.some(
    (param) => param.required && !String(values[param.name] ?? "").trim(),
  );
  const secondaryDetailsDefaultOpen =
    serverPayoutOperation || secondaryNeedsInput;
  const [secondaryDetailsOpen, setSecondaryDetailsOpen] = useState(
    secondaryDetailsDefaultOpen,
  );
  const summaryRows = visibleParams.slice(0, 4).map((param) => ({
    key: param.name,
    label: param.label || param.name,
    value: displayParamValue(param, values[param.name]),
    missing: param.required && !String(values[param.name] ?? "").trim(),
  }));

  useEffect(() => {
    setValues(initialValues);
    setError(null);
    setSettled(false);
    setSecondaryDetailsOpen(secondaryDetailsDefaultOpen);
  }, [initialValues]);

  useEffect(() => {
    if (secondaryNeedsInput) setSecondaryDetailsOpen(true);
  }, [secondaryNeedsInput]);

  const effectiveDisabledReason = getDisabledReason
    ? getDisabledReason(op)
    : disabledReason;

  // Honest workflow stage for the panel's Configure → Preview → Submit →
  // Result strip: required params missing = Configure, ready to send =
  // Preview, in flight = Submit, resolved/rejected = Result.
  const requiredParamsFilled = (op.params ?? []).every(
    (param) => !param.required || String(values[param.name] ?? "").trim(),
  );
  const workflowStage: WorkflowStage = submitting
    ? "submit"
    : settled
      ? "result"
      : requiredParamsFilled
        ? "preview"
        : "configure";
  useEffect(() => {
    onWorkflowStageChange?.(workflowStage);
  }, [onWorkflowStageChange, workflowStage]);

  const setParamValue = (name: string, value: string) => {
    // Editing after a submit walks the workflow back from Result.
    setSettled(false);
    setValues((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async () => {
    if (submitting || pendingConfirm) return;
    if (effectiveDisabledReason) {
      setError(effectiveDisabledReason);
      return;
    }

    const missingRequired = (op.params ?? []).find(
      (param) => param.required && !String(values[param.name] ?? "").trim(),
    );
    if (missingRequired) {
      setError(`${missingRequired.label || missingRequired.name} is required.`);
      return;
    }

    if (op.confirm_message) {
      // Manifest-supplied confirmations (typically destructive withdraw /
      // cancel operations) go through the shared ConfirmModal instead of the
      // unstyled native confirm dialog.
      const approved = await new Promise<boolean>((resolve) =>
        setPendingConfirm({ resolve }),
      );
      if (!approved) return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await onInvoke(op, values);
      setValues((current) => {
        let changed = false;
        const next = { ...current };
        for (const param of op.params ?? []) {
          if (isSensitiveFrontendOperationParam(op, param.name) && next[param.name]) {
            next[param.name] = "";
            changed = true;
          }
        }
        return changed ? next : current;
      });
    } catch (invokeError) {
      if (showInvokeError) {
        setError(
          invokeError instanceof Error ? invokeError.message : "Operation failed",
        );
      }
    } finally {
      setSubmitting(false);
      setSettled(true);
    }
  };

  const tone = operationTone(op);
  const claimKeyValue = String(values.claimKey || values.key || "").trim();
  const submitDisabledReason = effectiveDisabledReason;

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col",
        serverPayoutOperation
          ? "max-h-none"
          : compact
            ? "max-h-[28rem] sm:max-h-[30rem]"
            : "max-h-[calc(100vh-10rem)] sm:max-h-[calc(100vh-11rem)]",
      )}
    >
      <div
        className={cn(
          "min-h-0 flex-1 space-y-2.5",
          serverPayoutOperation
            ? "overflow-visible pr-0"
            : "overflow-y-auto pr-1",
        )}
      >
        {serverPayoutOperation ? (
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold leading-5",
              claimKeyValue
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-amber-200 bg-amber-50 text-amber-800",
            )}
          >
            <span
              className={cn(
                "h-2.5 w-2.5 shrink-0 rounded-full",
                claimKeyValue ? "bg-emerald-500" : "bg-amber-500",
              )}
              aria-hidden="true"
            />
            <span>
              {claimKeyValue ? "Reward ready" : "Paste claim key or scan QR"}
            </span>
          </div>
        ) : null}

        {serverPayoutOperation && op.description ? (
          <p className="mb-0 text-xs leading-5 text-gray-500">
            {op.description}
          </p>
        ) : (
          op.description && (
            <p className="mb-0 text-xs leading-5 text-gray-500">
              {op.description}
            </p>
          )
        )}

        {workflowStage !== "configure" && summaryRows.length > 0 && (
          <div
            className="rounded-xl border border-emerald-100 bg-emerald-50/55 p-3 shadow-sm shadow-emerald-900/5"
            data-testid="operation-param-summary"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="m-0 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                  Current setup
                </p>
                <p className="m-0 mt-1 text-xs font-medium leading-5 text-emerald-950">
                  Review the active parameters, then adjust details only when needed.
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                  secondaryNeedsInput
                    ? "border-amber-200 bg-amber-50 text-amber-700"
                    : "border-emerald-200 bg-white/80 text-emerald-700",
                )}
              >
                {secondaryNeedsInput ? "Needs input" : "Ready"}
              </span>
            </div>
            <div className="mt-3 grid gap-2">
              {summaryRows.map((item) => (
                <div
                  key={item.key}
                  className={cn(
                    "grid grid-cols-[minmax(0,0.78fr)_minmax(0,1fr)] items-center gap-3 rounded-lg border bg-white/82 px-3 py-2",
                    item.missing
                      ? "border-amber-200"
                      : "border-emerald-100/80",
                  )}
                >
                  <span className="min-w-0 truncate text-[11px] font-bold uppercase tracking-wide text-gray-500">
                    {item.label}
                  </span>
                  <strong
                    className={cn(
                      "min-w-0 truncate text-right text-xs font-bold tabular-nums",
                      item.missing ? "text-amber-700" : "text-gray-900",
                    )}
                  >
                    {item.value}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        )}

        {firstChoiceParam && (
          <ChoiceParam
            param={firstChoiceParam}
            value={values[firstChoiceParam.name] ?? ""}
            tone={tone}
            fieldIdPrefix={fieldIdPrefix}
            onChange={(value) => setParamValue(firstChoiceParam.name, value)}
          />
        )}

        {primaryValueParam && (
          <PrimaryValueParam
            param={primaryValueParam}
            value={values[primaryValueParam.name] ?? ""}
            fieldIdPrefix={fieldIdPrefix}
            onChange={(value) => setParamValue(primaryValueParam.name, value)}
          />
        )}

        {secondaryParams.length > 0 && (
          <details
            className="group rounded-xl border border-gray-200 bg-white shadow-sm shadow-gray-950/5"
            open={secondaryDetailsOpen}
            onToggle={(event) =>
              setSecondaryDetailsOpen(event.currentTarget.open)
            }
            data-testid="operation-secondary-details"
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30">
              <span className="min-w-0">
                <span className="block text-xs font-bold text-gray-900">
                  Parameters
                </span>
                <span className="mt-0.5 block truncate text-[11px] font-medium text-gray-500">
                  {secondaryNeedsInput
                    ? "Required details need attention"
                    : "Defaults are ready; open to tune"}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    secondaryNeedsInput
                      ? "border-amber-200 bg-amber-50 text-amber-700"
                      : "border-gray-200 bg-gray-50 text-gray-600",
                  )}
                >
                  {secondaryParams.length} fields
                </span>
                <ChevronDown className="h-4 w-4 text-gray-500 transition-transform group-open:rotate-180" />
              </span>
            </summary>
            <div className="space-y-3 border-t border-gray-100 p-3">
              {secondaryParams.map((param) => (
                <ParamInput
                  key={param.name}
                  param={param}
                  value={values[param.name] ?? ""}
                  tone={tone}
                  fieldIdPrefix={fieldIdPrefix}
                  onChange={(value) => setParamValue(param.name, value)}
                />
              ))}
            </div>
          </details>
        )}
      </div>

      <div className="sticky bottom-0 z-10 mt-3 space-y-2 border-t border-gray-100 bg-white/95 pt-3 backdrop-blur">
        {error && (
          <div
            aria-live="polite"
            className="break-words rounded-lg bg-red-50 p-3 text-sm text-red-600"
          >
            {error}
          </div>
        )}

        {effectiveDisabledReason && !error && (
          <div
            aria-live="polite"
            className="break-words rounded-lg bg-amber-50 p-3 text-sm text-amber-700"
          >
            {effectiveDisabledReason}
          </div>
        )}

        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 w-full min-w-0 cursor-pointer items-center justify-center gap-2 rounded-lg border-none px-4 py-3 text-sm font-semibold leading-none transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-fit sm:min-w-40",
            "whitespace-nowrap",
            "disabled:cursor-not-allowed disabled:opacity-50",
            tone.submitClass,
          )}
          onClick={handleSubmit}
          aria-disabled={submitting || Boolean(submitDisabledReason)}
          title={submitDisabledReason || undefined}
          disabled={submitting || Boolean(submitDisabledReason)}
          data-testid="operation-submit-button"
        >
          {submitting && (
            <span
              className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-white/45 border-t-white"
              aria-hidden="true"
            />
          )}
          <span className="min-w-0 text-center">{submitLabel}</span>
        </button>
      </div>

      {op.confirm_message && (
        <ConfirmModal
          isOpen={Boolean(pendingConfirm)}
          title={op.name || "Confirm operation"}
          message={op.confirm_message}
          confirmText={op.name || "Confirm"}
          confirmVariant={tone.variant === "danger" ? "danger" : "primary"}
          onConfirm={() => pendingConfirm?.resolve(true)}
          onCancel={() => {
            pendingConfirm?.resolve(false);
            setPendingConfirm(null);
          }}
        />
      )}
    </div>
  );
}

function isServerPayoutOperation(op: OperationEntry) {
  if (op.method === "claimOneGateVault") return true;
  if (op.method !== "claimPool") return false;
  return (op.params ?? []).some(isOneGateClaimKeyParam);
}

function operationSubmittingLabel(op: OperationEntry) {
  if (op.method === "prepareMiniAppOperation") return "Opening workspace...";
  return isServerPayoutOperation(op) ? "Claiming reward..." : "Processing...";
}

function operationSubmitLabel(op: OperationEntry) {
  if (op.method === "prepareMiniAppOperation") return "Open workspace";
  return isServerPayoutOperation(op) ? "Claim Reward" : op.name;
}

function isOneGateClaimKeyParam(param: OperationParam) {
  const text = `${param.name} ${param.label || ""}`.toLowerCase();
  return /claim\s*key|claimkey|(^|\W)key($|\W)/.test(text);
}

function operationTone(op: OperationEntry) {
  const text =
    `${op.button_style || ""} ${op.name || ""} ${op.method || ""}`.toLowerCase();
  if (/danger|withdraw|refund|cancel|remove|delete/.test(text)) {
    return {
      variant: "danger" as const,
      activeChoice:
        "border-red-200 bg-red-50 text-red-700",
      inactiveChoice:
        "border-transparent bg-transparent text-gray-600 hover:border-red-100 hover:bg-red-50 hover:text-red-700",
      submitClass:
        "bg-red-600 text-white shadow-sm shadow-red-600/15 hover:bg-red-700 focus-visible:ring-red-500",
    };
  }
  if (/secondary|edit|view|read|search|query/.test(text)) {
    return {
      variant: "neutral" as const,
      activeChoice:
        "border-gray-200 bg-gray-100 text-gray-900",
      inactiveChoice:
        "border-transparent bg-transparent text-gray-600 hover:border-gray-200 hover:bg-gray-50 hover:text-gray-900",
      submitClass:
        "bg-gray-950 text-white shadow-sm shadow-gray-950/15 hover:bg-gray-800 focus-visible:ring-gray-950",
    };
  }
  return {
    variant: "primary" as const,
    activeChoice:
      "border-emerald-200 bg-emerald-50 text-emerald-800",
    inactiveChoice:
      "border-transparent bg-transparent text-gray-700 hover:border-emerald-100 hover:bg-emerald-50 hover:text-emerald-800",
    submitClass:
      "bg-emerald-700 text-white shadow-sm shadow-emerald-700/15 hover:bg-emerald-800 focus-visible:ring-neo/50 disabled:border disabled:border-gray-200 disabled:bg-gray-100 disabled:text-gray-700 disabled:opacity-100",
  };
}

function ChoiceParam({
  param,
  value,
  tone,
  fieldIdPrefix,
  onChange,
}: {
  param: OperationParam;
  value: string;
  tone: ReturnType<typeof operationTone>;
  fieldIdPrefix: string;
  onChange: (v: string) => void;
}) {
  const options = parseSelectOptions(param.options);
  const label = param.label || param.name;
  const groupId = buildFieldId(fieldIdPrefix, "choice", param.name);

  return (
    <div className="space-y-1.5">
      <span
        id={groupId}
        className="text-xs font-semibold text-gray-800 sm:text-sm"
      >
        {label}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={groupId}
        className="flex w-fit max-w-full flex-wrap gap-1 rounded-full border border-gray-200 bg-white p-1"
      >
        {options.map((option) => {
          const active = value === option.value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={`${label}: ${option.label}`}
              onClick={() => onChange(option.value)}
              className={cn(
                "min-h-8 max-w-full cursor-pointer rounded-full border px-3 py-1.5 text-center text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30",
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
  fieldIdPrefix,
  onChange,
}: {
  param: OperationParam;
  value: string;
  fieldIdPrefix: string;
  onChange: (v: string) => void;
}) {
  const label = param.label || param.name;
  const presets = quickPresetsFor(param);
  const inputId = buildFieldId(fieldIdPrefix, param.name || label);

  return (
    <div className="space-y-2 rounded-lg border border-gray-200 bg-gray-50/70 p-2 sm:p-3">
      <div className="flex items-center justify-between gap-3">
        <label
          htmlFor={inputId}
          className="text-xs font-semibold text-gray-800 sm:text-sm"
        >
          {label}
        </label>
        <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500">
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
        className="h-9 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 sm:h-10"
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
              className="min-h-8 cursor-pointer rounded-lg border border-gray-200 bg-white px-2 py-1 text-center transition hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30 sm:min-h-9 sm:py-1.5"
            >
              <span className="block text-xs font-semibold text-gray-900 sm:text-sm">
                {preset.label}
              </span>
              {preset.helper && (
                <span className="block text-[10px] font-medium text-emerald-700 sm:text-[11px]">
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

function quickPresetsFor(
  param: OperationParam,
): Array<{ label: string; value: string; helper?: string }> {
  return Array.isArray(param.presets) ? param.presets : [];
}

function displayParamValue(param: OperationParam, rawValue: unknown) {
  const value = String(rawValue ?? param.default_value ?? "").trim();
  if (!value) return param.required ? "Needed" : "Optional";
  if (param.sensitive) return "••••••";
  if (param.type === "boolean") return value === "true" ? "On" : "Off";
  if (param.type === "select") {
    const match = parseSelectOptions(param.options).find(
      (option) => option.value === value,
    );
    return match?.label || value;
  }
  if (value.length > 28) return `${value.slice(0, 14)}…${value.slice(-8)}`;
  return value;
}

function ParamInput({
  param,
  value,
  tone,
  fieldIdPrefix,
  onChange,
}: {
  param: OperationParam;
  value: string;
  tone: ReturnType<typeof operationTone>;
  fieldIdPrefix: string;
  onChange: (v: string) => void;
}) {
  const label = param.label || param.name;

  if (param.type === "boolean") {
    const enabled = value === "true";
    return (
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={() => onChange(enabled ? "false" : "true")}
        className={cn(
          "flex w-full cursor-pointer items-center justify-between gap-3 rounded-lg border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/30",
          enabled
            ? "border-emerald-200 bg-emerald-50 text-emerald-950 shadow-sm"
            : "border-gray-200 bg-gray-50 text-gray-700 hover:border-emerald-200 hover:bg-white",
        )}
      >
        <span className="min-w-0 text-sm font-semibold">{label}</span>
        <span
          className={cn(
            "relative h-6 w-11 flex-none rounded-full transition-colors",
            enabled ? "bg-emerald-600" : "bg-gray-300",
          )}
          aria-hidden="true"
        >
          <span
            className={cn(
              "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-transform",
              enabled ? "translate-x-6" : "translate-x-1",
            )}
          />
        </span>
      </button>
    );
  }

  if (param.type === "select") {
    const parsedOptions = parseSelectOptions(param.options);
    if (parsedOptions.length === 0) return null;

    return (
      <ChoiceParam
        param={param}
        value={value}
        tone={tone}
        fieldIdPrefix={fieldIdPrefix}
        onChange={onChange}
      />
    );
  }

  const inputId = buildFieldId(fieldIdPrefix, param.name || label);
  const multiline =
    param.type === "string" &&
    /candidate|public\s*keys|keys|list|payload|json|calldata/i.test(
      `${param.name} ${label}`,
    );

  return (
    <div className="flex flex-col space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={inputId}
          rows={4}
          className="w-full resize-y rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 font-mono text-xs text-gray-900 transition-all placeholder:text-gray-400 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          placeholder={param.placeholder || `Enter ${label.toLowerCase()}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : (
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
      )}
    </div>
  );
}
