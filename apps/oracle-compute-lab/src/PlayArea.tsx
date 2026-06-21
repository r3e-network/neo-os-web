import { useMemo, useState } from "react";
import {
  BrainCircuit,
  Check,
  ChevronDown,
  Copy,
  FileJson2,
  Fingerprint,
  KeyRound,
  Layers3,
  LockKeyhole,
  Play,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UnlockKeyhole,
} from "lucide-react";
import {
  NeoButton,
  type ConsoleFieldOption,
  type ConsoleResult,
} from "@shared/components-react";
import type { ObservableState } from "@shared/react/context";
import type { PlayAreaProps } from "@shared/react/defineMiniApp";
import { consoleConfig } from "./appConfig";
import "./PlayArea.scss";

function initialValues(
  launchParams: Record<string, string> = {},
): Record<string, string> {
  return consoleConfig.fields.reduce<Record<string, string>>((acc, field) => {
    acc[field.key] = launchParams[field.key] ?? field.defaultValue ?? "";
    return acc;
  }, {});
}

function setObservable(state: ObservableState, key: string, value: unknown) {
  const observable = state[key];
  if (observable && typeof observable.set === "function") {
    observable.set(value);
  }
}

function readObservable(state: ObservableState, key: string, fallback: string) {
  const value = state[key]?.get?.();
  return value == null || value === "" ? fallback : String(value);
}

function optionLabel(option: ConsoleFieldOption, t: PlayAreaProps["t"]) {
  return option.labelKey ? t(option.labelKey) : (option.label ?? option.value);
}

function boolLabel(value: unknown, t: PlayAreaProps["t"]) {
  return value === true ? t("yes") : t("no");
}

function workflowIcon(value: string) {
  if (value === "proof-check") return <ShieldCheck size={18} />;
  if (value === "batch-transform") return <Layers3 size={18} />;
  return <BrainCircuit size={18} />;
}

function workflowHint(value: string, t: PlayAreaProps["t"]) {
  if (value === "proof-check") return t("workflowProofHint");
  if (value === "batch-transform") return t("workflowBatchHint");
  return t("workflowRiskHint");
}

export default function PlayArea({
  t,
  state,
  services,
  setStatus,
  launchContext,
}: PlayAreaProps) {
  const [values, setValues] = useState(() =>
    initialValues(launchContext?.params),
  );
  const [result, setResult] = useState<ConsoleResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [initialDigest] = useState(() =>
    readObservable(state, "lastDigest", t("digestPlaceholder")),
  );
  const [initialStatus] = useState(() =>
    readObservable(state, "lastStatus", t("statusReady")),
  );

  const payloadText = useMemo(
    () => (result ? JSON.stringify(result.payload, null, 2) : ""),
    [result],
  );
  const draftResult = useMemo(
    () => consoleConfig.buildResult(values, t),
    [values, t],
  );
  const networkLabel = readObservable(state, "networkLabel", t("notAvailable"));
  const endpointLabel = readObservable(
    state,
    "endpointLabel",
    t("notAvailable"),
  );
  const lastStatus = readObservable(state, "lastStatus", initialStatus);
  const lastDigest = readObservable(state, "lastDigest", initialDigest);
  const requestCount = readObservable(state, "requestCount", "0");
  const workflowField = consoleConfig.fields.find(
    (field) => field.key === "workflow",
  );
  const privacyField = consoleConfig.fields.find(
    (field) => field.key === "privacy",
  );
  const workflowOptions = workflowField?.options ?? [];
  const privacyOptions = privacyField?.options ?? [];
  const workflowValue = values.workflow ?? "";
  const privacyValue = values.privacy ?? "";
  const inputValue = values.input ?? "";
  const selectedWorkflow =
    workflowOptions.find((option) => option.value === workflowValue) ??
    workflowOptions[0];
  const selectedPrivacy =
    privacyOptions.find((option) => option.value === privacyValue) ??
    privacyOptions[0];
  const selectedWorkflowLabel = selectedWorkflow
    ? optionLabel(selectedWorkflow, t)
    : workflowValue;
  const selectedPrivacyLabel = selectedPrivacy
    ? optionLabel(selectedPrivacy, t)
    : privacyValue;
  const privacySealed = privacyValue !== "public";
  const inputValid = draftResult.payload.inputValid === true;
  const draftOk = draftResult.payload.status !== "input_required";
  const resultOk = result?.payload.status !== "input_required";
  const inputDigest = String(draftResult.payload.inputDigest ?? "");
  const summaryItems = [
    {
      key: "workflow",
      label: t("workflow"),
      value: selectedWorkflowLabel,
    },
    {
      key: "privacy",
      label: t("privacy"),
      value: selectedPrivacyLabel,
    },
    {
      key: "input",
      label: t("inputValid"),
      value: boolLabel(inputValid, t),
    },
    {
      key: "size",
      label: t("computeInputSize"),
      value: t("computeInputBytes", { count: inputValue.length }),
    },
  ];

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function applyResult(next: ConsoleResult) {
    setResult(next);
    const ok = next.payload.status !== "input_required";
    setObservable(state, "lastStatus", next.status);
    const digest = next.payload.digest ?? next.payload.requestId;
    if (ok && digest != null && digest !== "") {
      setObservable(state, "lastDigest", String(digest));
    } else if (!ok) {
      setObservable(
        state,
        "lastDigest",
        readObservable(state, "lastDigest", t("notAvailable")),
      );
    }
    if (ok) {
      const count = Number(state.requestCount?.get?.() ?? 0);
      setObservable(state, "requestCount", count + 1);
    }
    if (!ok) {
      setStatus(next.status, "warning");
    }
  }

  function buildPreview() {
    applyResult(consoleConfig.buildResult(values, t));
  }

  function reset() {
    setValues(initialValues(launchContext?.params));
    setResult(null);
    setObservable(state, "lastStatus", initialStatus);
    setObservable(state, "lastDigest", initialDigest);
    setObservable(state, "requestCount", 0);
  }

  async function copyPayload() {
    if (!payloadText) return;
    await services.clipboard.copy(payloadText, consoleConfig.copiedKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className="compute-play-area">
      <section className="compute-hero" aria-label={t("panelTitle")}>
        <img
          className="compute-hero__media"
          src="./compute-privacy-stage.jpg"
          alt={t("computeHeroAlt")}
          loading="eager"
          decoding="async"
        />
        <div className="compute-hero__shade" aria-hidden="true" />
        <div className="compute-hero__copy">
          <span className="compute-hero__badge" aria-hidden="true">
            <BrainCircuit size={24} />
          </span>
          <span className="compute-eyebrow">{t("panelEyebrow")}</span>
          <h2>{t("panelTitle")}</h2>
          <p>{t("computeHeroCopy")}</p>
          <div
            className="compute-hero__pills"
            aria-label={t("computeStatusLabel")}
          >
            <span>
              <ShieldCheck size={15} aria-hidden="true" />
              {lastStatus}
            </span>
            <span>
              <Fingerprint size={15} aria-hidden="true" />
              {lastDigest}
            </span>
          </div>
        </div>
        <div className="compute-hero__metrics" aria-label={t("statistics")}>
          <span>
            <small>{t("statNetwork")}</small>
            <strong>{networkLabel}</strong>
          </span>
          <span>
            <small>{t("statEndpoint")}</small>
            <strong>{endpointLabel}</strong>
          </span>
          <span>
            <small>{t("statRequests")}</small>
            <strong>{requestCount}</strong>
          </span>
        </div>
      </section>

      <section className="compute-flow" aria-label={t("computeFlowTitle")}>
        <span>
          <BrainCircuit size={18} aria-hidden="true" />
          <strong>{t("computeFlowWorkflow")}</strong>
          <small>{t("computeFlowWorkflowDesc")}</small>
        </span>
        <span>
          <LockKeyhole size={18} aria-hidden="true" />
          <strong>{t("computeFlowSeal")}</strong>
          <small>{t("computeFlowSealDesc")}</small>
        </span>
        <span>
          <KeyRound size={18} aria-hidden="true" />
          <strong>{t("computeFlowDigest")}</strong>
          <small>{t("computeFlowDigestDesc")}</small>
        </span>
      </section>

      <section className="compute-workspace">
        <div className="compute-request-card" aria-label={t("computePlan")}>
          <header className="compute-card-head">
            <span aria-hidden="true">
              <Sparkles size={19} />
            </span>
            <div>
              <small>{t("computePlan")}</small>
              <strong>{t("computePlanCopy")}</strong>
            </div>
          </header>

          <div
            className="compute-summary-strip"
            aria-label={t("consoleSelectedValues")}
          >
            {summaryItems.map((item) => (
              <span key={item.key}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>

          <section
            className="compute-capsule-panel"
            aria-label={t("computeCapsuleTitle")}
          >
            <div className="compute-capsule-panel__head">
              <div className="compute-section-copy">
                <small>{t("computeCapsuleTitle")}</small>
                <strong>{t("computeCapsuleCopy")}</strong>
              </div>
              <span
                className={`compute-valid-chip${
                  draftOk
                    ? " compute-valid-chip--ok"
                    : " compute-valid-chip--warn"
                }`}
              >
                {draftOk ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <FileJson2 size={15} aria-hidden="true" />
                )}
                {draftOk ? t("computeValidationReady") : draftResult.status}
              </span>
            </div>

            <div className="compute-capsule-board">
              <div className="compute-stage-block">
                <div className="compute-stage-block__copy">
                  <span aria-hidden="true">
                    <BrainCircuit size={18} />
                  </span>
                  <div>
                    <small>{t("computeWorkflowTitle")}</small>
                    <strong>{t("computeWorkflowCopy")}</strong>
                  </div>
                </div>
                <div
                  className="compute-workflow-grid"
                  role="radiogroup"
                  aria-label={t("workflow")}
                >
                  {workflowOptions.map((option) => {
                    const selected = workflowValue === option.value;
                    const label = optionLabel(option, t);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${t("workflow")}: ${label}`}
                        className={`compute-choice-card${
                          selected ? " compute-choice-card--selected" : ""
                        }`}
                        onClick={() => updateValue("workflow", option.value)}
                      >
                        <span aria-hidden="true">{workflowIcon(option.value)}</span>
                        <strong>{label}</strong>
                        <small>{workflowHint(option.value, t)}</small>
                        {selected && (
                          <span
                            className="compute-choice-card__check"
                            aria-hidden="true"
                          >
                            <Check size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="compute-stage-block">
                <div className="compute-stage-block__copy">
                  <span aria-hidden="true">
                    <LockKeyhole size={18} />
                  </span>
                  <div>
                    <small>{t("computePrivacyTitle")}</small>
                    <strong>{t("computePrivacyCopy")}</strong>
                  </div>
                </div>
                <div
                  className="compute-privacy-grid"
                  role="radiogroup"
                  aria-label={t("privacy")}
                >
                  {privacyOptions.map((option) => {
                    const selected = privacyValue === option.value;
                    const label = optionLabel(option, t);
                    const isPublic = option.value === "public";
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${t("privacy")}: ${label}`}
                        className={`compute-choice-card${
                          selected ? " compute-choice-card--selected" : ""
                        }`}
                        onClick={() => updateValue("privacy", option.value)}
                      >
                        <span aria-hidden="true">
                          {isPublic ? (
                            <UnlockKeyhole size={18} />
                          ) : (
                            <LockKeyhole size={18} />
                          )}
                        </span>
                        <strong>{label}</strong>
                        <small>
                          {isPublic
                            ? t("privacyPublicHint")
                            : t("privacySealedHint")}
                        </small>
                        {selected && (
                          <span
                            className="compute-choice-card__check"
                            aria-hidden="true"
                          >
                            <Check size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <label
                className={`compute-input-capsule${
                  inputValid ? " compute-input-capsule--ok" : " compute-input-capsule--warn"
                }`}
              >
                <span className="compute-input-capsule__icon" aria-hidden="true">
                  <FileJson2 size={18} />
                </span>
                <span className="compute-input-capsule__copy">
                  <small>{t("computeInputTitle")}</small>
                  <strong>
                    {privacySealed
                      ? t("computeInputSealedCopy")
                      : t("computeInputPublicCopy")}
                  </strong>
                </span>
                <span
                  className={`compute-valid-chip${
                    inputValid
                      ? " compute-valid-chip--ok"
                      : " compute-valid-chip--warn"
                  }`}
                >
                  {inputValid ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <FileJson2 size={15} aria-hidden="true" />
                  )}
                  {t("inputValid")}: {boolLabel(inputValid, t)}
                </span>
                <textarea
                  aria-label={t("input")}
                  value={inputValue}
                  placeholder={t("inputPlaceholder")}
                  onChange={(event) =>
                    updateValue("input", event.currentTarget.value)
                  }
                />
                <small className="compute-input-capsule__hint">
                  {inputValid
                    ? t("computeInputReadyHint")
                    : t("computeInputInvalidHint")}
                </small>
                <div className="compute-digest-strip">
                  <span>
                    <small>{t("inputDigest")}</small>
                    <strong>{inputDigest}</strong>
                  </span>
                  <span>
                    <small>{t("computeVisibility")}</small>
                    <strong>
                      {privacySealed ? t("inputRedacted") : t("inputPublic")}
                    </strong>
                  </span>
                </div>
              </label>
            </div>
          </section>

          <div className="compute-actions">
            <NeoButton variant="primary" size="lg" onClick={buildPreview}>
              <Play size={18} aria-hidden="true" />
              <span>{t(consoleConfig.primaryActionKey)}</span>
            </NeoButton>
            <NeoButton variant="ghost" size="lg" onClick={reset}>
              <RotateCcw size={18} aria-hidden="true" />
              <span>{t(consoleConfig.resetActionKey)}</span>
            </NeoButton>
          </div>
        </div>

        <aside className="compute-result-card" aria-live="polite">
          <header className="compute-card-head">
            <span aria-hidden="true">
              <ScanSearch size={19} />
            </span>
            <div>
              <small>{t("computeReceipt")}</small>
              <strong>{result ? result.status : t("previewWaiting")}</strong>
            </div>
          </header>

          <div
            className={`compute-readiness${
              draftOk ? " compute-readiness--ok" : " compute-readiness--warn"
            }`}
          >
            <span>
              {draftOk ? t("computeValidationReady") : draftResult.status}
            </span>
            <strong>{selectedPrivacyLabel}</strong>
          </div>

          {result ? (
            <>
              <div
                className={`compute-result-hero${
                  resultOk
                    ? " compute-result-hero--ok"
                    : " compute-result-hero--warn"
                }`}
              >
                <span>{selectedWorkflowLabel}</span>
                <strong>{resultOk ? result.summary : result.status}</strong>
                <small>
                  {String(
                    result.payload.digest ?? result.payload.requestId ?? "",
                  )}
                </small>
              </div>
              <div className="compute-result-rows">
                {result.rows.map((row) => (
                  <span key={row.label}>
                    <small>{row.label}</small>
                    <strong>{row.value}</strong>
                  </span>
                ))}
              </div>
              <div className="compute-payload-actions">
                <NeoButton variant="secondary" size="sm" onClick={copyPayload}>
                  {copied ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                  <span>
                    {copied
                      ? t(consoleConfig.copiedKey)
                      : t(consoleConfig.copyActionKey)}
                  </span>
                </NeoButton>
              </div>
              <details className="compute-payload-card console-tool__payload-card">
                <summary>
                  <span>{t("consolePayload")}</span>
                  <ChevronDown
                    className="compute-payload-card__icon"
                    size={15}
                    aria-hidden="true"
                  />
                </summary>
                <pre>{payloadText}</pre>
              </details>
            </>
          ) : (
            <div className="compute-empty-state">
              <span aria-hidden="true">
                <LockKeyhole size={24} />
              </span>
              <strong>{t("computeEmptyTitle")}</strong>
              <p>{t("computeEmptyCopy")}</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
