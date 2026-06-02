/**
 * PlayArea.tsx - AA Relay Console
 *
 * Wallet-style sponsored relay workspace for AA payload preparation.
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

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);
  const launchDefaults = getRelayLaunchDefaults(launchContext);

  const aaAddressDisplay = str("aaAddressDisplay", t("notAvailable") || "N/A");
  const paymasterDisplay = str("paymasterDisplay", t("unset") || "unset");
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
  const dappDisplay = dappIdLocal.trim() || t("unset");

  const stateItems = [
    { label: t("labelAA") || "AA", value: aaAddressDisplay },
    { label: t("paymasterLabel") || "Paymaster", value: paymasterDisplay },
    { label: t("labelSponsor") || "Sponsor", value: sponsorState },
    { label: t("relayLabel") || "Relay", value: relayResponse },
  ];

  return (
    <div className="relay-play-area">
      <section className="relay-hero">
        <div className="relay-hero__copy">
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
            <h2>{t("relayHeroTitle")}</h2>
          </div>
          <p>{t("relayHeroCopy")}</p>
          <div
            className="relay-hero__metrics"
            aria-label={t("relayMetricsLabel")}
          >
            <div className="relay-metric">
              <span>{t("network") || "Network"}</span>
              <strong>{networkDisplay || "--"}</strong>
            </div>
            <div className="relay-metric">
              <span>{t("relayEndpointMetric")}</span>
              <strong>{relayUrlDisplay || "--"}</strong>
            </div>
            <div className="relay-metric">
              <span>{t("paymasterLabel") || "Paymaster"}</span>
              <strong>{dappDisplay}</strong>
            </div>
          </div>
        </div>

        <NeoCard
          variant="erobo"
          title={t("relayCommandTitle")}
          className="relay-command"
        >
          <div className="relay-command__status">
            <span>{t("aaCoreLabel")}</span>
            <strong>{aaCoreDisplay || "--"}</strong>
          </div>
          <div className="relay-form">
            <NeoInput
              value={aaAddress}
              label={t("aaAddress") || "AA Address"}
              hint={t("aaAddressHint")}
              placeholder={t("aaAddressPlaceholder") || "N..."}
              onChange={(val) => setAaAddress(val)}
            />
            {!canCheckSponsor && (
              <p className="relay-hint">{t("sponsorBlocked")}</p>
            )}
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
        </NeoCard>
      </section>

      <section className="relay-flow" aria-label={t("relayFlowLabel")}>
        <div className="relay-flow__step">
          <span>01</span>
          <strong>{t("relayFlowSponsor")}</strong>
          <p>{t("relayFlowSponsorDesc")}</p>
        </div>
        <div className="relay-flow__step">
          <span>02</span>
          <strong>{t("relayFlowRequest")}</strong>
          <p>{t("relayFlowRequestDesc")}</p>
        </div>
        <div className="relay-flow__step">
          <span>03</span>
          <strong>{t("relayFlowSubmit")}</strong>
          <p>{t("relayFlowSubmitDesc")}</p>
        </div>
      </section>

      <section className="relay-workspace">
        <div className="relay-state-panel">
          <div className="relay-section-heading">
            <div>
              <span>{t("relayStateLabel")}</span>
              <h3>{t("relayStateTitle")}</h3>
            </div>
            <strong>{draftAAAddress}</strong>
          </div>

          <div className="relay-state-grid">
            {stateItems.map((item) => (
              <div key={item.label} className="relay-state-card">
                <span>{item.label}</span>
                <pre>{item.value}</pre>
              </div>
            ))}
          </div>

          <div className="relay-risk-note">
            <span>PM</span>
            <div>
              <strong>{t("relayRiskTitle")}</strong>
              <p>{t("relayRiskCopy")}</p>
            </div>
          </div>
        </div>

        <aside className="relay-side-rail">
          <NeoCard
            variant="erobo"
            title={t("relaySubmitTitle")}
            className="relay-submit-card"
          >
            <div className="relay-scope-summary">
              <strong>{t("relayDraftLabel")}</strong>
              <span>{draftAAAddress}</span>
            </div>
            {(!canSubmitRelay || !payloadJsonIsValid) && (
              <p className="relay-hint">
                {payloadJsonIsValid ? t("relayBlocked") : t("payloadInvalid")}
              </p>
            )}
            <div className="relay-form">
              <NeoInput
                value={dappIdLocal}
                label={t("dappId") || "Paymaster Dapp ID"}
                hint={t("dappIdHint")}
                placeholder={t("dappIdPlaceholder") || "Optional dapp id"}
                onChange={(val) => setDappIdLocal(val)}
              />
              <NeoInput
                type="number"
                value={sponsorAmountLocal}
                label={t("sponsorAmount") || "Sponsor Amount"}
                hint={t("sponsorAmountHint")}
                placeholder={t("sponsorAmountPlaceholder") || "0.1"}
                onChange={(val) => setSponsorAmountLocal(val)}
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
              <NeoButton
                variant="primary"
                loading={isRelaying}
                disabled={!canSubmitRelay}
                aria-label={t("submitRelay") || "Submit Relay"}
                onClick={() =>
                  dispatch(
                    "submitRelay",
                    aaAddress,
                    dappIdLocal,
                    payloadJsonLocal,
                  )
                }
              >
                {t("submitRelay") || "Submit Relay Payload"}
              </NeoButton>
            </div>
          </NeoCard>
        </aside>
      </section>
    </div>
  );
}
