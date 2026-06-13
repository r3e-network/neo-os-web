/**
 * PlayArea.tsx - AA Account Lab
 *
 * Wallet-style AA account registration and inspection workspace.
 */

import { useEffect, useMemo, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
import { deriveRegistrationAccountIdHash } from "@shared/utils/aa-account";
import { DEFAULT_ESCAPE_TIMELOCK, getAccountLabLaunchDefaults } from "./launch";
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
  const { str, bool } = useStateBindings(state);
  const launchDefaults = getAccountLabLaunchDefaults(launchContext);

  const notAvailable = t("notAvailable");

  const isInspecting = bool("isInspecting");
  const isSubmitting = bool("isSubmitting");
  const currentVerifier = str("currentVerifier", notAvailable);
  const currentHook = str("currentHook", notAvailable);
  const currentBackupOwner = str("currentBackupOwner", notAvailable);
  const currentEscapeTimelock = str("currentEscapeTimelock", notAvailable);
  const currentEscapeActive = str("currentEscapeActive", notAvailable);
  const aaCoreDisplay = str("aaCoreDisplay");
  const defaultVerifierDisplay = str("defaultVerifierDisplay");
  const networkDisplay = str("networkDisplay");
  // Connected wallet script hash (0x form, "" when disconnected). The backup
  // owner must witness registerAccount, so it has to equal this value.
  const connectedWalletHash = str("connectedWalletDisplay");

  // The inspect AccountId is the literal id stored on-chain (a registration
  // hash). Register derives its own id from the parameters below.
  const [accountId, setAccountId] = useState(launchDefaults.accountIdInput);
  const [verifierHash, setVerifierHash] = useState(
    launchDefaults.verifierHash || defaultVerifierDisplay || "",
  );
  const [verifierParamsHex, setVerifierParamsHex] = useState(
    launchDefaults.verifierParamsHex,
  );
  const [hookHash, setHookHash] = useState(launchDefaults.hookHash);
  const [backupOwner, setBackupOwner] = useState(launchDefaults.backupOwner);
  const [backupOwnerTouched, setBackupOwnerTouched] = useState(false);
  const [escapeTimelock, setEscapeTimelock] = useState(
    launchDefaults.escapeTimelock || DEFAULT_ESCAPE_TIMELOCK,
  );

  // Prefill the backup owner with the connected wallet once (until the user
  // edits it). registerAccount requires the backup owner to sign, so the
  // connected wallet is the only value that will not abort the transaction.
  useEffect(() => {
    if (!backupOwnerTouched && !backupOwner.trim() && connectedWalletHash.trim()) {
      setBackupOwner(connectedWalletHash.trim());
    }
  }, [connectedWalletHash, backupOwnerTouched, backupOwner]);

  // Derive the only accountId registerAccount will accept, mirroring the
  // contract's computeRegistrationAccountId. Recomputed live from the form so
  // the user sees the exact id before paying. Empty until the required fields
  // (verifier, backup owner, valid timelock) are present.
  const derivedRegistrationId = useMemo(() => {
    if (!verifierHash.trim() || !backupOwner.trim() || !escapeTimelock.trim()) {
      return "";
    }
    try {
      return `0x${deriveRegistrationAccountIdHash({
        verifierContractHash: verifierHash,
        verifierParamsHex: verifierParamsHex,
        hookContractHash: hookHash,
        backupOwnerAddress: backupOwner,
        escapeTimelock: Number.parseInt(escapeTimelock.trim(), 10),
      })}`;
    } catch {
      return "";
    }
  }, [verifierHash, verifierParamsHex, hookHash, backupOwner, escapeTimelock]);

  // The backup owner must equal the connected wallet (it witnesses the tx).
  // Compare bare lowercase hashes; only meaningful once a wallet is connected
  // and a backup owner is entered.
  const backupOwnerNormalized = backupOwner.trim().replace(/^0x/i, "").toLowerCase();
  const walletNormalized = connectedWalletHash.trim().replace(/^0x/i, "").toLowerCase();
  const backupOwnerMismatch =
    Boolean(walletNormalized) &&
    Boolean(backupOwnerNormalized) &&
    backupOwnerNormalized !== walletNormalized;

  const canInspect = Boolean(accountId.trim()) && !isInspecting;
  const canRegister =
    Boolean(verifierHash.trim()) &&
    Boolean(backupOwner.trim()) &&
    Boolean(escapeTimelock.trim()) &&
    Boolean(derivedRegistrationId) &&
    !backupOwnerMismatch &&
    !isSubmitting;

  // Explicit flag set by the composable after a successful read, so an account
  // with no verifier still renders the detail grid (not the empty placeholder).
  const hasInspected = bool("hasInspected");
  const verifierUnset = currentVerifier === notAvailable;

  // registerAccount is a real write transaction that follows the host/?network
  // param (defaults to mainnet). Surface an explicit mainnet caution near the
  // Register CTA so the "lab" framing + docs don't imply a low-stakes testnet.
  const networkIsMainnet = networkDisplay.trim().toLowerCase() === "mainnet";
  // After a successful inspect, if the entered account already has a verifier
  // set, a re-register would revert on-chain. Warn before the user pays.
  const alreadyRegistered = hasInspected && !verifierUnset;

  const fmt = (value: string) =>
    !value || value === notAvailable ? DASH : value;

  const detailItems = [
    { label: t("currentVerifier"), value: fmt(currentVerifier) },
    { label: t("currentHook"), value: fmt(currentHook) },
    {
      label: t("currentBackupOwner"),
      value: fmt(currentBackupOwner),
    },
    {
      label: t("currentEscapeTimelock"),
      value: fmt(currentEscapeTimelock),
    },
    {
      label: t("currentEscapeStatus"),
      value: fmt(currentEscapeActive),
    },
    { label: t("aaCore"), value: fmt(aaCoreDisplay) },
  ];

  return (
    <div className="aa-account-play-area">
      <section className="account-hero">
        <div className="account-hero__intro">
          <span className="account-hero__badge" aria-hidden="true">
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
              <path d="M12 2 4 5v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V5l-8-3Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
          </span>
          <div className="account-hero__heading">
            <span className="account-hero__eyebrow">
              {t("accountHeroEyebrow")}
            </span>
            <h2>{t("accountHeroTitle")}</h2>
          </div>
        </div>
        <p>{t("accountHeroCopy")}</p>
        <div
          className="account-hero__meta"
          aria-label={t("accountMetricsLabel")}
        >
          <div className="account-hero__stat">
            <span>{t("network")}</span>
            <strong>{networkDisplay || DASH}</strong>
          </div>
          <div className="account-hero__stat account-hero__stat--wide">
            <span>{t("defaultVerifier")}</span>
            <strong title={defaultVerifierDisplay || undefined}>
              {defaultVerifierDisplay || DASH}
            </strong>
          </div>
        </div>
      </section>

      <section className="account-workspace">
        <NeoCard
          variant="erobo"
          title={
            t("accountInspectorTitle") ||
            t("inspectorTitle")
          }
          className="account-command"
        >
          <div className="account-form">
            <NeoInput
              value={accountId}
              label={t("accountId")}
              hint={t("accountIdHint")}
              placeholder={t("accountIdPlaceholder")}
              onChange={(v) => setAccountId(v)}
            />
            {!canInspect && <p className="account-hint">{t("inspectBlocked")}</p>}
            <div className="account-action-grid">
              <NeoButton
                variant="primary"
                loading={isInspecting}
                disabled={!canInspect}
                aria-label={t("inspect")}
                onClick={() => dispatch("inspect", accountId)}
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

            {hasInspected ? (
              <>
                <div className="account-detail-grid">
                  {detailItems.map((item) => (
                    <div key={item.label} className="account-detail-card">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                    </div>
                  ))}
                </div>
                <p className="account-note account-note--muted">
                  {t("escapeStatusExplainer")}
                </p>
                {verifierUnset && (
                  <p className="account-hint">{t("noVerifierRegistered")}</p>
                )}
              </>
            ) : (
              <p className="account-empty">{t("accountStateTitle")} {DASH}</p>
            )}
          </div>
        </NeoCard>

        <NeoCard
          variant="erobo"
          title={t("registerTitle")}
          className="account-register-card"
        >
          <div className="account-form">
            <p className="account-note">{t("registerPermanentNote")}</p>
            {!canRegister && (
              <p className="account-hint">{t("registerBlocked")}</p>
            )}
            <NeoInput
              value={verifierHash}
              label={t("verifier")}
              hint={t("verifierHint")}
              placeholder={t("verifierPlaceholder")}
              onChange={(v) => setVerifierHash(v)}
            />
            <NeoInput
              value={verifierParamsHex}
              label={t("verifierParams")}
              hint={t("verifierParamsHint")}
              placeholder={t("verifierParamsPlaceholder")}
              onChange={(v) => setVerifierParamsHex(v)}
            />
            <NeoInput
              value={hookHash}
              label={t("hook")}
              hint={t("hookHint")}
              placeholder={t("hookPlaceholder")}
              onChange={(v) => setHookHash(v)}
            />
            <NeoInput
              value={backupOwner}
              label={t("backupOwner")}
              hint={t("backupOwnerHint")}
              placeholder={t("backupOwnerPlaceholder")}
              onChange={(v) => {
                setBackupOwnerTouched(true);
                setBackupOwner(v);
              }}
            />
            {backupOwnerMismatch && (
              <p className="account-caution account-caution--danger" role="alert">
                {t("backupOwnerMustSign")}
              </p>
            )}
            <NeoInput
              value={escapeTimelock}
              label={t("timelock")}
              hint={t("timelockHint")}
              placeholder={t("timelockPlaceholder")}
              onChange={(v) => setEscapeTimelock(v)}
            />
            <p className="account-note account-note--muted">
              {t("timelockExplainer")}
            </p>
            {/* Read-only preview of the deterministic accountId the contract
                computes from these parameters — the only id registerAccount
                accepts (a free seed would always revert). */}
            <div className="account-derived" role="status" aria-live="polite">
              <span className="account-derived__label">
                {t("derivedAccountIdLabel")}
              </span>
              <code className="account-derived__value">
                {derivedRegistrationId || DASH}
              </code>
              <span className="account-derived__hint">
                {t("derivedAccountIdHint")}
              </span>
            </div>
            <p className="account-hint">{t("accountRiskCopy")}</p>
            {alreadyRegistered && (
              <p className="account-caution" role="status">
                {t("alreadyRegisteredCaution")}
              </p>
            )}
            {networkIsMainnet && (
              <p className="account-caution account-caution--danger" role="alert">
                {t("mainnetCaution")}
              </p>
            )}
            <NeoButton
              variant="primary"
              loading={isSubmitting}
              disabled={!canRegister}
              aria-label={t("register")}
              onClick={() =>
                dispatch(
                  "register",
                  accountId,
                  verifierHash,
                  verifierParamsHex,
                  hookHash,
                  backupOwner,
                  escapeTimelock,
                )
              }
            >
              {t("register")}
            </NeoButton>
          </div>
        </NeoCard>
      </section>
    </div>
  );
}
