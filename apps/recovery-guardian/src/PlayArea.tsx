/**
 * PlayArea.tsx - Recovery Guardian
 *
 * Wallet-style social recovery workspace with guarded link preparation.
 */

import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  FileCheck2,
  KeyRound,
  Search,
  Share2,
  ShieldCheck,
} from "lucide-react";
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
  const networkDefaultVerifier = str(
    "networkDefaultVerifier",
    t("digestPlaceholder"),
  );
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
  const overrideTrimmed = verifierHashOverride.trim();
  const queryRouteState = isQuerying
    ? "querying"
    : hasPayload
      ? "ready"
      : accountReady
        ? "armed"
        : "idle";
  const prepareRouteState = canPrepareRecovery
    ? "ready"
    : hasPayload
      ? "draft"
      : "locked";
  const commandStageTitle =
    queryRouteState === "querying"
      ? t("guardianStageQuerying")
      : queryRouteState === "ready"
        ? t("guardianStageReady")
        : queryRouteState === "armed"
          ? t("guardianStageArmed")
          : t("guardianStageIdle");
  const commandStageHint =
    queryRouteState === "querying"
      ? t("guardianStageQueryingHint")
      : queryRouteState === "ready"
        ? t("guardianStageReadyHint")
        : queryRouteState === "armed"
          ? t("guardianStageArmedHint")
          : t("guardianStageIdleHint");
  const passStatus =
    prepareRouteState === "ready"
      ? t("guardianPassReady")
      : prepareRouteState === "draft"
        ? t("guardianPassDraft")
        : t("guardianPassLocked");
  const verifierDisplay = overrideTrimmed
    ? verifierReady
      ? t("guardianPassVerifierCustom")
      : t("guardianPassVerifierInvalid")
    : t("guardianPassVerifierAuto");

  // In-app diagnostic for the optional verifier override: once a guardian state
  // is loaded and a valid override is entered, compare it to the account's
  // bound verifier and badge match/mismatch (case-insensitive Hash160 compare).
  const boundVerifierKnown =
    hasPayload &&
    verifierHash !== t("digestPlaceholder") &&
    verifierHash !== t("verifierNotConfigured");
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
      ? [
          {
            label: t("networkDefaultVerifierLabel"),
            value: networkDefaultVerifier,
          },
        ]
      : []),
  ];

  // Optional verifier override + template id are folded into an "Advanced"
  // disclosure so the core path (new owner + expiry -> generate link) is the
  // visible default. Auto-open it when either field already holds a value or a
  // verifier diagnostic is active, so nothing the operator typed is hidden.
  const advancedOpen =
    overrideTrimmed.length > 0 ||
    recoveryTemplateId.trim().length > 0 ||
    overrideDiagnostic !== null;

  const linkGroups = [
    {
      title: t("recoveryPreviewGroup"),
      open: { key: "openRecoveryPreviewLink", aria: t("openRecoveryPreview") },
      copy: { key: "copyRecoveryPreviewLink", aria: t("copyRecoveryLink") },
      share: { key: "shareRecoveryPreviewLink", aria: t("shareRecoveryLink") },
    },
    {
      title: t("recoveryCredentialGroup"),
      open: {
        key: "openRecoveryCredentialLink",
        aria: t("openRecoveryCredential"),
      },
      copy: {
        key: "copyRecoveryCredentialLink",
        aria: t("copyRecoveryCredential"),
      },
      share: {
        key: "shareRecoveryCredentialLink",
        aria: t("shareRecoveryCredential"),
      },
    },
  ];

  const copyIcon = <Copy aria-hidden="true" />;
  const shareIcon = <Share2 aria-hidden="true" />;

  return (
    <div className="guardian-play-area">
      <section className="guardian-hero">
        <div className="guardian-hero__copy">
          <div className="guardian-hero__head">
            <span className="guardian-hero__badge" aria-hidden="true">
              <ShieldCheck />
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
          <div
            className="guardian-hero__visual"
            role="img"
            aria-label={t("guardianHeroVisualAlt")}
          >
            <img
              src="./recovery-command-center.jpg"
              alt=""
              loading="eager"
              decoding="async"
            />
            <span>
              <KeyRound aria-hidden="true" />
              {t("guardianHeroVisualBadge")}
            </span>
          </div>
        </div>

        <NeoCard
          variant="erobo"
          title={t("guardianCommandTitle")}
          className="guardian-command"
        >
          <div className="guardian-form">
            <div
              className={`guardian-command-stage guardian-command-stage--${queryRouteState}`}
              aria-label={t("guardianCommandStageLabel")}
              aria-busy={isQuerying || undefined}
            >
              <div className="guardian-command-stage__copy">
                <span>{t("guardianCommandStageEyebrow")}</span>
                <strong>{commandStageTitle}</strong>
                <p>{commandStageHint}</p>
              </div>
              <div className="guardian-command-stage__route" role="list">
                <span
                  className={accountReady ? "is-ready" : undefined}
                  role="listitem"
                >
                  <ShieldCheck aria-hidden="true" />
                  <small>{t("guardianRouteAccount")}</small>
                  <strong>
                    {accountReady
                      ? t("guardianRouteAccountReady")
                      : t("guardianRouteAccountNeeded")}
                  </strong>
                </span>
                <span
                  className={
                    hasPayload
                      ? "is-ready"
                      : isQuerying
                        ? "is-active"
                        : undefined
                  }
                  role="listitem"
                >
                  <Search aria-hidden="true" />
                  <small>{t("guardianRouteState")}</small>
                  <strong>
                    {isQuerying
                      ? t("guardianRouteStateReading")
                      : hasPayload
                        ? t("guardianRouteStateReady")
                        : t("guardianRouteStateWaiting")}
                  </strong>
                </span>
                <span
                  className={canPrepareRecovery ? "is-ready" : undefined}
                  role="listitem"
                >
                  <KeyRound aria-hidden="true" />
                  <small>{t("guardianRouteHandoff")}</small>
                  <strong>
                    {canPrepareRecovery
                      ? t("guardianRouteLinksReady")
                      : t("guardianRouteLinksLocked")}
                  </strong>
                </span>
              </div>
              <span
                className="guardian-command-stage__packet"
                aria-hidden="true"
              />
            </div>
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
                className={`guardian-query-button${
                  isQuerying ? " guardian-query-button--querying" : ""
                }`}
                disabled={!canQueryState}
                onClick={() => handleAction("queryGuardianState")}
                aria-label={isQuerying ? t("queryingState") : t("queryState")}
                aria-busy={isQuerying || undefined}
              >
                {isQuerying ? (
                  <span className="guardian-query-spinner" aria-hidden="true" />
                ) : (
                  <Search aria-hidden="true" />
                )}
                {isQuerying ? t("queryingState") : t("queryState")}
              </NeoButton>
              <NeoButton
                variant="secondary"
                onClick={() => handleAction("openRecoveryDocs")}
                aria-label={t("openRecoveryDocs")}
              >
                <FileCheck2 aria-hidden="true" />
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
              <div className="guardian-state-empty__head">
                <span
                  className="guardian-state-empty__badge"
                  aria-hidden="true"
                >
                  <Search />
                </span>
                <strong>{t("noStateYet")}</strong>
                <p>{t("noStateHint")}</p>
              </div>
            </div>
          )}

          <div className="guardian-risk-note">
            <span aria-hidden="true">
              <ShieldCheck />
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
            className={
              hasPayload
                ? "guardian-prepare-card"
                : "guardian-prepare-card guardian-prepare-card--locked"
            }
          >
            <div
              className={`guardian-recovery-pass guardian-recovery-pass--${prepareRouteState}`}
              aria-label={t("guardianPassTitle")}
            >
              <div className="guardian-recovery-pass__head">
                <span>{t("guardianPassTitle")}</span>
                <strong>{passStatus}</strong>
              </div>
              <div className="guardian-recovery-pass__grid">
                <span className={ownerReady ? "is-ready" : undefined}>
                  <small>{t("guardianPassOwner")}</small>
                  <strong>
                    {ownerReady
                      ? t("guardianPassOwnerReady")
                      : t("guardianPassOwnerMissing")}
                  </strong>
                </span>
                <span className={expiryReady ? "is-ready" : undefined}>
                  <small>{t("guardianPassExpiry")}</small>
                  <strong>
                    {expiryReady
                      ? t("guardianPassExpiryReady")
                      : t("guardianPassExpiryMissing")}
                  </strong>
                </span>
                <span className={verifierReady ? "is-ready" : undefined}>
                  <small>{t("guardianPassVerifier")}</small>
                  <strong>{verifierDisplay}</strong>
                </span>
              </div>
            </div>
            <div className="guardian-scope-summary">
              <strong>{t("guardianDraftLabel")}</strong>
              <span>{accountDisplay}</span>
            </div>
            {!hasPayload ? (
              <p className="guardian-hint guardian-hint--gate" role="note">
                <span className="guardian-status-dot" aria-hidden="true" />
                {t("preparePreReadHint")}
              </p>
            ) : (
              !canPrepareRecovery && (
                <p className="guardian-hint">{t("recoveryLinkBlocked")}</p>
              )
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

              <details className="guardian-advanced" open={advancedOpen}>
                <summary className="guardian-advanced__summary">
                  <span>{t("advancedOptional")}</span>
                  <ChevronDown
                    className="guardian-advanced__chevron"
                    aria-hidden="true"
                  />
                </summary>
                <div className="guardian-advanced__body">
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
                      <span
                        className="guardian-status-dot"
                        aria-hidden="true"
                      />
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
                </div>
              </details>

              <div className="guardian-link-groups">
                {linkGroups.map((group) => (
                  <div key={group.title} className="guardian-link-group">
                    <span className="guardian-link-group__title">
                      {group.title}
                    </span>
                    <div className="guardian-link-row">
                      <NeoButton
                        variant="primary"
                        size="sm"
                        className="guardian-link-btn guardian-link-btn--open"
                        disabled={!canPrepareRecovery}
                        onClick={() => handleAction(group.open.key)}
                        aria-label={group.open.aria}
                      >
                        <ExternalLink aria-hidden="true" />
                        {t("linkActionOpen")}
                      </NeoButton>
                      <NeoButton
                        variant="secondary"
                        size="sm"
                        className="guardian-link-btn guardian-link-btn--icon"
                        disabled={!canPrepareRecovery}
                        onClick={() => handleAction(group.copy.key)}
                        aria-label={group.copy.aria}
                      >
                        {copyIcon}
                      </NeoButton>
                      <NeoButton
                        variant="secondary"
                        size="sm"
                        className="guardian-link-btn guardian-link-btn--icon"
                        disabled={!canPrepareRecovery}
                        onClick={() => handleAction(group.share.key)}
                        aria-label={group.share.aria}
                      >
                        {shareIcon}
                      </NeoButton>
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
              <ExternalLink aria-hidden="true" />
              {t("openIdentityWorkspace")}
            </NeoButton>
            <NeoButton
              variant="secondary"
              onClick={() => handleAction("openAaWorkspace")}
              aria-label={t("openAaWorkspace")}
            >
              <ExternalLink aria-hidden="true" />
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
