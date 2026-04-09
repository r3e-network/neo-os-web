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
  const aaAddressDisplay = str("aaAddressDisplay", t("notAvailable"));
  const paymasterDisplay = str("paymasterDisplay", t("unset"));
  const sponsorState = str("sponsorState", "{}");
  const relayResponse = str("relayResponse", "{}");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const isRelaying = bool("isRelaying");

  // Local form state
  const [aaAddress, setAaAddress] = useState("");
  const [dappIdLocal, setDappIdLocal] = useState("");
  const [payloadJsonLocal, setPayloadJsonLocal] = useState('{\n  "metaInvocation": {\n    "scriptHash": "0xe24d2980d17d2580ff4ee8dc5dddaa20e3caec38"\n  }\n}');

  return (
    <div className="relay-play-area">
      {/* Result Section */}
      <NeoCard variant="erobo" className="result-card">
        <div className="response-grid">
          <div><span className="label">{t("labelAA")}</span><span className="value">{aaAddressDisplay}</span></div>
          <div><span className="label">{t("paymasterLabel")}</span><span className="value">{paymasterDisplay}</span></div>
          <div><span className="label">{t("labelSponsor")}</span><span className="value">{sponsorState}</span></div>
          <div><span className="label">{t("relayLabel")}</span><span className="value">{relayResponse}</span></div>
        </div>
      </NeoCard>

      {/* Operation Section */}
      <NeoCard variant="erobo" className="operation-card">
        <div className="stack">
          <NeoInput value={aaAddress} label={t("aaAddress")} placeholder={t("aaAddressPlaceholder")} onChange={(val) => setAaAddress(val)} />
          <NeoInput value={dappIdLocal} label={t("dappId")} placeholder={t("dappIdPlaceholder")} onChange={(val) => setDappIdLocal(val)} />
          <NeoInput type="textarea" value={payloadJsonLocal} label={t("payloadJson")} placeholder={t("payloadJsonPlaceholder")} aria-label={t("payloadJson")} onChange={(val) => setPayloadJsonLocal(val)} />
          <div className="actions-row">
            <NeoButton variant="secondary" loading={isCheckingSponsorship} aria-label={t("sponsorCheck")} onClick={() => dispatch("checkSponsor", aaAddress, dappIdLocal)}>{t("sponsorCheck")}</NeoButton>
            <NeoButton variant="secondary" loading={isCheckingSponsorship} aria-label={t("sponsorRequest")} onClick={() => dispatch("requestSponsor", aaAddress, dappIdLocal)}>{t("sponsorRequest")}</NeoButton>
            <NeoButton variant="primary" loading={isRelaying} aria-label={t("submitRelay")} onClick={() => dispatch("submitRelay", aaAddress, dappIdLocal, payloadJsonLocal)}>{t("submitRelay")}</NeoButton>
          </div>
        </div>
      </NeoCard>
    </div>
  );
}
