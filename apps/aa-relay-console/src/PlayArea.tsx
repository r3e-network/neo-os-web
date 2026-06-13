/**
 * PlayArea.tsx - AA Relay Console
 *
 * Wallet-style sponsored relay workspace for AA payload preparation.
 * Single vertical flow: AA Address -> (Check / Request Sponsorship) -> Payload -> Submit.
 */

import { useState } from "react";
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
    if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    /* not yet populated */
  }
  return null;
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
      (activeResult.status as string) ||
      (activeResult.state as string) ||
      "";
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
        <div className="relay-hero__head">
          <span className="relay-hero__badge" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M12 2 4 6v6c0 4.42 3.05 7.7 8 9 4.95-1.3 8-4.58 8-9V6l-8-4Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path
                d="m9 12 2 2 4-4"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <div className="relay-hero__copy">
            <span className="relay-hero__eyebrow">{t("relayLabel")}</span>
            <h2>{t("relayHeroTitle")}</h2>
            <p>{t("relayHeroCopy")}</p>
          </div>
        </div>

        <div className="relay-hero__facts" aria-label={t("relayMetricsLabel")}>
          <span className="relay-fact">
            <span className="relay-fact__label">{t("network")}</span>
            <strong>{networkDisplay || "—"}</strong>
          </span>
          <span className="relay-hero__divider" aria-hidden="true" />
          <span className="relay-fact">
            <span className="relay-fact__label">{t("relayEndpointMetric")}</span>
            <strong title={relayUrlDisplay || "—"}>
              <code>{relayUrlDisplay || "—"}</code>
            </strong>
          </span>
          <span className="relay-hero__divider" aria-hidden="true" />
          <span className="relay-fact">
            <span className="relay-fact__label">{t("aaCoreLabel")}</span>
            <strong title={aaCoreDisplay || "—"}>
              <code>{aaCoreDisplay || "—"}</code>
            </strong>
          </span>
        </div>
      </section>

      <NeoCard
        variant="erobo"
        title={t("relayCommandTitle")}
        className="relay-command"
      >
        <div className="relay-form">
          <p className="relay-explainer">{t("relayPaymasterExplainer")}</p>
          {/* Step 1: AA address + sponsorship preflight */}
          <NeoInput
            value={aaAddress}
            label={t("aaAddress")}
            hint={t("aaAddressHint")}
            placeholder={t("aaAddressPlaceholder")}
            error={aaAddressInvalid ? t("aaAddressInvalid") : ""}
            onChange={(val) => setAaAddress(val)}
          />

          <div className="relay-sponsor-row">
            <div className="relay-sponsor-row__amount">
              <NeoInput
                type="number"
                value={sponsorAmountLocal}
                label={t("sponsorAmount")}
                hint={t("sponsorAmountHint")}
                placeholder={t("sponsorAmountPlaceholder")}
                onChange={(val) => setSponsorAmountLocal(val)}
              />
            </div>
            <div className="relay-action-grid">
              <NeoButton
                variant="secondary"
                loading={isCheckingSponsorship}
                disabled={!canCheckSponsor}
                aria-label={t("sponsorCheck")}
                onClick={() => dispatch("checkSponsor", aaAddress, dappIdLocal)}
              >
                {t("sponsorCheck")}
              </NeoButton>
              <NeoButton
                variant="secondary"
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
                {t("sponsorRequest")}
              </NeoButton>
            </div>
          </div>
          <p className="relay-explainer relay-explainer--muted">
            {t("sponsorDirectionNote")}
          </p>
          {!canCheckSponsor && (
            <p className="relay-hint">{t("sponsorBlocked")}</p>
          )}
          {canCheckSponsor && hasSponsorAmount && !sponsorAmountIsValid && (
            <p className="relay-hint">{t("sponsorAmountInvalid")}</p>
          )}

          <hr className="relay-divider" />

          {/* Step 2: payload + submit */}
          <NeoInput
            value={dappIdLocal}
            label={t("dappId")}
            hint={t("dappIdHint")}
            placeholder={t("dappIdPlaceholder")}
            onChange={(val) => setDappIdLocal(val)}
          />
          <NeoInput
            type="textarea"
            value={payloadJsonLocal}
            label={t("payloadJson")}
            hint={t("payloadJsonHint")}
            placeholder={t("payloadJsonPlaceholder")}
            aria-label={t("payloadJson")}
            onChange={(val) => setPayloadJsonLocal(val)}
          />
          <p className="relay-explainer relay-explainer--muted">
            {t("relaySubmitExplainer")}
          </p>
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
              dispatch("submitRelay", aaAddress, dappIdLocal, payloadJsonLocal)
            }
          >
            {t("submitRelay")}
          </NeoButton>

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
                <summary>{t("latestRelay")}</summary>
                <pre>{resultRaw}</pre>
              </details>
            </div>
          )}
        </div>
      </NeoCard>
    </div>
  );
}
