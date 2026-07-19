/**
 * PlayArea.tsx -- AA Account Lab (product-owned account control center)
 *
 * The warm account-control artwork is the primary scene. Recovery strategies,
 * verifier identity, owner and escape window assemble into a deterministic
 * AccountId; exact hashes and inspection stay in the secondary drawer.
 *
 * Real domain state from useAAAccountLab is bound throughout; the generic
 * "Execute/Ready" template is gone.
 */
import { useState, useEffect, useMemo } from "react";
import { AlertTriangle, Clock3, KeyRound, RefreshCw, Search, ShieldCheck, Wallet } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { deriveRegistrationAccountIdHash } from "@shared/utils/aa-account";
import { addressToScriptHash, normalizeScriptHash } from "@shared/utils/neo";
import type { PendingAARegistration } from "./registration-recovery";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
}

function compactHash(value: string): string {
  const v = String(value || "").trim();
  if (!v) return "—";
  if (v.length <= 14) return v;
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

const ACCOUNT_PLANS = [
  { key: "daily", label: "accountPlanDaily", copy: "accountPlanDailyCopy", timelock: "2592000" },
  { key: "fast", label: "accountPlanFast", copy: "accountPlanFastCopy", timelock: "604800" },
  { key: "cold", label: "accountPlanCold", copy: "accountPlanColdCopy", timelock: "7776000" },
] as const;

const TIMELOCK_PRESETS = [
  { key: "7d", seconds: "604800" },
  { key: "30d", seconds: "2592000" },
  { key: "90d", seconds: "7776000" },
] as const;
const ACCOUNT_ART = "account-control-center.webp";
const ACCOUNT_MARK = "logo.webp";

function formatTimelockDays(value: string): string {
  const seconds = Number.parseInt(value, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const days = seconds / 86400;
  return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

function normalizedHash(value: string, allowZero = false): string {
  const trimmed = value.trim();
  if (!trimmed) return allowZero ? "0x0000000000000000000000000000000000000000" : "";
  try {
    const normalized = trimmed.startsWith("N")
      ? addressToScriptHash(trimmed)
      : normalizeScriptHash(trimmed);
    if (!/^0x[0-9a-fA-F]{40}$/.test(normalized)) return "";
    if (!allowZero && /^0x0{40}$/i.test(normalized)) return "";
    return normalized.toLowerCase();
  } catch {
    return "";
  }
}

function sanitizedHex(value: string): string {
  const normalized = value.trim().replace(/^0x/i, "");
  return normalized.length % 2 === 0 && /^[0-9a-f]*$/i.test(normalized) ? normalized : "";
}

function derivedAccountId(
  verifier: string,
  verifierParams: string,
  hook: string,
  backupOwner: string,
  timelock: string,
): string {
  const verifierHash = normalizedHash(verifier);
  const verifierParamsHex = sanitizedHex(verifierParams);
  const hookHash = normalizedHash(hook, true);
  const ownerHash = normalizedHash(backupOwner);
  const seconds = Number(timelock);
  if (
    !verifierHash ||
    !hookHash ||
    !ownerHash ||
    (verifierParams.trim() && !verifierParamsHex) ||
    !Number.isInteger(seconds) ||
    seconds <= 0
  ) return "";
  try {
    return `0x${deriveRegistrationAccountIdHash({
      verifierContractHash: verifierHash,
      verifierParamsHex,
      hookContractHash: hookHash,
      backupOwnerAddress: ownerHash,
      escapeTimelock: seconds,
    })}`.toLowerCase();
  } catch {
    return "";
  }
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, val } = useStateBindings(state);

  // Live AA Core read state
  const currentVerifier = str("currentVerifier");
  const currentHook = str("currentHook");
  const currentBackupOwner = str("currentBackupOwner");
  const currentEscapeActive = str("currentEscapeActive");
  const hasInspected = bool("hasInspected");
  const isInspecting = bool("isInspecting");
  const isSubmitting = bool("isSubmitting");
  const isRecovering = bool("isRecovering");
  const connectedWallet = str("connectedWalletDisplay");
  const networkDisplay = str("networkDisplay");
  const aaCoreDisplay = str("aaCoreDisplay");
  const defaultVerifier = str("defaultVerifierDisplay");
  const launchAccountId = str("launchAccountIdInput");
  const launchVerifier = str("launchVerifierHash");
  const launchVerifierParams = str("launchVerifierParamsHex");
  const launchHook = str("launchHookHash");
  const launchBackupOwner = str("launchBackupOwner");
  const launchTimelock = str("launchEscapeTimelock");
  const inspectedAccountId = str("inspectedAccountId");
  const lastStatus = str("lastStatus", t("statusReady"));
  const lastError = str("lastError");
  const lastSuccess = str("lastSuccess");
  const pendingStorageHealthy = val<boolean>("pendingStorageHealthy", true) ?? true;
  const pendingRegistration = val<PendingAARegistration | null>("pendingRegistration", null);

  // Draft shell fields mirror the composable form; dispatch carries the exact
  // values used by the visual derivation to the registration action.
  const [draftAccountId, setDraftAccountId] = useState(launchAccountId);
  const [draftVerifier, setDraftVerifier] = useState(launchVerifier || defaultVerifier);
  const [draftVerifierParams, setDraftVerifierParams] = useState(launchVerifierParams);
  const [draftHook, setDraftHook] = useState(launchHook);
  const [draftBackupOwner, setDraftBackupOwner] = useState(launchBackupOwner);
  const [draftTimelock, setDraftTimelock] = useState(launchTimelock || "2592000");
  const [activePlan, setActivePlan] = useState<(typeof ACCOUNT_PLANS)[number]["key"]>(() =>
    ACCOUNT_PLANS.find((plan) => plan.timelock === (launchTimelock || "2592000"))?.key ?? "daily",
  );

  useEffect(() => {
    if (defaultVerifier && !draftVerifier.trim()) setDraftVerifier(defaultVerifier);
  }, [defaultVerifier, draftVerifier]);

  useEffect(() => {
    if (connectedWallet && !draftBackupOwner.trim()) setDraftBackupOwner(connectedWallet);
  }, [connectedWallet, draftBackupOwner]);

  // Readiness of each shell segment — drives the lit/unlit assembly diagram.
  const seg = useMemo(() => {
    const verifierHash = normalizedHash(draftVerifier);
    const canonicalWeb3Auth = normalizedHash(defaultVerifier);
    const needsIdentityKey = Boolean(verifierHash && canonicalWeb3Auth && verifierHash === canonicalWeb3Auth);
    const hasIdentityKey = /^04[0-9a-f]{128}$/i.test(sanitizedHex(draftVerifierParams));
    const hasVerifier = Boolean(verifierHash) && (!needsIdentityKey || hasIdentityKey);
    const hasHook = draftHook.trim().length === 0 || /^0x[0-9a-f]{40}$/i.test(draftHook.trim()) || draftHook.trim().length >= 10;
    const hasBackup = draftBackupOwner.trim().length >= 6;
    const tl = Number(draftTimelock);
    const hasTimelock = Number.isInteger(tl) && tl > 0;
    return { hasVerifier, hasHook, hasBackup, hasTimelock, needsIdentityKey, hasIdentityKey };
  }, [draftVerifier, draftVerifierParams, draftHook, draftBackupOwner, draftTimelock, defaultVerifier]);

  const filledCount = [seg.hasVerifier, seg.hasBackup, seg.hasTimelock].filter(Boolean).length;
  const shellReady = filledCount >= 3;
  const shellCharge = Math.max(10, Math.round((filledCount / 3) * 100));
  const escapeActive = /active|进行中/i.test(currentEscapeActive) && !/inactive|未触发|not available/i.test(currentEscapeActive);
  const activePlanDef = ACCOUNT_PLANS.find((plan) => plan.key === activePlan) ?? ACCOUNT_PLANS[0];
  const draftDerivedAccountId = seg.hasVerifier
    ? derivedAccountId(
        draftVerifier,
        draftVerifierParams,
        draftHook,
        draftBackupOwner,
        draftTimelock,
      )
    : "";

  const handleInspect = () => {
    void dispatch("inspect", draftAccountId);
  };
  const handleConnect = () => { void dispatch("connect"); };
  const handleRecover = () => { void dispatch("recoverRegistration"); };
  const applyPlan = (plan: typeof ACCOUNT_PLANS[number]) => {
    if (draftLocked) return;
    setActivePlan(plan.key);
    setDraftTimelock(plan.timelock);
    if (defaultVerifier && !draftVerifier.trim()) setDraftVerifier(defaultVerifier);
    if (connectedWallet && !draftBackupOwner.trim()) setDraftBackupOwner(connectedWallet);
  };
  const applyTimelockPreset = (seconds: string) => {
    if (draftLocked) return;
    setDraftTimelock(seconds);
    const matchingPlan = ACCOUNT_PLANS.find((plan) => plan.timelock === seconds);
    if (matchingPlan) setActivePlan(matchingPlan.key);
  };
  const useConnectedWalletAsOwner = () => {
    if (connectedWallet) setDraftBackupOwner(connectedWallet);
  };
  const handleRegister = () => {
    if (!shellReady || pendingRegistration) return;
    void dispatch(
      "register",
      draftAccountId,
      draftVerifier,
      draftVerifierParams,
      draftHook,
      draftBackupOwner,
      draftTimelock,
    );
  };

  const busy = isInspecting || isSubmitting || isRecovering;
  const draftLocked = busy || Boolean(pendingRegistration);
  const shellStatusText = pendingRegistration
    ? t("registrationPending")
    : busy
    ? isInspecting ? t("accountStageInspecting") : isRecovering ? t("registrationRecovering") : t("accountStageRegistering")
    : shellReady
      ? t("accountStageReady")
      : !seg.hasVerifier
        ? t("accountStageNeedVerifier")
        : !seg.hasBackup
          ? t("accountStageNeedOwner")
          : !seg.hasTimelock
            ? t("accountStageNeedTimelock")
            : t("accountStageIdle");

  // Assembly diagram: four segments (id, verifier, backup owner, escape window)
  // arranged around a central shell core. Each lights up when its field is set.
  const renderSegment = (
    label: string,
    value: string,
    lit: boolean,
    accent: "id" | "verifier" | "backup" | "escape",
    empty = "—",
  ) => (
    <div
      className={["aa-scene__seg", `aa-scene__seg--${accent}`, lit ? "is-lit" : ""].filter(Boolean).join(" ")}
      data-ready={lit ? "true" : undefined}
    >
      <span className="aa-scene__seg-label">{label}</span>
      <span className="aa-scene__seg-value">{value || empty}</span>
    </div>
  );

  const scene = (
    <div className="aa-scene" data-state={pendingRegistration ? "pending" : busy ? "busy" : hasInspected ? "inspected" : shellReady ? "ready" : "idle"}>
      {pendingRegistration && (
        <div className="aa-pending-strip" role="status">
          <Clock3 size={17} aria-hidden="true" />
          <span><strong>{t("registrationPending")}</strong><small>{compactHash(pendingRegistration.txid)}</small></span>
          <button type="button" onClick={connectedWallet ? handleRecover : handleConnect} disabled={isRecovering}>
            {connectedWallet ? <RefreshCw size={15} aria-hidden="true" /> : <Wallet size={15} aria-hidden="true" />}
            {connectedWallet ? t("checkConfirmation") : t("connectToRecover")}
          </button>
        </div>
      )}
      <figure className="aa-scene__visual">
        <img src={ACCOUNT_ART} alt={t("accountHeroTitle")} loading="eager" decoding="async" />
        <figcaption>
          <span>{t("accountHeroEyebrow")}</span>
          <strong>{draftDerivedAccountId ? compactHash(draftDerivedAccountId) : t("derivedAccountPending")}</strong>
        </figcaption>
      </figure>
      <div className="aa-scene__diagram" aria-label={t("accountStageEyebrow")}>
        <div className="aa-scene__core">
          <img className="aa-scene__core-mark" src={ACCOUNT_MARK} alt="" aria-hidden="true" />
          <span className="aa-scene__core-label">{t("accountShellLabel")}</span>
          <strong>{shellStatusText}</strong>
        </div>
        <div className="aa-scene__segments">
          {renderSegment(
            t("derivedAccountIdLabel"),
            draftDerivedAccountId ? compactHash(draftDerivedAccountId) : "",
            Boolean(draftDerivedAccountId),
            "id",
            t("derivedAccountAwait"),
          )}
          {renderSegment(
            t("verifier"),
            seg.needsIdentityKey && !seg.hasIdentityKey ? t("identityKeyRequired") : compactHash(draftVerifier),
            seg.hasVerifier,
            "verifier",
          )}
          {renderSegment(
            t("backupOwner"),
            draftBackupOwner ? compactHash(draftBackupOwner) : "",
            seg.hasBackup,
            "backup",
            t("ownerNotSet"),
          )}
          {renderSegment(t("timelock"), formatTimelockDays(draftTimelock), seg.hasTimelock, "escape")}
        </div>
      </div>
      <div className="aa-scene__status">
        <div>
          <span>{t("accountShellLabel")}</span>
          <strong>{t("accountShellProgress", { count: filledCount })}</strong>
        </div>
        <div className="aa-scene__meter" aria-hidden="true">
          <span style={{ width: `${shellCharge}%` }} />
        </div>
        <p>
          {lastError || lastSuccess || lastStatus || shellStatusText}
        </p>
      </div>
      {!pendingStorageHealthy && (
        <p className="aa-storage-warning" role="alert"><AlertTriangle size={15} /> {t("pendingStorageUnavailable")}</p>
      )}
    </div>
  );

  // Live AA Core readout — the inspected verifier/hook/owner/escape state.
  const readout = hasInspected ? [
    { label: t("accountId"), value: compactHash(inspectedAccountId) },
    { label: t("currentVerifier"), value: compactHash(currentVerifier), accent: true },
    { label: t("currentHook"), value: compactHash(currentHook) },
    { label: t("currentBackupOwner"), value: compactHash(currentBackupOwner) },
    { label: t("currentEscapeStatus"), value: currentEscapeActive, accent: escapeActive },
  ] : [
    { label: t("network"), value: networkDisplay || "—" },
    { label: t("aaCore"), value: compactHash(aaCoreDisplay) },
    { label: t("walletConnected"), value: connectedWallet ? compactHash(connectedWallet) : t("notConnected") },
    { label: t("accountShellLabel"), value: t("accountShellProgress", { count: filledCount }) },
  ];

  const controls = (
    <div className="aa-controls">
      <section className="aa-plan-panel" aria-label={t("accountPlanTitle")}>
        <header className="aa-plan-panel__head">
          <div>
            <span>{t("accountPlanTitle")}</span>
            <strong>{t(activePlanDef.label)}</strong>
          </div>
          <em>{formatTimelockDays(activePlanDef.timelock)}</em>
        </header>
        <p>{t(activePlanDef.copy)}</p>
        {/* WCAG: role="group" (named, no required children) — cards are <button>s, not listitems */}
        <div className="aa-plan-grid" role="group" aria-label={t("accountPlanTitle")}>
          {ACCOUNT_PLANS.map((plan) => (
            <button
              key={plan.key}
              type="button"
              className={["aa-plan-card", activePlan === plan.key ? "aa-plan-card--active" : null].filter(Boolean).join(" ")}
              onClick={() => applyPlan(plan)}
              disabled={draftLocked}
            >
              <span className="aa-plan-card__label">{t(plan.label)}</span>
              <strong>{formatTimelockDays(plan.timelock)}</strong>
              <em>{t(plan.copy)}</em>
            </button>
          ))}
        </div>
      </section>
      <div className="aa-controls__recovery">
        <div className="aa-owner-card">
          <span>{t("backupOwner")}</span>
          <strong>{draftBackupOwner ? compactHash(draftBackupOwner) : t("ownerNotSet")}</strong>
          <button type="button" onClick={useConnectedWalletAsOwner} disabled={!connectedWallet || draftLocked}>
            {t("useConnectedWallet")}
          </button>
        </div>
        <div className="aa-timelock-strip" aria-label={t("recoveryWindow")}>
          <span>{t("recoveryWindow")}</span>
          <div>
            {TIMELOCK_PRESETS.map((preset) => (
              <button
                key={preset.key}
                type="button"
                className={draftTimelock === preset.seconds ? "aa-timelock-chip aa-timelock-chip--active" : "aa-timelock-chip"}
                onClick={() => applyTimelockPreset(preset.seconds)}
                disabled={draftLocked}
              >
                {preset.key}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // Register form lives in the drawer so the stage stays primary/clean. The
  // fields mirror the composable form; dispatch carries them to the chain.
  const drawer = (
    <div className="aa-drawer">
      <OpenUiPanel
        className="aa-drawer__panel aa-drawer__panel--wide"
        icon={<Search size={16} />}
        title={t("advancedAccountFields")}
        subtitle={t("advancedAccountFieldsHint")}
      >
        <OpenUiTextField
          className="aa-drawer__field"
          label={`${t("accountId")} · ${t("inspect")}`}
          value={draftAccountId}
          onChange={(e) => setDraftAccountId(e.target.value)}
          placeholder={t("accountIdPlaceholder")}
          hint={t("accountIdHint")}
          mono
          disabled={draftLocked}
        />
        {!connectedWallet && (
          <button type="button" className="aa-drawer__connect mx2-btn mx2-btn--ghost" onClick={handleConnect}>
            <Wallet size={15} /> {t("connectWallet")}
          </button>
        )}
      </OpenUiPanel>

      <OpenUiPanel
        className="aa-drawer__panel"
        icon={<ShieldCheck size={16} />}
        title={t("accountShellLabel")}
        subtitle={t("accountShellProgress", { count: filledCount })}
      >
        <OpenUiTextField
          className="aa-drawer__field"
          label={t("verifier")}
          value={draftVerifier}
          onChange={(e) => setDraftVerifier(e.target.value)}
          placeholder={t("verifierPlaceholder")}
          mono
          disabled={draftLocked}
        />
        <OpenUiTextField
          className="aa-drawer__field"
          label={t("verifierParams")}
          value={draftVerifierParams}
          onChange={(e) => setDraftVerifierParams(e.target.value)}
          placeholder={t("verifierParamsPlaceholder")}
          hint={seg.needsIdentityKey ? t("web3AuthPublicKeyHint") : t("verifierParamsHint")}
          mono
          disabled={draftLocked}
        />
        <OpenUiTextField
          className="aa-drawer__field"
          label={t("hook")}
          value={draftHook}
          onChange={(e) => setDraftHook(e.target.value)}
          placeholder={t("hookPlaceholder")}
          mono
          disabled={draftLocked}
        />
      </OpenUiPanel>

      <OpenUiPanel
        className="aa-drawer__panel"
        icon={<KeyRound size={16} />}
        title={t("backupOwner")}
        subtitle={formatTimelockDays(draftTimelock)}
      >
        <OpenUiTextField
          className="aa-drawer__field"
          label={t("backupOwner")}
          value={draftBackupOwner}
          onChange={(e) => setDraftBackupOwner(e.target.value)}
          placeholder={t("backupOwnerPlaceholder")}
          mono
          disabled={draftLocked}
        />
        <OpenUiTextField
          className="aa-drawer__field"
          label={`${t("timelock")} (s)`}
          value={draftTimelock}
          onChange={(e) => setDraftTimelock(e.target.value)}
          placeholder={t("timelockPlaceholder")}
          hint={t("timelockExplainer")}
          inputMode="numeric"
          mono
          disabled={draftLocked}
        />
      </OpenUiPanel>

      <OpenUiNotice
        className="aa-drawer__caution"
        icon={<Clock3 size={16} />}
        title={t("networkWriteCaution", { network: networkDisplay || t("network") })}
        type="warning"
      />
    </div>
  );

  return (
    <div className="aa-play-area mx2 mx2-cat-tool">
      <OpenUiProvider>
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("accountHeroEyebrow"),
            title: t("accountHeroTitle"),
            subtitle: t("accountStageCopy"),
          }}
          scene={<div className="aa-workspace">{scene}{controls}</div>}
          score={readout}
          actions={{
            primary: {
              label: isRecovering
                ? t("registrationRecovering")
                : pendingRegistration
                  ? connectedWallet ? t("checkConfirmation") : t("connectToRecover")
                : busy
                ? (isInspecting ? t("accountStageInspecting") : t("accountStageRegistering"))
                : !connectedWallet ? t("connectWallet") : t("register"),
              onClick: pendingRegistration
                ? connectedWallet ? handleRecover : handleConnect
                : !connectedWallet ? handleConnect : handleRegister,
              disabled: busy || (!pendingRegistration && Boolean(connectedWallet) && !shellReady),
              loading: busy,
              hint: pendingRegistration
                ? t("registrationPendingHint")
                : shellReady || !connectedWallet ? undefined : t("registerBlocked"),
            },
            secondary: [{ label: t("inspect"), onClick: handleInspect, disabled: !draftAccountId.trim() || draftLocked }],
          }}
          drawerToggleLabel={t("registerTitle")}
          drawer={{ title: t("registerTitle"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
