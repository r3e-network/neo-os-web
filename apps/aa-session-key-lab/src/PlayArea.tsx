/**
 * PlayArea.tsx - AA Session Key Lab
 *
 * Wallet-style session-key workspace for configuring scoped AA permissions.
 */

import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { getSessionKeyLaunchDefaults } from "./launch";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

const DASH = "—";

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { bool, str, val } = useStateBindings(state);
  const launchDefaults = useMemo(
    () => getSessionKeyLaunchDefaults(launchContext),
    [launchContext.signature],
  );

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

  const [accountSeed, setAccountSeed] = useState(launchDefaults.accountSeed);
  const [sessionPublicKey, setSessionPublicKey] = useState(
    launchDefaults.sessionPublicKey,
  );
  const [targetContract, setTargetContract] = useState(
    launchDefaults.targetContract,
  );
  const [allowedMethod, setAllowedMethod] = useState(
    launchDefaults.allowedMethod,
  );
  const [expiresAt, setExpiresAt] = useState(launchDefaults.expiresAt);
  const [dappId, setDappId] = useState(launchDefaults.dappId);
  const [sponsorAmount, setSponsorAmount] = useState(
    launchDefaults.sponsorAmount,
  );
  const [generatedPrivateKey, setGeneratedPrivateKey] = useState("");
  const [privateKeyCopied, setPrivateKeyCopied] = useState(false);

  useEffect(() => {
    setAccountSeed(launchDefaults.accountSeed);
    setSessionPublicKey(launchDefaults.sessionPublicKey);
    setTargetContract(launchDefaults.targetContract);
    setAllowedMethod(launchDefaults.allowedMethod);
    setExpiresAt(launchDefaults.expiresAt);
    setDappId(launchDefaults.dappId);
    setSponsorAmount(launchDefaults.sponsorAmount);
  }, [launchContext.signature, launchDefaults]);

  const canConfigure =
    Boolean(accountSeed.trim()) &&
    Boolean(sessionPublicKey.trim()) &&
    Boolean(targetContract.trim()) &&
    Boolean(expiresAt.trim()) &&
    !isSubmitting;
  const methodDisplay =
    normalizedAllowedMethod || allowedMethod.trim() || t("anyMethod");

  // A session is only truly configured once the on-chain submit succeeds; the
  // composable reflects that through sessionStatusDisplay === t("configured").
  const isConfigured = sessionStatusDisplay === t("configured");

  const environmentItems = [
    {
      label: t("aaCore") || "AA Core",
      value: aaCoreDisplay || DASH,
    },
    {
      label: t("sessionVerifier") || "Session Verifier",
      value: sessionVerifierDisplay || DASH,
    },
    {
      label: t("derivedAccountId") || "Account ID Hash",
      value: derivedAccountIdHash || DASH,
    },
  ];

  const handleGenerateKey = async () => {
    const result = (await dispatch("generateKey")) as unknown as {
      publicKey?: string;
      privateKey?: string;
    };
    if (result?.publicKey) {
      setSessionPublicKey(result.publicKey);
    }
    if (result?.privateKey) {
      setGeneratedPrivateKey(result.privateKey);
      setPrivateKeyCopied(false);
    }
  };

  const handleCopyPrivateKey = async () => {
    if (!generatedPrivateKey) return;
    await navigator.clipboard?.writeText(generatedPrivateKey);
    setPrivateKeyCopied(true);
  };

  return (
    <div className="session-play-area">
      {/* Hero — the single status surface (Session / Sponsor / Scope) */}
      <section className="session-hero">
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
            <strong>{sessionStatusDisplay || DASH}</strong>
          </div>
          <div className="session-metric">
            <span>{t("sessionMetricSponsor")}</span>
            <strong>{sponsorStatusDisplay || DASH}</strong>
          </div>
          <div className="session-metric session-metric--scope">
            <span>{t("sessionMetricScope")}</span>
            <strong>{methodDisplay}</strong>
          </div>
        </div>
      </section>

      {/* Linear flow: 1) Generate key + sponsorship  2) Configure scope */}
      <section className="session-flow-stack">
        {/* Step 1 — Generate key & check/request sponsorship */}
        <NeoCard
          variant="erobo"
          title={t("sessionCommandTitle")}
          className="session-command"
        >
          <div className="session-command__status">
            <span>{t("wallet") || "Wallet"}</span>
            <strong>{walletDisplay || t("notConnected")}</strong>
          </div>
          <div className="session-action-grid">
            <NeoButton
              variant="primary"
              aria-label={t("generateKey") || "Generate Key"}
              onClick={handleGenerateKey}
            >
              {t("generateKey") || "Generate Key"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              loading={isCheckingSponsorship}
              aria-label={t("checkSponsor") || "Check Sponsor"}
              onClick={() => dispatch("checkSponsor", accountSeed, dappId)}
            >
              {t("checkSponsor") || "Check Sponsor"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              loading={isCheckingSponsorship}
              aria-label={t("requestSponsor") || "Request Sponsor"}
              onClick={() =>
                dispatch("requestSponsor", accountSeed, dappId, sponsorAmount)
              }
            >
              {t("requestSponsor") || "Request Sponsor"}
            </NeoButton>
          </div>
          <div className="session-form session-form--compact">
            <NeoInput
              value={dappId}
              label={t("dappId") || "Paymaster dApp ID"}
              placeholder={
                t("dappIdPlaceholder") || "miniapp-aa-session-key-lab"
              }
              onChange={(v: string) => setDappId(v)}
            />
            <NeoInput
              type="number"
              value={sponsorAmount}
              label={t("sponsorAmount") || "Sponsor Amount"}
              placeholder={t("sponsorAmountPlaceholder") || "0.1"}
              onChange={(v: string) => setSponsorAmount(v)}
            />
          </div>
          {generatedPrivateKey && (
            <div className="session-private-export">
              <span>{t("privateKeyReady")}</span>
              <NeoButton
                variant="secondary"
                aria-label={t("copyPrivateKey") || "Copy Private Key"}
                onClick={handleCopyPrivateKey}
              >
                {privateKeyCopied ? t("copiedPrivateKey") : t("copyPrivateKey")}
              </NeoButton>
            </div>
          )}
        </NeoCard>

        {/* Step 2 — Configure scope + submit (the primary business action) */}
        <NeoCard
          variant="erobo"
          title={t("configureSession")}
          className="session-config-card"
        >
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
      </section>

      {/* Configured summary — only after a successful submit; otherwise a
          single muted empty-state line. */}
      <section className="session-summary">
        <div className="session-section-heading">
          <span>{t("sessionMetricStatus")}</span>
          <h3>{t("latestState")}</h3>
        </div>

        {isConfigured ? (
          <NeoCard variant="erobo" className="session-result-card">
            <div className="session-detail-list">
              {detailItems.map((item) => (
                <div key={item.label} className="session-detail-row">
                  <span>{item.label}</span>
                  <strong>{String(item.value ?? DASH)}</strong>
                </div>
              ))}
            </div>
          </NeoCard>
        ) : (
          <NeoCard variant="erobo" className="session-result-card">
            <div className="session-empty-state">
              <span className="session-empty-state__badge" aria-hidden="true">
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
              </span>
              <p>{t("sessionEmptyCopy")}</p>
            </div>
          </NeoCard>
        )}

        <details className="session-environment">
          <summary>{t("sessionStateLabel")}</summary>
          <div className="session-env-grid">
            {environmentItems.map((item) => (
              <div key={item.label} className="session-env-item">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </details>
      </section>
    </div>
  );
}
