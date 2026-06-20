import { useContext, useId, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  ArrowRight,
  Check,
  Copy,
  DatabaseZap,
  FileSearch,
  Info,
  Play,
  ReceiptText,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { MiniAppManifestContext } from "../react/context";
import type { ObservableState } from "../react/context";
import type { PlatformServices } from "../services";
import type { MiniAppLaunchContext } from "../utils/launch-params";
import { NeoButton } from "./NeoButton";
import { NeoInput } from "./NeoInput";
import "./ConsoleToolPanel.scss";

export type ConsoleFieldType = "text" | "textarea" | "number" | "select";

export interface ConsoleFieldOption {
  value: string;
  labelKey?: string;
  label?: string;
}

export interface ConsoleField {
  key: string;
  labelKey: string;
  placeholderKey?: string;
  type?: ConsoleFieldType;
  defaultValue?: string;
  options?: ConsoleFieldOption[];
}

export interface ConsoleResultRow {
  label: string;
  value: string;
}

export interface ConsoleResult {
  status: string;
  summary: string;
  rows: ConsoleResultRow[];
  payload: Record<string, unknown>;
}

export interface ConsoleToolConfig {
  titleKey: string;
  eyebrowKey: string;
  descriptionKey: string;
  primaryActionKey: string;
  resetActionKey: string;
  copyActionKey: string;
  copiedKey: string;
  /**
   * i18n key for the live-dispatch button label.
   * Defaults to the shared "consoleExecuteAction" base message.
   */
  executeActionKey?: string;
  /**
   * i18n key for the preview-only notice shown when no execute hook is
   * configured. Defaults to the shared "consolePreviewNotice" base message.
   */
  previewNoticeKey?: string;
  /**
   * Optional public image path for the scene card. Oracle console apps default
   * to ./oracle-workspace-stage.jpg, which each app ships from its public dir.
   */
  visualSrc?: string;
  /**
   * Hide the session "Requests" counter in the hero meta line for consoles
   * where the tally carries no business meaning (e.g. the VRF console).
   */
  hideRequestCount?: boolean;
  fields: ConsoleField[];
  buildResult: (
    values: Record<string, string>,
    t: (key: string, params?: Record<string, string | number>) => string,
  ) => ConsoleResult;
  /**
   * OPT-IN live dispatch. When provided, the panel renders a secondary
   * "Send live request" button that awaits this hook and applies the returned
   * ConsoleResult exactly like a preview (status, digest, request counter,
   * toast). Probed 2026-06-12: the restored mainnet worker
   * (oracle.meshmini.app/mainnet) rejects every tokenless POST lane
   * (oracle/query, oracle/smart-fetch, compute/execute → 401) and gates
   * vrf/random behind Turnstile (403), but serves tokenless GETs for
   * feeds/price/:symbol, feeds/catalog, neodid/providers and
   * oracle/public-key — so consoles should wire this hook to those read
   * lanes only. Without the hook the panel shows an honest preview-only
   * notice instead of a silent dead-end.
   */
  execute?: (
    values: Record<string, string>,
    t: (key: string, params?: Record<string, string | number>) => string,
  ) => Promise<ConsoleResult>;
}

export interface ConsoleToolPanelProps {
  config: ConsoleToolConfig;
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  services: PlatformServices;
  setStatus: (msg: string, type: "success" | "error" | "info" | "warning") => void;
  launchContext?: MiniAppLaunchContext | null;
}

function initialValues(
  fields: ConsoleField[],
  launchParams: Record<string, string> = {},
) {
  return fields.reduce<Record<string, string>>((acc, field) => {
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

export function previewId(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `0x${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const HEX_ACCENT_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

/**
 * Derive the panel's accent custom properties from the manifest accentColor so
 * the console chrome (badge, status pill, focus ring) follows each app's
 * declared accent instead of the host's hardcoded violet. Falls back to the
 * --ns-violet-* aliases (declared in the SCSS) when the manifest has no valid
 * hex accent.
 */
export function consoleAccentVars(
  accentColor: string | undefined | null,
): CSSProperties | undefined {
  if (!accentColor || !HEX_ACCENT_PATTERN.test(accentColor)) return undefined;
  const hex =
    accentColor.length === 4
      ? `#${accentColor[1]}${accentColor[1]}${accentColor[2]}${accentColor[2]}${accentColor[3]}${accentColor[3]}`
      : accentColor;
  const red = parseInt(hex.slice(1, 3), 16);
  const green = parseInt(hex.slice(3, 5), 16);
  const blue = parseInt(hex.slice(5, 7), 16);
  return {
    "--console-accent": hex,
    "--console-accent-soft": `rgba(${red}, ${green}, ${blue}, 0.12)`,
  } as CSSProperties;
}

export function ConsoleToolPanel({
  config,
  t,
  state,
  services,
  setStatus,
  launchContext = null,
}: ConsoleToolPanelProps) {
  const manifest = useContext(MiniAppManifestContext);
  const accentVars = useMemo(
    () => consoleAccentVars(manifest?.theme?.accentColor),
    [manifest],
  );
  const [values, setValues] = useState(() =>
    initialValues(config.fields, launchContext?.params),
  );
  const panelId = useId();
  const [result, setResult] = useState<ConsoleResult | null>(null);
  const [executing, setExecuting] = useState(false);
  // Capture the app-provided initial status/digest once, so Reset restores the
  // exact placeholders each app seeded (e.g. "—" vs "N/A") instead of a single
  // hardcoded key. Computed once at mount before any preview mutates the state.
  const [initialDigest] = useState(() =>
    readObservable(state, "lastDigest", t("notAvailable")),
  );
  const [initialStatus] = useState(() =>
    readObservable(state, "lastStatus", t("statusReady")),
  );
  const payloadText = useMemo(
    () => (result ? JSON.stringify(result.payload, null, 2) : ""),
    [result],
  );
  const networkLabel = readObservable(state, "networkLabel", t("notAvailable"));
  const endpointLabel = readObservable(state, "endpointLabel", t("notAvailable"));
  const requestCount = readObservable(state, "requestCount", "0");
  const choiceFields = config.fields.filter((field) => field.type === "select");
  const inputFields = config.fields.filter((field) => field.type !== "select");
  const stageSrc = config.visualSrc ?? "./oracle-workspace-stage.jpg";
  const requestSummary = config.fields.slice(0, 4).map((field) => ({
    key: field.key,
    label: t(field.labelKey),
    value: displayFieldValue(field, values[field.key], t),
  }));

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function applyResult(next: ConsoleResult) {
    setResult(next);
    // A result carrying payload.status === "input_required" signals a
    // validation failure (no real preview/dispatch produced). Treat it as a
    // warning so the host does not render a green "success" toast, keep
    // counters/digest honest.
    const ok = next.payload.status !== "input_required";
    setObservable(state, "lastStatus", next.status);
    const digest = next.payload.digest ?? next.payload.requestId;
    if (ok && digest != null && digest !== "") {
      setObservable(state, "lastDigest", String(digest));
    } else if (!ok) {
      // Preserve the existing placeholder/value instead of blanking the stat.
      setObservable(state, "lastDigest", readObservable(state, "lastDigest", t("notAvailable")));
    }
    if (ok) {
      const count = Number(state.requestCount?.get?.() ?? 0);
      setObservable(state, "requestCount", count + 1);
    }
    setStatus(next.status, ok ? "success" : "warning");
  }

  function runPreview() {
    applyResult(config.buildResult(values, t));
  }

  async function runExecute() {
    if (!config.execute || executing) return;
    setExecuting(true);
    try {
      applyResult(await config.execute(values, t));
    } catch (err) {
      // Live dispatch failed — keep the last preview/result intact and surface
      // an honest error toast. Apps localize their own thrown messages; only
      // an empty/non-Error rejection falls back to the shared key.
      const message =
        err instanceof Error && err.message ? err.message : t("unexpectedError");
      setStatus(message, "error");
    } finally {
      setExecuting(false);
    }
  }

  function reset() {
    // Re-apply deep-link launch params (when present) so Reset returns a
    // deep-linked console to the launch payload it opened with, not to the
    // bare field defaults.
    setValues(initialValues(config.fields, launchContext?.params));
    setResult(null);
    // Restore the same initial values the app seeded so Reset returns the surface
    // to a genuinely fresh state: status/digest placeholders match first load and
    // the request tally is cleared (it tracks this session's previews, not a
    // lifetime metric).
    setObservable(state, "lastStatus", initialStatus);
    setObservable(state, "lastDigest", initialDigest);
    setObservable(state, "requestCount", 0);
  }

  async function copyPayload() {
    if (!payloadText) return;
    await services.clipboard.copy(payloadText, config.copiedKey);
  }

  return (
    <div className="console-tool" style={accentVars}>
      <section className="console-tool__hero" aria-labelledby="console-title">
        <div className="console-tool__intro">
          <span className="console-tool__hero-badge" aria-hidden="true">
            <ShieldCheck size={22} />
          </span>
          <div className="console-tool__intro-copy">
            <span className="console-tool__eyebrow">{t(config.eyebrowKey)}</span>
            <h2 id="console-title">{t(config.titleKey)}</h2>
            <p>{t(config.descriptionKey)}</p>
          </div>
          <div className="console-tool__hero-meta" aria-label={t("statistics")}>
            <span>{t("statNetwork")} <strong>{networkLabel}</strong></span>
            <span>{t("statEndpoint")} <strong>{endpointLabel}</strong></span>
            {config.hideRequestCount ? null : (
              <span>{t("statRequests")} <strong>{requestCount}</strong></span>
            )}
          </div>
        </div>
        <figure className="console-tool__stage">
          <img
            src={stageSrc}
            alt=""
            onError={(event) => {
              const image = event.currentTarget;
              if (image.dataset.fallbackApplied === "true") return;
              image.dataset.fallbackApplied = "true";
              image.src = "./banner.jpg";
            }}
          />
          <figcaption>
            <span>{t("consoleFlow")}</span>
            <strong>{t("consoleRequestHint")}</strong>
          </figcaption>
        </figure>
      </section>

      {!config.execute && (
        <p className="console-tool__notice" role="note">
          <Info size={16} aria-hidden="true" />
          <span>{t(config.previewNoticeKey ?? "consolePreviewNotice")}</span>
        </p>
      )}

      <section className="console-tool__workspace">
        <div className="console-tool__form" aria-label={t(config.titleKey)}>
          <div className="console-tool__form-head">
            <span className="console-tool__form-icon" aria-hidden="true">
              <DatabaseZap size={18} />
            </span>
            <div className="console-tool__form-copy">
              <span>{t("consoleConfigureEyebrow")}</span>
              <strong>{t("consoleConfigureTitle")}</strong>
            </div>
          </div>

          <div className="console-tool__flow-rail" aria-label={t("consoleFlow")}>
            <span>{t("consoleFlowInput")}</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>{t("consoleFlowPreview")}</span>
            <ArrowRight size={14} aria-hidden="true" />
            <span>{t("consoleFlowVerify")}</span>
          </div>

          <div className="console-tool__request-summary" aria-label={t("consoleSelectedValues")}>
            {requestSummary.map((item) => (
              <div key={item.key}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          {choiceFields.length > 0 && (
            <div className="console-tool__choice-stack">
              {choiceFields.map((field) => {
                const fieldLabel = t(field.labelKey);
                const fieldHeadingId = `${panelId}-${field.key}-choice`;
                const selectedOption = (field.options ?? []).find(
                  (option) => option.value === values[field.key],
                );
                const selectedLabel = selectedOption
                  ? optionLabel(selectedOption, t)
                  : values[field.key] || t("notAvailable");

                return (
                  <section
                    className="console-tool__choice-group"
                    key={field.key}
                    aria-labelledby={fieldHeadingId}
                  >
                    <div className="console-tool__choice-head">
                      <span id={fieldHeadingId}>{fieldLabel}</span>
                      <strong>{selectedLabel}</strong>
                    </div>
                    <div
                      className="console-tool__choice-options"
                      role="radiogroup"
                      aria-label={fieldLabel}
                    >
                      {(field.options ?? []).map((option) => {
                        const label = optionLabel(option, t);
                        const selected = values[field.key] === option.value;
                        const showValue = option.value !== label;

                        return (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            aria-label={`${fieldLabel}: ${label}`}
                            className={`console-tool__choice-button${
                              selected ? " console-tool__choice-button--active" : ""
                            }`}
                            onClick={() => updateValue(field.key, option.value)}
                          >
                            <span className="console-tool__choice-copy">
                              <strong>{label}</strong>
                              {showValue && <small>{option.value}</small>}
                            </span>
                            {selected && (
                              <span className="console-tool__choice-check" aria-hidden="true">
                                <Check size={14} />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}

          {inputFields.length > 0 && (
            <section className="console-tool__input-section">
              <div className="console-tool__section-head">
                <span>{t("consoleParametersEyebrow")}</span>
                <strong>{t("consoleParametersTitle")}</strong>
              </div>
              <div className="console-tool__input-grid">
                {inputFields.map((field) => (
                  <div
                    key={field.key}
                    className={`console-tool__input-cell${
                      isWideConsoleField(field) ? " console-tool__input-cell--wide" : ""
                    }`}
                  >
                    <NeoInput
                      type={
                        field.type === "number"
                          ? "number"
                          : field.type === "textarea"
                            ? "textarea"
                            : "text"
                      }
                      label={t(field.labelKey)}
                      value={values[field.key] ?? ""}
                      placeholder={field.placeholderKey ? t(field.placeholderKey) : ""}
                      onChange={(value) => updateValue(field.key, value)}
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          <div className="console-tool__actions">
            <NeoButton variant="primary" size="lg" onClick={runPreview}>
              <Play size={18} aria-hidden="true" />
              <span>{t(config.primaryActionKey)}</span>
            </NeoButton>
            {config.execute ? (
              <NeoButton
                variant="secondary"
                size="lg"
                loading={executing}
                onClick={() => {
                  void runExecute();
                }}
              >
                <Send size={18} aria-hidden="true" />
                <span>{t(config.executeActionKey ?? "consoleExecuteAction")}</span>
              </NeoButton>
            ) : null}
            <NeoButton variant="ghost" size="lg" onClick={reset}>
              <RotateCcw size={18} aria-hidden="true" />
              <span>{t(config.resetActionKey)}</span>
            </NeoButton>
          </div>
        </div>

        <div className="console-tool__result" aria-live="polite">
          <div className="console-tool__result-top">
            <span className="console-tool__result-icon" aria-hidden="true">
              {result ? <ReceiptText size={18} /> : <FileSearch size={18} />}
            </span>
            <div>
              <span>{t("consolePreviewEyebrow")}</span>
              <strong>{t("consolePreviewTitle")}</strong>
            </div>
          </div>
          {result ? (
            <>
              <div className="console-tool__result-head">
                <div className="console-tool__result-status">
                  <span className="console-tool__status-badge">{result.status}</span>
                  <strong>{result.summary}</strong>
                </div>
                <NeoButton variant="secondary" size="sm" onClick={copyPayload}>
                  <Copy size={16} aria-hidden="true" />
                  <span>{t(config.copyActionKey)}</span>
                </NeoButton>
              </div>
              <div className="console-tool__rows">
                {result.rows.map((row) => (
                  <div key={row.label}>
                    <span>{row.label}</span>
                    <strong>{row.value}</strong>
                  </div>
                ))}
              </div>
              <details className="console-tool__payload-card">
                <summary>{t("consolePayload")}</summary>
                <pre>{payloadText}</pre>
              </details>
            </>
          ) : (
            <div className="console-tool__empty">
              <span className="console-tool__empty-pill">{t("previewWaiting")}</span>
              <p className="console-tool__empty-hint">{t("previewWaitingHint")}</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function optionLabel(
  option: ConsoleFieldOption,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  return option.labelKey ? t(option.labelKey) : option.label ?? option.value;
}

function displayFieldValue(
  field: ConsoleField,
  value: string | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
) {
  if (field.type === "select") {
    const selected = (field.options ?? []).find((option) => option.value === value);
    if (selected) return optionLabel(selected, t);
  }
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : t("notAvailable");
}

function isWideConsoleField(field: ConsoleField) {
  if (field.type === "textarea") return true;
  const key = field.key.toLowerCase();
  return [
    "address",
    "callback",
    "consumer",
    "contract",
    "did",
    "hash",
    "path",
    "recipient",
    "url",
  ].some((token) => key.includes(token));
}
