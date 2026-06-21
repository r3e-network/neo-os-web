import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Copy,
  FileJson2,
  Fingerprint,
  KeyRound,
  LockKeyhole,
  MailCheck,
  PackageCheck,
  Play,
  RotateCcw,
  Route,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import {
  NeoButton,
  NeoInput,
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

function purposeHint(value: string, t: PlayAreaProps["t"]) {
  if (value === "callback-secret") return t("purposeCallbackHint");
  if (value === "attestation") return t("purposeAttestationHint");
  return t("purposeInputHint");
}

function purposeIcon(value: string) {
  if (value === "callback-secret") return <KeyRound size={18} />;
  if (value === "attestation") return <ShieldAlert size={18} />;
  return <PackageCheck size={18} />;
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
  const lastDigest = readObservable(state, "lastDigest", initialDigest);
  const requestCount = readObservable(state, "requestCount", "0");
  const purposeField = consoleConfig.fields.find(
    (field) => field.key === "purpose",
  );
  const purposeOptions = purposeField?.options ?? [];
  const selectedPurpose =
    purposeOptions.find((option) => option.value === values.purpose) ??
    purposeOptions[0];
  const selectedPurposeLabel = selectedPurpose
    ? optionLabel(selectedPurpose, t)
    : values.purpose;
  const payloadValid = draftResult.payload.payloadValid === true;
  const draftOk = draftResult.payload.status !== "input_required";
  const resultOk = result?.payload.status !== "input_required";
  const payloadDigest = String(draftResult.payload.payloadDigest ?? "");
  const recipientLabel = values.recipient.trim() || t("digestPlaceholder");
  const summaryItems = [
    {
      key: "protection",
      label: t("protectionLabel"),
      value: t("sealReferenceOnly"),
    },
    {
      key: "purpose",
      label: t("purpose"),
      value: selectedPurposeLabel,
    },
    {
      key: "recipient",
      label: t("recipient"),
      value: recipientLabel,
    },
    {
      key: "payload",
      label: t("payloadValid"),
      value: boolLabel(payloadValid, t),
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
    setStatus(next.status, ok ? "success" : "warning");
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
    <div className="seal-play-area">
      <section className="seal-hero" aria-label={t("panelTitle")}>
        <img
          className="seal-hero__media"
          src="./seal-reference-stage.jpg"
          alt={t("sealHeroAlt")}
          loading="eager"
          decoding="async"
        />
        <div className="seal-hero__shade" aria-hidden="true" />
        <div className="seal-hero__copy">
          <span className="seal-hero__badge" aria-hidden="true">
            <MailCheck size={24} />
          </span>
          <span className="seal-eyebrow">{t("panelEyebrow")}</span>
          <h2>{t("panelTitle")}</h2>
          <p>{t("sealHeroCopy")}</p>
          <div className="seal-hero__pills" aria-label={t("sealStatusLabel")}>
            <span>
              <AlertTriangle size={15} aria-hidden="true" />
              {t("protectionValue")}
            </span>
            <span>
              <Fingerprint size={15} aria-hidden="true" />
              {lastDigest}
            </span>
          </div>
        </div>
        <div className="seal-hero__metrics" aria-label={t("statistics")}>
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

      <section className="seal-flow" aria-label={t("sealFlowTitle")}>
        <span>
          <AlertTriangle size={18} aria-hidden="true" />
          <strong>{t("sealFlowPlain")}</strong>
          <small>{t("sealFlowPlainDesc")}</small>
        </span>
        <span>
          <Route size={18} aria-hidden="true" />
          <strong>{t("sealFlowRoute")}</strong>
          <small>{t("sealFlowRouteDesc")}</small>
        </span>
        <span>
          <Fingerprint size={18} aria-hidden="true" />
          <strong>{t("sealFlowChecksum")}</strong>
          <small>{t("sealFlowChecksumDesc")}</small>
        </span>
      </section>

      <section className="seal-workspace">
        <div className="seal-request-card" aria-label={t("sealPlan")}>
          <header className="seal-card-head">
            <span aria-hidden="true">
              <Sparkles size={19} />
            </span>
            <div>
              <small>{t("sealPlan")}</small>
              <strong>{t("sealPlanCopy")}</strong>
            </div>
          </header>

          <div
            className="seal-warning-band"
            role="note"
            aria-label={t("sealProtectionTitle")}
          >
            <AlertTriangle size={18} aria-hidden="true" />
            <span>
              <strong>{t("sealProtectionTitle")}</strong>
              <small>{t("sealProtectionCopy")}</small>
            </span>
          </div>

          <div
            className="seal-summary-strip"
            aria-label={t("consoleSelectedValues")}
          >
            {summaryItems.map((item) => (
              <span key={item.key}>
                <small>{item.label}</small>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>

          <div
            className="seal-quick-actions"
            aria-label={t("sealReceipt")}
          >
            <NeoButton variant="primary" size="lg" onClick={buildPreview}>
              <Play size={18} aria-hidden="true" />
              <span>{t(consoleConfig.primaryActionKey)}</span>
            </NeoButton>
          </div>

          <section
            className="seal-purpose-panel"
            aria-label={t("sealPurposeTitle")}
          >
            <div className="seal-section-copy">
              <small>{t("sealPurposeTitle")}</small>
              <strong>{t("sealPurposeCopy")}</strong>
            </div>
            <div
              className="seal-purpose-grid"
              role="radiogroup"
              aria-label={t("purpose")}
            >
              {purposeOptions.map((option) => {
                const selected = values.purpose === option.value;
                const label = optionLabel(option, t);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${t("purpose")}: ${label}`}
                    className={`seal-choice-card${
                      selected ? " seal-choice-card--selected" : ""
                    }`}
                    onClick={() => updateValue("purpose", option.value)}
                  >
                    <span aria-hidden="true">{purposeIcon(option.value)}</span>
                    <strong>{label}</strong>
                    <small>{purposeHint(option.value, t)}</small>
                    {selected && (
                      <span
                        className="seal-choice-card__check"
                        aria-hidden="true"
                      >
                        <Check size={14} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          <section
            className="seal-recipient-panel"
            aria-label={t("sealRecipientTitle")}
          >
            <div className="seal-section-copy">
              <small>{t("sealRecipientTitle")}</small>
              <strong>{t("sealRecipientCopy")}</strong>
            </div>
            <NeoInput
              label={t("recipient")}
              value={values.recipient}
              placeholder={t("recipientPlaceholder")}
              hint={t("recipientHint")}
              onChange={(value) => updateValue("recipient", value)}
            />
          </section>

          <section
            className="seal-payload-panel"
            aria-label={t("sealPayloadTitle")}
          >
            <div className="seal-section-copy">
              <small>{t("sealPayloadTitle")}</small>
              <strong>{t("sealPayloadCopy")}</strong>
            </div>
            <div className="seal-payload-shell">
              <NeoInput
                type="textarea"
                label={t("payload")}
                value={values.payload}
                placeholder={t("payloadPlaceholder")}
                hint={payloadValid ? t("payloadReadyHint") : ""}
                error={payloadValid ? "" : t("payloadInvalidHint")}
                onChange={(value) => updateValue("payload", value)}
              />
              <span
                className={`seal-valid-chip${
                  payloadValid
                    ? " seal-valid-chip--ok"
                    : " seal-valid-chip--warn"
                }`}
              >
                {payloadValid ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <FileJson2 size={15} aria-hidden="true" />
                )}
                {t("payloadValid")}: {boolLabel(payloadValid, t)}
              </span>
            </div>
            <div className="seal-digest-strip">
              <span>
                <small>{t("payloadDigest")}</small>
                <strong>{payloadDigest}</strong>
              </span>
              <span>
                <small>{t("sealPayloadSize")}</small>
                <strong>
                  {t("sealPayloadChars", { count: values.payload.length })}
                </strong>
              </span>
            </div>
          </section>

          <div className="seal-actions">
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

        <aside className="seal-result-card" aria-live="polite">
          <header className="seal-card-head">
            <span aria-hidden="true">
              <LockKeyhole size={19} />
            </span>
            <div>
              <small>{t("sealReceipt")}</small>
              <strong>{result ? result.status : t("previewWaiting")}</strong>
            </div>
          </header>

          <div
            className={`seal-readiness${
              draftOk ? " seal-readiness--ok" : " seal-readiness--warn"
            }`}
          >
            <span>
              {draftOk ? t("sealValidationReady") : draftResult.status}
            </span>
            <strong>{t("sealReferenceOnly")}</strong>
          </div>

          {result ? (
            <>
              <div
                className={`seal-result-hero${
                  resultOk ? " seal-result-hero--ok" : " seal-result-hero--warn"
                }`}
              >
                <span>{selectedPurposeLabel}</span>
                <strong>{resultOk ? result.summary : result.status}</strong>
                <small>
                  {String(
                    result.payload.digest ?? result.payload.requestId ?? "",
                  )}
                </small>
              </div>
              <div className="seal-result-rows">
                {result.rows.map((row) => (
                  <span key={row.label}>
                    <small>{row.label}</small>
                    <strong>{row.value}</strong>
                  </span>
                ))}
              </div>
              <div className="seal-payload-actions">
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
              <details className="seal-payload-card console-tool__payload-card">
                <summary>
                  <span>{t("consolePayload")}</span>
                  <ChevronDown
                    className="seal-payload-card__icon"
                    size={15}
                    aria-hidden="true"
                  />
                </summary>
                <pre>{payloadText}</pre>
              </details>
            </>
          ) : (
            <div className="seal-empty-state">
              <span aria-hidden="true">
                <MailCheck size={24} />
              </span>
              <strong>{t("sealEmptyTitle")}</strong>
              <p>{t("sealEmptyCopy")}</p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}
