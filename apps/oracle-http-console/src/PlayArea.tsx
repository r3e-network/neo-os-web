import { useEffect, useMemo, useRef, useState } from "react";
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

type HttpActionPreview = "preview" | "copy";

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
  const [actionPreview, setActionPreview] = useState<HttpActionPreview | null>(
    null,
  );
  const actionPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
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
  const routeStageClassName = [
    "http-route-stage",
    draftOk ? "http-route-stage--ready" : "http-route-stage--warn",
  ].join(" ");
  const routeStatusClassName = [
    "http-route-status",
    draftOk ? "http-route-status--ready" : "http-route-status--warn",
  ].join(" ");
  const draftDigest = String(
    draftResult.payload.digest ?? t("digestPlaceholder"),
  );
  const routeSignals = [
    {
      key: "url",
      ok: urlValid,
      label: t("urlValid"),
      value: urlValid ? t("httpUrlReadyHint") : t("httpUrlInvalidHint"),
    },
    {
      key: "path",
      ok: pathValid,
      label: t("pathValid"),
      value: pathValid ? t("httpPathReadyHint") : t("httpPathInvalidHint"),
    },
    {
      key: "body",
      ok: true,
      label: t("httpBodyState"),
      value: bodyEnabled ? t("httpBodyIncluded") : t("httpBodyIgnored"),
    },
  ];
  const isPreviewing = actionPreview === "preview";
  const isCopying = actionPreview === "copy";
  const isLocalActionBusy = actionPreview !== null;

  useEffect(
    () => () => {
      if (actionPreviewTimeout.current !== null) {
        clearTimeout(actionPreviewTimeout.current);
      }
    },
    [],
  );

  function startActionPreview(action: HttpActionPreview, duration = 1100) {
    if (actionPreviewTimeout.current !== null) {
      clearTimeout(actionPreviewTimeout.current);
    }
    setActionPreview(action);
    actionPreviewTimeout.current = setTimeout(() => {
      setActionPreview(null);
      actionPreviewTimeout.current = null;
    }, duration);
  }

  function updateValue(key: string, value: string) {
    if (isPreviewing) return;
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
    if (isPreviewing) return;
    startActionPreview("preview", 1100);
    applyResult(consoleConfig.buildResult(values, t));
  }

  function reset() {
    if (isLocalActionBusy) return;
    setValues(initialValues(launchContext?.params));
    setResult(null);
    setObservable(state, "lastStatus", initialStatus);
    setObservable(state, "lastDigest", initialDigest);
    setObservable(state, "requestCount", 0);
  }

  async function copyPayload() {
    if (!payloadText || isCopying) return;
    startActionPreview("copy", 900);
    await services.clipboard.copy(payloadText, consoleConfig.copiedKey);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div
      className={[
        "http-play-area",
        isPreviewing ? "http-play-area--routing" : "",
        isCopying ? "http-play-area--copying" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-busy={isLocalActionBusy || undefined}
    >
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

          <section
            className={`${routeStageClassName}${isPreviewing ? " http-route-stage--routing" : ""}`}
            aria-label={t("httpRouteWorkbench")}
            aria-busy={isPreviewing || undefined}
          >
            <div className="http-route-stage__head">
              <div className="http-section-copy">
                <small>{t("httpRouteWorkbench")}</small>
                <strong>{t("httpRouteWorkbenchCopy")}</strong>
              </div>
              <span className={routeStatusClassName}>
                {draftOk ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Link2 size={15} aria-hidden="true" />
                )}
                {draftOk ? t("httpValidationReady") : draftResult.status}
              </span>
            </div>

            <div className="http-route-lane" aria-label={t("httpFlowTitle")}>
              <div className="http-route-node http-route-node--source">
                <span className="http-route-node__orb" aria-hidden="true">
                  <Globe2 size={18} />
                </span>
                <small>{t("httpRouteSourceNode")}</small>
                <strong>{compactUrl(urlValue)}</strong>
              </div>
              <span className="http-route-connector" aria-hidden="true">
                <span className="http-route-connector__packet" />
              </span>
              <div className="http-route-node http-route-node--extract">
                <span className="http-route-node__orb" aria-hidden="true">
                  <Braces size={18} />
                </span>
                <small>{t("httpRouteExtractNode")}</small>
                <strong>{jsonPathValue.trim() || t("notAvailable")}</strong>
              </div>
              <span className="http-route-connector" aria-hidden="true">
                <span className="http-route-connector__packet" />
              </span>
              <div className="http-route-node http-route-node--digest">
                <span className="http-route-node__orb" aria-hidden="true">
                  <Fingerprint size={18} />
                </span>
                <small>{t("httpRouteDigestNode")}</small>
                <strong>{draftDigest}</strong>
              </div>
            </div>

            <div className="http-signal-row" aria-label={t("httpSignalsLabel")}>
              {routeSignals.map((signal) => (
                <span
                  key={signal.key}
                  className={[
                    "http-signal-chip",
                    signal.ok
                      ? "http-signal-chip--ok"
                      : "http-signal-chip--warn",
                  ].join(" ")}
                >
                  {signal.ok ? (
                    <Check size={14} aria-hidden="true" />
                  ) : (
                    <Link2 size={14} aria-hidden="true" />
                  )}
                  <small>{signal.label}</small>
                  <strong>{signal.value}</strong>
                </span>
              ))}
            </div>
          </section>

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
                    disabled={isPreviewing}
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
                  urlValid
                    ? " http-pipeline-node--ok"
                    : " http-pipeline-node--warn"
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
                  disabled={isPreviewing}
                  onChange={(event) =>
                    updateValue("url", event.currentTarget.value)
                  }
                />
              </label>

              <label
                className={`http-pipeline-node${
                  pathValid
                    ? " http-pipeline-node--ok"
                    : " http-pipeline-node--warn"
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
                  disabled={isPreviewing}
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
                      disabled={!bodyEnabled || isPreviewing}
                      onChange={(event) =>
                        updateValue("body", event.currentTarget.value)
                      }
                    />
                    <small>
                      {bodyEnabled
                        ? t("httpBodyPostHint")
                        : t("httpBodyGetHint")}
                    </small>
                  </label>
                </div>
              </details>
            </div>
          </section>

          <div className="http-actions">
            <NeoButton
              variant="primary"
              size="lg"
              disabled={isPreviewing}
              className={isPreviewing ? "is-routing" : undefined}
              aria-label={
                isPreviewing
                  ? t("previewingRequest")
                  : t(consoleConfig.primaryActionKey)
              }
              onClick={buildPreview}
            >
              {isPreviewing ? (
                <DatabaseZap size={18} aria-hidden="true" />
              ) : (
                <Play size={18} aria-hidden="true" />
              )}
              <span>
                {isPreviewing
                  ? t("previewingRequest")
                  : t(consoleConfig.primaryActionKey)}
              </span>
            </NeoButton>
            <NeoButton
              variant="ghost"
              size="lg"
              disabled={isLocalActionBusy}
              onClick={reset}
            >
              <RotateCcw size={18} aria-hidden="true" />
              <span>{t(consoleConfig.resetActionKey)}</span>
            </NeoButton>
          </div>
        </div>

        <aside
          className={`http-result-card${isCopying ? " http-result-card--copying" : ""}`}
          aria-live="polite"
        >
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
                <NeoButton
                  variant="secondary"
                  size="sm"
                  disabled={isCopying}
                  className={isCopying ? "is-copying" : undefined}
                  aria-label={
                    isCopying
                      ? t("copyingPayload")
                      : t(consoleConfig.copyActionKey)
                  }
                  onClick={copyPayload}
                >
                  {isCopying ? (
                    <DatabaseZap size={16} aria-hidden="true" />
                  ) : copied ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <Copy size={16} aria-hidden="true" />
                  )}
                  <span>
                    {isCopying
                      ? t("copyingPayload")
                      : copied
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
