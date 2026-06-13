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
  isOptionalTemplateId,
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
  const isQuerying = bool("isQuerying");
  const renderedPayload = str("renderedPayload", t("digestPlaceholder"));

  const accountId = str("accountId", t("digestPlaceholder"));
  const verifierHash = str("verifierHash", t("digestPlaceholder"));
  const escapeStatus = str("escapeStatus", t("digestPlaceholder"));
  const timelock = str("timelock", t("digestPlaceholder"));
  const backupOwner = str("backupOwnerState", t("digestPlaceholder"));
  const checkedAt = str("checkedAt", t("digestPlaceholder"));
  const networkDefaultVerifier = str("networkDefaultVerifier", t("digestPlaceholder"));
  const escapeTriggeredAt = str("escapeTriggeredAt", t("digestPlaceholder"));

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
  const templateReady = isOptionalTemplateId(recoveryTemplateId);
  const canQueryState = accountReady && !isQuerying;
  const canPrepareRecovery =
    accountReady && ownerReady && expiryReady && verifierReady && templateReady;
  const accountDisplay = accountAddress.trim() || "—";
  const expiryDisplay = expiryReady ? recoveryExpiryMinutes : "—";

  // In-app diagnostic for the optional verifier override: once a guardian state
  // is loaded and a valid override is entered, compare it to the account's
  // bound verifier and badge match/mismatch (case-insensitive Hash160 compare).
  const overrideTrimmed = verifierHashOverride.trim();
  const boundVerifierKnown =
    hasPayload && verifierHash !== t("digestPlaceholder") && verifierHash !== t("verifierNotConfigured");
  const overrideDiagnostic =
    overrideTrimmed.length > 0 && verifierReady && boundVerifierKnown
      ? overrideTrimmed.toLowerCase() === verifierHash.trim().toLowerCase()
        ? { ok: true, label: t("verifierOverrideMatch") }
        : { ok: false, label: t("verifierOverrideMismatch") }
      : null;

  const setField = (field: string, value: string) => {
    dispatch("setField", field, value);
  };
  const handleAction = (name: string) => dispatch(name);

  const showEscapeTriggered =
    hasPayload && escapeTriggeredAt !== t("digestPlaceholder");
  const showNetworkDefaultVerifier =
    hasPayload && networkDefaultVerifier !== t("digestPlaceholder");

  const stateItems = [
    { label: t("accountId"), value: accountId },
    { label: t("currentVerifier"), value: verifierHash },
    { label: t("backupOwner"), value: backupOwner },
    { label: t("escapeStatusLabel"), value: escapeStatus },
    { label: t("timelockLabel"), value: timelock },
    { label: t("checkedAt"), value: checkedAt },
    ...(showEscapeTriggered
      ? [{ label: t("escapeTriggeredAtLabel"), value: escapeTriggeredAt }]
      : []),
    ...(showNetworkDefaultVerifier
      ? [{ label: t("networkDefaultVerifierLabel"), value: networkDefaultVerifier }]
      : []),
  ];

  const linkGroups = [
    {
      title: t("recoveryPreviewGroup"),
      actions: [
        { key: "openRecoveryPreviewLink", label: t("linkActionOpen"), aria: t("openRecoveryPreview"), primary: true },
        { key: "copyRecoveryPreviewLink", label: t("linkActionCopy"), aria: t("copyRecoveryLink"), primary: false },
        { key: "shareRecoveryPreviewLink", label: t("linkActionShare"), aria: t("shareRecoveryLink"), primary: false },
      ],
    },
    {
      title: t("recoveryCredentialGroup"),
      actions: [
        { key: "openRecoveryCredentialLink", label: t("linkActionOpen"), aria: t("openRecoveryCredential"), primary: true },
        { key: "copyRecoveryCredentialLink", label: t("linkActionCopy"), aria: t("copyRecoveryCredential"), primary: false },
        { key: "shareRecoveryCredentialLink", label: t("linkActionShare"), aria: t("shareRecoveryCredential"), primary: false },
      ],
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
            <div className="guardian-hero__heading">
              <span className="guardian-hero__eyebrow">{t("title")}</span>
              <h2>{t("guardianHeroTitle")}</h2>
            </div>
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
              <strong>{recoveryNewOwner.trim() || "—"}</strong>
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
              label={t("accountAddress")}
              hint={t("accountAddressHint")}
              placeholder={t("accountAddressPlaceholder")}
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
                aria-label={t("queryState")}
              >
                {t("queryState")}
              </NeoButton>
              <NeoButton
                variant="secondary"
                onClick={() => handleAction("openRecoveryDocs")}
                aria-label={t("openRecoveryDocs")}
              >
                {t("openRecoveryDocs")}
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
            <span aria-hidden="true">
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
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            </span>
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
                label={t("newOwner")}
                hint={t("newOwnerHint")}
                placeholder={t("newOwnerPlaceholder")}
              />
              <NeoInput
                value={recoveryExpiryMinutes}
                onChange={(v) => setField("recoveryExpiryMinutes", v)}
                label={t("recoveryExpiry")}
                hint={t("recoveryExpiryHint")}
                placeholder={t("recoveryExpiryPlaceholder")}
              />
              <NeoInput
                value={verifierHashOverride}
                onChange={(v) => setField("verifierHashOverride", v)}
                label={t("verifierHash")}
                hint={t("verifierHashHint")}
                placeholder={t("verifierHashPlaceholder")}
              />
              {overrideDiagnostic && (
                <p
                  className={`guardian-verifier-diagnostic guardian-verifier-diagnostic--${
                    overrideDiagnostic.ok ? "match" : "mismatch"
                  }`}
                  role="status"
                >
                  {overrideDiagnostic.label}
                </p>
              )}
              <NeoInput
                value={recoveryTemplateId}
                onChange={(v) => setField("recoveryTemplateId", v)}
                label={t("recoveryTemplateId")}
                hint={t("recoveryTemplateIdHint")}
                placeholder={t("recoveryTemplateIdPlaceholder")}
              />
              <div className="guardian-link-groups">
                {linkGroups.map((group) => (
                  <div key={group.title} className="guardian-link-group">
                    <span className="guardian-link-group__title">{group.title}</span>
                    <div className="guardian-link-row">
                      {group.actions.map((action) => (
                        <NeoButton
                          key={action.key}
                          variant={action.primary ? "primary" : "secondary"}
                          size="sm"
                          className={
                            action.primary
                              ? "guardian-link-btn guardian-link-btn--open"
                              : "guardian-link-btn"
                          }
                          disabled={!canPrepareRecovery}
                          onClick={() => handleAction(action.key)}
                          aria-label={action.aria}
                        >
                          {action.label}
                        </NeoButton>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </NeoCard>

          <div className="guardian-workspace-links">
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openIdentityWorkspace")}
              aria-label={t("openIdentityWorkspace")}
            >
              {t("openIdentityWorkspace")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openAaWorkspace")}
              aria-label={t("openAaWorkspace")}
            >
              {t("openAaWorkspace")}
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
          <p className="guardian-link-preview__note">
            {t("guardianLinkHandoffNote")}
          </p>
        </section>
      )}
    </div>
  );
}
