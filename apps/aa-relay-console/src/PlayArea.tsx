/**
 * PlayArea.tsx -- AA Relay Console
 *
 * Uses all state: aaAddressDisplay, paymasterDisplay, sponsorState,
 * relayResponse, aaCoreDisplay, relayUrlDisplay, networkDisplay,
 * isCheckingSponsorship, isRelaying.
 * Actions: checkSponsor, requestSponsor, submitRelay.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  // State bindings
  const aaAddressDisplay = str("aaAddressDisplay", t("notAvailable") || "N/A");
  const paymasterDisplay = str("paymasterDisplay", t("unset") || "unset");
  const sponsorState = str("sponsorState", "{}");
  const relayResponse = str("relayResponse", "{}");
  const aaCoreDisplay = str("aaCoreDisplay", "");
  const relayUrlDisplay = str("relayUrlDisplay", "");
  const networkDisplay = str("networkDisplay", "");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const isRelaying = bool("isRelaying");

  // Local form state
  const [aaAddress, setAaAddress] = useState("");
  const [dappIdLocal, setDappIdLocal] = useState("");
  const [payloadJsonLocal, setPayloadJsonLocal] = useState('{\n  "metaInvocation": {\n    "scriptHash": "0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38"\n  }\n}');

  return (
    <div className="relay-play-area">
      {/* Infrastructure info */}
      <NeoCard variant="erobo" className="infra-card">
        <div className="infra-grid">
          {networkDisplay && (
            <div className="infra-row">
              <span className="label">{t("network") || "Network"}</span>
              <span className="value">{networkDisplay}</span>
            </div>
          )}
          {aaCoreDisplay && (
            <div className="infra-row">
              <span className="label">AA Core</span>
              <span className="value mono">{aaCoreDisplay}</span>
            </div>
          )}
          {relayUrlDisplay && (
            <div className="infra-row">
              <span className="label">{t("heroRelay") || "Relay"}</span>
              <span className="value mono">{relayUrlDisplay}</span>
            </div>
          )}
        </div>
      </NeoCard>

      {/* Result Section */}
      <NeoCard variant="erobo" className="result-card">
        <div className="response-grid">
          <div><span className="label">{t("labelAA") || "AA"}</span><span className="value">{aaAddressDisplay}</span></div>
          <div><span className="label">{t("paymasterLabel") || "Paymaster"}</span><span className="value">{paymasterDisplay}</span></div>
          <div><span className="label">{t("labelSponsor") || "Sponsor"}</span><span className="value mono">{sponsorState}</span></div>
          <div><span className="label">{t("relayLabel") || "Relay"}</span><span className="value mono">{relayResponse}</span></div>
        </div>
      </NeoCard>

      {/* Operation Section */}
      <NeoCard variant="erobo" className="operation-card">
        <div className="stack">
          <NeoInput value={aaAddress} label={t("aaAddress") || "AA Address"} placeholder={t("aaAddressPlaceholder") || "N..."} onChange={(val) => setAaAddress(val)} />
          <NeoInput value={dappIdLocal} label={t("dappId") || "Paymaster Dapp ID"} placeholder={t("dappIdPlaceholder") || "Optional dapp id"} onChange={(val) => setDappIdLocal(val)} />
          <NeoInput type="textarea" value={payloadJsonLocal} label={t("payloadJson") || "Relay Payload JSON"} placeholder={t("payloadJsonPlaceholder") || "{}"} aria-label={t("payloadJson") || "Relay Payload JSON"} onChange={(val) => setPayloadJsonLocal(val)} />
          <div className="actions-row">
            <NeoButton variant="secondary" loading={isCheckingSponsorship} aria-label={t("sponsorCheck") || "Check Sponsorship"} onClick={() => dispatch("checkSponsor", aaAddress, dappIdLocal)}>{t("sponsorCheck") || "Check Sponsorship"}</NeoButton>
            <NeoButton variant="secondary" loading={isCheckingSponsorship} aria-label={t("sponsorRequest") || "Request Sponsorship"} onClick={() => dispatch("requestSponsor", aaAddress, dappIdLocal)}>{t("sponsorRequest") || "Request Sponsorship"}</NeoButton>
            <NeoButton variant="primary" loading={isRelaying} aria-label={t("submitRelay") || "Submit Relay"} onClick={() => dispatch("submitRelay", aaAddress, dappIdLocal, payloadJsonLocal)}>{t("submitRelay") || "Submit Relay Payload"}</NeoButton>
          </div>
        </div>
      </NeoCard>
    </div>
  );
}
