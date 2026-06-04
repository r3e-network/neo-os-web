/**
 * PlayArea.tsx - AA Account Lab
 *
 * Wallet-style AA account registration and inspection workspace.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import type { MiniAppLaunchContext } from "@shared/utils/launch-params";
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

  const notAvailable = t("notAvailable") || "N/A";

  const isInspecting = bool("isInspecting");
  const isSubmitting = bool("isSubmitting");
  const currentVerifier = str("currentVerifier", notAvailable);
  const currentHook = str("currentHook", notAvailable);
  const currentBackupOwner = str("currentBackupOwner", notAvailable);
  const aaCoreDisplay = str("aaCoreDisplay");
  const defaultVerifierDisplay = str("defaultVerifierDisplay");
  const networkDisplay = str("networkDisplay");

  // Single shared AccountId drives both Inspect (read) and Register (write).
  const [accountId, setAccountId] = useState(launchDefaults.accountIdInput);
  const [verifierHash, setVerifierHash] = useState(
    launchDefaults.verifierHash || defaultVerifierDisplay || "",
  );
  const [verifierParamsHex, setVerifierParamsHex] = useState(
    launchDefaults.verifierParamsHex,
  );
  const [hookHash, setHookHash] = useState(launchDefaults.hookHash);
  const [backupOwner, setBackupOwner] = useState(launchDefaults.backupOwner);
  const [escapeTimelock, setEscapeTimelock] = useState(
    launchDefaults.escapeTimelock || DEFAULT_ESCAPE_TIMELOCK,
  );

  const canInspect = Boolean(accountId.trim()) && !isInspecting;
  const canRegister =
    Boolean(accountId.trim()) &&
    Boolean(verifierHash.trim()) &&
    Boolean(backupOwner.trim()) &&
    Boolean(escapeTimelock.trim()) &&
    !isSubmitting;

  const accountDisplay = accountId.trim() || DASH;
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
    { label: t("currentVerifier") || "Verifier", value: fmt(currentVerifier) },
    { label: t("currentHook") || "Hook", value: fmt(currentHook) },
    {
      label: t("currentBackupOwner") || "Backup Owner",
      value: fmt(currentBackupOwner),
    },
    { label: t("aaCore") || "AA Core", value: fmt(aaCoreDisplay) },
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
            <span>{t("network") || "Network"}</span>
            <strong>{networkDisplay || DASH}</strong>
          </div>
          <div className="account-hero__stat account-hero__stat--wide">
            <span>{t("defaultVerifier") || "Default Verifier"}</span>
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
            t("inspectorTitle") ||
            "Account Inspector"
          }
          className="account-command"
        >
          <div className="account-form">
            <NeoInput
              value={accountId}
              label={t("accountId") || "Account ID"}
              hint={t("accountIdHint")}
              placeholder={t("accountIdPlaceholder") || "Enter account ID hash"}
              onChange={(v) => setAccountId(v)}
            />
            {!canInspect && <p className="account-hint">{t("inspectBlocked")}</p>}
            <div className="account-action-grid">
              <NeoButton
                variant="primary"
                loading={isInspecting}
                disabled={!canInspect}
                aria-label={t("inspect") || "Inspect"}
                onClick={() => dispatch("inspect", accountId)}
              >
                {t("inspect") || "Inspect"}
              </NeoButton>
              <NeoButton
                variant="secondary"
                aria-label={t("connectWallet") || "Connect Wallet"}
                onClick={() => dispatch("connect")}
              >
                {t("connectWallet") || "Connect Wallet"}
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
          title={t("registerTitle") || "Register Account"}
          className="account-register-card"
        >
          <div className="account-form">
            {!canRegister && (
              <p className="account-hint">{t("registerBlocked")}</p>
            )}
            <NeoInput
              value={accountId}
              label={t("accountId") || "Account ID"}
              hint={t("accountIdSharedHint") || t("accountIdHint")}
              placeholder={t("accountIdPlaceholder") || "Enter account ID hash"}
              onChange={(v) => setAccountId(v)}
            />
            <NeoInput
              value={verifierHash}
              label={t("verifier") || "Verifier Hash"}
              hint={t("verifierHint")}
              placeholder={t("verifierPlaceholder") || "0x..."}
              onChange={(v) => setVerifierHash(v)}
            />
            <NeoInput
              value={verifierParamsHex}
              label={t("verifierParams") || "Verifier Params (hex)"}
              hint={t("verifierParamsHint")}
              placeholder={t("verifierParamsPlaceholder") || "0x..."}
              onChange={(v) => setVerifierParamsHex(v)}
            />
            <NeoInput
              value={hookHash}
              label={t("hook") || "Hook Hash"}
              hint={t("hookHint")}
              placeholder={t("hookPlaceholder") || "0x..."}
              onChange={(v) => setHookHash(v)}
            />
            <NeoInput
              value={backupOwner}
              label={t("backupOwner") || "Backup Owner"}
              hint={t("backupOwnerHint")}
              placeholder={t("backupOwnerPlaceholder") || "NeoAddress..."}
              onChange={(v) => setBackupOwner(v)}
            />
            <NeoInput
              value={escapeTimelock}
              label={t("timelock") || "Escape Timelock"}
              hint={t("timelockHint")}
              placeholder={t("timelockPlaceholder") || "2592000"}
              onChange={(v) => setEscapeTimelock(v)}
            />
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
              aria-label={t("register") || "Register"}
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
              {t("register") || "Register"}
            </NeoButton>
          </div>
        </NeoCard>
      </section>
    </div>
  );
}
