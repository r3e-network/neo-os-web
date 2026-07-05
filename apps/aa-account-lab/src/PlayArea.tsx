/**
 * PlayArea.tsx -- AA Account Lab (v2 scene-driven rebuild)
 *
 * Tool identity (graphite + emerald, clean/technical). The account shell IS the
 * scene: an assembly diagram (verifier + hook + backup owner + escape window)
 * that lights up segment by segment as the draft is completed, plus a live AA
 * Core readout once inspected. Inspect is the primary read; Register is the
 * primary write (guarded). The register form + timelock explainer + mainnet
 * caution are tucked into a drawer so the stage stays clean and primary.
 *
 * Real domain state from useAAAccountLab is bound throughout; the generic
 * "Execute/Ready" template is gone.
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { Clock3, KeyRound, Search, ShieldCheck, Wallet } from "lucide-react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
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

function formatTimelockDays(value: string): string {
  const seconds = Number.parseInt(value, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return "—";
  const days = seconds / 86400;
  return Number.isInteger(days) ? `${days}d` : `${days.toFixed(1)}d`;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool } = useStateBindings(state);

  // Live AA Core read state
  const currentVerifier = str("currentVerifier");
  const currentHook = str("currentHook");
  const currentBackupOwner = str("currentBackupOwner");
  const currentEscapeActive = str("currentEscapeActive");
  const hasInspected = bool("hasInspected");
  const isInspecting = bool("isInspecting");
  const isSubmitting = bool("isSubmitting");
  const connectedWallet = str("connectedWalletDisplay");
  const networkDisplay = str("networkDisplay");
  const aaCoreDisplay = str("aaCoreDisplay");
  const defaultVerifier = str("defaultVerifierDisplay");

  // Draft shell fields (local UI state — the real form lives in the composable,
  // populated by dispatch args; this mirrors it for the assembly preview).
  const [draftAccountId, setDraftAccountId] = useState("");
  const [draftVerifier, setDraftVerifier] = useState(defaultVerifier);
  const [draftHook, setDraftHook] = useState("");
  const [draftBackupOwner, setDraftBackupOwner] = useState("");
  const [draftTimelock, setDraftTimelock] = useState("2592000");
  const [activePlan, setActivePlan] = useState<(typeof ACCOUNT_PLANS)[number]["key"]>("daily");

  useEffect(() => {
    if (defaultVerifier && !draftVerifier.trim()) setDraftVerifier(defaultVerifier);
  }, [defaultVerifier, draftVerifier]);

  useEffect(() => {
    if (connectedWallet && !draftBackupOwner.trim()) setDraftBackupOwner(connectedWallet);
  }, [connectedWallet, draftBackupOwner]);

  // Assembly pulse: lights up each shell segment in sequence on register.
  const [assemblyStep, setAssemblyStep] = useState(0);
  const assemblyTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (assemblyTimeout.current) clearTimeout(assemblyTimeout.current); }, []);

  // Readiness of each shell segment — drives the lit/unlit assembly diagram.
  const seg = useMemo(() => {
    const hasVerifier = /^0x[0-9a-f]{40}$/i.test(draftVerifier.trim()) || draftVerifier.trim().length >= 10;
    const hasHook = draftHook.trim().length === 0 || /^0x[0-9a-f]{40}$/i.test(draftHook.trim()) || draftHook.trim().length >= 10;
    const hasBackup = draftBackupOwner.trim().length >= 6;
    const tl = Number(draftTimelock);
    const hasTimelock = Number.isInteger(tl) && tl > 0;
    return { hasVerifier, hasHook, hasBackup, hasTimelock };
  }, [draftVerifier, draftHook, draftBackupOwner, draftTimelock]);

  const filledCount = [seg.hasVerifier, seg.hasBackup, seg.hasTimelock].filter(Boolean).length;
  const shellReady = filledCount >= 3;
  const shellCharge = Math.max(10, Math.round((filledCount / 3) * 100));
  const escapeActive = /active|进行中/i.test(currentEscapeActive) && !/inactive|未触发|not available/i.test(currentEscapeActive);
  const activePlanDef = ACCOUNT_PLANS.find((plan) => plan.key === activePlan) ?? ACCOUNT_PLANS[0];

  const handleInspect = () => {
    void dispatch("inspect", draftAccountId);
  };
  const handleConnect = () => { void dispatch("connect"); };
  const applyPlan = (plan: typeof ACCOUNT_PLANS[number]) => {
    if (busy) return;
    setActivePlan(plan.key);
    setDraftTimelock(plan.timelock);
    if (defaultVerifier && !draftVerifier.trim()) setDraftVerifier(defaultVerifier);
    if (connectedWallet && !draftBackupOwner.trim()) setDraftBackupOwner(connectedWallet);
  };
  const applyTimelockPreset = (seconds: string) => {
    if (busy) return;
    setDraftTimelock(seconds);
    const matchingPlan = ACCOUNT_PLANS.find((plan) => plan.timelock === seconds);
    if (matchingPlan) setActivePlan(matchingPlan.key);
  };
  const useConnectedWalletAsOwner = () => {
    if (connectedWallet) setDraftBackupOwner(connectedWallet);
  };
  const handleRegister = () => {
    if (!shellReady) return;
    // Sequential assembly pulse, then fire the real register dispatch.
    if (assemblyTimeout.current) clearTimeout(assemblyTimeout.current);
    setAssemblyStep(1);
    const step = (n: number) => {
      setAssemblyStep(n);
      if (n < 4) {
        assemblyTimeout.current = setTimeout(() => step(n + 1), 320);
      } else {
        assemblyTimeout.current = setTimeout(() => {
          setAssemblyStep(0);
          void dispatch(
            "register",
            draftAccountId,
            draftVerifier,
            "",
            draftHook,
            draftBackupOwner,
            draftTimelock,
          );
        }, 360);
      }
    };
    step(1);
  };

  const busy = isInspecting || isSubmitting;
  const shellStatusText = busy
    ? isInspecting ? t("accountStageInspecting") : t("accountStageRegistering")
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
    pulseActive: boolean,
  ) => (
    <div
      className={["aa-scene__seg", `aa-scene__seg--${accent}`, lit ? "is-lit" : "", pulseActive ? "is-pulsing" : ""].filter(Boolean).join(" ")}
      data-ready={lit ? "true" : undefined}
    >
      <span className="aa-scene__seg-label">{label}</span>
      <span className="aa-scene__seg-value">{value || "—"}</span>
    </div>
  );

  const scene = (
    <div className="aa-scene" data-state={busy ? "busy" : hasInspected ? "inspected" : shellReady ? "ready" : "idle"}>
      <div className="aa-scene__diagram" aria-label={t("accountStageEyebrow")}>
        <div className="aa-scene__core">
          <div className={["aa-scene__core-ring", busy ? "is-spinning" : ""].filter(Boolean).join(" ")} />
          <CoinArt size={30} variant="gas" />
          <span className="aa-scene__core-label">{t("accountShellLabel")}</span>
          <strong>{shellStatusText}</strong>
        </div>
        <div className="aa-scene__segments">
          {renderSegment(t("verifier"), compactHash(draftVerifier), seg.hasVerifier, "verifier", assemblyStep === 1)}
          {renderSegment(t("hook"), draftHook ? compactHash(draftHook) : t("noHook"), seg.hasHook, "id", assemblyStep === 2)}
          {renderSegment(t("backupOwner"), compactHash(draftBackupOwner), seg.hasBackup, "backup", assemblyStep === 3)}
          {renderSegment(t("timelock"), formatTimelockDays(draftTimelock), seg.hasTimelock, "escape", assemblyStep === 4)}
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
          {shellStatusText}
        </p>
      </div>
    </div>
  );

  // Live AA Core readout — the inspected verifier/hook/owner/escape state.
  const readout = hasInspected ? [
    { label: t("currentVerifier"), value: compactHash(currentVerifier), accent: true },
    { label: t("currentHook"), value: compactHash(currentHook) },
    { label: t("currentBackupOwner"), value: compactHash(currentBackupOwner) },
    { label: t("currentEscapeStatus"), value: escapeActive ? `⚠ ${currentEscapeActive}` : currentEscapeActive, accent: escapeActive },
  ] : [
    { label: t("network"), value: networkDisplay || "—" },
    { label: t("aaCore"), value: compactHash(aaCoreDisplay) },
    { label: t("walletConnected"), value: connectedWallet ? compactHash(connectedWallet) : t("notConnected") },
    { label: t("accountShellLabel"), value: t("accountShellProgress", { count: filledCount }) },
  ];

  const controls = (
    <div className="aa-controls">
      <figure className="aa-visual-card">
        <img src={ACCOUNT_ART} alt="" aria-hidden="true" loading="eager" decoding="async" />
        <figcaption>
          <span>{t("accountHeroEyebrow")}</span>
          <strong>{t("accountHeroTitle")}</strong>
        </figcaption>
      </figure>
      <section className="aa-plan-panel" aria-label={t("accountPlanTitle")}>
        <header className="aa-plan-panel__head">
          <div>
            <span>{t("accountPlanTitle")}</span>
            <strong>{t(activePlanDef.label)}</strong>
          </div>
          <em>{formatTimelockDays(activePlanDef.timelock)}</em>
        </header>
        <p>{t(activePlanDef.copy)}</p>
        <div className="aa-plan-grid" role="list" aria-label={t("accountPlanTitle")}>
          {ACCOUNT_PLANS.map((plan) => (
            <button
              key={plan.key}
              type="button"
              className={["aa-plan-card", activePlan === plan.key ? "aa-plan-card--active" : null].filter(Boolean).join(" ")}
              onClick={() => applyPlan(plan)}
              disabled={busy}
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
          <button type="button" onClick={useConnectedWalletAsOwner} disabled={!connectedWallet || busy}>
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
                disabled={busy}
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
        titleId="aa-drawer-identity"
      >
        <OpenUiTextField
          className="aa-drawer__field"
          label={`${t("accountId")} · ${t("inspect")}`}
          value={draftAccountId}
          onChange={(e) => setDraftAccountId(e.target.value)}
          placeholder={t("accountIdPlaceholder")}
          hint={t("accountIdHint")}
          mono
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
        titleId="aa-drawer-shell"
      >
        <OpenUiTextField
          className="aa-drawer__field"
          label={t("verifier")}
          value={draftVerifier}
          onChange={(e) => setDraftVerifier(e.target.value)}
          placeholder={t("verifierPlaceholder")}
          mono
        />
        <OpenUiTextField
          className="aa-drawer__field"
          label={t("hook")}
          value={draftHook}
          onChange={(e) => setDraftHook(e.target.value)}
          placeholder={t("hookPlaceholder")}
          mono
        />
      </OpenUiPanel>

      <OpenUiPanel
        className="aa-drawer__panel"
        icon={<KeyRound size={16} />}
        title={t("backupOwner")}
        subtitle={formatTimelockDays(draftTimelock)}
        titleId="aa-drawer-recovery"
      >
        <OpenUiTextField
          className="aa-drawer__field"
          label={t("backupOwner")}
          value={draftBackupOwner}
          onChange={(e) => setDraftBackupOwner(e.target.value)}
          placeholder={t("backupOwnerPlaceholder")}
          mono
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
        />
      </OpenUiPanel>

      <OpenUiNotice
        className="aa-drawer__caution"
        icon={<Clock3 size={16} />}
        title={t("mainnetCaution")}
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
              label: busy
                ? (isInspecting ? "…" : t("accountStageRegistering"))
                : !connectedWallet ? t("connectWallet") : t("register"),
              onClick: !connectedWallet ? handleConnect : handleRegister,
              disabled: Boolean(connectedWallet) && !shellReady,
              loading: busy,
              hint: shellReady || !connectedWallet ? undefined : t("registerBlocked"),
            },
            secondary: [{ label: t("inspect"), onClick: handleInspect, disabled: !draftAccountId.trim() || busy }],
          }}
          drawerToggleLabel={t("registerTitle")}
          drawer={{ title: t("registerTitle"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
