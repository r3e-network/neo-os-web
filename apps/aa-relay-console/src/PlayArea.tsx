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
  const payloadJsonIsValid = isValidJson(payloadJsonLocal);
  const hasSponsorAmount = Boolean(sponsorAmountLocal.trim());
  const canCheckSponsor = hasAAAddress && !isCheckingSponsorship;
  const canRequestSponsor =
    hasAAAddress && hasSponsorAmount && !isCheckingSponsorship;
  const canSubmitRelay = hasAAAddress && payloadJsonIsValid && !isRelaying;
  const draftAAAddress = aaAddress.trim() || t("notAvailable");

  // Single human-readable result line: show only after an action has populated state.
  const relayResult = parseStateJson(relayResponse);
  const sponsorResult = parseStateJson(sponsorState);
  const activeResult = relayResult ?? sponsorResult;
  const resultRaw = relayResult ? relayResponse : sponsorState;

  let resultTone: "ok" | "warn" | "info" = "info";
  let resultText = "";
  if (activeResult) {
    if (relayResult) {
      resultText = t("relaySubmitted");
      resultTone = "ok";
    } else {
      resultText = t("sponsorCheckComplete");
      resultTone = "info";
    }
    // Surface an error message if the service returned one.
    const errLike =
      (activeResult.error as string) ||
      (activeResult.message as string) ||
      "";
    const statusLike =
      (activeResult.status as string) ||
      (activeResult.state as string) ||
      "";
    if (typeof errLike === "string" && errLike) {
      resultText = errLike;
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
            <h2>{t("relayHeroTitle")}</h2>
            <p>{t("relayHeroCopy")}</p>
          </div>
        </div>

        <div className="relay-hero__facts" aria-label={t("relayMetricsLabel")}>
          <div className="relay-fact">
            <span>{t("network") || "Network"}</span>
            <strong>{networkDisplay || "--"}</strong>
          </div>
          <p
            className="relay-hero__caption"
            title={`${t("relayEndpointMetric")}: ${relayUrlDisplay || "--"} · ${t("aaCoreLabel")}: ${aaCoreDisplay || "--"}`}
          >
            {t("relayEndpointMetric")}: <code>{relayUrlDisplay || "--"}</code>
            <span aria-hidden="true"> · </span>
            {t("aaCoreLabel")}: <code>{aaCoreDisplay || "--"}</code>
          </p>
        </div>
      </section>

      <NeoCard
        variant="erobo"
        title={t("relayCommandTitle")}
        className="relay-command"
      >
        <div className="relay-form">
          {/* Step 1: AA address + sponsorship preflight */}
          <NeoInput
            value={aaAddress}
            label={t("aaAddress") || "AA Address"}
            hint={t("aaAddressHint")}
            placeholder={t("aaAddressPlaceholder") || "N..."}
            onChange={(val) => setAaAddress(val)}
          />

          <div className="relay-sponsor-row">
            <div className="relay-sponsor-row__amount">
              <NeoInput
                type="number"
                value={sponsorAmountLocal}
                label={t("sponsorAmount") || "Sponsor Amount"}
                hint={t("sponsorAmountHint")}
                placeholder={t("sponsorAmountPlaceholder") || "0.1"}
                onChange={(val) => setSponsorAmountLocal(val)}
              />
            </div>
            <div className="relay-action-grid">
              <NeoButton
                variant="secondary"
                loading={isCheckingSponsorship}
                disabled={!canCheckSponsor}
                aria-label={t("sponsorCheck") || "Check Sponsorship"}
                onClick={() => dispatch("checkSponsor", aaAddress, dappIdLocal)}
              >
                {t("sponsorCheck") || "Check Sponsorship"}
              </NeoButton>
              <NeoButton
                variant="secondary"
                loading={isCheckingSponsorship}
                disabled={!canRequestSponsor}
                aria-label={t("sponsorRequest") || "Request Sponsorship"}
                onClick={() =>
                  dispatch(
                    "requestSponsor",
                    aaAddress,
                    dappIdLocal,
                    sponsorAmountLocal,
                  )
                }
              >
                {t("sponsorRequest") || "Request Sponsorship"}
              </NeoButton>
            </div>
          </div>
          {!canCheckSponsor && (
            <p className="relay-hint">{t("sponsorBlocked")}</p>
          )}

          <hr className="relay-divider" />

          {/* Step 2: payload + submit */}
          <NeoInput
            value={dappIdLocal}
            label={t("dappId") || "Paymaster Dapp ID"}
            hint={t("dappIdHint")}
            placeholder={t("dappIdPlaceholder") || "Optional dapp id"}
            onChange={(val) => setDappIdLocal(val)}
          />
          <NeoInput
            type="textarea"
            value={payloadJsonLocal}
            label={t("payloadJson") || "Relay Payload JSON"}
            hint={t("payloadJsonHint")}
            placeholder={t("payloadJsonPlaceholder") || "{}"}
            aria-label={t("payloadJson") || "Relay Payload JSON"}
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
            aria-label={t("submitRelay") || "Submit Relay"}
            onClick={() =>
              dispatch("submitRelay", aaAddress, dappIdLocal, payloadJsonLocal)
            }
          >
            {t("submitRelay") || "Submit Relay Payload"}
          </NeoButton>

          {/* Single human-readable result line, only after an action runs */}
          {activeResult && (
            <div className={`relay-result relay-result--${resultTone}`}>
              <div className="relay-result__line">
                <span className="relay-result__dot" aria-hidden="true" />
                <span className="relay-result__text">{resultText}</span>
                <span className="relay-result__scope">{draftAAAddress}</span>
              </div>
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
