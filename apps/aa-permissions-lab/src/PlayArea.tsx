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
  const { str, bool } = useStateBindings(state);
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
  const canRefresh = accountReady && !isRefreshing;
  const canUpdateVerifier =
    accountReady && Boolean(verifierHash.trim()) && !isVerifierBusy;
  const canUpdateHook = accountReady && Boolean(hookHash.trim()) && !isHookBusy;

  const notAvailable = t("notAvailable");
  const normalize = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || trimmed === notAvailable || trimmed === "N/A") {
      return PLACEHOLDER;
    }
    return trimmed;
  };

  const detailItems = [
    {
      label: t("currentVerifier") || "Current Verifier",
      value: normalize(currentVerifier),
    },
    { label: t("currentHook") || "Current Hook", value: normalize(currentHook) },
    {
      label: t("currentBackupOwner") || "Backup Owner",
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
            {t("permissionsMetricsLabel")}
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
                label={t("accountId") || "Account ID Hash"}
                hint={t("accountIdHint")}
                placeholder={
                  t("accountIdHashPlaceholder") || "Enter account ID hash"
                }
                onChange={(v) => setAccountIdHash(v)}
              />
              <div className="permissions-action-grid">
                <NeoButton
                  variant="primary"
                  loading={isRefreshing}
                  disabled={!canRefresh}
                  aria-label={t("inspect") || "Inspect"}
                  onClick={() => dispatch("refresh", accountIdHash)}
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
              {accountReady ? (
                <strong className="permissions-status permissions-status--active">
                  {t("configured")}
                </strong>
              ) : null}
            </div>

            {accountReady ? (
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

          <NeoCard
            variant="erobo"
            title={t("updateVerifier") || "Update Verifier"}
            className="permissions-operation-card"
          >
            <div className="permissions-form">
              <NeoInput
                value={verifierHash}
                label={t("verifier") || "Verifier Hash"}
                placeholder={t("verifierHashPlaceholder") || "0x..."}
                onChange={(v) => setVerifierHash(v)}
              />
              <NeoInput
                value={verifierParamsHex}
                label={t("verifierParams") || "Verifier Params (hex)"}
                hint={t("verifierParamsHint")}
                placeholder={t("verifierParamsPlaceholder") || "0x..."}
                onChange={(v) => setVerifierParamsHex(v)}
              />
              <NeoButton
                variant="primary"
                loading={isVerifierBusy}
                disabled={!canUpdateVerifier}
                aria-label={t("updateVerifier") || "Update Verifier"}
                onClick={() =>
                  dispatch(
                    "submitVerifier",
                    accountIdHash,
                    verifierHash,
                    verifierParamsHex,
                  )
                }
              >
                {t("updateVerifier") || "Update Verifier"}
              </NeoButton>
              {!canUpdateVerifier && !isVerifierBusy ? (
                <p className="permissions-caption permissions-caption--warn">
                  {t("verifierUpdateBlocked")}
                </p>
              ) : null}
            </div>
          </NeoCard>

          <NeoCard
            variant="erobo"
            title={t("updateHook") || "Update Hook"}
            className="permissions-operation-card"
          >
            <div className="permissions-form">
              <NeoInput
                value={hookHash}
                label={t("hook") || "Hook Hash"}
                placeholder={t("hookHashPlaceholder") || "0x..."}
                onChange={(v) => setHookHash(v)}
              />
              <NeoButton
                variant="secondary"
                loading={isHookBusy}
                disabled={!canUpdateHook}
                aria-label={t("updateHook") || "Update Hook"}
                onClick={() => dispatch("submitHook", accountIdHash, hookHash)}
              >
                {t("updateHook") || "Update Hook"}
              </NeoButton>
              {!canUpdateHook && !isHookBusy ? (
                <p className="permissions-caption permissions-caption--warn">
                  {t("hookUpdateBlocked")}
                </p>
              ) : null}
            </div>
          </NeoCard>
        </div>
      </div>
    </div>
  );
}
