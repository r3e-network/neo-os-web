import { useMemo, useState } from "react";
import { Copy, Play, RotateCcw, ShieldCheck } from "lucide-react";
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
  fields: ConsoleField[];
  buildResult: (
    values: Record<string, string>,
    t: (key: string, params?: Record<string, string | number>) => string,
  ) => ConsoleResult;
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

export function ConsoleToolPanel({
  config,
  t,
  state,
  services,
  setStatus,
  launchContext = null,
}: ConsoleToolPanelProps) {
  const [values, setValues] = useState(() =>
    initialValues(config.fields, launchContext?.params),
  );
  const [result, setResult] = useState<ConsoleResult | null>(null);
  const payloadText = useMemo(
    () => (result ? JSON.stringify(result.payload, null, 2) : ""),
    [result],
  );
  const networkLabel = readObservable(state, "networkLabel", t("notAvailable"));
  const endpointLabel = readObservable(state, "endpointLabel", t("notAvailable"));
  const requestCount = readObservable(state, "requestCount", "0");

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function runPreview() {
    const next = config.buildResult(values, t);
    setResult(next);
    // A buildResult that returns payload.status === "input_required" signals a
    // validation failure (no real preview produced). Treat it as a warning so the
    // host does not render a green "success" toast, keep counters/digest honest.
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

  function reset() {
    setValues(initialValues(config.fields));
    setResult(null);
    setObservable(state, "lastStatus", t("statusReady"));
    setObservable(state, "lastDigest", t("notAvailable"));
  }

  async function copyPayload() {
    if (!payloadText) return;
    await services.clipboard.copy(payloadText, config.copiedKey);
  }

  return (
    <div className="console-tool">
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
        </div>
        <div className="console-tool__hero-meta" aria-label={t("statistics")}>
          <span>{t("statNetwork")} <strong>{networkLabel}</strong></span>
          <span>{t("statEndpoint")} <strong>{endpointLabel}</strong></span>
          <span>{t("statRequests")} <strong>{requestCount}</strong></span>
        </div>
      </section>

      <section className="console-tool__workspace">
        <div className="console-tool__form" aria-label={t(config.titleKey)}>
          {config.fields.map((field) => {
            if (field.type === "select") {
              return (
                <label className="console-tool__field" key={field.key}>
                  <span>{t(field.labelKey)}</span>
                  <select
                    value={values[field.key] ?? ""}
                    onChange={(event) => updateValue(field.key, event.target.value)}
                  >
                    {(field.options ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.labelKey ? t(option.labelKey) : option.label ?? option.value}
                      </option>
                    ))}
                  </select>
                </label>
              );
            }

            return (
              <NeoInput
                key={field.key}
                type={field.type === "number" ? "number" : field.type === "textarea" ? "textarea" : "text"}
                label={t(field.labelKey)}
                value={values[field.key] ?? ""}
                placeholder={field.placeholderKey ? t(field.placeholderKey) : ""}
                onChange={(value) => updateValue(field.key, value)}
              />
            );
          })}

          <div className="console-tool__actions">
            <NeoButton variant="primary" size="lg" onClick={runPreview}>
              <Play size={18} aria-hidden="true" />
              <span>{t(config.primaryActionKey)}</span>
            </NeoButton>
            <NeoButton variant="ghost" size="lg" onClick={reset}>
              <RotateCcw size={18} aria-hidden="true" />
              <span>{t(config.resetActionKey)}</span>
            </NeoButton>
          </div>
        </div>

        <div className="console-tool__result" aria-live="polite">
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
              <span>{t("previewWaiting")}</span>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
