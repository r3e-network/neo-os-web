/**
 * PlayArea.tsx — AA Session Key Lab
 *
 * Full interactive session key console: stats bar with key/sponsor/session
 * status, detail items grid, form for configuration, and sponsor actions.
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
  const { bool, str, val } = useStateBindings(state);

  const isSubmitting = bool("isSubmitting");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const detailItems = val<Array<{ label: string; value: unknown }>>("detailItems") ?? [];
  const derivedAccountIdHash = str("derivedAccountIdHash");
  const normalizedTargetContract = str("normalizedTargetContract");
  const normalizedAllowedMethod = str("normalizedAllowedMethod");
  const aaCoreDisplay = str("aaCoreDisplay");
  const sessionStatusDisplay = str("sessionStatusDisplay");
  const sessionVerifierDisplay = str("sessionVerifierDisplay");
  const walletDisplay = str("walletDisplay");
  const sponsorStatusDisplay = str("sponsorStatusDisplay");

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
      {/* Stats Bar */}
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-value">{sessionStatusDisplay || "--"}</span>
          <span className="stat-label">{t("sessionStatus") || "Session"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{sponsorStatusDisplay || "--"}</span>
          <span className="stat-label">{t("sponsorStatus") || "Sponsor"}</span>
        </div>
        <div className="stat-chip">
          <span className="stat-value">{walletDisplay || "--"}</span>
          <span className="stat-label">{t("wallet") || "Wallet"}</span>
        </div>
      </div>

      {/* Environment Info */}
      <NeoCard variant="erobo" className="env-card">
        <div className="env-grid">
          <div className="env-item">
            <span className="env-label">{t("aaCore") || "AA Core"}</span>
            <span className="env-value">{aaCoreDisplay || "--"}</span>
          </div>
          <div className="env-item">
            <span className="env-label">{t("sessionVerifier") || "Session Verifier"}</span>
            <span className="env-value">{sessionVerifierDisplay || "--"}</span>
          </div>
          <div className="env-item">
            <span className="env-label">{t("derivedAccountId") || "Account ID Hash"}</span>
            <span className="env-value">{derivedAccountIdHash || "--"}</span>
          </div>
          <div className="env-item">
            <span className="env-label">{t("normalizedTarget") || "Target Contract"}</span>
            <span className="env-value">{normalizedTargetContract || "--"}</span>
          </div>
          <div className="env-item">
            <span className="env-label">{t("normalizedMethod") || "Allowed Method"}</span>
            <span className="env-value">{normalizedAllowedMethod || "--"}</span>
          </div>
        </div>
      </NeoCard>

      {/* Detail Items Grid */}
      <NeoCard variant="erobo" className="result-card">
        <div className="details-grid">
          {detailItems.map((item: { label: string; value: unknown }) => (
            <div key={item.label} className="detail-row">
              <span className="label">{item.label}</span>
              <span className="value">{String(item.value ?? (t("notAvailable") || "N/A"))}</span>
            </div>
          ))}
          {detailItems.length === 0 && (
            <span className="empty-hint">{t("noDetails") || "No session details yet. Generate a key to begin."}</span>
          )}
        </div>
      </NeoCard>

      {/* Operation Section */}
      <NeoCard variant="erobo" className="operation-card">
        <div className="stack">
          <NeoInput value={accountSeed} label={t("accountSeed") || "Account Seed"} placeholder={t("accountSeedPlaceholder") || "Enter seed"} onChange={(v: string) => setAccountSeed(v)} />
          <NeoInput value={sessionPublicKey} label={t("sessionPublicKey") || "Session Public Key"} placeholder={t("sessionPublicKeyPlaceholder") || "Public key"} onChange={(v: string) => setSessionPublicKey(v)} />
          <NeoInput value={targetContract} label={t("targetContract") || "Target Contract"} placeholder={t("targetContractPlaceholder") || "Contract hash"} onChange={(v: string) => setTargetContract(v)} />
          <NeoInput value={allowedMethod} label={t("allowedMethod") || "Allowed Method"} placeholder={t("allowedMethodPlaceholder") || "*"} onChange={(v: string) => setAllowedMethod(v)} />
          <NeoInput value={expiresAt} label={t("expiresAt") || "Expires At"} placeholder={t("expiresAtPlaceholder") || "Unix timestamp"} onChange={(v: string) => setExpiresAt(v)} />
          <div className="actions-row">
            <NeoButton variant="secondary" aria-label={t("generateKey") || "Generate Key"} onClick={handleGenerateKey}>
              {t("generateKey") || "Generate Key"}
            </NeoButton>
            <NeoButton variant="secondary" loading={isCheckingSponsorship} aria-label={t("checkSponsor") || "Check Sponsor"} onClick={() => dispatch("checkSponsor")}>
              {t("checkSponsor") || "Check Sponsor"}
            </NeoButton>
            <NeoButton variant="secondary" loading={isCheckingSponsorship} aria-label={t("requestSponsor") || "Request Sponsor"} onClick={() => dispatch("requestSponsor")}>
              {t("requestSponsor") || "Request Sponsor"}
            </NeoButton>
            <NeoButton variant="primary" loading={isSubmitting} aria-label={t("configureSession") || "Configure"} onClick={() => dispatch("configureSessionKey", accountSeed, sessionPublicKey, targetContract, allowedMethod, expiresAt)}>
              {t("configureSession") || "Configure Session"}
            </NeoButton>
          </div>
        </div>
      </NeoCard>
    </div>
  );
}
