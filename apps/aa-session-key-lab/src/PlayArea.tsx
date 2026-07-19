/**
 * AA Session Key Lab — one permission object, one live account, one next step.
 * Raw identifiers and sponsorship remain secondary in the details drawer.
 */
import { useEffect, useMemo, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2/DataPhase";
import {
  OpenUiLiteNotice as OpenUiNotice,
  OpenUiLitePanel as OpenUiPanel,
  OpenUiLiteProvider as OpenUiProvider,
  OpenUiLiteTextField as OpenUiTextField,
} from "@shared/components-react/v2/OpenUiLite";
import {
  Copy,
  Eye,
  EyeOff,
  HandCoins,
  KeyRound,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  UserRoundCheck,
} from "lucide-react";
import { normalizeSessionAccount } from "./session-key-chain";
import {
  DEFAULT_SESSION_ACCOUNT_SEED,
  DEFAULT_SESSION_ALLOWED_METHOD,
  getDefaultSessionExpiryTimestamp,
} from "./launch";
import type { PendingSessionWrite } from "./composables/useAASessionKeyLab";
import "./PlayArea.scss";

interface P {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
}

interface OnChainView {
  decoded: {
    pubKey: string;
    targetContract: string;
    method: string;
    expirySeconds: number;
    expiryDisplay: string;
    spendingLimitGas: string;
    spendingLimitUnlimited: boolean;
    spendingLimitSupported: boolean;
  };
  spentGas: string;
}

const SCOPE_PRESETS = [
  { key: "rewards", label: "sessionPresetRewards", copy: "sessionPresetRewardsCopy", method: DEFAULT_SESSION_ALLOWED_METHOD, spend: "0.1", seconds: 3_600 },
  { key: "mint", label: "sessionPresetMint", copy: "sessionPresetMintCopy", method: "mint", spend: "1", seconds: 86_400 },
  { key: "ops", label: "sessionPresetOps", copy: "sessionPresetOpsCopy", method: "execute", spend: "0", seconds: 604_800 },
] as const;

const EXPIRY_PRESETS = [
  { key: "1h", seconds: 3_600 },
  { key: "24h", seconds: 86_400 },
  { key: "7d", seconds: 604_800 },
] as const;

const SPEND_PRESETS = ["0", "0.1", "1"] as const;
const SESSION_ART = "session-key-control.webp";

/**
 * Middle-elide a long identifier. Returns "" — never an em-dash — for an empty
 * value. "Not supplied yet" is a phase for <PhaseValue> to render as zero-state
 * copy (see `sessionModules` and `readout`), not a character this helper should
 * invent on a permission draft the visitor has not filled in.
 */
function compact(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.length > 16 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text;
}

/**
 * The permission draft is assembled locally, so its fields never have a read in
 * flight: each is either filled ("ready") or still waiting on the visitor
 * ("unavailable"). Shimmering a field that is merely blank would imply pending
 * I/O that does not exist.
 */
function draftPhase(value: string) {
  return resolvePhase({ loading: false, settled: true, hasData: Boolean(value) });
}

function futureTimestamp(seconds: number): string {
  return String(Math.floor(Date.now() / 1000) + seconds);
}

function expiryWindow(value: string): string {
  const expiry = Number.parseInt(value, 10);
  if (!Number.isFinite(expiry)) return "—";
  const remaining = expiry - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return "expired";
  if (remaining < 86_400) return `${Math.max(1, Math.round(remaining / 3_600))}h`;
  return `${Math.max(1, Math.round(remaining / 86_400))}d`;
}

function spendLabel(value: string, t: P["t"]): string {
  return value === "0" || !value ? t("spendUnlimited") : `${value} GAS`;
}

function presetWindow(seconds: number): string {
  return seconds < 86_400 ? `${seconds / 3_600}h` : `${seconds / 86_400}d`;
}

function draftAccountHash(value: string): string {
  return normalizeSessionAccount(value);
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, val } = useStateBindings(state);
  const accountStatus = str("accountReadStatus") || "idle";
  const sessionStatus = str("sessionReadStatus") || "idle";
  const inspectedAccount = str("inspectedAccountIdHash");
  const accountOwner = str("accountOwner");
  const accountVerifier = str("accountVerifier");
  const ownerAuthority = str("ownerAuthorityStatus") || "unverified";
  const network = str("networkDisplay");
  const walletNetwork = str("walletNetwork");
  const sessionVerifier = str("sessionVerifierDisplay");
  const aaCore = str("aaCoreDisplay");
  const sponsorStatus = str("sponsorStatusDisplay");
  const generatedPublicKey = str("generatedPublicKey");
  const generatedPrivateKey = str("generatedPrivateKey");
  const lastError = str("lastError");
  const writePhase = str("writePhase") || "idle";
  const verifierBound = bool("verifierBound");
  const allowanceSupported = bool("allowanceSupported");
  const canConfigure = bool("canConfigure");
  const canRevoke = bool("canRevoke");
  const isSubmitting = bool("isSubmitting");
  const isRevoking = bool("isRevoking");
  const isInspecting = bool("isInspecting");
  const isRecovering = bool("isRecovering");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const onChainView = val<OnChainView>("onChainSessionView");
  const pendingWrite = val<PendingSessionWrite>("pendingWrite");
  const launchAccountId = str("launchAccountId");

  const [draftAccount, setDraftAccount] = useState(launchAccountId || DEFAULT_SESSION_ACCOUNT_SEED);
  const [draftPublicKey, setDraftPublicKey] = useState("");
  const [draftTarget, setDraftTarget] = useState("");
  const [draftMethod, setDraftMethod] = useState(DEFAULT_SESSION_ALLOWED_METHOD);
  const [draftExpiry, setDraftExpiry] = useState(getDefaultSessionExpiryTimestamp);
  const [draftLimit, setDraftLimit] = useState("0.1");
  const [activePreset, setActivePreset] = useState<(typeof SCOPE_PRESETS)[number]["key"]>("rewards");
  const [showSecret, setShowSecret] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [clockSeconds, setClockSeconds] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    if (generatedPublicKey && !draftPublicKey.trim()) setDraftPublicKey(generatedPublicKey);
  }, [generatedPublicKey, draftPublicKey]);

  useEffect(() => {
    setShowSecret(false);
  }, [generatedPrivateKey]);

  useEffect(() => {
    if (sessionStatus !== "active" && sessionStatus !== "expired") setConfirmRevoke(false);
  }, [sessionStatus]);

  useEffect(() => {
    const timer = window.setInterval(() => setClockSeconds(Math.floor(Date.now() / 1000)), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const currentDraftHash = useMemo(() => draftAccountHash(draftAccount), [draftAccount]);
  const accountIsCurrent = Boolean(currentDraftHash && inspectedAccount && currentDraftHash === inspectedAccount);
  const accountReady = accountIsCurrent && accountStatus === "ready";
  const effectiveSessionStatus = sessionStatus === "active" &&
    onChainView?.decoded.expirySeconds && onChainView.decoded.expirySeconds <= clockSeconds
    ? "expired"
    : sessionStatus;
  const liveRecord = accountIsCurrent && (effectiveSessionStatus === "active" || effectiveSessionStatus === "expired");
  const busy = isSubmitting || isRevoking || isInspecting || isRecovering || isCheckingSponsorship;
  const publicKey = onChainView?.decoded.pubKey || draftPublicKey || generatedPublicKey;
  const target = onChainView?.decoded.targetContract || draftTarget;
  const method = onChainView?.decoded.method || draftMethod;
  const expiry = onChainView?.decoded.expiryDisplay || expiryWindow(draftExpiry);
  const allowance = !allowanceSupported
    ? t("allowanceUnavailableTestnet")
    : onChainView?.decoded
      ? onChainView.decoded.spendingLimitUnlimited
        ? t("spendUnlimited")
        : `${onChainView.spentGas || "0"} / ${onChainView.decoded.spendingLimitGas} GAS`
      : spendLabel(draftLimit, t);

  const readiness = {
    account: accountReady && verifierBound,
    key: Boolean(publicKey),
    target: Boolean(draftTarget || onChainView?.decoded.targetContract),
    expiry: /^\d+$/.test(draftExpiry) && Number(draftExpiry) > Math.floor(Date.now() / 1000),
  };
  const readyCount = Object.values(readiness).filter(Boolean).length;
  const scopeReady = readyCount === 4 && ownerAuthority === "owner" && canConfigure;
  const activeScope = SCOPE_PRESETS.find((preset) => preset.key === activePreset) ?? SCOPE_PRESETS[0];

  // Each module carries its own zero-state line. The `scope` row already worked
  // this way (`sessionTargetMissing`); the other three fell through to a literal
  // "—", so a first paint of the permission draft read as three broken values
  // next to one that politely asked for input. `idle` says which piece is still
  // outstanding, which is exactly what this readiness grid exists to report.
  const sessionModules = [
    { key: "account", label: t("sessionObjectAccount"), value: compact(inspectedAccount || currentDraftHash), idle: t("sessionAccountIdle"), ready: readiness.account },
    { key: "owner", label: t("sessionObjectOwner"), value: ownerAuthority === "owner" ? t("ownerVerified") : compact(accountOwner), idle: t("sessionOwnerIdle"), ready: ownerAuthority === "owner" },
    { key: "key", label: t("sessionObjectKey"), value: compact(publicKey), idle: t("sessionKeyIdle"), ready: readiness.key },
    { key: "scope", label: t("sessionObjectScope"), value: target ? `${method}@${compact(target)}` : "", idle: t("sessionTargetMissing"), ready: readiness.target },
    { key: "expiry", label: t("sessionObjectExpiry"), value: expiry, idle: t("sessionExpiryIdle"), ready: readiness.expiry },
    { key: "limit", label: t("sessionObjectAllowance"), value: allowance, idle: t("sessionAllowanceIdle"), ready: !allowanceSupported || Boolean(onChainView) || readiness.expiry },
  ];

  const applyPreset = (preset: (typeof SCOPE_PRESETS)[number]) => {
    if (busy || liveRecord) return;
    setActivePreset(preset.key);
    setDraftMethod(preset.method);
    setDraftLimit(preset.spend);
    setDraftExpiry(futureTimestamp(preset.seconds));
  };

  const handleInspect = () => { void dispatch("inspectSession", draftAccount); };
  const handleConnect = () => { void dispatch("connectOwner", draftAccount); };
  const handleGenerate = () => { void dispatch("generateKey"); };
  const handleRecover = () => { void dispatch("recoverPending"); };
  const handleCopySecret = () => { void dispatch("copyPrivateKey"); };
  const handleConfigure = () => {
    void dispatch(
      "configureSessionKey",
      draftAccount,
      draftPublicKey || generatedPublicKey,
      draftTarget,
      draftMethod,
      draftExpiry,
      draftLimit,
      t(activeScope.label),
    );
  };
  const handleRevoke = () => { void dispatch("revokeSession", draftAccount); };
  const handleCheckSponsor = () => { void dispatch("checkSponsor", draftAccount, ""); };
  const handleRequestSponsor = () => { void dispatch("requestSponsor", draftAccount, "", "0.1"); };

  let primaryLabel = t("inspectAAAccount");
  let primaryAction = handleInspect;
  let primaryDisabled = !currentDraftHash;
  let primaryHint: string | undefined;

  if (pendingWrite) {
    primaryLabel = isRecovering ? t("recoveringSessionWrite") : t("recoverSessionWrite");
    primaryAction = handleRecover;
    primaryDisabled = isRecovering;
    primaryHint = t("recoverSessionWriteHint");
  } else if (!accountIsCurrent || accountStatus === "idle" || accountStatus === "missing" || accountStatus === "unavailable") {
    primaryLabel = isInspecting ? t("inspectingAAAccount") : accountStatus === "missing" && accountIsCurrent ? t("retryAAAccount") : t("inspectAAAccount");
    primaryAction = handleInspect;
    primaryDisabled = isInspecting || !currentDraftHash;
    primaryHint = !currentDraftHash
      ? t("invalidSessionAccountId")
      : accountStatus === "missing" && accountIsCurrent
        ? t("accountMissingHint")
        : undefined;
  } else if (accountReady && ownerAuthority === "disconnected") {
    primaryLabel = t("connectOwnerWallet");
    primaryAction = handleConnect;
    primaryDisabled = busy;
  } else if (accountReady && ownerAuthority === "mismatch") {
    primaryLabel = t("ownerWalletMismatch");
    primaryDisabled = true;
    primaryHint = t("ownerWalletMismatchHint");
  } else if (liveRecord) {
    primaryLabel = confirmRevoke ? t("revokeConfirm") : t("revokeSession");
    primaryAction = confirmRevoke ? handleRevoke : () => setConfirmRevoke(true);
    primaryDisabled = confirmRevoke ? !canRevoke || busy : busy;
    primaryHint = confirmRevoke ? t("revokeConfirmPrompt") : t("revokeLifecycleHint");
  } else if (!publicKey) {
    primaryLabel = t("sessionNextGenerate");
    primaryAction = handleGenerate;
    primaryDisabled = busy || !accountReady || ownerAuthority !== "owner";
  } else {
    primaryLabel = t("configureSession");
    primaryAction = handleConfigure;
    primaryDisabled = busy || !scopeReady;
    primaryHint = !readiness.target ? t("sessionStageNeedTarget") : !scopeReady ? t("configureSessionBlocked") : undefined;
  }

  const accountTone = accountStatus === "ready" && verifierBound ? "ready" : accountStatus;
  const lifecycleText = pendingWrite
    ? t("sessionWritePending", { kind: t(pendingWrite.kind === "configure" ? "configureSession" : "revokeSession") })
    : writePhase === "confirmed"
      ? t("sessionWriteConfirmed")
      : lastError || t(liveRecord ? (effectiveSessionStatus === "expired" ? "sessionExpired" : "sessionActive") : "sessionDraftHonest");

  const scene = (
    <div className="sess-scene" data-state={liveRecord ? effectiveSessionStatus : writePhase}>
      <div className="sess-account-ribbon" data-tone={accountTone}>
        <span><ShieldCheck size={15} /> {network || "—"}</span>
        <strong>{accountStatus === "ready" ? (verifierBound ? t("bindingVerified") : t("bindingMismatch")) : t(`sessionAccount${accountStatus[0]?.toUpperCase()}${accountStatus.slice(1)}`)}</strong>
        <em>{walletNetwork ? t("walletNetworkVerified") : t("walletNetworkReadOnly")}</em>
      </div>
      <article className={["sess-object", liveRecord ? "is-live" : "", busy ? "is-busy" : ""].filter(Boolean).join(" ")}>
        <header className="sess-object__head">
          <span className="sess-object__asset"><CoinArt size={26} variant="gas" /></span>
          <div>
            <span>{t("sessionPermissionObject")}</span>
            <strong>{liveRecord ? t(effectiveSessionStatus === "expired" ? "sessionExpired" : "sessionActive") : t("sessionDraft")}</strong>
          </div>
          <em>{readyCount}/4</em>
        </header>
        <div className="sess-object__grid" aria-label={t("sessionReadinessChecks")}>
          {sessionModules.map((item) => (
            <div key={item.key} className={["sess-object__module", item.ready ? "is-ready" : ""].filter(Boolean).join(" ")}>
              <span>{item.label}</span>
              <strong>
                <PhaseValue phase={draftPhase(item.value)} placeholder={item.idle}>
                  {item.value}
                </PhaseValue>
              </strong>
            </div>
          ))}
        </div>
        <footer className="sess-object__footer">
          <p>{lifecycleText}</p>
          <span>{t("sessionReadbackRequired")}</span>
        </footer>
      </article>
    </div>
  );

  const controls = (
    <div className="sess-controls">
      <figure className="sess-visual-card">
        <img src={SESSION_ART} alt={t("sessionHeroVisualAlt")} loading="eager" decoding="async" />
        <figcaption>
          <span>{t("sessionHeroEyebrow")}</span>
          <strong>{t("sessionPassTitle")}</strong>
          <em>{t("sessionHeroCopy")}</em>
        </figcaption>
      </figure>

      <section className="sess-scope-panel" aria-label={t("sessionScopeTitle")}>
        <header className="sess-scope-panel__head">
          <div><span>{t("sessionScopeTitle")}</span><strong>{t(activeScope.label)}</strong></div>
          <em>{activeScope.method}</em>
        </header>
        <p>{t(activeScope.copy)}</p>
        {/* WCAG: role="group" (named, no required children) — cards are <button>s, not listitems */}
        <div className="sess-preset-grid" role="group" aria-label={t("sessionScopeTitle")}>
          {SCOPE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={["sess-preset-card", activePreset === preset.key ? "sess-preset-card--active" : ""].filter(Boolean).join(" ")}
              onClick={() => applyPreset(preset)}
              disabled={busy || liveRecord}
            >
              <span>{t(preset.label)}</span>
              <strong>{preset.method}</strong>
              <em>{allowanceSupported ? spendLabel(preset.spend, t) : t("allowanceUnavailableShort")} · {presetWindow(preset.seconds)}</em>
            </button>
          ))}
        </div>
      </section>

      {generatedPrivateKey && (
        <OpenUiNotice className="sess-secret-card" icon={<KeyRound size={17} />} title={t("privateKeyCardTitle")}>
          <p>{t("privateKeyCaution")}</p>
          <div className="sess-secret-card__key">
            <code>{showSecret ? generatedPrivateKey : "•••• •••• •••• •••• •••• •••• •••• ••••"}</code>
            <button type="button" onClick={() => setShowSecret((value) => !value)} aria-label={showSecret ? t("hidePrivateKey") : t("showPrivateKey")}>
              {showSecret ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
            <button type="button" onClick={handleCopySecret} aria-label={t("copyPrivateKey")}><Copy size={15} /></button>
          </div>
        </OpenUiNotice>
      )}

      <div className="sess-control-grid">
        <div className="sess-status-card">
          <span>{t("sessionPublicKey")}</span>
          {/*
            `sessionKeyMissing` is an exception message ("Session key not
            generated." — thrown from main.tsx when a copy is attempted with no
            key). Rendering it here printed a bare lowercase "missing" in
            monospace as this card's headline value on every first paint. Not
            having generated a key yet is the expected opening state, so it gets
            the card's own zero-state line instead.
          */}
          <strong>
            <PhaseValue phase={draftPhase(publicKey)} placeholder={t("sessionKeyIdle")}>
              {compact(publicKey)}
            </PhaseValue>
          </strong>
          <button type="button" onClick={handleGenerate} disabled={busy || liveRecord}>{publicKey ? t("replaceLocalKey") : t("sessionNextGenerate")}</button>
        </div>
        <div className="sess-chip-card">
          <span>{t("expiresAt")}</span>
          <div>{EXPIRY_PRESETS.map((preset) => <button key={preset.key} type="button" onClick={() => setDraftExpiry(futureTimestamp(preset.seconds))} disabled={busy || liveRecord}>{preset.key}</button>)}</div>
        </div>
        <div className="sess-chip-card">
          <span>{t("spendingLimit")}</span>
          {allowanceSupported
            ? <div>{SPEND_PRESETS.map((value) => <button key={value} type="button" className={draftLimit === value ? "is-active" : ""} onClick={() => setDraftLimit(value)} disabled={busy || liveRecord}>{spendLabel(value, t)}</button>)}</div>
            : <p>{t("allowanceUnavailableTestnet")}</p>}
        </div>
        <div className="sess-endpoint-card">
          <span>{t("targetContract")}</span>
          <strong>
            <PhaseValue phase={draftPhase(target)} placeholder={t("sessionTargetMissing")}>
              {compact(target)}
            </PhaseValue>
          </strong>
          <em>{t("sessionTargetHint")}</em>
        </div>
      </div>
    </div>
  );

  const readout = [
    { label: t("sessionMetricStatus"), value: t(liveRecord ? (effectiveSessionStatus === "expired" ? "sessionExpired" : "sessionActive") : `sessionAccount${accountStatus[0]?.toUpperCase()}${accountStatus.slice(1)}`), accent: liveRecord },
    { label: t("accountOwner"), value: ownerAuthority === "owner" ? t("ownerVerified") : ownerAuthority === "mismatch" ? t("ownerMismatch") : t("ownerNotVerified") },
    { label: t("sessionVerifier"), value: compact(accountVerifier || sessionVerifier) || t("sessionVerifierIdle") },
    { label: t("network"), value: network || t("networkIdle") },
  ];

  const drawer = (
    <div className="sess-drawer">
      <OpenUiPanel className="sess-drawer-panel sess-drawer-panel--ops" icon={<KeyRound size={16} />} title={t("sessionCommandTitle")} subtitle={t("sessionAdvancedHint")}>
        <div className="sess-command-grid">
          <button type="button" className="sess-command-card" onClick={handleInspect} disabled={busy || !currentDraftHash}><Search size={16} /><span>{t("inspectSession")}</span></button>
          <button type="button" className="sess-command-card" onClick={handleConnect} disabled={busy || !currentDraftHash}><UserRoundCheck size={16} /><span>{t("connectOwnerWallet")}</span></button>
          <button type="button" className="sess-command-card" onClick={handleRecover} disabled={busy || !pendingWrite}><RefreshCw size={16} /><span>{t("recoverSessionWrite")}</span></button>
          <button type="button" className="sess-command-card sess-command-card--danger" onClick={() => setConfirmRevoke(true)} disabled={busy || !liveRecord}><ShieldOff size={16} /><span>{t("revokeSession")}</span></button>
        </div>
        <OpenUiNotice className="sess-sponsor-card" icon={<HandCoins size={16} />} title={t("sponsorship")}>
          <p className="sess-drawer__note">{t("sessionFlowSponsorDesc")}</p>
          <div className="sess-sponsor-card__actions">
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleCheckSponsor} disabled={busy}>{t("checkSponsor")}</button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleRequestSponsor} disabled={busy}>{t("requestSponsor")}</button>
          </div>
          <span className="sess-sponsor-card__status">{sponsorStatus}</span>
        </OpenUiNotice>
      </OpenUiPanel>

      <OpenUiPanel className="sess-drawer-panel sess-drawer-panel--scope" icon={<SlidersHorizontal size={16} />} title={t("sessionAdvancedTitle")} subtitle={t("sessionTargetHint")}>
        <div className="sess-drawer-grid">
          <OpenUiTextField className="sess-drawer__field" label={t("accountSeed")} value={draftAccount} onChange={(event) => { setDraftAccount(event.target.value); setConfirmRevoke(false); }} placeholder={t("accountSeedPlaceholder")} mono />
          <OpenUiTextField className="sess-drawer__field sess-drawer__field--wide" label={t("sessionPublicKey")} value={draftPublicKey} onChange={(event) => setDraftPublicKey(event.target.value)} placeholder={t("sessionPublicKeyPlaceholder")} mono />
          <OpenUiTextField className="sess-drawer__field sess-drawer__field--wide" label={t("targetContract")} value={draftTarget} onChange={(event) => setDraftTarget(event.target.value)} placeholder={t("targetContractPlaceholder")} mono />
          <OpenUiTextField className="sess-drawer__field" label={t("allowedMethod")} value={draftMethod} onChange={(event) => setDraftMethod(event.target.value)} placeholder={t("allowedMethodPlaceholder")} hint={t("explicitMethodHint")} mono />
          <OpenUiTextField className="sess-drawer__field" label={t("expiresAt")} value={draftExpiry} onChange={(event) => setDraftExpiry(event.target.value)} placeholder={t("expiresAtPlaceholder")} inputMode="numeric" mono />
          {allowanceSupported && <OpenUiTextField className="sess-drawer__field" label={t("spendingLimit")} value={draftLimit} onChange={(event) => setDraftLimit(event.target.value)} placeholder={t("spendingLimitPlaceholder")} hint={t("spendingLimitHint")} inputMode="decimal" mono />}
        </div>
        <dl className="sess-binding-detail">
          <div><dt>{t("aaCore")}</dt><dd><PhaseValue phase={draftPhase(compact(aaCore))} placeholder={t("bindingIdle")}>{compact(aaCore)}</PhaseValue></dd></div>
          <div><dt>{t("sessionVerifier")}</dt><dd><PhaseValue phase={draftPhase(compact(sessionVerifier))} placeholder={t("bindingIdle")}>{compact(sessionVerifier)}</PhaseValue></dd></div>
          <div><dt>{t("accountOwner")}</dt><dd><PhaseValue phase={draftPhase(compact(accountOwner))} placeholder={t("sessionOwnerIdle")}>{compact(accountOwner)}</PhaseValue></dd></div>
        </dl>
      </OpenUiPanel>
    </div>
  );

  return (
    <div className="sess-play-area mx2 mx2-cat-tool">
      <OpenUiProvider>
        <PlayStage
          category="tool"
          stage={{ eyebrow: t("sessionHeroEyebrow"), title: t("sessionHeroTitle"), subtitle: t("sessionPassTitle") }}
          scene={<div className="sess-workspace">{scene}{controls}</div>}
          score={readout}
          actions={{
            primary: {
              label: busy && !pendingWrite ? "…" : primaryLabel,
              onClick: primaryAction,
              disabled: primaryDisabled,
              loading: busy,
              hint: primaryHint,
            },
          }}
          drawerToggleLabel={t("sessionCommandTitle")}
          drawer={{ title: t("sessionCommandTitle"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
