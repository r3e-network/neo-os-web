/**
 * PlayArea.tsx - AA Permissions Lab
 *
 * Wallet-style control room for inspecting and rotating AA verifier/hook policy.
 */

import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
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
    [launchContext.signature],
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

  // Humanize a pending-update unlock timestamp (seconds) into a status line.
  const pendingUnlockText = (unlockAtSeconds: number): string => {
    if (!unlockAtSeconds || unlockAtSeconds <= Math.floor(Date.now() / 1000)) {
      return t("pendingUnlockReady");
    }
    const when = new Date(unlockAtSeconds * 1000).toLocaleString();
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

  const lockGlyph = (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle
        cx="7.5"
        cy="15.5"
        r="4.5"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="m10.8 12.2 8.2-8.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="m16 5 3 3M14 7l3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <div className="aa-permissions-play-area">
      <section className="permissions-hero">
        <span className="permissions-hero__badge" aria-hidden="true">
          {lockGlyph}
        </span>
        <div className="permissions-hero__copy">
          <span className="permissions-hero__eyebrow">
            {t("permissionsHeroEyebrow")}
          </span>
          <h2>{t("permissionsHeroTitle")}</h2>
          <p>{t("permissionsHeroCopy")}</p>
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
                  loading={isRefreshing}
                  disabled={!canRefresh}
                  aria-label={t("inspect")}
                  onClick={() => dispatch("refresh", accountIdHash)}
                >
                  {t("inspect")}
                </NeoButton>
                <NeoButton
                  variant="secondary"
                  aria-label={t("connectWallet")}
                  onClick={() => dispatch("connect")}
                >
                  {t("connectWallet")}
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
              <p className="permissions-empty-line">
                {t("permissionsStateEmpty")}
              </p>
            )}
          </section>
        </div>

        <div className="permissions-column permissions-column--write">
          <div className="permissions-write-heading">
            <span>{t("permissionsFlowLabel")}</span>
            <h3>{t("permissionsRiskTitle")}</h3>
          </div>

          <p className="permissions-caption">{t("twoPhaseExplainer")}</p>

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
                {t("updateVerifier")}
              </NeoButton>
              <p className="permissions-caption">{t("proposeVerifierHint")}</p>
              {!canUpdateVerifier && !isVerifierBusy && !notBackupOwner ? (
                <p className="permissions-caption permissions-caption--warn">
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
                {t("updateHook")}
              </NeoButton>
              <p className="permissions-caption">{t("proposeHookHint")}</p>
              {!canUpdateHook && !isHookBusy && !notBackupOwner ? (
                <p className="permissions-caption permissions-caption--warn">
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
