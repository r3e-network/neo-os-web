/**
 * PlayArea.tsx - AA Permissions Lab
 *
 * Wallet-style control room for inspecting and rotating AA verifier/hook policy.
 */

import { useEffect, useMemo, useState } from "react";
import {
  BadgeCheck,
  Clock3,
  Fingerprint,
  KeyRound,
  Link2,
  RefreshCw,
  ShieldCheck,
  SlidersHorizontal,
  WalletCards,
} from "lucide-react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { StateView } from "@shared/components";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { getPermissionsLaunchDefaults } from "./launch";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

export default function PlayArea({
  t,
  state,
  dispatch,
  launchContext,
}: PlayAreaProps) {
  const { str, bool, num } = useStateBindings(state);
  const launchDefaults = useMemo(
    () => getPermissionsLaunchDefaults(launchContext),
    [launchContext],
  );

  const PLACEHOLDER = "—";
  const isRefreshing = bool("isRefreshing");
  const isVerifierBusy = bool("isVerifierBusy");
  const isHookBusy = bool("isHookBusy");
  const currentVerifier = str("currentVerifier", PLACEHOLDER);
  const currentHook = str("currentHook", PLACEHOLDER);
  const currentBackupOwner = str("currentBackupOwner", PLACEHOLDER);
  // True only after a successful read — the "configured" chip and detail grid
  // must reflect fetched state, not merely a typed account id.
  const hasInspected = bool("hasInspected");
  const hasPendingVerifier = bool("hasPendingVerifier");
  const hasPendingHook = bool("hasPendingHook");
  const pendingVerifierUnlockAt = num("pendingVerifierUnlockAt", 0);
  const pendingHookUnlockAt = num("pendingHookUnlockAt", 0);
  const connectedWalletHash = str("connectedWalletDisplay");

  const [accountIdHash, setAccountIdHash] = useState(
    launchDefaults.accountIdHash,
  );
  const [verifierHash, setVerifierHash] = useState(launchDefaults.verifierHash);
  const [verifierParamsHex, setVerifierParamsHex] = useState(
    launchDefaults.verifierParamsHex,
  );
  const [hookHash, setHookHash] = useState(launchDefaults.hookHash);

  useEffect(() => {
    setAccountIdHash(launchDefaults.accountIdHash);
    setVerifierHash(launchDefaults.verifierHash);
    setVerifierParamsHex(launchDefaults.verifierParamsHex);
    setHookHash(launchDefaults.hookHash);
  }, [launchContext.signature, launchDefaults]);

  const accountReady = Boolean(accountIdHash.trim());

  const notAvailable = t("notAvailable");
  const normalize = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === notAvailable || trimmed === "N/A") {
      return PLACEHOLDER;
    }
    return trimmed;
  };

  // The connected wallet must be the account's backup owner to rotate bindings;
  // the contract enforces this, so disable the write CTAs (with guidance) when
  // an inspected backup owner is known and does not match the wallet.
  const walletNormalized = connectedWalletHash.trim().replace(/^0x/i, "").toLowerCase();
  const ownerNormalized = currentBackupOwner.trim().replace(/^0x/i, "").toLowerCase();
  const ownerKnown = hasInspected && /^[0-9a-f]{40}$/.test(ownerNormalized);
  const notBackupOwner =
    Boolean(walletNormalized) && ownerKnown && ownerNormalized !== walletNormalized;

  const canRefresh = accountReady && !isRefreshing;
  const canUpdateVerifier =
    accountReady &&
    Boolean(verifierHash.trim()) &&
    !isVerifierBusy &&
    !notBackupOwner;
  const canUpdateHook =
    accountReady && Boolean(hookHash.trim()) && !isHookBusy && !notBackupOwner;

  // Humanize a pending-update unlock timestamp into a status line. The value is
  // the contract's getPending*UpdateTime, computed as InitiatedAt (Runtime.Time)
  // + ConfigUpdateTimelockMs — i.e. epoch MILLISECONDS, since Neo N3 Runtime.Time
  // is ms. (Treating it as seconds read the unlock ~1000x into the future and
  // never showed "ready".)
  const pendingUnlockText = (unlockAtMs: number): string => {
    if (!unlockAtMs || unlockAtMs <= Date.now()) {
      return t("pendingUnlockReady");
    }
    const when = new Date(unlockAtMs).toLocaleString();
    return t("pendingUnlockAt", { time: when });
  };

  const detailItems = [
    {
      label: t("currentVerifier"),
      value: normalize(currentVerifier),
    },
    { label: t("currentHook"), value: normalize(currentHook) },
    {
      label: t("currentBackupOwner"),
      value: normalize(currentBackupOwner),
    },
  ];

  return (
    <div className="aa-permissions-play-area">
      <section className="permissions-hero">
        <div className="permissions-hero__copy">
          <span className="permissions-hero__badge" aria-hidden="true">
            <KeyRound size={24} />
          </span>
          <div>
            <span className="permissions-hero__eyebrow">
              {t("permissionsHeroEyebrow")}
            </span>
            <h2>{t("permissionsHeroTitle")}</h2>
            <p>{t("permissionsHeroCopy")}</p>
            <span className="permissions-hero__chip">{t("permissionsHeroChip")}</span>
          </div>
        </div>
        <figure className="permissions-hero__visual">
          <img src="./permission-console.jpg" alt={t("permissionsHeroImageAlt")} />
          <figcaption>
            <span>{t("permissionsHeroVisualLabel")}</span>
            <strong>{hasInspected ? t("configured") : t("notInspected")}</strong>
          </figcaption>
        </figure>
        <div className="permissions-hero__metrics" aria-label={t("permissionsMetricsLabel")}>
          <span>
            <Fingerprint size={15} aria-hidden="true" />
            {t("permissionsMetricAccount")}
            <strong>{accountIdHash.trim() || PLACEHOLDER}</strong>
          </span>
          <span>
            <ShieldCheck size={15} aria-hidden="true" />
            {t("permissionsMetricVerifier")}
            <strong>{normalize(currentVerifier)}</strong>
          </span>
          <span>
            <Link2 size={15} aria-hidden="true" />
            {t("permissionsMetricHook")}
            <strong>{normalize(currentHook)}</strong>
          </span>
        </div>
      </section>

      <div className="permissions-grid">
        <div className="permissions-column">
          <NeoCard
            variant="erobo"
            title={t("permissionsCommandTitle")}
            className="permissions-command"
          >
            <div className="permissions-form">
              <div className="permissions-account-card" aria-label={t("permissionsAccountPreview")}>
                <span className="permissions-account-card__icon" aria-hidden="true">
                  <Fingerprint size={26} />
                </span>
                <div className="permissions-account-card__copy">
                  <span>{t("permissionsAccountPreview")}</span>
                  <strong>{accountIdHash.trim() || t("accountPreviewEmpty")}</strong>
                  <p>{t("permissionsRiskCopy")}</p>
                </div>
                <dl className="permissions-account-card__facts">
                  <div>
                    <dt>{t("currentBackupOwner")}</dt>
                    <dd>{normalize(currentBackupOwner)}</dd>
                  </div>
                  <div>
                    <dt>{t("connectedWallet")}</dt>
                    <dd>{connectedWalletHash || PLACEHOLDER}</dd>
                  </div>
                </dl>
              </div>
              <NeoInput
                value={accountIdHash}
                label={t("accountId")}
                hint={t("accountIdHint")}
                placeholder={
                  t("accountIdHashPlaceholder")
                }
                onChange={(v) => setAccountIdHash(v)}
              />
              <div className="permissions-action-grid">
                <NeoButton
                  variant="primary"
                  aria-label={t("connectWallet")}
                  onClick={() => dispatch("connect")}
                >
                  <WalletCards size={17} aria-hidden="true" />
                  {t("connectWallet")}
                </NeoButton>
                <NeoButton
                  variant="secondary"
                  loading={isRefreshing}
                  disabled={!canRefresh}
                  aria-label={t("inspect")}
                  onClick={() => dispatch("refresh", accountIdHash)}
                >
                  <RefreshCw size={17} aria-hidden="true" />
                  {t("inspect")}
                </NeoButton>
              </div>
              {!canRefresh ? (
                <p className="permissions-caption permissions-caption--warn">
                  {t("inspectBlocked")}
                </p>
              ) : (
                <p className="permissions-caption">{t("permissionsRiskCopy")}</p>
              )}
            </div>
          </NeoCard>

          <section className="permissions-state-panel">
            <div className="permissions-section-heading">
              <div>
                <span>{t("permissionsStateLabel")}</span>
                <h3>{t("permissionsStateTitle")}</h3>
              </div>
              {/* Gate on hasInspected (a completed read), not on a typed id —
                  a green "configured" chip must not assert unfetched state. */}
              <strong
                className={`permissions-status${
                  hasInspected ? " permissions-status--active" : ""
                }`}
              >
                {hasInspected ? t("configured") : t("notInspected")}
              </strong>
            </div>

            {hasInspected ? (
              <div className="permissions-detail-list">
                {detailItems.map((item) => (
                  <div key={item.label} className="permissions-detail-row">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            ) : (
              <StateView
                kind="empty"
                className="permissions-empty"
                title={t("permissionsStateEmpty")}
                hint={t("inspectBlocked")}
              />
            )}
          </section>
        </div>

        <div className="permissions-column permissions-column--write">
          <div className="permissions-write-heading">
            <span>{t("permissionsFlowLabel")}</span>
            <h3>{t("permissionsRiskTitle")}</h3>
          </div>

          <div className="permissions-flow-rail" aria-label={t("permissionsFlowLabel")}>
            <span>
              <b>1</b>
              <strong>{t("permissionsFlowInspect")}</strong>
              <small>{t("permissionsFlowInspectDesc")}</small>
            </span>
            <span>
              <b>2</b>
              <strong>{t("writeStagePropose")}</strong>
              <small>{t("twoPhaseExplainer")}</small>
            </span>
            <span>
              <b>3</b>
              <strong>{t("writeStageConfirm")}</strong>
              <small>{t("timelockPurpose")}</small>
            </span>
          </div>

          {notBackupOwner && (
            <p
              className="permissions-caption permissions-caption--warn"
              role="alert"
            >
              {t("notBackupOwner")}
            </p>
          )}

          <NeoCard
            variant="erobo"
            title={t("updateVerifier")}
            className="permissions-operation-card"
          >
            <div className="permissions-form">
              <div className="permissions-operation-intro">
                <span className="permissions-operation-intro__icon" aria-hidden="true">
                  <BadgeCheck size={18} />
                </span>
                <div>
                  <strong>{t("permissionsFlowVerifier")}</strong>
                  <p>{t("permissionsFlowVerifierDesc")}</p>
                </div>
              </div>
              <NeoInput
                value={verifierHash}
                label={t("verifier")}
                placeholder={t("verifierHashPlaceholder")}
                onChange={(v) => setVerifierHash(v)}
              />
              <NeoInput
                value={verifierParamsHex}
                label={t("verifierParams")}
                hint={t("verifierParamsHint")}
                placeholder={t("verifierParamsPlaceholder")}
                onChange={(v) => setVerifierParamsHex(v)}
              />
              <NeoButton
                variant="primary"
                loading={isVerifierBusy}
                disabled={!canUpdateVerifier}
                aria-label={t("updateVerifier")}
                onClick={() =>
                  dispatch(
                    "submitVerifier",
                    accountIdHash,
                    verifierHash,
                    verifierParamsHex,
                  )
                }
              >
                <SlidersHorizontal size={17} aria-hidden="true" />
                {t("updateVerifier")}
              </NeoButton>
              <p className="permissions-caption">{t("proposeVerifierHint")}</p>
              {!canUpdateVerifier && !isVerifierBusy && !notBackupOwner ? (
                <p className="permissions-caption permissions-caption--helper">
                  {t("verifierUpdateBlocked")}
                </p>
              ) : null}
              {/* Second phase: a proposed rotation waits out a timelock, then
                  the owner confirms (or cancels) it. */}
              {hasPendingVerifier && (
                <div className="permissions-pending" role="status">
                  <span className="permissions-pending__title">
                    {t("pendingVerifierTitle")}
                  </span>
                  <span className="permissions-pending__time">
                    {pendingUnlockText(pendingVerifierUnlockAt)}
                  </span>
                  <span className="permissions-pending__purpose">
                    {t("timelockPurpose")}
                  </span>
                  <div className="permissions-pending__actions">
                    <NeoButton
                      variant="primary"
                      loading={isVerifierBusy}
                      disabled={isVerifierBusy}
                      aria-label={t("confirmUpdate")}
                      onClick={() => dispatch("confirmVerifier", accountIdHash)}
                    >
                      {t("confirmUpdate")}
                    </NeoButton>
                    <NeoButton
                      variant="secondary"
                      loading={isVerifierBusy}
                      disabled={isVerifierBusy}
                      aria-label={t("cancelUpdate")}
                      onClick={() => dispatch("cancelVerifier", accountIdHash)}
                    >
                      {t("cancelUpdate")}
                    </NeoButton>
                  </div>
                </div>
              )}
            </div>
          </NeoCard>

          <NeoCard
            variant="erobo"
            title={t("updateHook")}
            className="permissions-operation-card"
          >
            <div className="permissions-form">
              <div className="permissions-operation-intro">
                <span className="permissions-operation-intro__icon" aria-hidden="true">
                  <Clock3 size={18} />
                </span>
                <div>
                  <strong>{t("permissionsFlowHook")}</strong>
                  <p>{t("permissionsFlowHookDesc")}</p>
                </div>
              </div>
              <NeoInput
                value={hookHash}
                label={t("hook")}
                placeholder={t("hookHashPlaceholder")}
                onChange={(v) => setHookHash(v)}
              />
              <NeoButton
                variant="secondary"
                loading={isHookBusy}
                disabled={!canUpdateHook}
                aria-label={t("updateHook")}
                onClick={() => dispatch("submitHook", accountIdHash, hookHash)}
              >
                <Link2 size={17} aria-hidden="true" />
                {t("updateHook")}
              </NeoButton>
              <p className="permissions-caption">{t("proposeHookHint")}</p>
              {!canUpdateHook && !isHookBusy && !notBackupOwner ? (
                <p className="permissions-caption permissions-caption--helper">
                  {t("hookUpdateBlocked")}
                </p>
              ) : null}
              {hasPendingHook && (
                <div className="permissions-pending" role="status">
                  <span className="permissions-pending__title">
                    {t("pendingHookTitle")}
                  </span>
                  <span className="permissions-pending__time">
                    {pendingUnlockText(pendingHookUnlockAt)}
                  </span>
                  <span className="permissions-pending__purpose">
                    {t("timelockPurpose")}
                  </span>
                  <div className="permissions-pending__actions">
                    <NeoButton
                      variant="primary"
                      loading={isHookBusy}
                      disabled={isHookBusy}
                      aria-label={t("confirmUpdate")}
                      onClick={() => dispatch("confirmHook", accountIdHash)}
                    >
                      {t("confirmUpdate")}
                    </NeoButton>
                    <NeoButton
                      variant="secondary"
                      loading={isHookBusy}
                      disabled={isHookBusy}
                      aria-label={t("cancelUpdate")}
                      onClick={() => dispatch("cancelHook", accountIdHash)}
                    >
                      {t("cancelUpdate")}
                    </NeoButton>
                  </div>
                </div>
              )}
            </div>
          </NeoCard>
        </div>
      </div>
    </div>
  );
}
