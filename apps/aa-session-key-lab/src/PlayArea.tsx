/**
 * PlayArea.tsx - AA Session Key Lab
 *
 * Wallet-style session-key workspace for configuring scoped AA permissions.
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
  const detailItems =
    val<Array<{ label: string; value: unknown }>>("detailItems") ?? [];
  const derivedAccountIdHash = str("derivedAccountIdHash");
  const normalizedTargetContract = str("normalizedTargetContract");
  const normalizedAllowedMethod = str("normalizedAllowedMethod");
  const aaCoreDisplay = str("aaCoreDisplay");
  const sessionStatusDisplay = str("sessionStatusDisplay");
  const sessionVerifierDisplay = str("sessionVerifierDisplay");
  const walletDisplay = str("walletDisplay");
  const sponsorStatusDisplay = str("sponsorStatusDisplay");

  const [accountSeed, setAccountSeed] = useState("");
  const [sessionPublicKey, setSessionPublicKey] = useState("");
  const [targetContract, setTargetContract] = useState("");
  const [allowedMethod, setAllowedMethod] = useState("*");
  const [expiresAt, setExpiresAt] = useState(() =>
    String(Math.floor(Date.now() / 1000) + 3600),
  );

  const canConfigure =
    Boolean(accountSeed.trim()) &&
    Boolean(sessionPublicKey.trim()) &&
    Boolean(targetContract.trim()) &&
    Boolean(expiresAt.trim()) &&
    !isSubmitting;
  const sessionKeyState = sessionPublicKey.trim()
    ? t("sessionKeyReady")
    : t("sessionKeyMissing");
  const scopeDisplay =
    normalizedTargetContract ||
    (targetContract.trim() ? targetContract.trim() : t("notAvailable"));
  const methodDisplay =
    normalizedAllowedMethod || allowedMethod.trim() || t("anyMethod");

  const environmentItems = [
    { label: t("aaCore") || "AA Core", value: aaCoreDisplay || "--" },
    {
      label: t("sessionVerifier") || "Session Verifier",
      value: sessionVerifierDisplay || "--",
    },
    {
      label: t("derivedAccountId") || "Account ID Hash",
      value: derivedAccountIdHash || "--",
    },
    {
      label: t("normalizedTarget") || "Target Contract",
      value: normalizedTargetContract || "--",
    },
    {
      label: t("normalizedMethod") || "Allowed Method",
      value: normalizedAllowedMethod || "--",
    },
  ];

  const handleGenerateKey = async () => {
    const result = (await dispatch("generateKey")) as unknown as {
      publicKey?: string;
    };
    if (result?.publicKey) {
      setSessionPublicKey(result.publicKey);
    }
  };

  return (
    <div className="session-play-area">
      <section className="session-hero">
        <div className="session-hero__copy">
          <div className="session-hero__head">
            <div className="session-hero__badge" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle
                  cx="7.5"
                  cy="15.5"
                  r="4.5"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <path
                  d="M10.5 12.5 19 4m-2 2 2.5 2.5M15 6l2.5 2.5"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div className="session-hero__heading">
              <h2>{t("sessionHeroTitle")}</h2>
              <p>{t("sessionHeroCopy")}</p>
            </div>
          </div>
          <div
            className="session-hero__metrics"
            aria-label={t("sessionMetricsLabel")}
          >
            <div className="session-metric">
              <span>{t("sessionMetricStatus")}</span>
              <strong>{sessionStatusDisplay || "--"}</strong>
            </div>
            <div className="session-metric">
              <span>{t("sessionMetricSponsor")}</span>
              <strong>{sponsorStatusDisplay || "--"}</strong>
            </div>
            <div className="session-metric">
              <span>{t("sessionMetricScope")}</span>
              <strong>{methodDisplay}</strong>
            </div>
          </div>
        </div>

        <NeoCard
          variant="erobo"
          title={t("sessionCommandTitle")}
          className="session-command"
        >
          <div className="session-command__status">
            <span>{t("wallet") || "Wallet"}</span>
            <strong>{walletDisplay || t("notConnected")}</strong>
          </div>
          <div className="session-command__status">
            <span>{t("sessionPublicKey")}</span>
            <strong>{sessionKeyState}</strong>
          </div>
          <div className="session-action-grid">
            <NeoButton
              variant="secondary"
              aria-label={t("generateKey") || "Generate Key"}
              onClick={handleGenerateKey}
            >
              {t("generateKey") || "Generate Key"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              loading={isCheckingSponsorship}
              aria-label={t("checkSponsor") || "Check Sponsor"}
              onClick={() => dispatch("checkSponsor")}
            >
              {t("checkSponsor") || "Check Sponsor"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              loading={isCheckingSponsorship}
              aria-label={t("requestSponsor") || "Request Sponsor"}
              onClick={() => dispatch("requestSponsor")}
            >
              {t("requestSponsor") || "Request Sponsor"}
            </NeoButton>
          </div>
        </NeoCard>
      </section>

      <section className="session-flow" aria-label={t("sessionFlowLabel")}>
        <div className="session-flow__step">
          <span>01</span>
          <strong>{t("sessionFlowKey")}</strong>
          <p>{t("sessionFlowKeyDesc")}</p>
        </div>
        <div className="session-flow__step">
          <span>02</span>
          <strong>{t("sessionFlowSponsor")}</strong>
          <p>{t("sessionFlowSponsorDesc")}</p>
        </div>
        <div className="session-flow__step">
          <span>03</span>
          <strong>{t("sessionFlowConfigure")}</strong>
          <p>{t("sessionFlowConfigureDesc")}</p>
        </div>
      </section>

      <section className="session-workspace">
        <div className="session-main-panel">
          <div className="session-section-heading">
            <div>
              <span>{t("sessionStateLabel")}</span>
              <h3>{t("latestState")}</h3>
            </div>
            <strong>{sessionStatusDisplay || "--"}</strong>
          </div>

          <div className="session-env-grid">
            {environmentItems.map((item) => (
              <div key={item.label} className="session-env-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <NeoCard variant="erobo" className="session-result-card">
            <div className="session-detail-list">
              {detailItems.map((item) => (
                <div key={item.label} className="session-detail-row">
                  <span>{item.label}</span>
                  <strong>
                    {String(item.value ?? (t("notAvailable") || "N/A"))}
                  </strong>
                </div>
              ))}
              {detailItems.length === 0 && (
                <div className="session-empty-state">
                  <span>SK</span>
                  <strong>{t("noDetails")}</strong>
                  <p>{t("sessionEmptyCopy")}</p>
                </div>
              )}
            </div>
          </NeoCard>
        </div>

        <aside className="session-side-rail">
          <NeoCard
            variant="erobo"
            title={t("configureSession")}
            className="session-config-card"
          >
            <div className="session-config-copy">
              <strong>{t("sessionScopeTitle")}</strong>
              <span>{scopeDisplay}</span>
            </div>
            {!canConfigure && (
              <p className="session-hint">{t("configureSessionBlocked")}</p>
            )}
            <div className="session-form">
              <NeoInput
                value={accountSeed}
                label={t("accountSeed") || "Account Seed"}
                placeholder={t("accountSeedPlaceholder") || "Enter seed"}
                onChange={(v: string) => setAccountSeed(v)}
              />
              <NeoInput
                value={sessionPublicKey}
                label={t("sessionPublicKey") || "Session Public Key"}
                placeholder={t("sessionPublicKeyPlaceholder") || "Public key"}
                onChange={(v: string) => setSessionPublicKey(v)}
              />
              <NeoInput
                value={targetContract}
                label={t("targetContract") || "Target Contract"}
                placeholder={t("targetContractPlaceholder") || "Contract hash"}
                onChange={(v: string) => setTargetContract(v)}
              />
              <NeoInput
                value={allowedMethod}
                label={t("allowedMethod") || "Allowed Method"}
                placeholder={t("allowedMethodPlaceholder") || "*"}
                onChange={(v: string) => setAllowedMethod(v)}
              />
              <NeoInput
                value={expiresAt}
                label={t("expiresAt") || "Expires At"}
                placeholder={t("expiresAtPlaceholder") || "Unix timestamp"}
                onChange={(v: string) => setExpiresAt(v)}
              />
              <NeoButton
                variant="primary"
                loading={isSubmitting}
                disabled={!canConfigure}
                aria-label={t("configureSession") || "Configure"}
                onClick={() =>
                  dispatch(
                    "configureSessionKey",
                    accountSeed,
                    sessionPublicKey,
                    targetContract,
                    allowedMethod,
                    expiresAt,
                  )
                }
              >
                {t("configureSession") || "Configure Session"}
              </NeoButton>
            </div>
          </NeoCard>
        </aside>
      </section>
    </div>
  );
}
