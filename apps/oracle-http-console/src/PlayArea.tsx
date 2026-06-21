import { useMemo, useState } from "react";
import {
  Braces,
  Check,
  ChevronDown,
  Copy,
  DatabaseZap,
  FileJson2,
  Fingerprint,
  Globe2,
  Link2,
  Play,
  Radio,
  RotateCcw,
  Send,
  ShieldCheck,
  SlidersHorizontal,
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

function compactUrl(value: string) {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
  } catch {
    return value.trim() || "—";
  }
}

function boolLabel(value: unknown, t: PlayAreaProps["t"]) {
  return value === true ? t("yes") : t("no");
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
  const methodField = consoleConfig.fields.find(
    (field) => field.key === "method",
  );
  const methodOptions = methodField?.options ?? [];
  const methodValue = values.method ?? "";
  const urlValue = values.url ?? "";
  const jsonPathValue = values.jsonPath ?? "";
  const bodyValue = values.body ?? "";
  const selectedMethod =
    methodOptions.find((option) => option.value === methodValue) ??
    methodOptions[0];
  const selectedMethodLabel = selectedMethod
    ? optionLabel(selectedMethod, t)
    : methodValue;
  const bodyEnabled = methodValue === "POST";
  const urlValid = draftResult.payload.urlValid === true;
  const pathValid = draftResult.payload.pathValid === true;
  const draftOk = draftResult.payload.status !== "input_required";
  const resultOk = result?.payload.status !== "input_required";
  const requestSummary = [
    {
      key: "method",
      label: t("method"),
      value: selectedMethodLabel,
    },
    {
      key: "source",
      label: t("httpSourceLabel"),
      value: compactUrl(urlValue),
    },
    {
      key: "path",
      label: t("httpExtractionLabel"),
      value: jsonPathValue.trim() || t("notAvailable"),
    },
    {
      key: "body",
      label: t("httpBodyState"),
      value: bodyEnabled ? t("httpBodyIncluded") : t("httpBodyIgnored"),
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
    <div className="http-play-area">
      <section className="http-hero" aria-label={t("panelTitle")}>
        <img
          className="http-hero__media"
          src="./http-oracle-pipeline.jpg"
          alt={t("httpHeroAlt")}
          loading="eager"
          decoding="async"
        />
        <div className="http-hero__shade" aria-hidden="true" />
        <div className="http-hero__copy">
          <span className="http-hero__badge" aria-hidden="true">
            <Radio size={24} />
          </span>
          <span className="http-eyebrow">{t("panelEyebrow")}</span>
          <h2>{t("panelTitle")}</h2>
          <p>{t("httpHeroCopy")}</p>
          <div className="http-hero__pills" aria-label={t("httpStatusLabel")}>
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
        <div className="http-hero__metrics" aria-label={t("statistics")}>
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

      <section className="http-flow" aria-label={t("httpFlowTitle")}>
        <span>
          <Globe2 size={18} aria-hidden="true" />
          <strong>{t("httpFlowTarget")}</strong>
          <small>{t("httpFlowTargetDesc")}</small>
        </span>
        <span>
          <Braces size={18} aria-hidden="true" />
          <strong>{t("httpFlowExtract")}</strong>
          <small>{t("httpFlowExtractDesc")}</small>
        </span>
        <span>
          <ShieldCheck size={18} aria-hidden="true" />
          <strong>{t("httpFlowBind")}</strong>
          <small>{t("httpFlowBindDesc")}</small>
        </span>
      </section>

      <section className="http-workspace">
        <div className="http-request-card" aria-label={t("httpRequestPlan")}>
          <header className="http-card-head">
            <span aria-hidden="true">
              <DatabaseZap size={19} />
            </span>
            <div>
              <small>{t("httpRequestPlan")}</small>
              <strong>{t("httpRequestPlanCopy")}</strong>
            </div>
          </header>

          <div
            className="http-summary-strip"
            aria-label={t("consoleSelectedValues")}
          >
            {requestSummary.map((item) => (
              <span key={item.key}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>

          <div
            className="http-quick-actions"
            aria-label={t("httpResultPreview")}
          >
            <NeoButton variant="primary" size="lg" onClick={buildPreview}>
              <Play size={18} aria-hidden="true" />
              <span>{t(consoleConfig.primaryActionKey)}</span>
            </NeoButton>
          </div>

          <section
            className="http-pipeline-panel"
            aria-label={t("httpPipelineTitle")}
          >
            <div className="http-pipeline-panel__head">
              <div className="http-section-copy">
                <small>{t("httpPipelineTitle")}</small>
                <strong>{t("httpPipelineCopy")}</strong>
              </div>
              <span
                className={`http-valid-chip${
                  draftOk ? " http-valid-chip--ok" : " http-valid-chip--warn"
                }`}
              >
                {draftOk ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Link2 size={15} aria-hidden="true" />
                )}
                {draftOk ? t("httpValidationReady") : draftResult.status}
              </span>
            </div>

            <div
              className="http-method-rail"
              role="radiogroup"
              aria-label={t("method")}
            >
              {methodOptions.map((option) => {
                const selected = methodValue === option.value;
                const label = optionLabel(option, t);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${t("method")}: ${label}`}
                    className={`http-method-card${
                      selected ? " http-method-card--selected" : ""
                    }`}
                    onClick={() => updateValue("method", option.value)}
                  >
                    <span aria-hidden="true">
                      {option.value === "POST" ? (
                        <Send size={18} />
                      ) : (
                        <Globe2 size={18} />
                      )}
                    </span>
                    <strong>{label}</strong>
                    <small>
                      {option.value === "POST"
                        ? t("httpMethodPostHint")
                        : t("httpMethodGetHint")}
                    </small>
                    {selected && (
                      <span
                        className="http-method-card__check"
                        aria-hidden="true"
                      >
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="http-pipeline-board">
              <label
                className={`http-pipeline-node${
                  urlValid ? " http-pipeline-node--ok" : " http-pipeline-node--warn"
                }`}
              >
                <span className="http-pipeline-node__icon" aria-hidden="true">
                  <Globe2 size={18} />
                </span>
                <span className="http-pipeline-node__copy">
                  <small>{t("httpEndpointTitle")}</small>
                  <strong>{t("httpEndpointCopy")}</strong>
                </span>
                <span className="http-pipeline-node__status">
                  {urlValid ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Link2 size={14} aria-hidden="true" />
                  )}
                  {t("urlValid")}: {boolLabel(urlValid, t)}
                </span>
                <input
                  value={urlValue}
                  placeholder={t("urlPlaceholder")}
                  aria-label={t("url")}
                  onChange={(event) => updateValue("url", event.currentTarget.value)}
                />
              </label>

              <label
                className={`http-pipeline-node${
                  pathValid ? " http-pipeline-node--ok" : " http-pipeline-node--warn"
                }`}
              >
                <span className="http-pipeline-node__icon" aria-hidden="true">
                  <Braces size={18} />
                </span>
                <span className="http-pipeline-node__copy">
                  <small>{t("httpExtractionTitle")}</small>
                  <strong>{t("httpExtractionCopy")}</strong>
                </span>
                <span className="http-pipeline-node__status">
                  {pathValid ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Braces size={14} aria-hidden="true" />
                  )}
                  {t("pathValid")}: {boolLabel(pathValid, t)}
                </span>
                <input
                  value={jsonPathValue}
                  placeholder={t("jsonPathPlaceholder")}
                  aria-label={t("jsonPath")}
                  onChange={(event) =>
                    updateValue("jsonPath", event.currentTarget.value)
                  }
                />
              </label>

              <details
                className={`http-body-panel${
                  bodyEnabled ? "" : " http-body-panel--muted"
                }`}
                open={bodyEnabled}
              >
                <summary>
                  <span>
                    <SlidersHorizontal size={17} aria-hidden="true" />
                    {t("httpBodyPanelTitle")}
                  </span>
                  <strong>
                    {bodyEnabled ? t("httpBodyIncluded") : t("httpBodyIgnored")}
                  </strong>
                  <ChevronDown
                    className="http-body-panel__icon"
                    size={15}
                    aria-hidden="true"
                  />
                </summary>
                <div className="http-body-panel__content">
                  <p>
                    {bodyEnabled
                      ? t("httpBodyPanelPostCopy")
                      : t("httpBodyPanelGetCopy")}
                  </p>
                  <label className="http-body-editor">
                    <span>{t("body")}</span>
                    <textarea
                      value={bodyValue}
                      placeholder={t("bodyPlaceholder")}
                      disabled={!bodyEnabled}
                      onChange={(event) =>
                        updateValue("body", event.currentTarget.value)
                      }
                    />
                    <small>
                      {bodyEnabled ? t("httpBodyPostHint") : t("httpBodyGetHint")}
                    </small>
                  </label>
                </div>
              </details>
            </div>
          </section>

          <div className="http-actions">
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

        <aside className="http-result-card" aria-live="polite">
          <header className="http-card-head">
            <span aria-hidden="true">
              <FileJson2 size={19} />
            </span>
            <div>
              <small>{t("httpResultPreview")}</small>
              <strong>{result ? result.status : t("previewWaiting")}</strong>
            </div>
          </header>

          <div
            className={`http-readiness${
              draftOk ? " http-readiness--ok" : " http-readiness--warn"
            }`}
          >
            <span>
              {draftOk ? t("httpValidationReady") : draftResult.status}
            </span>
            <strong>{selectedMethodLabel}</strong>
          </div>

          {result ? (
            <>
              <div
                className={`http-result-hero${
                  resultOk ? " http-result-hero--ok" : " http-result-hero--warn"
                }`}
              >
                <span>{selectedMethodLabel}</span>
                <strong>{result.summary}</strong>
                <small>
                  {String(
                    result.payload.digest ?? result.payload.requestId ?? "",
                  )}
                </small>
              </div>
              <div className="http-result-rows">
                {result.rows.map((row) => (
                  <span key={row.label}>
                    <small>{row.label}</small>
                    <strong>{row.value}</strong>
                  </span>
                ))}
              </div>
              <div className="http-payload-actions">
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
              <details className="http-payload-card">
                <summary>
                  <span>{t("consolePayload")}</span>
                  <ChevronDown
                    className="http-payload-card__icon"
                    size={15}
                    aria-hidden="true"
                  />
                </summary>
                <pre>{payloadText}</pre>
              </details>
            </>
          ) : (
            <div className="http-empty-state">
              <span aria-hidden="true">
                <DatabaseZap size={24} />
              </span>
              <strong>{t("httpEmptyTitle")}</strong>
              <p>{t("httpEmptyCopy")}</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
