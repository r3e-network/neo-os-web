/**
 * PlayArea.tsx -- AA Session Key Lab
 *
 * The main surface is a scoped permission pass, not a raw parameter form.
 * Users choose an authorization shape, generate the session key, and review
 * expiry/spend limits before signing. Account/target/sponsor internals stay in
 * the details drawer.
 */
import { useEffect, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import { CoinArt } from "@shared/art";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import { HandCoins, KeyRound, Search, ShieldOff, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_SESSION_ACCOUNT_SEED,
  DEFAULT_SESSION_ALLOWED_METHOD,
  getDefaultSessionExpiryTimestamp,
} from "./launch";
import "./PlayArea.scss";

interface P {
  t: (k: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (n: string, ...a: unknown[]) => Promise<void>;
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
  };
  spentGas: string;
}

const SCOPE_PRESETS = [
  { key: "rewards", label: "sessionPresetRewards", copy: "sessionPresetRewardsCopy", method: DEFAULT_SESSION_ALLOWED_METHOD, spend: "0.1", seconds: 3600 },
  { key: "mint", label: "sessionPresetMint", copy: "sessionPresetMintCopy", method: "mint", spend: "1", seconds: 86400 },
  { key: "ops", label: "sessionPresetOps", copy: "sessionPresetOpsCopy", method: "execute", spend: "0", seconds: 604800 },
] as const;

const EXPIRY_PRESETS = [
  { key: "1h", seconds: 3600 },
  { key: "24h", seconds: 86400 },
  { key: "7d", seconds: 604800 },
] as const;

const SPEND_PRESETS = ["0", "0.1", "1"] as const;
const SESSION_ART = "session-key-control.webp";

function compactHash(value: string): string {
  const v = String(value || "").trim();
  if (!v || v === "—") return "—";
  if (v.length <= 14) return v;
  return `${v.slice(0, 8)}…${v.slice(-6)}`;
}

function futureTimestamp(secondsFromNow: number): string {
  return String(Math.floor(Date.now() / 1000) + secondsFromNow);
}

function formatExpiry(value: string): string {
  const expiry = Number.parseInt(value, 10);
  if (!Number.isFinite(expiry) || expiry <= 0) return "—";
  const remaining = expiry - Math.floor(Date.now() / 1000);
  if (remaining <= 0) return "expired";
  if (remaining < 86400) return `${Math.max(1, Math.round(remaining / 3600))}h`;
  return `${Math.max(1, Math.round(remaining / 86400))}d`;
}

function spendLabel(value: string, t: P["t"]): string {
  return value === "0" || !value ? t("spendUnlimited") : `${value} GAS`;
}

function presetWindowLabel(seconds: number): string {
  if (seconds < 86400) return `${Math.max(1, Math.round(seconds / 3600))}h`;
  return `${Math.max(1, Math.round(seconds / 86400))}d`;
}

export default function PlayArea({ t, state, dispatch }: P) {
  const { str, bool, val } = useStateBindings(state);

  const sessionStatus = str("sessionStatusDisplay");
  const sessionVerifier = str("sessionVerifierDisplay");
  const derivedAccountIdHash = str("derivedAccountIdHash");
  const sponsorStatus = str("sponsorStatusDisplay");
  const aaCoreDisplay = str("aaCoreDisplay");
  const walletDisplay = str("walletDisplay");
  const generatedPublicKey = str("generatedPublicKey");
  const hasOnChainSession = bool("hasOnChainSession");
  const isSubmitting = bool("isSubmitting");
  const isRevoking = bool("isRevoking");
  const isCheckingSponsorship = bool("isCheckingSponsorship");
  const onChainView = val<OnChainView>("onChainSessionView");

  const [draftAccount, setDraftAccount] = useState(DEFAULT_SESSION_ACCOUNT_SEED);
  const [draftPubKey, setDraftPubKey] = useState("");
  const [draftTarget, setDraftTarget] = useState("");
  const [draftMethod, setDraftMethod] = useState(DEFAULT_SESSION_ALLOWED_METHOD);
  const [draftExpiry, setDraftExpiry] = useState(getDefaultSessionExpiryTimestamp);
  const [draftSpendLimit, setDraftSpendLimit] = useState("0.1");
  const [activePreset, setActivePreset] = useState<(typeof SCOPE_PRESETS)[number]["key"]>("rewards");

  useEffect(() => {
    if (generatedPublicKey && !draftPubKey.trim()) setDraftPubKey(generatedPublicKey);
  }, [generatedPublicKey, draftPubKey]);

  const configured = sessionStatus === t("configured") || hasOnChainSession;
  const busy = isSubmitting || isRevoking || isCheckingSponsorship;

  const passPublicKey = onChainView?.decoded?.pubKey || draftPubKey || generatedPublicKey;
  const scopeTarget = onChainView?.decoded?.targetContract || draftTarget;
  const scopeMethod = onChainView?.decoded?.method || draftMethod;
  const scopeExpiryDisplay =
    onChainView?.decoded?.expiryDisplay ||
    (draftExpiry && /^\d+$/.test(draftExpiry) ? formatExpiry(draftExpiry) : "");
  const scopeLimit = onChainView?.decoded
    ? onChainView.decoded.spendingLimitUnlimited
      ? t("spendUnlimited")
      : onChainView.decoded.spendingLimitGas
    : spendLabel(draftSpendLimit, t);

  const seg = {
    account: draftAccount.trim().length > 0 || !!derivedAccountIdHash,
    key: passPublicKey.trim().length > 0,
    target: draftTarget.trim().length > 0 || Boolean(onChainView?.decoded?.targetContract),
    expiry: /^\d+$/.test(draftExpiry.trim()) && Number(draftExpiry) > Math.floor(Date.now() / 1000),
  };
  const filledCount = [seg.account, seg.key, seg.target, seg.expiry].filter(Boolean).length;
  const scopeReady = filledCount >= 4;
  const passCharge = Math.max(10, Math.round((filledCount / 4) * 100));
  const activeScope = SCOPE_PRESETS.find((preset) => preset.key === activePreset) ?? SCOPE_PRESETS[0];
  const missingStatus = !seg.key
    ? t("sessionStageNeedKey")
    : !seg.target
      ? t("sessionStageNeedTarget")
      : !seg.expiry
        ? t("sessionStageNeedExpiry")
        : t("sessionPassDraft");
  const sessionModules = [
    {
      key: "account",
      label: t("accountSeed"),
      value: compactHash(derivedAccountIdHash || draftAccount),
      ready: seg.account || configured,
    },
    {
      key: "key",
      label: t("sessionPublicKey"),
      value: compactHash(passPublicKey),
      ready: seg.key || configured,
    },
    {
      key: "method",
      label: t("allowedMethod"),
      value: scopeMethod || t("anyMethod"),
      ready: Boolean(scopeMethod) || configured,
    },
    {
      key: "target",
      label: t("targetContract"),
      value: compactHash(scopeTarget),
      ready: seg.target || configured,
    },
    {
      key: "expiry",
      label: t("expiresAt"),
      value: scopeExpiryDisplay || "—",
      ready: seg.expiry || configured,
    },
    {
      key: "limit",
      label: t("spendingLimit"),
      value: scopeLimit,
      ready: configured || seg.expiry,
    },
  ];

  const applyScopePreset = (preset: typeof SCOPE_PRESETS[number]) => {
    if (busy) return;
    setActivePreset(preset.key);
    setDraftMethod(preset.method);
    setDraftSpendLimit(preset.spend);
    setDraftExpiry(futureTimestamp(preset.seconds));
  };

  const setExpiryPreset = (seconds: number) => {
    if (!busy) setDraftExpiry(futureTimestamp(seconds));
  };

  const handleGenerate = () => { void dispatch("generateKey"); };
  const handleInspect = () => { void dispatch("inspectSession", draftAccount); };
  const handleRevoke = () => { void dispatch("revokeSession", draftAccount); };
  const handleConfigure = () => {
    void dispatch(
      "configureSessionKey",
      draftAccount,
      draftPubKey || generatedPublicKey,
      draftTarget,
      draftMethod,
      draftExpiry,
      draftSpendLimit,
      "",
    );
  };
  const handleCheckSponsor = () => { void dispatch("checkSponsor", draftAccount, ""); };
  const handleRequestSponsor = () => { void dispatch("requestSponsor", draftAccount, "", draftSpendLimit); };

  const sceneState = isRevoking
    ? "revoking"
    : isSubmitting
      ? "submitting"
      : configured
        ? "configured"
        : scopeReady
          ? "ready"
          : "draft";

  const statusText = busy
    ? isRevoking ? `${t("revokeSession")}...` : isSubmitting ? `${t("configureSession")}...` : `${t("checkSponsor")}...`
    : configured
      ? t("configured")
      : scopeReady
        ? t("sessionPassReady")
        : missingStatus;

  const scene = (
    <div className="sess-scene" data-state={sceneState}>
      <div className="sess-scene__pass-wrap">
        <div
          className={[
            "sess-scene__pass",
            configured ? "is-issued" : "",
            isRevoking ? "is-tearing" : "",
            busy && !isRevoking ? "is-minting" : "",
          ].filter(Boolean).join(" ")}
        >
          <div className="sess-scene__pass-head">
            <div className="sess-scene__pass-icon">
              <div className={["sess-scene__ring", busy && !isRevoking ? "is-spinning" : ""].filter(Boolean).join(" ")} />
              <CoinArt size={24} variant="gas" />
            </div>
            <div className="sess-scene__pass-meta">
              <span className="sess-scene__pass-label">{t("sessionLabel")}</span>
              <span className="sess-scene__pass-status">{configured ? t("configured") : t("pending")}</span>
            </div>
            <strong className="sess-scene__readiness">{filledCount}/4</strong>
          </div>

          <div className="sess-scene__scope" aria-label={t("sessionReadinessChecks")}>
            {sessionModules.map((item) => (
              <span
                key={item.key}
                className={[
                  "sess-scene__badge",
                  `sess-scene__badge--${item.key}`,
                  item.ready ? "is-on" : "",
                ].filter(Boolean).join(" ")}
              >
                <em>{item.label}</em>
                <strong>{item.value}</strong>
              </span>
            ))}
          </div>

          <div className="sess-scene__footer">
            <p className="sess-scene__status">{statusText}</p>
            <div className="sess-scene__meter" aria-hidden="true">
              <span style={{ width: `${passCharge}%` }} />
            </div>
          </div>
          {configured && isRevoking && <div className="sess-scene__tear" aria-hidden="true" />}
        </div>
      </div>
    </div>
  );

  const controls = (
    <div className="sess-controls">
      <figure className="sess-visual-card">
        <img src={SESSION_ART} alt="" aria-hidden="true" loading="eager" decoding="async" />
        <figcaption>
          <span>{t("sessionHeroEyebrow")}</span>
          <strong>{t("sessionPassTitle")}</strong>
        </figcaption>
      </figure>
      <section className="sess-scope-panel" aria-label={t("sessionScopeTitle")}>
        <header className="sess-scope-panel__head">
          <div>
            <span>{t("sessionScopeTitle")}</span>
            <strong>{t(activeScope.label)}</strong>
          </div>
          <em>{activeScope.method}</em>
        </header>
        <p>{t(activeScope.copy)}</p>
        <div className="sess-preset-grid" role="list" aria-label={t("sessionScopeTitle")}>
          {SCOPE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              className={["sess-preset-card", activePreset === preset.key ? "sess-preset-card--active" : null].filter(Boolean).join(" ")}
              onClick={() => applyScopePreset(preset)}
              disabled={busy}
            >
              <span>{t(preset.label)}</span>
              <strong>{preset.method}</strong>
              <em>{spendLabel(preset.spend, t)} · {presetWindowLabel(preset.seconds)}</em>
            </button>
          ))}
        </div>
      </section>

      <div className="sess-control-grid">
        <div className="sess-status-card">
          <span>{t("sessionPublicKey")}</span>
          <strong>{passPublicKey ? compactHash(passPublicKey) : t("sessionKeyMissing")}</strong>
          <button type="button" onClick={handleGenerate} disabled={busy}>
            {passPublicKey ? t("generateKey") : t("sessionNextGenerate")}
          </button>
        </div>
        <div className="sess-chip-card">
          <span>{t("expiresAt")}</span>
          <div>
            {EXPIRY_PRESETS.map((preset) => (
              <button key={preset.key} type="button" onClick={() => setExpiryPreset(preset.seconds)} disabled={busy}>
                {preset.key}
              </button>
            ))}
          </div>
        </div>
        <div className="sess-chip-card">
          <span>{t("spendingLimit")}</span>
          <div>
            {SPEND_PRESETS.map((value) => (
              <button
                key={value}
                type="button"
                className={draftSpendLimit === value ? "is-active" : ""}
                onClick={() => setDraftSpendLimit(value)}
                disabled={busy}
              >
                {spendLabel(value, t)}
              </button>
            ))}
          </div>
        </div>
        <div className="sess-endpoint-card">
          <span>{t("targetContract")}</span>
          <strong>{scopeTarget ? compactHash(scopeTarget) : t("sessionTargetMissing")}</strong>
          <em>{t("sessionTargetHint")}</em>
        </div>
      </div>
    </div>
  );

  const readout = configured
    ? [
        { label: t("sessionMetricStatus"), value: sessionStatus, accent: true },
        { label: t("sponsor"), value: sponsorStatus },
        { label: t("sessionVerifier"), value: compactHash(sessionVerifier) },
        { label: t("wallet"), value: walletDisplay && walletDisplay !== t("notConnected") ? compactHash(walletDisplay) : t("notConnected") },
      ]
    : [
        { label: t("sessionMetricStatus"), value: `${filledCount}/4`, accent: true },
        { label: t("sessionVerifier"), value: compactHash(sessionVerifier) },
        { label: t("aaCore"), value: compactHash(aaCoreDisplay) },
        { label: t("wallet"), value: walletDisplay && walletDisplay !== t("notConnected") ? compactHash(walletDisplay) : t("notConnected") },
      ];

  const drawer = (
    <div className="sess-drawer">
      <OpenUiPanel
        className="sess-drawer-panel sess-drawer-panel--ops"
        icon={<KeyRound size={16} />}
        title={t("sessionCommandTitle")}
        subtitle={t("sessionAdvancedHint")}
        titleId="sess-drawer-ops"
      >
        <div className="sess-command-grid">
          <button type="button" className="sess-command-card" onClick={handleGenerate}>
            <KeyRound size={16} />
            <span>{t("generateKey")}</span>
          </button>
          <button type="button" className="sess-command-card" onClick={handleInspect} disabled={!draftAccount}>
            <Search size={16} />
            <span>{t("inspectSession")}</span>
          </button>
          <button type="button" className="sess-command-card sess-command-card--danger" onClick={handleRevoke} disabled={!configured}>
            <ShieldOff size={16} />
            <span>{t("revokeSession")}</span>
          </button>
        </div>
        <OpenUiNotice
          className="sess-sponsor-card"
          icon={<HandCoins size={16} />}
          title={t("sponsorship")}
        >
          <p className="sess-drawer__note">{t("sessionFlowSponsorDesc")}</p>
          <div className="sess-sponsor-card__actions">
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleCheckSponsor} disabled={!draftAccount}>{t("checkSponsor")}</button>
            <button type="button" className="mx2-btn mx2-btn--ghost" onClick={handleRequestSponsor} disabled={!draftAccount}>{t("requestSponsor")}</button>
          </div>
        </OpenUiNotice>
      </OpenUiPanel>

      <OpenUiPanel
        className="sess-drawer-panel sess-drawer-panel--scope"
        icon={<SlidersHorizontal size={16} />}
        title={t("sessionAdvancedTitle")}
        subtitle={t("sessionTargetHint")}
        titleId="sess-drawer-scope"
      >
        <div className="sess-drawer-grid">
          <OpenUiTextField className="sess-drawer__field" label={t("accountSeed")} value={draftAccount} onChange={(e) => setDraftAccount(e.target.value)} placeholder={t("accountSeedPlaceholder")} mono />
          <OpenUiTextField className="sess-drawer__field sess-drawer__field--wide" label={t("sessionPublicKey")} value={draftPubKey} onChange={(e) => setDraftPubKey(e.target.value)} placeholder={t("sessionPublicKeyPlaceholder")} mono />
          <OpenUiTextField className="sess-drawer__field sess-drawer__field--wide" label={t("targetContract")} value={draftTarget} onChange={(e) => setDraftTarget(e.target.value)} placeholder={t("targetContractPlaceholder")} mono />
          <OpenUiTextField className="sess-drawer__field" label={t("allowedMethod")} value={draftMethod} onChange={(e) => setDraftMethod(e.target.value)} placeholder={t("allowedMethodPlaceholder")} hint={!draftMethod ? t("anyMethodCaution") : undefined} mono />
          <OpenUiTextField className="sess-drawer__field" label={t("expiresAt")} value={draftExpiry} onChange={(e) => setDraftExpiry(e.target.value)} placeholder={t("expiresAtPlaceholder")} inputMode="numeric" mono />
          <OpenUiTextField className="sess-drawer__field" label={t("spendingLimit")} value={draftSpendLimit} onChange={(e) => setDraftSpendLimit(e.target.value)} placeholder={t("spendingLimitPlaceholder")} hint={t("spendingLimitHint")} inputMode="decimal" mono />
        </div>
      </OpenUiPanel>
    </div>
  );

  const needsKey = !seg.key;

  return (
    <div className="sess-play-area mx2 mx2-cat-tool">
      <OpenUiProvider>
        <PlayStage
          category="tool"
          stage={{
            eyebrow: t("sessionHeroEyebrow"),
            title: t("sessionHeroTitle"),
            subtitle: t("sessionPassTitle"),
          }}
          scene={<div className="sess-workspace">{scene}{controls}</div>}
          score={readout}
          actions={{
            primary: {
              label: busy ? "..." : needsKey ? t("sessionNextGenerate") : t("configureSession"),
              onClick: needsKey ? handleGenerate : handleConfigure,
              disabled: !needsKey && !scopeReady,
              loading: busy,
              hint: !needsKey && !scopeReady ? t("configureSessionBlocked") : undefined,
            },
          }}
          drawerToggleLabel={t("sessionCommandTitle")}
          drawer={{ title: t("sessionCommandTitle"), children: drawer }}
        />
      </OpenUiProvider>
    </div>
  );
}
