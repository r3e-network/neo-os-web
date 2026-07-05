import { useEffect, useState } from "react";
import { Clock3, Copy, ExternalLink, FileCheck2, KeyRound, Search, ShieldCheck, SlidersHorizontal, UserRoundCheck } from "lucide-react";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import type { ObservableState } from "@shared/react/context";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import { formatHash } from "@shared/utils/format";
import {
  isAccountLocator,
  isOptionalHash160,
  isOptionalTemplateId,
  isRecoveryExpiryMinutes,
} from "./utils/validation";
import "./PlayArea.scss";

const STAGE_IMAGE = "recovery-command-center.webp";
const EXPIRY_PRESETS = ["15", "30", "60", "240"];

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

function compact(value: string, fallback = "-"): string {
  const trimmed = value.trim();
  return trimmed ? formatHash(trimmed, 6) : fallback;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool } = useStateBindings(state);
  const isQuerying = bool("isQuerying");
  const hasPayload = bool("hasPayload");
  const accountId = str("accountId");
  const verifierHash = str("verifierHash");
  const escapeStatus = str("escapeStatus");
  const timelock = str("timelock");
  const backupOwnerState = str("backupOwnerState");
  const checkedAt = str("checkedAt");
  const networkDefaultVerifier = str("networkDefaultVerifier");
  const escapeTriggeredAt = str("escapeTriggeredAt");
  const renderedPayload = str("renderedPayload");
  const previewUrl = str("previewUrl");
  const credentialUrl = str("credentialUrl");

  const [accountAddress, setAccountAddress] = useState(str("accountAddress"));
  const [newOwner, setNewOwner] = useState(str("recoveryNewOwner"));
  const [expiryMinutes, setExpiryMinutes] = useState(str("recoveryExpiryMinutes", "30"));
  const [verifierOverride, setVerifierOverride] = useState(str("verifierHashOverride"));
  const [templateId, setTemplateId] = useState(str("recoveryTemplateId"));

  useEffect(() => setAccountAddress(str("accountAddress")), [state, str]);
  useEffect(() => setNewOwner(str("recoveryNewOwner")), [state, str]);
  useEffect(() => setExpiryMinutes(str("recoveryExpiryMinutes", "30")), [state, str]);
  useEffect(() => setVerifierOverride(str("verifierHashOverride")), [state, str]);
  useEffect(() => setTemplateId(str("recoveryTemplateId")), [state, str]);

  const setField = (field: string, value: string) => {
    if (field === "accountAddress") setAccountAddress(value);
    if (field === "recoveryNewOwner") setNewOwner(value);
    if (field === "recoveryExpiryMinutes") setExpiryMinutes(value);
    if (field === "verifierHashOverride") setVerifierOverride(value);
    if (field === "recoveryTemplateId") setTemplateId(value);
    state[field]?.set(value);
  };

  const accountReady = isAccountLocator(accountAddress);
  const ownerReady = isAccountLocator(newOwner);
  const expiryReady = isRecoveryExpiryMinutes(expiryMinutes);
  const verifierReady = isOptionalHash160(verifierOverride);
  const templateReady = isOptionalTemplateId(templateId);
  const recoveryPassReady = hasPayload && accountReady && ownerReady && expiryReady && verifierReady && templateReady && Boolean(previewUrl && credentialUrl);

  const stageState = isQuerying
    ? "querying"
    : hasPayload
      ? recoveryPassReady
        ? "ready"
        : "draft"
      : accountReady
        ? "armed"
        : "idle";

  const primary = recoveryPassReady
    ? {
        label: t("openRecoveryPreview"),
        onClick: () => void dispatch("openRecoveryPreviewLink"),
        icon: <ExternalLink size={17} />,
      }
    : {
        label: isQuerying ? t("queryingState") : t("queryState"),
        onClick: () => void dispatch("queryGuardianState"),
        disabled: !accountReady || isQuerying,
        loading: isQuerying,
        icon: <ShieldCheck size={17} />,
        hint: accountReady ? undefined : t("queryBlocked"),
      };

  const scene = (
    <div className="guardian-scene" data-state={stageState}>
      <section className="guardian-command-panel">
        <div className="guardian-command-panel__head">
          <span><Search size={15} /> {t("guardianRouteAccount")}</span>
          <strong>{accountReady ? t("guardianRouteAccountReady") : t("guardianRouteAccountNeeded")}</strong>
        </div>

        <label className={`guardian-account-pass ${accountReady ? "is-valid" : ""}`}>
          <span>{t("accountAddress")}</span>
          <input
            value={accountAddress}
            onChange={(event) => setField("accountAddress", event.target.value)}
            placeholder={t("accountAddressPlaceholder")}
            disabled={isQuerying}
          />
        </label>

        <div className="guardian-route" aria-label={t("guardianCommandStageLabel")}>
          <span className={accountReady ? "is-ready" : ""}>
            <KeyRound size={18} />
            <strong>{t("guardianRouteAccount")}</strong>
            <small>{accountReady ? t("guardianRouteAccountReady") : t("guardianRouteAccountNeeded")}</small>
          </span>
          <span className={hasPayload ? "is-ready" : isQuerying ? "is-working" : ""}>
            <ShieldCheck size={18} />
            <strong>{t("guardianRouteState")}</strong>
            <small>{hasPayload ? t("guardianRouteStateReady") : isQuerying ? t("guardianRouteStateReading") : t("guardianRouteStateWaiting")}</small>
          </span>
          <span className={recoveryPassReady ? "is-ready" : ""}>
            <UserRoundCheck size={18} />
            <strong>{t("guardianRouteHandoff")}</strong>
            <small>{recoveryPassReady ? t("guardianRouteLinksReady") : t("guardianRouteLinksLocked")}</small>
          </span>
        </div>

        <section className="guardian-state-card">
          <small>{t("guardianStateTitle")}</small>
          <strong>
            {stageState === "querying"
              ? t("guardianStageQuerying")
              : stageState === "ready"
                ? t("guardianPassReady")
                : stageState === "draft"
                  ? t("guardianPassDraft")
                  : stageState === "armed"
                    ? t("guardianStageArmed")
                    : t("guardianStageIdle")}
          </strong>
          <span>
            {hasPayload
              ? `${t("currentVerifier")}: ${compact(verifierHash, t("verifierNotConfigured"))}`
              : t("guardianStageIdleHint")}
          </span>
        </section>
      </section>

      <aside className="guardian-pass-panel">
        <figure className="guardian-command-art">
          <img src={STAGE_IMAGE} alt="" aria-hidden="true" loading="eager" decoding="async" />
          <figcaption>{t("guardianCommandStageEyebrow")}</figcaption>
        </figure>

        <section className="guardian-recovery-pass" data-ready={recoveryPassReady}>
          <div className="guardian-recovery-pass__icon" aria-hidden="true">
            <span className="guardian-scene__shield-ring guardian-scene__shield-ring--outer" />
            <span className="guardian-scene__shield-ring guardian-scene__shield-ring--inner" />
            <ShieldCheck size={42} />
          </div>
          <div className="guardian-recovery-pass__body">
            <span>{t("guardianRouteHandoff")}</span>
            <strong>{recoveryPassReady ? t("guardianPassReady") : t("guardianPassLocked")}</strong>
            <dl>
              <div><dt>{t("newOwner")}</dt><dd>{ownerReady ? compact(newOwner) : t("guardianPassOwnerMissing")}</dd></div>
              <div><dt>{t("recoveryExpiry")}</dt><dd>{expiryReady ? `${expiryMinutes}m` : t("guardianPassExpiryMissing")}</dd></div>
              <div><dt>{t("currentVerifier")}</dt><dd>{compact(verifierHash, t("verifierNotConfigured"))}</dd></div>
            </dl>
          </div>
        </section>
      </aside>
    </div>
  );

  const drawer = (
    <OpenUiProvider>
      <div className="guardian-drawer">
        <OpenUiPanel
          className="guardian-drawer__panel guardian-drawer__panel--status"
          icon={<ShieldCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("guardianRiskTitle")}
          subtitle={hasPayload ? t("guardianRouteStateReady") : t("guardianRouteStateWaiting")}
        >
          <OpenUiNotice
            className="guardian-drawer__notice"
            icon={<ShieldCheck size={17} strokeWidth={2.35} aria-hidden="true" />}
            title={hasPayload ? t("guardianStageReady") : t("guardianStageIdle")}
          >
            {t("guardianRiskCopy")}
          </OpenUiNotice>
          <div className="guardian-drawer__actions" aria-label={t("guardianFlowCredential")}>
            {hasPayload ? (
              <>
                <button
                  type="button"
                  className="mx2-btn mx2-btn--ghost"
                  onClick={() => void dispatch("queryGuardianState")}
                  disabled={!accountReady || isQuerying}
                >
                  <ShieldCheck size={16} /> {t("queryState")}
                </button>
                <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("openIdentityWorkspace")}>
                  <ExternalLink size={16} /> {t("openIdentityWorkspace")}
                </button>
              </>
            ) : (
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("openRecoveryDocs")}>
                <ExternalLink size={16} /> {t("openRecoveryDocs")}
              </button>
            )}
          </div>
          <dl className="guardian-facts">
            <div><dt>{t("accountId")}</dt><dd>{compact(accountId, t("digestPlaceholder"))}</dd></div>
            <div><dt>{t("backupOwner")}</dt><dd>{compact(backupOwnerState, t("digestPlaceholder"))}</dd></div>
            <div><dt>{t("escapeStatusLabel")}</dt><dd>{escapeStatus || t("digestPlaceholder")}</dd></div>
            <div><dt>{t("timelockLabel")}</dt><dd>{timelock || t("digestPlaceholder")}</dd></div>
          </dl>
        </OpenUiPanel>

        <OpenUiPanel
          className="guardian-drawer__panel guardian-drawer__panel--handoff"
          icon={<UserRoundCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("guardianPrepareTitle")}
          subtitle={recoveryPassReady ? t("guardianPassReady") : t("guardianPassDraft")}
        >
          <div className="guardian-drawer__field-grid">
            <OpenUiTextField
              className={["guardian-drawer__field", ownerReady ? "is-valid" : "is-invalid"].join(" ")}
              label={t("newOwner")}
              value={newOwner}
              onChange={(event) => setField("recoveryNewOwner", event.target.value)}
              placeholder={t("newOwnerPlaceholder")}
              disabled={isQuerying}
              hint={t("newOwnerHint")}
              mono
            />
            <OpenUiTextField
              className={["guardian-drawer__field", expiryReady ? "is-valid" : "is-invalid"].join(" ")}
              label={t("recoveryExpiry")}
              value={expiryMinutes}
              onChange={(event) => setField("recoveryExpiryMinutes", event.target.value)}
              inputMode="numeric"
              placeholder={t("recoveryExpiryPlaceholder")}
              disabled={isQuerying}
              hint={t("recoveryExpiryHint")}
            />
          </div>
          <div className="guardian-expiry-presets" aria-label={t("recoveryExpiry")}>
            {EXPIRY_PRESETS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                className={expiryMinutes === minutes ? "is-active" : ""}
                onClick={() => setField("recoveryExpiryMinutes", minutes)}
                disabled={isQuerying}
              >
                <Clock3 size={14} /> {minutes}m
              </button>
            ))}
          </div>
        </OpenUiPanel>

        <OpenUiPanel
          className="guardian-drawer__panel guardian-drawer__panel--advanced"
          icon={<SlidersHorizontal size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("advancedOptional")}
          subtitle={verifierReady && templateReady ? t("guardianRouteLinksReady") : t("guardianRouteLinksLocked")}
        >
          <OpenUiTextField
            className={["guardian-drawer__field", verifierReady ? "is-valid" : "is-invalid"].join(" ")}
            label={t("verifierHash")}
            value={verifierOverride}
            onChange={(event) => setField("verifierHashOverride", event.target.value)}
            placeholder={t("verifierHashPlaceholder")}
            hint={t("verifierHashHint")}
            mono
          />
          <OpenUiTextField
            className={["guardian-drawer__field", templateReady ? "is-valid" : "is-invalid"].join(" ")}
            label={t("recoveryTemplateId")}
            value={templateId}
            onChange={(event) => setField("recoveryTemplateId", event.target.value)}
            placeholder={t("recoveryTemplateIdPlaceholder")}
            hint={t("recoveryTemplateIdHint")}
            mono
          />
        </OpenUiPanel>

        <OpenUiPanel
          className="guardian-drawer__panel guardian-drawer__panel--links"
          icon={<ExternalLink size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("recoveryPreviewGroup")}
          subtitle={recoveryPassReady ? t("guardianRouteLinksReady") : t("guardianRouteLinksLocked")}
        >
          <OpenUiNotice
            className="guardian-drawer__notice"
            icon={<FileCheck2 size={17} strokeWidth={2.35} aria-hidden="true" />}
            title={recoveryPassReady ? t("guardianPassReady") : t("guardianPassLocked")}
            type={recoveryPassReady ? "success" : "info"}
          >
            {recoveryPassReady ? t("guardianLinkHandoffNote") : t("recoveryLinkBlocked")}
          </OpenUiNotice>
          <div className="guardian-link-actions">
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("openRecoveryPreviewLink")} disabled={!previewUrl}>
              <ExternalLink size={16} /> {t("linkActionOpen")}
            </button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("copyRecoveryPreviewLink")} disabled={!previewUrl}>
              <Copy size={16} /> {t("linkActionCopy")}
            </button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("copyRecoveryCredentialLink")} disabled={!credentialUrl}>
              <Copy size={16} /> {t("copyRecoveryCredential")}
            </button>
          </div>
        </OpenUiPanel>

        <OpenUiPanel
          className="guardian-drawer__panel guardian-drawer__panel--wide"
          icon={<Search size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("latestState")}
          subtitle={checkedAt || t("guardianRouteStateWaiting")}
        >
          {hasPayload ? (
            <dl className="guardian-facts guardian-facts--wide">
              <div><dt>{t("checkedAt")}</dt><dd>{checkedAt || t("digestPlaceholder")}</dd></div>
              <div><dt>{t("networkDefaultVerifierLabel")}</dt><dd>{compact(networkDefaultVerifier, t("digestPlaceholder"))}</dd></div>
              <div><dt>{t("escapeTriggeredAtLabel")}</dt><dd>{escapeTriggeredAt || t("digestPlaceholder")}</dd></div>
            </dl>
          ) : (
            <OpenUiNotice
              className="guardian-drawer__notice"
              icon={<Search size={17} strokeWidth={2.35} aria-hidden="true" />}
              title={t("noStateHint")}
            />
          )}
          {hasPayload && <pre className="guardian-payload">{renderedPayload}</pre>}
        </OpenUiPanel>
      </div>
    </OpenUiProvider>
  );

  return (
    <div className="recovery-guardian-play-area mx2 mx2-cat-tool">
      <PlayStage
        category="tool"
        stage={{
          eyebrow: t("guardianCommandStageEyebrow"),
          title: t("guardianHeroTitle"),
          subtitle: t("guardianHeroCopy"),
          badges: (
            <span className="mx2-badge" data-tone="accent">
              <span className="mx2-badge__dot" /> {recoveryPassReady ? t("guardianPassReady") : t("guardianPassLocked")}
            </span>
          ),
        }}
        scene={scene}
        score={[
          { label: t("guardianMetricAccount"), value: accountReady ? compact(accountAddress) : t("guardianRouteAccountNeeded"), accent: true },
          { label: t("guardianMetricOwner"), value: ownerReady ? compact(newOwner) : t("guardianPassOwnerMissing") },
          { label: t("guardianMetricExpiry"), value: expiryReady ? `${expiryMinutes}m` : t("guardianPassExpiryMissing") },
        ]}
        actions={{
          primary,
        }}
        drawerToggleLabel={t("guardianPrepareShort")}
        drawer={{ title: t("guardianPrepareTitle"), children: drawer }}
      />
    </div>
  );
}
