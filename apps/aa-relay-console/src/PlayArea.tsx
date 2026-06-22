/**
 * PlayArea.tsx - AA Relay Console
 *
 * Wallet-style sponsored relay workspace for AA payload preparation.
 * Two-step workspace: Step 1 Sponsor preflight (left) -> Step 2 Build & submit (right),
 * sharing one AA address. Collapses to a single column below 960px.
 */

import { useMemo, useState } from "react";
import {
  ChevronDown,
  CircleDollarSign,
  ClipboardCheck,
  FileJson2,
  Gauge,
  Landmark,
  Rocket,
  ShieldCheck,
  TerminalSquare,
  WalletCards,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { DEFAULT_RELAY_PAYLOAD, getRelayLaunchDefaults } from "./launch";
import { explorerTxUrl } from "./utils/explorer";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

function isValidJson(value: string) {
  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

// AA address: a Neo N-address (34 chars) or a 0x/40-hex script hash. Gating the
// actions on this avoids enabling all three buttons for obviously bad input
// like "abc" that only fails server-side.
const AA_ADDRESS_PATTERN = /^(N[1-9A-HJ-NP-Za-km-z]{33}|(0x)?[0-9a-fA-F]{40})$/;
function isValidAAAddress(value: string) {
  return AA_ADDRESS_PATTERN.test(value.trim());
}

// Known service-failure markers the host returns when the gas-sponsor edge
// function is not allow-listed or the relay upstream is unset. Mapped to a
// single localized "service unavailable" sentence instead of leaking codes.
function isServiceUnavailable(text: string): boolean {
  const lowered = text.toLowerCase();
  return (
    lowered.includes("function not allowed") ||
    lowered.includes("forbidden") ||
    lowered.includes("not configured") ||
    lowered.includes("aa_relay_url")
  );
}

/** Parse a stringified state object; returns null for empty "{}" / invalid. */
function parseStateJson(value: string): Record<string, unknown> | null {
  if (!value || value.trim() === "{}") return null;
  try {
    const parsed = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === "object" &&
      Object.keys(parsed).length > 0
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* not yet populated */
  }
  return null;
}

function summarizePayload(value: string) {
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    const metaInvocation =
      parsed.metaInvocation && typeof parsed.metaInvocation === "object"
        ? (parsed.metaInvocation as Record<string, unknown>)
        : parsed;
    const operation = String(metaInvocation.operation ?? "—");
    const target = String(
      metaInvocation.scriptHash ?? metaInvocation.contract ?? "—",
    );
    const args = metaInvocation.args;
    const argsLabel = Array.isArray(args)
      ? `${args.length}`
      : args == null
        ? "0"
        : "custom";
    return { operation, target, argsLabel };
  } catch {
    return { operation: "—", target: "—", argsLabel: "—" };
  }
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);
  const launchDefaults = getRelayLaunchDefaults(launchContext);

  const sponsorState = str("sponsorState", "{}");
  const relayResponse = str("relayResponse", "{}");
  const aaCoreDisplay = str("aaCoreDisplay", "");
  const relayUrlDisplay = str("relayUrlDisplay", "");
  const networkDisplay = str("networkDisplay", "");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const isRelaying = bool("isRelaying");

  const [aaAddress, setAaAddress] = useState(launchDefaults.aaAddress);
  const [dappIdLocal, setDappIdLocal] = useState(
    launchDefaults.dappId || str("paymasterDisplay", ""),
  );
  const [sponsorAmountLocal, setSponsorAmountLocal] = useState(
    launchDefaults.sponsorAmount,
  );
  const [payloadJsonLocal, setPayloadJsonLocal] = useState(
    launchDefaults.payloadJson || DEFAULT_RELAY_PAYLOAD,
  );

  const hasAAAddress = Boolean(aaAddress.trim());
  const aaAddressValid = isValidAAAddress(aaAddress);
  const payloadJsonIsValid = isValidJson(payloadJsonLocal);
  const payloadSummary = useMemo(
    () => summarizePayload(payloadJsonLocal),
    [payloadJsonLocal],
  );
  // Require a strictly positive plain decimal (no NaN, no <=0, no scientific/hex,
  // no whitespace). The edge function is the real authority, but blocking the
  // obviously-invalid client call surfaces inline guidance instead of an opaque
  // server-side rejection.
  const sponsorAmountTrimmed = sponsorAmountLocal.trim();
  const sponsorAmountIsValid =
    /^\d+(\.\d+)?$/.test(sponsorAmountTrimmed) &&
    Number(sponsorAmountTrimmed) > 0;
  const hasSponsorAmount = Boolean(sponsorAmountTrimmed);
  const canCheckSponsor = aaAddressValid && !isCheckingSponsorship;
  const canRequestSponsor =
    aaAddressValid && sponsorAmountIsValid && !isCheckingSponsorship;
  const canSubmitRelay = aaAddressValid && payloadJsonIsValid && !isRelaying;
  const draftAAAddress = aaAddress.trim() || "—";
  const aaAddressInvalid = hasAAAddress && !aaAddressValid;
  const sponsorReadiness = aaAddressValid ? t("relayReady") : t("relayNeedsAA");
  const amountReadiness = sponsorAmountIsValid
    ? t("relayReady")
    : t("relayNeedsAmount");
  const payloadReadiness = payloadJsonIsValid
    ? t("relayReady")
    : t("relayNeedsPayload");

  // Single human-readable result line: show only after an action has populated state.
  const relayResult = parseStateJson(relayResponse);
  const sponsorResult = parseStateJson(sponsorState);
  const activeResult = relayResult ?? sponsorResult;
  const resultRaw = relayResult ? relayResponse : sponsorState;

  // The relay broadcasts on-chain on the account's behalf, so if the relayer
  // returns a transaction id/hash, surface it as the verifiable on-chain
  // reference instead of leaving it buried in the raw JSON. The relay response
  // shape is set by the relayer, so accept the common field names.
  const relayTxid =
    relayResult &&
    (() => {
      const candidate =
        relayResult.txid ??
        relayResult.txId ??
        relayResult.txHash ??
        relayResult.tx_hash ??
        relayResult.transactionHash ??
        relayResult.hash;
      return typeof candidate === "string" && candidate.trim()
        ? candidate.trim()
          : null;
    })();

  const relayPhase = isRelaying
    ? "relaying"
    : isCheckingSponsorship
      ? "checking"
      : relayResult
        ? "submitted"
        : canSubmitRelay
          ? "ready"
          : sponsorAmountIsValid && aaAddressValid
            ? "funding"
            : aaAddressValid
              ? "sponsor"
              : "draft";
  const relayPhaseLabel =
    relayPhase === "relaying"
      ? t("relayBoardRelaying")
      : relayPhase === "checking"
        ? t("relayBoardChecking")
        : relayPhase === "submitted"
          ? t("relayBoardSubmitted")
          : relayPhase === "ready"
            ? t("relayBoardReady")
            : relayPhase === "funding"
              ? t("relayBoardFunding")
              : relayPhase === "sponsor"
                ? t("relayBoardSponsor")
                : t("relayBoardDraft");
  const routeStepClass = (ready: boolean, active: boolean) =>
    [
      "relay-route__step",
      ready ? "relay-route__step--ready" : "",
      active ? "relay-route__step--active" : "",
    ]
      .filter(Boolean)
      .join(" ");

  let resultTone: "ok" | "warn" | "info" = "info";
  let resultText = "";
  if (activeResult) {
    if (relayResult) {
      resultText = t("relaySubmitted");
      resultTone = "ok";
    } else {
      // A SponsorshipResult (request) carries `approved`; a SponsorshipStatus
      // (check) carries `eligible`. Pick the matching label so a request is not
      // mislabeled as a check.
      resultText =
        "approved" in activeResult
          ? t("sponsorRequestComplete")
          : t("sponsorCheckComplete");
      resultTone = "info";
    }
    // Promote the real eligibility answer to the headline instead of burying it
    // in the collapsed raw JSON.
    if ("eligible" in activeResult || "approved" in activeResult) {
      const eligible = Boolean(activeResult.eligible ?? activeResult.approved);
      if (eligible) {
        const remaining = String(activeResult.remaining ?? "");
        const dailyLimit = String(activeResult.dailyLimit ?? "");
        resultText =
          remaining && dailyLimit
            ? t("sponsorEligibleSummary", { remaining, dailyLimit })
            : t("sponsorEligible");
        resultTone = "ok";
      } else {
        const reason = String(
          activeResult.reason ?? activeResult.message ?? "",
        );
        resultText = reason
          ? t("sponsorNotEligibleReason", { reason })
          : t("sponsorNotEligible");
        resultTone = "warn";
      }
    }
    // Surface an error message if the service returned one, mapping known
    // service-outage markers to a single honest "unavailable" sentence. The
    // error can be a string or a nested {code,message} envelope.
    const rawError = activeResult.error;
    const nestedMessage =
      rawError && typeof rawError === "object"
        ? String(
            (rawError as Record<string, unknown>).message ??
              (rawError as Record<string, unknown>).code ??
              "",
          )
        : "";
    const errLike =
      (typeof rawError === "string" ? rawError : nestedMessage) ||
      (typeof activeResult.message === "string" ? activeResult.message : "") ||
      "";
    const statusLike =
      (activeResult.status as string) || (activeResult.state as string) || "";
    if (errLike) {
      resultText = isServiceUnavailable(errLike)
        ? t("serviceUnavailable")
        : errLike;
      resultTone = "warn";
    } else if (typeof statusLike === "string" && statusLike) {
      resultText = `${resultText} (${statusLike})`;
    }
  }

  return (
    <div className="relay-play-area">
      <section className="relay-hero">
        <div className="relay-hero__content">
          <div className="relay-hero__head">
            <span className="relay-hero__badge" aria-hidden="true">
              <ShieldCheck size={24} />
            </span>
            <div className="relay-hero__copy">
              <span className="relay-hero__eyebrow">{t("relayLabel")}</span>
              <h2>{t("relayHeroTitle")}</h2>
              <p>{t("relayHeroCopy")}</p>
            </div>
          </div>

          <div
            className="relay-hero__facts"
            aria-label={t("relayMetricsLabel")}
          >
            <span className="relay-fact">
              <span className="relay-fact__label">{t("network")}</span>
              <strong>{networkDisplay || "—"}</strong>
            </span>
            <span className="relay-fact">
              <span className="relay-fact__label">
                {t("relayEndpointMetric")}
              </span>
              <strong title={relayUrlDisplay || "—"}>
                <code>{relayUrlDisplay || "—"}</code>
              </strong>
            </span>
            <span className="relay-fact">
              <span className="relay-fact__label">{t("aaCoreLabel")}</span>
              <strong title={aaCoreDisplay || "—"}>
                <code>{aaCoreDisplay || "—"}</code>
              </strong>
            </span>
          </div>
        </div>
        <figure className="relay-hero__stage">
          <img src="./aa-relay-station.jpg" alt={t("relayHeroVisualAlt")} />
          <figcaption>
            <span>{t("relayStageKicker")}</span>
            <strong>{t("relayStageTitle")}</strong>
          </figcaption>
        </figure>
      </section>

      <NeoCard variant="erobo" className="relay-account">
        <div className="relay-account__intro">
          <span className="relay-account__icon" aria-hidden="true">
            <WalletCards size={21} />
          </span>
          <div>
            <span className="relay-account__eyebrow">
              {t("relayAccountEyebrow")}
            </span>
            <h3>{t("relayAccountTitle")}</h3>
            <p className="relay-explainer">{t("relayPaymasterExplainer")}</p>
          </div>
        </div>
        <div className="relay-readiness" aria-label={t("relayReadinessLabel")}>
          <span
            className={`relay-readiness__item${
              aaAddressValid ? " relay-readiness__item--ready" : ""
            }`}
          >
            <ShieldCheck size={17} aria-hidden="true" />
            <small>{t("aaAddress")}</small>
            <strong>{sponsorReadiness}</strong>
          </span>
          <span
            className={`relay-readiness__item${
              sponsorAmountIsValid ? " relay-readiness__item--ready" : ""
            }`}
          >
            <CircleDollarSign size={17} aria-hidden="true" />
            <small>{t("sponsorAmount")}</small>
            <strong>{amountReadiness}</strong>
          </span>
          <span
            className={`relay-readiness__item${
              payloadJsonIsValid ? " relay-readiness__item--ready" : ""
            }`}
          >
            <FileJson2 size={17} aria-hidden="true" />
            <small>{t("payloadJson")}</small>
            <strong>{payloadReadiness}</strong>
          </span>
        </div>
        <div className="relay-form relay-form--account">
          <div
            className="relay-account__summary"
            aria-label={t("relayDraftLabel")}
          >
            <span>
              <small>{t("aaAddress")}</small>
              <strong title={draftAAAddress}>{draftAAAddress}</strong>
            </span>
            <span>
              <small>{t("dappId")}</small>
              <strong title={dappIdLocal || "—"}>{dappIdLocal || "—"}</strong>
            </span>
            <span>
              <small>{t("sponsorAmount")}</small>
              <strong>{sponsorAmountTrimmed || "—"}</strong>
            </span>
          </div>
          <div className="relay-account__entry">
            <NeoInput
              value={aaAddress}
              label={t("aaAddress")}
              hint={t("aaAddressHint")}
              placeholder={t("aaAddressPlaceholder")}
              error={aaAddressInvalid ? t("aaAddressInvalid") : ""}
              onChange={(val) => setAaAddress(val)}
            />
            <details className="relay-howto">
              <summary>
                <span className="relay-disclosure__summary">
                  <span>{t("relayHowItWorksTitle")}</span>
                  <ChevronDown
                    className="relay-disclosure__icon"
                    size={16}
                    aria-hidden="true"
                  />
                </span>
              </summary>
              <div className="relay-howto__body">
                <p>{t("sponsorDirectionNote")}</p>
                <p>{t("relaySubmitExplainer")}</p>
              </div>
            </details>
          </div>
        </div>
      </NeoCard>

      <section
        className={`relay-control-deck relay-control-deck--${relayPhase}`}
        aria-label={t("relayBoardLabel")}
      >
        <picture className="relay-control-deck__media" aria-hidden="true">
          <img src="./aa-relay-station.jpg" alt="" loading="eager" decoding="async" />
        </picture>
        <div className="relay-control-deck__wash" aria-hidden="true" />
        <div className="relay-control-deck__header">
          <span>{t("relayBoardKicker")}</span>
          <strong>{relayPhaseLabel}</strong>
        </div>
        <div className="relay-control-deck__nodes">
          <article
            className={`relay-control-node${
              aaAddressValid ? " relay-control-node--ready" : ""
            }`}
          >
            <span className="relay-control-node__icon" aria-hidden="true">
              <WalletCards size={18} />
            </span>
            <div>
              <small>{t("relayBoardAA")}</small>
              <strong title={draftAAAddress}>{draftAAAddress}</strong>
            </div>
          </article>
          <article
            className={`relay-control-node${
              sponsorAmountIsValid ? " relay-control-node--ready" : ""
            }`}
          >
            <span className="relay-control-node__icon" aria-hidden="true">
              <CircleDollarSign size={18} />
            </span>
            <div>
              <small>{t("relayBoardPaymaster")}</small>
              <strong>{sponsorAmountTrimmed || "—"} GAS</strong>
            </div>
          </article>
          <article
            className={`relay-control-node${
              payloadJsonIsValid ? " relay-control-node--ready" : ""
            }`}
          >
            <span className="relay-control-node__icon" aria-hidden="true">
              <FileJson2 size={18} />
            </span>
            <div>
              <small>{t("relayBoardPayload")}</small>
              <strong>{payloadSummary.operation}</strong>
            </div>
          </article>
        </div>
        <div className="relay-control-deck__track" aria-hidden="true">
          <span className="relay-control-deck__track-line" />
          <span className="relay-control-deck__packet relay-control-deck__packet--one" />
          <span className="relay-control-deck__packet relay-control-deck__packet--two" />
        </div>
      </section>

      <section className="relay-route" aria-label={t("relayFlowLabel")}>
        <div
          className={routeStepClass(
            aaAddressValid,
            isCheckingSponsorship,
          )}
        >
          <span aria-hidden="true">
            <ShieldCheck size={18} />
          </span>
          <div>
            <strong>{t("relayFlowSponsor")}</strong>
            <p>{t("relayFlowSponsorDesc")}</p>
          </div>
        </div>
        <div
          className={routeStepClass(
            canRequestSponsor,
            isCheckingSponsorship && sponsorAmountIsValid,
          )}
        >
          <span aria-hidden="true">
            <WalletCards size={18} />
          </span>
          <div>
            <strong>{t("relayFlowRequest")}</strong>
            <p>{t("relayFlowRequestDesc")}</p>
          </div>
        </div>
        <div className={routeStepClass(canSubmitRelay, isRelaying)}>
          <span aria-hidden="true">
            <Rocket size={18} />
          </span>
          <div>
            <strong>{t("relayFlowSubmit")}</strong>
            <p>{t("relayFlowSubmitDesc")}</p>
          </div>
        </div>
      </section>

      <section className="relay-workspace">
        {/* Step 1: sponsorship preflight */}
        <NeoCard variant="erobo" className="relay-step">
          <div className="relay-form">
            <header className="relay-step__head">
              <span className="relay-step__icon" aria-hidden="true">
                <Landmark size={18} />
              </span>
              <div>
                <span className="relay-step__eyebrow">
                  {t("relayStep1Eyebrow")}
                </span>
                <h3 className="relay-step__title">{t("relayStep1Title")}</h3>
              </div>
            </header>

            <NeoInput
              type="number"
              value={sponsorAmountLocal}
              label={t("sponsorAmount")}
              hint={t("sponsorAmountHint")}
              placeholder={t("sponsorAmountPlaceholder")}
              onChange={(val) => setSponsorAmountLocal(val)}
            />
            <div className="relay-action-grid">
              <NeoButton
                variant="secondary"
                loading={isCheckingSponsorship}
                disabled={!canCheckSponsor}
                aria-label={t("sponsorCheck")}
                onClick={() => dispatch("checkSponsor", aaAddress, dappIdLocal)}
              >
                <ClipboardCheck size={17} aria-hidden="true" />
                {t("sponsorCheck")}
              </NeoButton>
              <NeoButton
                variant="primary"
                loading={isCheckingSponsorship}
                disabled={!canRequestSponsor}
                aria-label={t("sponsorRequest")}
                onClick={() =>
                  dispatch(
                    "requestSponsor",
                    aaAddress,
                    dappIdLocal,
                    sponsorAmountLocal,
                  )
                }
              >
                <CircleDollarSign size={17} aria-hidden="true" />
                {t("sponsorRequest")}
              </NeoButton>
            </div>
            {!canCheckSponsor && (
              <p className="relay-hint">{t("sponsorBlocked")}</p>
            )}
            {canCheckSponsor && hasSponsorAmount && !sponsorAmountIsValid && (
              <p className="relay-hint">{t("sponsorAmountInvalid")}</p>
            )}
          </div>
        </NeoCard>

        {/* Step 2: build & submit payload */}
        <NeoCard variant="erobo" className="relay-step">
          <div className="relay-form">
            <header className="relay-step__head">
              <span className="relay-step__icon" aria-hidden="true">
                <TerminalSquare size={18} />
              </span>
              <div>
                <span className="relay-step__eyebrow">
                  {t("relayStep2Eyebrow")}
                </span>
                <h3 className="relay-step__title">{t("relayStep2Title")}</h3>
              </div>
            </header>

            <NeoInput
              value={dappIdLocal}
              label={t("dappId")}
              hint={t("dappIdHint")}
              placeholder={t("dappIdPlaceholder")}
              onChange={(val) => setDappIdLocal(val)}
            />
            <div
              className={`relay-payload-lens${
                payloadJsonIsValid ? "" : " relay-payload-lens--invalid"
              }`}
              aria-label={t("relayPayloadLens")}
            >
              <div className="relay-payload-lens__head">
                <span aria-hidden="true">
                  <Gauge size={18} />
                </span>
                <div>
                  <small>{t("relayPayloadLens")}</small>
                  <strong>
                    {payloadJsonIsValid
                      ? t("relayPayloadReady")
                      : t("payloadInvalid")}
                  </strong>
                </div>
              </div>
              <div className="relay-payload-lens__grid">
                <span>
                  <small>{t("relayPayloadOperation")}</small>
                  <strong>{payloadSummary.operation}</strong>
                </span>
                <span>
                  <small>{t("relayPayloadTarget")}</small>
                  <strong title={payloadSummary.target}>
                    {payloadSummary.target}
                  </strong>
                </span>
                <span>
                  <small>{t("relayPayloadArgs")}</small>
                  <strong>{payloadSummary.argsLabel}</strong>
                </span>
              </div>
            </div>
            <NeoInput
              type="textarea"
              value={payloadJsonLocal}
              label={t("payloadJson")}
              hint={t("payloadJsonHint")}
              placeholder={t("payloadJsonPlaceholder")}
              aria-label={t("payloadJson")}
              className="relay-payload-editor"
              onChange={(val) => setPayloadJsonLocal(val)}
            />
            {(!hasAAAddress || !payloadJsonIsValid) && (
              <p className="relay-hint">
                {payloadJsonIsValid ? t("relayBlocked") : t("payloadInvalid")}
              </p>
            )}
            <NeoButton
              variant="primary"
              loading={isRelaying}
              disabled={!canSubmitRelay}
              aria-label={t("submitRelay")}
              onClick={() =>
                dispatch(
                  "submitRelay",
                  aaAddress,
                  dappIdLocal,
                  payloadJsonLocal,
                )
              }
            >
              <Rocket size={17} aria-hidden="true" />
              {t("submitRelay")}
            </NeoButton>
          </div>
        </NeoCard>
      </section>

      {/* Single human-readable result line, only after an action runs */}
      {activeResult && (
        <div className={`relay-result relay-result--${resultTone}`}>
          <div className="relay-result__line">
            <span className="relay-result__dot" aria-hidden="true" />
            <span className="relay-result__text">{resultText}</span>
            <span className="relay-result__scope">{draftAAAddress}</span>
          </div>
          {relayTxid && (
            <a
              className="relay-result__tx"
              href={explorerTxUrl(relayTxid)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="relay-result__tx-label">
                {t("relayTxLabel")}
              </span>
              <code>{relayTxid}</code>
            </a>
          )}
          <details className="relay-result__raw">
            <summary>
              <span className="relay-disclosure__summary relay-disclosure__summary--raw">
                <span>{t("latestRelay")}</span>
                <ChevronDown
                  className="relay-disclosure__icon"
                  size={15}
                  aria-hidden="true"
                />
              </span>
            </summary>
            <pre>{resultRaw}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
