import { useMemo, useState } from "react";
import {
  BadgeCheck,
  Check,
  ChevronDown,
  Copy,
  FileJson2,
  Fingerprint,
  IdCard,
  KeyRound,
  Network,
  Play,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UserCheck,
  WalletCards,
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

function providerHint(value: string, t: PlayAreaProps["t"]) {
  if (value === "wallet-signature") return t("providerWalletHint");
  if (value === "social-attestation") return t("providerSocialHint");
  return t("providerRegistryHint");
}

function providerIcon(value: string) {
  if (value === "wallet-signature") return <WalletCards size={18} />;
  if (value === "social-attestation") return <UserCheck size={18} />;
  return <Network size={18} />;
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
  const providerField = consoleConfig.fields.find(
    (field) => field.key === "provider",
  );
  const providerOptions = providerField?.options ?? [];
  const selectedProvider =
    providerOptions.find((option) => option.value === values.provider) ??
    providerOptions[0];
  const selectedProviderLabel = selectedProvider
    ? optionLabel(selectedProvider, t)
    : values.provider;
  const didText = String(values.did ?? "").trim();
  const claimText = String(values.claim ?? "").trim();
  const callbackText = String(values.callback ?? "").trim();
  const didValid = draftResult.payload.didValid === true;
  const claimReady = claimText.length > 0;
  const callbackValid = callbackText
    ? draftResult.payload.callbackValid === true
    : true;
  const draftOk = draftResult.payload.status !== "input_required";
  const resultOk = result?.payload.status !== "input_required";
  const previewDigest = String(
    draftResult.payload.digest ?? t("digestPlaceholder"),
  );
  const summaryItems = [
    {
      key: "did",
      label: t("did"),
      value: didText || t("inputRequired"),
    },
    {
      key: "provider",
      label: t("providerShort"),
      value: selectedProviderLabel,
    },
    {
      key: "claim",
      label: t("claim"),
      value: claimText || t("inputRequired"),
    },
    {
      key: "callback",
      label: t("callbackShort"),
      value: callbackText || t("callbackOptional"),
    },
  ];
  const identityTrackClassName = [
    "neodid-identity-track",
    draftOk ? "is-ready" : "is-blocked",
    didValid ? "has-did" : "",
    claimReady ? "has-claim" : "",
    callbackValid ? "has-callback" : "callback-blocked",
    result ? "has-result" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const identityTrackNodes = [
    {
      key: "did",
      icon: <IdCard size={18} aria-hidden="true" />,
      label: t("neodidTrackSubject"),
      value: didValid ? didText : t("inputRequired"),
      ready: didValid,
    },
    {
      key: "provider",
      icon: <ScanSearch size={18} aria-hidden="true" />,
      label: t("neodidTrackProvider"),
      value: selectedProviderLabel,
      ready: true,
    },
    {
      key: "claim",
      icon: <BadgeCheck size={18} aria-hidden="true" />,
      label: t("neodidTrackClaim"),
      value: claimReady ? claimText : t("inputRequired"),
      ready: claimReady,
    },
    {
      key: "receipt",
      icon: <KeyRound size={18} aria-hidden="true" />,
      label: t("neodidTrackReceipt"),
      value: draftOk ? previewDigest : t("inputRequired"),
      ready: draftOk,
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
    <div className="neodid-play-area">
      <section className="neodid-hero" aria-label={t("panelTitle")}>
        <img
          className="neodid-hero__media"
          src="./neodid-identity-stage.jpg"
          alt={t("neodidHeroAlt")}
          loading="eager"
          decoding="async"
        />
        <div className="neodid-hero__shade" aria-hidden="true" />
        <div className="neodid-hero__copy">
          <span className="neodid-hero__badge" aria-hidden="true">
            <IdCard size={24} />
          </span>
          <span className="neodid-eyebrow">{t("panelEyebrow")}</span>
          <h2>{t("panelTitle")}</h2>
          <p>{t("neodidHeroCopy")}</p>
          <div
            className="neodid-hero__pills"
            aria-label={t("neodidStatusLabel")}
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
        <div className="neodid-hero__metrics" aria-label={t("statistics")}>
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

      <section className="neodid-flow" aria-label={t("neodidFlowTitle")}>
        <span>
          <IdCard size={18} aria-hidden="true" />
          <strong>{t("neodidFlowSubject")}</strong>
          <small>{t("neodidFlowSubjectDesc")}</small>
        </span>
        <span>
          <ScanSearch size={18} aria-hidden="true" />
          <strong>{t("neodidFlowProvider")}</strong>
          <small>{t("neodidFlowProviderDesc")}</small>
        </span>
        <span>
          <KeyRound size={18} aria-hidden="true" />
          <strong>{t("neodidFlowReceipt")}</strong>
          <small>{t("neodidFlowReceiptDesc")}</small>
        </span>
      </section>

      <section className="neodid-workspace">
        <div className="neodid-request-card" aria-label={t("neodidPlan")}>
          <header className="neodid-card-head">
            <span aria-hidden="true">
              <Sparkles size={19} />
            </span>
            <div>
              <small>{t("neodidPlan")}</small>
              <strong>{t("neodidPlanCopy")}</strong>
            </div>
          </header>

          <div
            className="neodid-catalog-band"
            role="note"
            aria-label={t("neodidCatalogTitle")}
          >
            <ScanSearch size={18} aria-hidden="true" />
            <span>
              <strong>{t("neodidCatalogTitle")}</strong>
              <small>{t("neodidCatalogCopy")}</small>
            </span>
          </div>

          <section
            className={identityTrackClassName}
            aria-label={t("neodidIdentityTrackTitle")}
          >
            <picture className="neodid-identity-track__token" aria-hidden="true">
              <source srcSet="./logo.avif" type="image/avif" />
              <source srcSet="./logo.webp" type="image/webp" />
              <img src="./logo.jpg" alt="" loading="eager" decoding="sync" />
            </picture>
            <span className="neodid-identity-track__rail" aria-hidden="true" />
            {identityTrackNodes.map((node) => (
              <div
                key={node.key}
                className={`neodid-identity-track__node${
                  node.ready ? " is-ready" : " is-blocked"
                }`}
              >
                {node.icon}
                <span>{node.label}</span>
                <strong>{node.value}</strong>
              </div>
            ))}
          </section>

          <div
            className="neodid-summary-strip"
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
            className="neodid-subject-panel"
            aria-label={t("neodidSubjectTitle")}
          >
            <div className="neodid-section-copy">
              <small>{t("neodidSubjectTitle")}</small>
              <strong>{t("neodidSubjectCopy")}</strong>
            </div>
            <div className="neodid-input-with-chip">
              <NeoInput
                label={t("did")}
                value={values.did}
                placeholder={t("didPlaceholder")}
                hint={didValid ? t("didReadyHint") : ""}
                error={didText && !didValid ? t("didInvalidHint") : ""}
                onChange={(value) => updateValue("did", value)}
              />
              <span
                className={`neodid-valid-chip${
                  didValid
                    ? " neodid-valid-chip--ok"
                    : " neodid-valid-chip--warn"
                }`}
              >
                {didValid ? (
                  <Check size={15} aria-hidden="true" />
                ) : (
                  <Fingerprint size={15} aria-hidden="true" />
                )}
                {t("didValid")}: {boolLabel(didValid, t)}
              </span>
            </div>
          </section>

          <section
            className="neodid-provider-panel"
            aria-label={t("neodidProviderTitle")}
          >
            <div className="neodid-section-copy">
              <small>{t("neodidProviderTitle")}</small>
              <strong>{t("neodidProviderCopy")}</strong>
            </div>
            <div
              className="neodid-provider-grid"
              role="radiogroup"
              aria-label={t("providerShort")}
            >
              {providerOptions.map((option) => {
                const selected = values.provider === option.value;
                const label = optionLabel(option, t);
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${t("providerShort")}: ${label}`}
                    className={`neodid-provider-card${
                      selected ? " neodid-provider-card--selected" : ""
                    }`}
                    onClick={() => updateValue("provider", option.value)}
                  >
                    <span aria-hidden="true">{providerIcon(option.value)}</span>
                    <strong>{label}</strong>
                    <small>{providerHint(option.value, t)}</small>
                    {selected && (
                      <span
                        className="neodid-provider-card__check"
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
            className="neodid-claim-panel"
            aria-label={t("neodidClaimTitle")}
          >
            <div className="neodid-section-copy">
              <small>{t("neodidClaimTitle")}</small>
              <strong>{t("neodidClaimCopy")}</strong>
            </div>
            <div className="neodid-claim-grid">
              <div className="neodid-input-with-chip">
                <NeoInput
                  label={t("claim")}
                  value={values.claim}
                  placeholder={t("claimPlaceholder")}
                  hint={claimReady ? t("claimReadyHint") : ""}
                  error={claimReady ? "" : t("claimMissingHint")}
                  onChange={(value) => updateValue("claim", value)}
                />
                <span
                  className={`neodid-valid-chip${
                    claimReady
                      ? " neodid-valid-chip--ok"
                      : " neodid-valid-chip--warn"
                  }`}
                >
                  {claimReady ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <BadgeCheck size={15} aria-hidden="true" />
                  )}
                  {t("claim")}: {claimReady ? t("ready") : t("inputRequired")}
                </span>
              </div>
              <div className="neodid-input-with-chip">
                <NeoInput
                  label={t("callback")}
                  value={values.callback}
                  placeholder={t("callbackPlaceholder")}
                  hint={
                    callbackValid
                      ? t("callbackReadyHint")
                      : t("callbackInvalid")
                  }
                  error={callbackValid ? "" : t("callbackInvalidHint")}
                  onChange={(value) => updateValue("callback", value)}
                />
                <span
                  className={`neodid-valid-chip${
                    callbackValid
                      ? " neodid-valid-chip--ok"
                      : " neodid-valid-chip--warn"
                  }`}
                >
                  {callbackValid ? (
                    <Check size={15} aria-hidden="true" />
                  ) : (
                    <KeyRound size={15} aria-hidden="true" />
                  )}
                  {t("callbackValid")}: {boolLabel(callbackValid, t)}
                </span>
              </div>
            </div>
          </section>

          <div className="neodid-action-row">
            <NeoButton variant="primary" size="lg" onClick={buildPreview}>
              <Play size={18} aria-hidden="true" />
              {t("runAction")}
            </NeoButton>
            <NeoButton variant="secondary" size="lg" onClick={reset}>
              <RotateCcw size={17} aria-hidden="true" />
              {t("reset")}
            </NeoButton>
          </div>
        </div>

        <aside className="neodid-result-card" aria-label={t("neodidReceipt")}>
          <header className="neodid-card-head">
            <span aria-hidden="true">
              <FileJson2 size={19} />
            </span>
            <div>
              <small>{t("neodidReceipt")}</small>
              <strong>
                {result ? result.status : t("neodidValidationReady")}
              </strong>
            </div>
          </header>

          <div
            className={`neodid-readiness${
              draftOk ? " neodid-readiness--ok" : " neodid-readiness--warn"
            }`}
          >
            <span>{draftOk ? t("verifyReady") : draftResult.status}</span>
            <strong>{draftResult.summary}</strong>
          </div>

          {result ? (
            <>
              <div
                className={`neodid-result-hero${
                  resultOk ? " neodid-result-hero--ok" : ""
                }`}
              >
                <span>
                  {resultOk ? t("verifyReady") : t("validationBlocked")}
                </span>
                <strong>{result.summary}</strong>
              </div>
              <div className="neodid-result-rows">
                {result.rows.map((row) => (
                  <span key={`${row.label}-${row.value}`}>
                    <small>{row.label}</small>
                    <strong>{row.value}</strong>
                  </span>
                ))}
              </div>
              <div className="neodid-digest-strip">
                <span>
                  <small>{t("statDigest")}</small>
                  <strong>
                    {String(result.payload.digest ?? t("notAvailable"))}
                  </strong>
                </span>
                <span>
                  <small>{t("dispatchReady")}</small>
                  <strong>{boolLabel(result.payload.dispatchReady, t)}</strong>
                </span>
              </div>
            </>
          ) : (
            <div className="neodid-empty-state">
              <BadgeCheck size={34} aria-hidden="true" />
              <strong>{t("neodidEmptyTitle")}</strong>
              <p>{t("neodidEmptyCopy")}</p>
            </div>
          )}

          <details className="neodid-payload-details" open={Boolean(result)}>
            <summary>
              <span>
                <FileJson2 size={17} aria-hidden="true" />
                {t("payload")}
              </span>
              <strong>{result ? t("previewReady") : previewDigest}</strong>
              <ChevronDown
                className="neodid-payload-details__icon"
                size={15}
                aria-hidden="true"
              />
            </summary>
            <pre className="console-tool__payload-card neodid-payload-card">
              {payloadText || JSON.stringify(draftResult.payload, null, 2)}
            </pre>
          </details>

          <div className="neodid-action-row neodid-action-row--result">
            <NeoButton
              variant="secondary"
              size="md"
              disabled={!payloadText}
              onClick={copyPayload}
            >
              <Copy size={17} aria-hidden="true" />
              {copied ? t("copied") : t("copy")}
            </NeoButton>
            <NeoButton variant="ghost" size="md" onClick={buildPreview}>
              <Play size={17} aria-hidden="true" />
              {t("runAction")}
            </NeoButton>
          </div>
        </aside>
      </section>
    </div>
  );
}
