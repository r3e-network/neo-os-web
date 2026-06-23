/**
 * PlayArea.tsx - AA Account Lab
 *
 * Wallet-style AA account registration and inspection workspace.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { NeoButton, NeoCard, NeoInput } from "@shared/components-react";
import { StateView } from "@shared/components";
import {
  ChevronDown,
  Fingerprint,
  KeyRound,
  Link2,
  Search,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
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
type AccountActionPreview = "inspect" | "register" | "connect";

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
  const [actionPreview, setActionPreview] =
    useState<AccountActionPreview | null>(null);
  const actionPreviewTimeout = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(
    () => () => {
      if (actionPreviewTimeout.current !== null) {
        clearTimeout(actionPreviewTimeout.current);
      }
    },
    [],
  );

  const startActionPreview = (action: AccountActionPreview) => {
    if (actionPreviewTimeout.current !== null) {
      clearTimeout(actionPreviewTimeout.current);
    }
    setActionPreview(action);
    actionPreviewTimeout.current = setTimeout(() => {
      setActionPreview(null);
      actionPreviewTimeout.current = null;
    }, 1300);
  };

  // Prefill the backup owner with the connected wallet once (until the user
  // edits it). registerAccount requires the backup owner to sign, so the
  // connected wallet is the only value that will not abort the transaction.
  useEffect(() => {
    if (
      !backupOwnerTouched &&
      !backupOwner.trim() &&
      connectedWalletHash.trim()
    ) {
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
  const backupOwnerNormalized = backupOwner
    .trim()
    .replace(/^0x/i, "")
    .toLowerCase();
  const walletNormalized = connectedWalletHash
    .trim()
    .replace(/^0x/i, "")
    .toLowerCase();
  const backupOwnerMismatch =
    Boolean(walletNormalized) &&
    Boolean(backupOwnerNormalized) &&
    backupOwnerNormalized !== walletNormalized;

  const canInspect = Boolean(accountId.trim()) && !isInspecting;
  const registerReady =
    Boolean(verifierHash.trim()) &&
    Boolean(backupOwner.trim()) &&
    Boolean(escapeTimelock.trim()) &&
    Boolean(derivedRegistrationId) &&
    !backupOwnerMismatch;
  const canRegister =
    registerReady &&
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
  const isInspectPreview = actionPreview === "inspect";
  const isRegisterPreview = actionPreview === "register";
  const isConnectPreview = actionPreview === "connect";
  const isFlowActive =
    isInspecting || isSubmitting || isInspectPreview || isRegisterPreview;
  const accountFlowStatus = isRegisterPreview || isSubmitting
      ? t("accountStageRegistering")
      : isInspectPreview || isInspecting
        ? t("accountStageInspecting")
        : isConnectPreview
          ? t("accountStageConnecting")
          : registerReady
            ? t("accountStageReady")
            : t("accountStageIdle");
  const accountFlowClassName = [
    "account-flow-stage",
    registerReady ? "account-flow-stage--ready" : "",
    isInspectPreview || isInspecting ? "account-flow-stage--inspecting" : "",
    isRegisterPreview || isSubmitting ? "account-flow-stage--registering" : "",
    isConnectPreview ? "account-flow-stage--connecting" : "",
  ]
    .filter(Boolean)
    .join(" ");

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
    <div
      className={[
        "aa-account-play-area",
        isFlowActive ? "aa-account-play-area--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <section className="account-hero">
        <div className="account-hero__copy">
          <div className="account-hero__intro">
            <span className="account-hero__badge" aria-hidden="true">
              <ShieldCheck />
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
        </div>
        <div
          className="account-hero__visual"
          role="img"
          aria-label={t("accountHeroVisualAlt")}
        >
          <img
            src="./account-control-center.jpg"
            alt=""
            loading="eager"
            decoding="async"
          />
          <span>
            <Fingerprint aria-hidden="true" />
            {t("accountHeroVisualBadge")}
          </span>
        </div>
      </section>

      <section
        className={accountFlowClassName}
        aria-label={t("accountFlowLabel")}
        aria-live="polite"
      >
        <img
          className="account-flow-stage__media"
          src="./account-control-center.jpg"
          alt=""
          loading="lazy"
          decoding="async"
          aria-hidden="true"
        />
        <div className="account-flow-stage__shade" aria-hidden="true" />
        <div className="account-flow-stage__rail" aria-hidden="true">
          <span className="account-flow-stage__node account-flow-stage__node--wallet">
            <Wallet />
          </span>
          <span className="account-flow-stage__route account-flow-stage__route--one" />
          <span className="account-flow-stage__node account-flow-stage__node--verifier">
            <KeyRound />
          </span>
          <span className="account-flow-stage__route account-flow-stage__route--two" />
          <span className="account-flow-stage__node account-flow-stage__node--shell">
            <Fingerprint />
          </span>
          <span className="account-flow-stage__packet">
            <ShieldCheck />
          </span>
        </div>
        <div className="account-flow-stage__copy">
          <small>{t("accountStageEyebrow")}</small>
          <strong>{accountFlowStatus}</strong>
          <span>{t("accountStageCopy")}</span>
        </div>
        <div className="account-flow-stage__steps">
          <span>
            <Search aria-hidden="true" />
            <strong>{t("accountFlowInspect")}</strong>
          </span>
          <span>
            <Link2 aria-hidden="true" />
            <strong>{t("accountFlowRegister")}</strong>
          </span>
          <span>
            <ShieldCheck aria-hidden="true" />
            <strong>{t("accountFlowRecovery")}</strong>
          </span>
        </div>
      </section>

      <section className="account-workspace">
        <NeoCard
          variant="erobo"
          title={t("accountInspectorTitle") || t("inspectorTitle")}
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
            {!canInspect && (
              <p className="account-hint">{t("inspectBlocked")}</p>
            )}
            <div className="account-action-grid">
              <NeoButton
                variant="primary"
                loading={isInspecting}
                disabled={!canInspect}
                aria-label={t("inspect")}
                onClick={() => {
                  startActionPreview("inspect");
                  void dispatch("inspect", accountId);
                }}
              >
                <Search aria-hidden="true" />
                {t("inspect")}
              </NeoButton>
              <NeoButton
                variant="secondary"
                aria-label={t("connectWallet")}
                onClick={() => {
                  startActionPreview("connect");
                  void dispatch("connect");
                }}
              >
                <Wallet aria-hidden="true" />
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
              <StateView
                kind="empty"
                icon={null}
                className="account-empty"
                title={t("accountStateTitle")}
                hint={t("inspectBlocked")}
              />
            )}
          </div>
        </NeoCard>

        <NeoCard
          variant="erobo"
          title={t("registerTitle")}
          className="account-register-card"
        >
          <div className="account-form account-register-form">
            <div className="account-register-intro">
              <p className="account-note">{t("registerPermanentNote")}</p>
            </div>

            <div className="account-register-layout">
              <div className="account-register-fields">
                <section
                  className="account-field-group"
                  aria-label={t("accountFlowRegister")}
                >
                  <div className="account-field-group__head">
                    <span>{t("accountFlowRegister")}</span>
                    <p>{t("accountFlowRegisterDesc")}</p>
                  </div>
                  <NeoInput
                    value={verifierHash}
                    label={t("verifier")}
                    hint={t("verifierHint")}
                    placeholder={t("verifierPlaceholder")}
                    onChange={(v) => setVerifierHash(v)}
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
                    <p
                      className="account-caution account-caution--danger"
                      role="alert"
                    >
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
                  <p className="account-note account-note--muted account-note--compact">
                    {t("timelockExplainer")}
                  </p>
                </section>

                <details className="account-optional">
                  <summary>
                    <span>{t("optionalFieldsSummary")}</span>
                    <ChevronDown
                      className="account-optional__chevron"
                      aria-hidden="true"
                    />
                  </summary>
                  <div className="account-optional__body">
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
                  </div>
                </details>
              </div>

              <aside
                className="account-register-review"
                aria-label={t("accountRiskTitle")}
              >
                <div className="account-register-review__head">
                  <span>{t("accountRiskTitle")}</span>
                  <p>{t("accountRiskCopy")}</p>
                </div>
                {/* Read-only preview of the deterministic accountId the contract
                    computes from these parameters — the only id registerAccount
                    accepts (a free seed would always revert). */}
                <div
                  className="account-derived"
                  role="status"
                  aria-live="polite"
                >
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
                {!registerReady && (
                  <p className="account-hint">{t("registerBlocked")}</p>
                )}
                {alreadyRegistered && (
                  <p className="account-caution" role="status">
                    {t("alreadyRegisteredCaution")}
                  </p>
                )}
                {networkIsMainnet && (
                  <p
                    className="account-caution account-caution--danger"
                    role="alert"
                  >
                    <TriangleAlert
                      className="account-caution__glyph"
                      aria-hidden="true"
                    />
                    <span className="account-caution__text">
                      {t("mainnetCautionLead")}
                      <strong>{t("mainnetCautionEmphasis")}</strong>
                      {t("mainnetCautionTail")}
                    </span>
                  </p>
                )}
                <NeoButton
                  variant="primary"
                  className="account-register-cta"
                  loading={isSubmitting}
                  disabled={!canRegister}
                  aria-label={t("register")}
                  onClick={() => {
                    startActionPreview("register");
                    void dispatch(
                      "register",
                      accountId,
                      verifierHash,
                      verifierParamsHex,
                      hookHash,
                      backupOwner,
                      escapeTimelock,
                    );
                  }}
                >
                  <ShieldCheck aria-hidden="true" />
                  {t("register")}
                </NeoButton>
              </aside>
            </div>
          </div>
        </NeoCard>
      </section>
    </div>
  );
}
