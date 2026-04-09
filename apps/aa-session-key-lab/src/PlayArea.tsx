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
  const { bool, val } = useStateBindings(state);

  // State bindings
  const isSubmitting = bool("isSubmitting");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const detailItems = val<Array<{ label: string; value: unknown }>>("detailItems") ?? [];

  // Local form state
  const [accountSeed, setAccountSeed] = useState("");
  const [sessionPublicKey, setSessionPublicKey] = useState("");
  const [targetContract, setTargetContract] = useState("");
  const [allowedMethod, setAllowedMethod] = useState("*");
  const [expiresAt, setExpiresAt] = useState(String(Math.floor(Date.now() / 1000) + 3600));

  const handleGenerateKey = async () => {
    const result = await dispatch("generateKey") as unknown as { publicKey?: string };
    if (result?.publicKey) {
      setSessionPublicKey(result.publicKey);
    }
  };

  return (
    <div className="session-play-area">
      {/* Result Section */}
      <NeoCard variant="erobo" className="result-card">
        <div className="details-grid">
          {detailItems.map((item) => (
            <div key={item.label}>
              <span className="label">{item.label}</span>
              <span className="value">{String(item.value ?? t("notAvailable"))}</span>
            </div>
          ))}
        </div>
      </NeoCard>

      {/* Operation Section */}
      <NeoCard variant="erobo" className="operation-card">
        <div className="stack">
          <NeoInput value={accountSeed} label={t("accountSeed")} placeholder={t("accountSeedPlaceholder")} onChange={(val) => setAccountSeed(val)} />
          <NeoInput value={sessionPublicKey} label={t("sessionPublicKey")} placeholder={t("sessionPublicKeyPlaceholder")} onChange={(val) => setSessionPublicKey(val)} />
          <NeoInput value={targetContract} label={t("targetContract")} placeholder={t("targetContractPlaceholder")} onChange={(val) => setTargetContract(val)} />
          <NeoInput value={allowedMethod} label={t("allowedMethod")} placeholder={t("allowedMethodPlaceholder")} onChange={(val) => setAllowedMethod(val)} />
          <NeoInput value={expiresAt} label={t("expiresAt")} placeholder={t("expiresAtPlaceholder")} onChange={(val) => setExpiresAt(val)} />
          <div className="actions-row">
            <NeoButton variant="secondary" aria-label={t("generateKey")} onClick={handleGenerateKey}>{t("generateKey")}</NeoButton>
            <NeoButton variant="secondary" loading={isCheckingSponsorship} aria-label={t("checkSponsor")} onClick={() => dispatch("checkSponsor")}>{t("checkSponsor")}</NeoButton>
            <NeoButton variant="secondary" loading={isCheckingSponsorship} aria-label={t("requestSponsor")} onClick={() => dispatch("requestSponsor")}>{t("requestSponsor")}</NeoButton>
            <NeoButton variant="primary" loading={isSubmitting} aria-label={t("configureSession")} onClick={() => dispatch("configureSessionKey", accountSeed, sessionPublicKey, targetContract, allowedMethod, expiresAt)}>{t("configureSession")}</NeoButton>
          </div>
        </div>
      </NeoCard>
    </div>
  );
}
