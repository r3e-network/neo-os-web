/**
 * PlayArea.tsx - AA Permissions Lab
 *
 * Wallet-style control room for inspecting and rotating AA verifier/hook policy.
 */

import { useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable>;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool } = useStateBindings(state);

  const isRefreshing = bool("isRefreshing");
  const isVerifierBusy = bool("isVerifierBusy");
  const isHookBusy = bool("isHookBusy");
  const currentVerifier = str("currentVerifier", t("notAvailable") || "N/A");
  const currentHook = str("currentHook", t("notAvailable") || "N/A");
  const currentBackupOwner = str(
    "currentBackupOwner",
    t("notAvailable") || "N/A",
  );

  const [accountIdHash, setAccountIdHash] = useState("");
  const [verifierHash, setVerifierHash] = useState("");
  const [verifierParamsHex, setVerifierParamsHex] = useState("");
  const [hookHash, setHookHash] = useState("");

  const accountReady = Boolean(accountIdHash.trim());
  const canRefresh = accountReady && !isRefreshing;
  const canUpdateVerifier =
    accountReady && Boolean(verifierHash.trim()) && !isVerifierBusy;
  const canUpdateHook = accountReady && Boolean(hookHash.trim()) && !isHookBusy;
  const accountDisplay = accountReady
    ? accountIdHash.trim()
    : t("notAvailable");

  const detailItems = [
    {
      label: t("currentVerifier") || "Current Verifier",
      value: currentVerifier,
    },
    { label: t("currentHook") || "Current Hook", value: currentHook },
    {
      label: t("currentBackupOwner") || "Backup Owner",
      value: currentBackupOwner,
    },
  ];

  return (
    <div className="aa-permissions-play-area">
      <section className="permissions-hero">
        <div className="permissions-hero__copy">
          <h2>{t("permissionsHeroTitle")}</h2>
          <p>{t("permissionsHeroCopy")}</p>
          <div
            className="permissions-hero__metrics"
            aria-label={t("permissionsMetricsLabel")}
          >
            <div className="permissions-metric">
              <span>{t("permissionsMetricVerifier")}</span>
              <strong>{currentVerifier}</strong>
            </div>
            <div className="permissions-metric">
              <span>{t("permissionsMetricHook")}</span>
              <strong>{currentHook}</strong>
            </div>
            <div className="permissions-metric">
              <span>{t("permissionsMetricAccount")}</span>
              <strong>{accountDisplay}</strong>
            </div>
          </div>
        </div>

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
            <NeoButton
              variant="primary"
              loading={isRefreshing}
              disabled={!canRefresh}
              aria-label={t("inspect") || "Inspect"}
              onClick={() => dispatch("refresh", accountIdHash)}
            >
              {t("inspect") || "Inspect"}
            </NeoButton>
          </div>
        </NeoCard>
      </section>

      <section
        className="permissions-flow"
        aria-label={t("permissionsFlowLabel")}
      >
        <div className="permissions-flow__step">
          <span>01</span>
          <strong>{t("permissionsFlowInspect")}</strong>
          <p>{t("permissionsFlowInspectDesc")}</p>
        </div>
        <div className="permissions-flow__step">
          <span>02</span>
          <strong>{t("permissionsFlowVerifier")}</strong>
          <p>{t("permissionsFlowVerifierDesc")}</p>
        </div>
        <div className="permissions-flow__step">
          <span>03</span>
          <strong>{t("permissionsFlowHook")}</strong>
          <p>{t("permissionsFlowHookDesc")}</p>
        </div>
      </section>

      <section className="permissions-workspace">
        <div className="permissions-state-panel">
          <div className="permissions-section-heading">
            <div>
              <span>{t("permissionsStateLabel")}</span>
              <h3>{t("permissionsStateTitle")}</h3>
            </div>
            <strong>
              {accountReady ? t("configured") : t("notAvailable")}
            </strong>
          </div>

          <div className="permissions-detail-grid">
            {detailItems.map((item) => (
              <div key={item.label} className="permissions-detail-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>

          <div className="permissions-risk-note">
            <span>AA</span>
            <div>
              <strong>{t("permissionsRiskTitle")}</strong>
              <p>{t("permissionsRiskCopy")}</p>
            </div>
          </div>
        </div>

        <aside className="permissions-side-rail">
          <NeoCard
            variant="erobo"
            title={t("updateVerifier") || "Update Verifier"}
            className="permissions-operation-card"
          >
            {!canUpdateVerifier && (
              <p className="permissions-hint">{t("verifierUpdateBlocked")}</p>
            )}
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
            </div>
          </NeoCard>

          <NeoCard
            variant="erobo"
            title={t("updateHook") || "Update Hook"}
            className="permissions-operation-card"
          >
            {!canUpdateHook && (
              <p className="permissions-hint">{t("hookUpdateBlocked")}</p>
            )}
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
            </div>
          </NeoCard>
        </aside>
      </section>
    </div>
  );
}
