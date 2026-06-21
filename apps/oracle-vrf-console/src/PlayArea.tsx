import { useMemo, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Dices,
  Fingerprint,
  KeyRound,
  Layers3,
  Minus,
  Play,
  Plus,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Shuffle,
  Sparkles,
} from "lucide-react";
import {
  NeoButton,
  type ConsoleField,
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

function displayFieldValue(
  field: ConsoleField,
  value: string,
  t: PlayAreaProps["t"],
) {
  if (field.type === "select") {
    const selected = (field.options ?? []).find(
      (option) => option.value === value,
    );
    if (selected) return optionLabel(selected, t);
  }
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : t("notAvailable");
}

function roundValue(value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(10, Math.max(1, Math.floor(parsed)));
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
  const consumerValue = values.consumer ?? "";
  const saltValue = values.salt ?? "";
  const roundsValue = values.rounds ?? "";
  const modeValue = values.mode ?? "";
  const rounds = roundValue(roundsValue);
  const modeField = consoleConfig.fields.find((field) => field.key === "mode");
  const modeOptions = modeField?.options ?? [];
  const selectedMode =
    modeOptions.find((option) => option.value === modeValue) ??
    modeOptions[0];
  const selectedModeLabel = selectedMode
    ? optionLabel(selectedMode, t)
    : modeValue;
  const draftOk = draftResult.payload.status !== "input_required";
  const requestSummary = consoleConfig.fields.slice(0, 4).map((field) => ({
    key: field.key,
    label: t(field.labelKey),
    value: displayFieldValue(field, values[field.key] ?? "", t),
  }));

  function updateValue(key: string, value: string) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function adjustRounds(delta: number) {
    updateValue("rounds", String(Math.min(10, Math.max(1, rounds + delta))));
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
    <div className="vrf-play-area">
      <section className="vrf-hero" aria-label={t("panelTitle")}>
        <img
          className="vrf-hero__media"
          src="./vrf-randomness-stage.jpg"
          alt={t("vrfHeroAlt")}
          loading="eager"
          decoding="async"
        />
        <div className="vrf-hero__shade" aria-hidden="true" />
        <div className="vrf-hero__copy">
          <span className="vrf-hero__badge" aria-hidden="true">
            <Dices size={24} />
          </span>
          <span className="vrf-eyebrow">{t("panelEyebrow")}</span>
          <h2>{t("panelTitle")}</h2>
          <p>{t("vrfHeroCopy")}</p>
          <div className="vrf-hero__pills" aria-label={t("vrfStatusLabel")}>
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
        <div className="vrf-hero__metrics" aria-label={t("statistics")}>
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

      <section className="vrf-flow" aria-label={t("vrfFlowTitle")}>
        <span>
          <KeyRound size={18} aria-hidden="true" />
          <strong>{t("vrfFlowSeed")}</strong>
          <small>{t("vrfFlowSeedDesc")}</small>
        </span>
        <span>
          <Shuffle size={18} aria-hidden="true" />
          <strong>{t("vrfFlowDraw")}</strong>
          <small>{t("vrfFlowDrawDesc")}</small>
        </span>
        <span>
          <ShieldCheck size={18} aria-hidden="true" />
          <strong>{t("vrfFlowVerify")}</strong>
          <small>{t("vrfFlowVerifyDesc")}</small>
        </span>
      </section>

      <section className="vrf-workspace">
        <div className="vrf-request-card" aria-label={t("vrfRequestPlan")}>
          <header className="vrf-card-head">
            <span aria-hidden="true">
              <Sparkles size={19} />
            </span>
            <div>
              <small>{t("vrfRequestPlan")}</small>
              <strong>{t("vrfRequestPlanCopy")}</strong>
            </div>
          </header>

          <div
            className="vrf-summary-strip"
            aria-label={t("consoleSelectedValues")}
          >
            {requestSummary.map((item) => (
              <span key={item.key}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>

          <section className="vrf-ticket-panel" aria-label={t("vrfTicketTitle")}>
            <div className="vrf-ticket-panel__head">
              <div className="vrf-section-copy">
                <small>{t("vrfTicketTitle")}</small>
                <strong>{t("vrfTicketCopy")}</strong>
              </div>
              <span
                className={`vrf-valid-chip${
                  draftOk ? " vrf-valid-chip--ok" : " vrf-valid-chip--warn"
                }`}
              >
                {draftOk ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <KeyRound size={15} aria-hidden="true" />
                )}
                {draftOk ? t("vrfTicketReady") : draftResult.status}
              </span>
            </div>

            <div className="vrf-ticket-board">
              <div className="vrf-ticket-seed">
                <div className="vrf-ticket-step">
                  <span aria-hidden="true">
                    <KeyRound size={18} />
                  </span>
                  <div>
                    <small>{t("vrfSeedIdentity")}</small>
                    <strong>{t("vrfSeedIdentityCopy")}</strong>
                  </div>
                </div>
                <div className="vrf-seed-grid">
                  <label className="vrf-seed-field">
                    <span>{t("consumer")}</span>
                    <input
                      value={consumerValue}
                      placeholder={t("consumerPlaceholder")}
                      aria-label={t("consumer")}
                      onChange={(event) =>
                        updateValue("consumer", event.currentTarget.value)
                      }
                    />
                    <small>{t("vrfConsumerHint")}</small>
                  </label>
                  <label className="vrf-seed-field">
                    <span>{t("salt")}</span>
                    <input
                      value={saltValue}
                      placeholder={t("saltPlaceholder")}
                      aria-label={t("salt")}
                      onChange={(event) =>
                        updateValue("salt", event.currentTarget.value)
                      }
                    />
                    <small>{t("vrfSaltHint")}</small>
                  </label>
                </div>
              </div>

              <div className="vrf-draw-stage">
                <div className="vrf-ticket-step">
                  <span aria-hidden="true">
                    <Dices size={18} />
                  </span>
                  <div>
                    <small>{t("vrfRoundsTitle")}</small>
                    <strong>{t("vrfRoundsHint")}</strong>
                  </div>
                </div>
                <div className="vrf-rounds-control">
                  <button
                    type="button"
                    aria-label={t("vrfDecreaseRounds")}
                    onClick={() => adjustRounds(-1)}
                  >
                    <Minus size={16} aria-hidden="true" />
                  </button>
                  <label className="vrf-rounds-value">
                    <span>{t("roundsLabel")}</span>
                    <input
                      type="number"
                      value={roundsValue}
                      min={1}
                      max={10}
                      aria-label={t("roundsLabel")}
                      onChange={(event) =>
                        updateValue("rounds", event.currentTarget.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    aria-label={t("vrfIncreaseRounds")}
                    onClick={() => adjustRounds(1)}
                  >
                    <Plus size={16} aria-hidden="true" />
                  </button>
                </div>
                <div className="vrf-rounds-track" aria-hidden="true">
                  {Array.from({ length: 10 }, (_, index) => (
                    <span
                      key={index}
                      className={index < rounds ? "is-active" : undefined}
                    />
                  ))}
                </div>
              </div>

              <div className="vrf-proof-stage">
                <div className="vrf-ticket-step">
                  <span aria-hidden="true">
                    <ShieldCheck size={18} />
                  </span>
                  <div>
                    <small>{t("vrfProofModeTitle")}</small>
                    <strong>{t("vrfProofModeHint")}</strong>
                  </div>
                </div>
                <div
                  className="vrf-mode-grid"
                  role="radiogroup"
                  aria-label={t("mode")}
                >
                  {modeOptions.map((option) => {
                    const selected = modeValue === option.value;
                    const label = optionLabel(option, t);
                    return (
                      <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        aria-label={`${t("mode")}: ${label}`}
                        className={`vrf-mode-card${
                          selected ? " vrf-mode-card--selected" : ""
                        }`}
                        onClick={() => updateValue("mode", option.value)}
                      >
                        <span aria-hidden="true">
                          {option.value === "batch-proof" ? (
                            <Layers3 size={18} />
                          ) : (
                            <ReceiptText size={18} />
                          )}
                        </span>
                        <strong>{label}</strong>
                        <small>
                          {option.value === "batch-proof"
                            ? t("modeBatchHint")
                            : t("modeSingleHint")}
                        </small>
                        {selected && (
                          <span className="vrf-mode-card__check" aria-hidden="true">
                            <Check size={14} />
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

          <div className="vrf-actions">
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

        <aside className="vrf-proof-card" aria-live="polite">
          <header className="vrf-card-head">
            <span aria-hidden="true">
              <ReceiptText size={19} />
            </span>
            <div>
              <small>{t("vrfProofPreview")}</small>
              <strong>{result ? result.status : t("previewWaiting")}</strong>
            </div>
          </header>

          {result ? (
            <>
              <div className="vrf-result-hero">
                <span>{selectedModeLabel}</span>
                <strong>{result.summary}</strong>
                <small>
                  {String(
                    result.payload.digest ?? result.payload.requestId ?? "",
                  )}
                </small>
              </div>
              <div className="vrf-result-rows">
                {result.rows.map((row) => (
                  <span key={row.label}>
                    <small>{row.label}</small>
                    <strong>{row.value}</strong>
                  </span>
                ))}
              </div>
              <div className="vrf-payload-actions">
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
              <details className="vrf-payload-card">
                <summary>
                  <span>{t("consolePayload")}</span>
                  <ChevronDown
                    className="vrf-payload-card__icon"
                    size={15}
                    aria-hidden="true"
                  />
                </summary>
                <pre>{payloadText}</pre>
              </details>
            </>
          ) : (
            <div className="vrf-empty-state">
              <span aria-hidden="true">
                <Dices size={24} />
              </span>
              <strong>{t("vrfEmptyTitle")}</strong>
              <p>{t("vrfEmptyCopy")}</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
