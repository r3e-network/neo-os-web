/**
 * PlayArea.tsx - Recovery Guardian
 *
 * Wallet-style social recovery workspace with guarded link preparation.
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import {
  isAccountLocator,
  isOptionalHash160,
  isRecoveryExpiryMinutes,
} from "./utils/validation";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  const hasPayload = bool("hasPayload");
  const isLoading = bool("isLoading");
  const isQuerying = bool("isQuerying");
  const renderedPayload = str("renderedPayload", t("notAvailable") || "N/A");

  const accountId = str("accountId", t("notAvailable") || "N/A");
  const verifierHash = str("verifierHash", t("notAvailable") || "N/A");
  const threshold = str("threshold", t("notAvailable") || "N/A");
  const timelock = str("timelock", t("notAvailable") || "N/A");

  const previewUrl = str("previewUrl");
  const credentialUrl = str("credentialUrl");

  const accountAddress = str("accountAddress");
  const verifierHashOverride = str("verifierHashOverride");
  const recoveryNewOwner = str("recoveryNewOwner");
  const recoveryExpiryMinutes = str("recoveryExpiryMinutes", "30");
  const recoveryTemplateId = str("recoveryTemplateId");

  const accountReady = isAccountLocator(accountAddress);
  const ownerReady = isAccountLocator(recoveryNewOwner);
  const expiryReady = isRecoveryExpiryMinutes(recoveryExpiryMinutes);
  const verifierReady = isOptionalHash160(verifierHashOverride);
  const canQueryState = accountReady && !isQuerying;
  const canPrepareRecovery =
    accountReady && ownerReady && expiryReady && verifierReady && !isLoading;
  const accountDisplay = accountAddress.trim() || t("notAvailable");
  const expiryDisplay = expiryReady ? recoveryExpiryMinutes : t("notAvailable");

  const setField = (field: string, value: string) => {
    dispatch("setField", field, value);
  };
  const handleAction = (name: string) => dispatch(name);

  const stateItems = [
    { label: t("accountId") || "Account ID", value: accountId },
    { label: t("currentVerifier") || "Verifier", value: verifierHash },
    { label: t("threshold") || "Threshold", value: threshold },
    { label: t("timelockLabel") || "Timelock", value: timelock },
  ];

  const linkActions = [
    {
      key: "openRecoveryPreviewLink",
      label: t("openRecoveryPreview") || "Open Recovery Preview",
    },
    {
      key: "copyRecoveryPreviewLink",
      label: t("copyRecoveryLink") || "Copy Recovery Link",
    },
    {
      key: "shareRecoveryPreviewLink",
      label: t("shareRecoveryLink") || "Share Recovery Link",
    },
    {
      key: "openRecoveryCredentialLink",
      label: t("openRecoveryCredential") || "Open Recovery Credential",
    },
    {
      key: "copyRecoveryCredentialLink",
      label: t("copyRecoveryCredential") || "Copy Recovery Credential",
    },
    {
      key: "shareRecoveryCredentialLink",
      label: t("shareRecoveryCredential") || "Share Recovery Credential",
    },
  ];

  return (
    <div className="guardian-play-area">
      <section className="guardian-hero">
        <div className="guardian-hero__copy">
          <div className="guardian-hero__head">
            <span className="guardian-hero__badge" aria-hidden="true">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
            <h2>{t("guardianHeroTitle")}</h2>
          </div>
          <p>{t("guardianHeroCopy")}</p>
          <div
            className="guardian-hero__metrics"
            aria-label={t("guardianMetricsLabel")}
          >
            <div className="guardian-metric">
              <span>{t("guardianMetricAccount")}</span>
              <strong>{accountDisplay}</strong>
            </div>
            <div className="guardian-metric">
              <span>{t("guardianMetricOwner")}</span>
              <strong>{recoveryNewOwner.trim() || t("notAvailable")}</strong>
            </div>
            <div className="guardian-metric">
              <span>{t("guardianMetricExpiry")}</span>
              <strong>{expiryDisplay}</strong>
            </div>
          </div>
        </div>

        <NeoCard
          variant="erobo"
          title={t("guardianCommandTitle")}
          className="guardian-command"
        >
          <div className="guardian-form">
            <NeoInput
              value={accountAddress}
              onChange={(v) => setField("accountAddress", v)}
              label={t("accountAddress") || "Account Address"}
              hint={t("accountAddressHint")}
              placeholder={t("accountAddressPlaceholder") || "NeoAddress..."}
            />
            {!canQueryState && (
              <p className="guardian-hint">{t("queryBlocked")}</p>
            )}
            <div className="guardian-action-grid">
              <NeoButton
                variant="primary"
                loading={isQuerying}
                disabled={!canQueryState}
                onClick={() => handleAction("queryGuardianState")}
                aria-label={t("queryState") || "Query State"}
              >
                {t("queryState") || "Query State"}
              </NeoButton>
              <NeoButton
                variant="secondary"
                onClick={() => handleAction("openRecoveryDocs")}
                aria-label={t("openRecoveryDocs") || "Recovery Docs"}
              >
                {t("openRecoveryDocs") || "Recovery Docs"}
              </NeoButton>
            </div>
          </div>
        </NeoCard>
      </section>

      <section className="guardian-flow" aria-label={t("guardianFlowLabel")}>
        <div className="guardian-flow__step">
          <span>01</span>
          <strong>{t("guardianFlowRead")}</strong>
          <p>{t("guardianFlowReadDesc")}</p>
        </div>
        <div className="guardian-flow__step">
          <span>02</span>
          <strong>{t("guardianFlowPrepare")}</strong>
          <p>{t("guardianFlowPrepareDesc")}</p>
        </div>
        <div className="guardian-flow__step">
          <span>03</span>
          <strong>{t("guardianFlowCredential")}</strong>
          <p>{t("guardianFlowCredentialDesc")}</p>
        </div>
      </section>

      <section className="guardian-workspace">
        <div className="guardian-state-panel">
          <div className="guardian-section-heading">
            <div>
              <span>{t("guardianStateLabel")}</span>
              <h3>{t("guardianStateTitle")}</h3>
            </div>
            <strong
              className={hasPayload ? undefined : "guardian-state-pill--idle"}
            >
              {hasPayload ? t("latestState") : t("awaitingQuery")}
            </strong>
          </div>

          {hasPayload ? (
            <>
              <div className="guardian-state-grid">
                {stateItems.map((item) => (
                  <div key={item.label} className="guardian-state-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>

              <div className="guardian-payload-card">
                <span>{t("latestState")}</span>
                <pre>{renderedPayload}</pre>
              </div>
            </>
          ) : (
            <div className="guardian-state-empty">
              <span className="guardian-state-empty__badge" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.3-4.3" />
                </svg>
              </span>
              <strong>{t("noStateYet")}</strong>
              <p>{t("noStateHint")}</p>
            </div>
          )}

          <div className="guardian-risk-note">
            <span>SR</span>
            <div>
              <strong>{t("guardianRiskTitle")}</strong>
              <p>{t("guardianRiskCopy")}</p>
            </div>
          </div>
        </div>

        <aside className="guardian-side-rail">
          <NeoCard
            variant="erobo"
            title={t("guardianPrepareTitle")}
            className="guardian-prepare-card"
          >
            <div className="guardian-scope-summary">
              <strong>{t("guardianDraftLabel")}</strong>
              <span>{accountDisplay}</span>
            </div>
            {!canPrepareRecovery && (
              <p className="guardian-hint">{t("recoveryLinkBlocked")}</p>
            )}
            <div className="guardian-form">
              <NeoInput
                value={recoveryNewOwner}
                onChange={(v) => setField("recoveryNewOwner", v)}
                label={t("newOwner") || "New Owner"}
                hint={t("newOwnerHint")}
                placeholder={t("newOwnerPlaceholder") || "NeoAddress..."}
              />
              <NeoInput
                value={recoveryExpiryMinutes}
                onChange={(v) => setField("recoveryExpiryMinutes", v)}
                label={t("recoveryExpiry") || "Expiry (minutes)"}
                hint={t("recoveryExpiryHint")}
                placeholder={t("recoveryExpiryPlaceholder") || "30"}
              />
              <NeoInput
                value={verifierHashOverride}
                onChange={(v) => setField("verifierHashOverride", v)}
                label={t("verifierHash") || "Verifier Hash Override"}
                hint={t("verifierHashHint")}
                placeholder={t("verifierHashPlaceholder") || "0x..."}
              />
              <NeoInput
                value={recoveryTemplateId}
                onChange={(v) => setField("recoveryTemplateId", v)}
                label={t("recoveryTemplateId") || "Template ID"}
                hint={t("recoveryTemplateIdHint")}
                placeholder={
                  t("recoveryTemplateIdPlaceholder") || "Enter template ID"
                }
              />
              <div className="guardian-link-grid">
                {linkActions.map((action) => (
                  <NeoButton
                    key={action.key}
                    variant="secondary"
                    disabled={!canPrepareRecovery}
                    onClick={() => handleAction(action.key)}
                    aria-label={action.label}
                  >
                    {action.label}
                  </NeoButton>
                ))}
              </div>
            </div>
          </NeoCard>

          <div className="guardian-workspace-links">
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openIdentityWorkspace")}
              aria-label={t("openIdentityWorkspace") || "Identity Workspace"}
            >
              {t("openIdentityWorkspace") || "Identity Workspace"}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openAaWorkspace")}
              aria-label={t("openAaWorkspace") || "AA Workspace"}
            >
              {t("openAaWorkspace") || "AA Workspace"}
            </NeoButton>
          </div>
        </aside>
      </section>

      {(previewUrl || credentialUrl) && (
        <section className="guardian-link-preview">
          {previewUrl && (
            <div>
              <span>{t("openRecoveryPreview")}</span>
              <strong>{previewUrl}</strong>
            </div>
          )}
          {credentialUrl && (
            <div>
              <span>{t("openRecoveryCredential")}</span>
              <strong>{credentialUrl}</strong>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
