import { useMemo, useState } from "react";
import { Activity, Copy, Database, Play, RotateCcw } from "lucide-react";
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
  const lastDigest = readObservable(state, "lastDigest", t("notAvailable"));
  const signalLabel = result?.status ?? t("statusReady");

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function runPreview() {
    const next = config.buildResult(values, t);
    setResult(next);
    setObservable(state, "lastStatus", next.status);
    setObservable(state, "lastDigest", String(next.payload.digest ?? next.payload.requestId ?? ""));
    const count = Number(state.requestCount?.get?.() ?? 0);
    setObservable(state, "requestCount", count + 1);
    setStatus(next.status, "success");
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
          <span className="console-tool__eyebrow">{t(config.eyebrowKey)}</span>
          <h2 id="console-title">{t(config.titleKey)}</h2>
          <p>{t(config.descriptionKey)}</p>
        </div>
        <div className="console-tool__hero-metrics" aria-label={t("statistics")}>
          <div className="console-tool__metric">
            <span>{t("statNetwork")}</span>
            <strong>{networkLabel}</strong>
          </div>
          <div className="console-tool__metric">
            <span>{t("statEndpoint")}</span>
            <strong>{endpointLabel}</strong>
          </div>
          <div className="console-tool__metric">
            <span>{t("statRequests")}</span>
            <strong>{requestCount}</strong>
          </div>
        </div>
      </section>

      <section className="console-tool__asset-card" aria-label={t(config.titleKey)}>
        <div className="console-tool__asset-token" aria-hidden="true">
          <Database size={24} />
        </div>
        <div className="console-tool__asset-copy">
          <span>{endpointLabel}</span>
          <strong>{lastDigest}</strong>
          <p>{t("consoleRequestHint")}</p>
        </div>
        <div className="console-tool__asset-signal" aria-label={t("consoleSignal")}>
          <span>{t("consoleSignal")}</span>
          <div className="console-tool__sparkline" aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
            <i />
          </div>
          <strong>{signalLabel}</strong>
        </div>
      </section>

      <section className="console-tool__workspace">
        <div className="console-tool__form" aria-label={t(config.titleKey)}>
          <div className="console-tool__flow" aria-label={t("consoleFlow")}>
            <span>{t("consoleFlowInput")}</span>
            <span>{t("consoleFlowPreview")}</span>
            <span>{t("consoleFlowVerify")}</span>
          </div>
          <div className="console-tool__hint">
            <Activity size={16} aria-hidden="true" />
            <span>{t("consoleRequestHint")}</span>
          </div>
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
                <div>
                  <span>{result.status}</span>
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
              <div className="console-tool__payload-card">
                <span>{t("consolePayload")}</span>
                <pre>{payloadText}</pre>
              </div>
            </>
          ) : (
            <div className="console-tool__empty">
              <span>{t("statusReady")}</span>
              <strong>{t("previewWaiting")}</strong>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
