/**
 * PlayArea.tsx -- OneGate Vault (gas-lucky-pool) v2 scene-driven rebuild
 *
 * Two modes share one warm DeFi/social identity: a claim screen (recipient scans
 * a key → backend pays GAS) and a creator workspace (fund a vault). The vault IS
 * the scene: a glowing vault that fills as you set the pool, with a charge→
 * split→scan→unwrap reward route. Create/claim are primary; manage (inspect/
 * top-up/refund) and gas-credit are tucked into a drawer. Chain logic untouched.
 */
import { useEffect, useRef, useState } from "react";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { Observable, ObservableState } from "@shared/react/context";
import { formatGas } from "@shared/utils/format";
import { getLaunchParam, type MiniAppLaunchContext } from "@shared/utils/launch-params";
import { normalizeClaimKey } from "./composables/useGasLuckyPool";
import { explorerTxUrl } from "./utils/explorer";
import { CoinArt, ParticleBurst } from "@shared/art";
import { Clock3, Info, Search, ShieldCheck, SlidersHorizontal, WalletCards } from "lucide-react";
import { OpenUiNotice, OpenUiPanel, OpenUiProvider, OpenUiSegmented, OpenUiTextField, PlayStage } from "@shared/components-react/v2";
import "./PlayArea.scss";

const vaultArtUrl = new URL("../public/gas-vault-stage.webp", import.meta.url).href;

interface PlayAreaProps {
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Observable> | ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<void>;
  launchContext: MiniAppLaunchContext;
}

function maskClaimKey(value: string): string {
  const key = normalizeClaimKey(value);
  if (!key) return "";
  if (key.length <= 12) return `${key.slice(0, 4)}…`;
  return `${key.slice(0, 7)}…${key.slice(-4)}`;
}

function splitClaimError(error: string): { message: string; diagnostics: string } {
  if (!error) return { message: "", diagnostics: "" };
  const match = error.match(/\n?(\[ogvdiag[^\]]*\])\s*$/);
  if (!match || match.index === undefined || !match[1]) return { message: error.trim(), diagnostics: "" };
  return { message: error.slice(0, match.index).trim(), diagnostics: match[1].trim() };
}

const TOTAL_AMOUNT_PRESETS = ["20", "50", "100"];
const CLAIM_SLOT_PRESETS = ["10", "25", "50"];
const CLAIM_RANGE_PRESETS = [
  { key: "small", min: "1", max: "3", label: "claimRangeSmall" },
  { key: "balanced", min: "1", max: "5", label: "claimRangeBalanced" },
  { key: "jackpot", min: "5", max: "20", label: "claimRangeJackpot" },
] as const;
const REWARD_PLAN_PRESETS = [
  { key: "small", label: "claimRangeSmall", amount: "20", min: "1", max: "3", slots: "10", expiry: "24" },
  { key: "balanced", label: "claimRangeBalanced", amount: "50", min: "1", max: "5", slots: "25", expiry: "72" },
  { key: "jackpot", label: "claimRangeJackpot", amount: "100", min: "5", max: "20", slots: "10", expiry: "168" },
] as const;
const EXPIRY_PRESETS = ["24", "72", "168"];
const VAULT_ART = vaultArtUrl;
type DrawerMode = "plan" | "pool" | "credit" | "guide";

function stepDecimal(value: string, delta: number, min: number): string {
  const current = Number.parseFloat(value);
  const base = Number.isFinite(current) ? current : min;
  return String(Math.round(Math.max(min, base + delta) * 100) / 100).replace(/\.0+$/, "");
}
function stepInteger(value: string, delta: number, min: number): string {
  const current = Number.parseInt(value, 10);
  const base = Number.isFinite(current) ? current : min;
  return String(Math.max(min, base + delta));
}

export default function PlayArea({ t, state, dispatch, launchContext }: PlayAreaProps) {
  const { str, val } = useStateBindings(state as ObservableState);
  const currentClaimKey = str("currentClaimKey", launchContext.params.claimKey ?? "");
  const currentPoolId = str("currentPoolId");
  const currentRange = str("currentRange", t("rewardRangeDefault"));
  const lastTxid = str("lastTxid");
  const lastClaimAmount = val<bigint>("lastClaimAmount", 0n) ?? 0n;
  const lastClaimKey = str("lastClaimKey", currentClaimKey);
  const lastClaimLuckPercent = str("lastClaimLuckPercent");
  const claimStatus = str("claimStatus");
  const isClaiming = Boolean(val<boolean>("isClaiming", false));
  const isCreating = Boolean(val<boolean>("isCreating", false));
  const isLoading = Boolean(val<boolean>("isLoading", false));
  const isFunding = Boolean(val<boolean>("isFunding", false));
  const isRefunding = Boolean(val<boolean>("isRefunding", false));
  const isCreditLoading = Boolean(val<boolean>("isCreditLoading", false));
  const isWithdrawingCredit = Boolean(val<boolean>("isWithdrawingCredit", false));
  const gasCredit = val<bigint>("gasCredit", 0n) ?? 0n;
  const lastSuccessType = str("lastSuccessType");
  const lastError = str("lastError");

  const launchClaimKey = normalizeClaimKey(getLaunchParam(launchContext, ["claimKey", "key", "code", "k"], ""));
  const isClaimOperation = !launchContext.operation || launchContext.operation === "claimPool" || launchContext.operation === "claimOneGateVault";
  const isOneGateClaimLaunch = isClaimOperation && Boolean(launchClaimKey);
  const launchOneGateAppId = getLaunchParam(launchContext, ["oneGateAppId", "oneGateId", "onegateAppId"], "");
  const claimSucceeded = lastSuccessType === "claim" && claimStatus === "paid" && Boolean(lastTxid) && !lastError;
  const createSucceeded = lastSuccessType === "create" && Boolean(lastTxid) && !lastError;

  const [claimKey, setClaimKey] = useState(currentClaimKey || launchClaimKey);
  const [claimPreview, setClaimPreview] = useState(false);
  const [createPreview, setCreatePreview] = useState(false);
  const claimPreviewTimeout = useRef<number | null>(null);
  const createPreviewTimeout = useRef<number | null>(null);

  // Creator form
  const [totalAmount, setTotalAmount] = useState("");
  const [minClaim, setMinClaim] = useState("1");
  const [maxClaim, setMaxClaim] = useState("5");
  const [maxClaims, setMaxClaims] = useState("");
  const [expiryHours, setExpiryHours] = useState("24");
  const [poolId, setPoolId] = useState(currentPoolId);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("plan");

  useEffect(() => {
    if (launchClaimKey && !claimKey) setClaimKey(launchClaimKey);
  }, [claimKey, launchClaimKey]);

  useEffect(() => () => {
    if (claimPreviewTimeout.current) window.clearTimeout(claimPreviewTimeout.current);
    if (createPreviewTimeout.current) window.clearTimeout(createPreviewTimeout.current);
  }, []);

  const totalAmountNumber = Number.parseFloat(totalAmount);
  const minClaimNumber = Number.parseFloat(minClaim);
  const maxClaimNumber = Number.parseFloat(maxClaim || "5");
  const slotCountNumber = Number.parseInt(maxClaims, 10);
  const rewardRangeReady = Number.isFinite(minClaimNumber) && Number.isFinite(maxClaimNumber) && minClaimNumber > 0 && maxClaimNumber >= minClaimNumber;
  const rewardPlanReady = totalAmount.trim() !== "" && maxClaims.trim() !== "" && Number.isFinite(totalAmountNumber) && Number.isFinite(slotCountNumber) && totalAmountNumber > 0 && slotCountNumber > 0 && rewardRangeReady;
  const claimIsAnimating = isClaiming || claimPreview;
  const createAnimating = isCreating || createPreview;

  const displayClaimKey = maskClaimKey(lastClaimKey || claimKey);
  const claimError = splitClaimError(lastError);
  const claimNetworkLabel = launchContext.network === "testnet" ? t("networkTestnet") : t("networkMainnet");

  const startClaimPreview = () => {
    if (claimPreviewTimeout.current) window.clearTimeout(claimPreviewTimeout.current);
    setClaimPreview(true);
    claimPreviewTimeout.current = window.setTimeout(() => { setClaimPreview(false); claimPreviewTimeout.current = null; }, 1400);
  };
  const startCreatePreview = () => {
    if (createPreviewTimeout.current) window.clearTimeout(createPreviewTimeout.current);
    setCreatePreview(true);
    createPreviewTimeout.current = window.setTimeout(() => { setCreatePreview(false); createPreviewTimeout.current = null; }, 1200);
  };

  const handleClaim = async () => {
    if (!claimKey.trim() || claimIsAnimating) return;
    startClaimPreview();
    await dispatch("claimPool", {
      claimKey: claimKey.trim(),
      poolId: currentPoolId || undefined,
      oneGateAppId: launchOneGateAppId || undefined,
      appId: "miniapp-gas-lucky-pool",
    });
  };
  const handleCreate = async () => {
    if (!rewardPlanReady || createAnimating) return;
    startCreatePreview();
    await dispatch("createPool", {
      totalAmount: totalAmount.trim(),
      minClaim: minClaim.trim() || "1",
      maxClaim: maxClaim.trim() || "5",
      maxClaims: maxClaims.trim(),
      expiryHours: expiryHours.trim() || "24",
    });
  };
  const handleManage = async (action: "loadPool" | "topUpPool" | "refundPool", id?: string, amount?: string) => {
    if (action === "topUpPool") {
      await dispatch("topUpPool", { poolId: (id ?? poolId).trim(), amount: (amount ?? topUpAmount).trim() });
      setTopUpAmount("");
    } else {
      await dispatch(action, { poolId: (id ?? poolId).trim() });
    }
  };
  const applyRewardPlan = (plan: typeof REWARD_PLAN_PRESETS[number]) => {
    if (createAnimating) return;
    setTotalAmount(plan.amount);
    setMinClaim(plan.min);
    setMaxClaim(plan.max);
    setMaxClaims(plan.slots);
    setExpiryHours(plan.expiry);
  };
  const adjustTotalAmount = (delta: number) => {
    if (!createAnimating) setTotalAmount(stepDecimal(totalAmount || "20", delta, 1));
  };
  const adjustMaxClaims = (delta: number) => {
    if (!createAnimating) setMaxClaims(stepInteger(maxClaims || "10", delta, 1));
  };
  const setDrawerModeSafe = (value: string) => {
    if (value === "plan" || value === "pool" || value === "credit" || value === "guide") {
      setDrawerMode(value);
    }
  };
  const applyClaimRangePreset = (key: string) => {
    if (createAnimating) return;
    const preset = CLAIM_RANGE_PRESETS.find((item) => item.key === key);
    if (!preset) return;
    setMinClaim(preset.min);
    setMaxClaim(preset.max);
  };
  const setExpiryPreset = (hours: string) => {
    if (EXPIRY_PRESETS.includes(hours)) {
      setExpiryHours(hours);
    }
  };
  const infoDrawer = (
    <OpenUiProvider>
      <div className="vault-info-drawer">
        <OpenUiPanel
          className="vault-info-drawer__panel"
          icon={<Info size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("howItWorks")}
          subtitle={t("oneGateReady")}
        >
          <p>{t("docHowItWorks")}</p>
        </OpenUiPanel>
        <OpenUiPanel
          className="vault-info-drawer__panel"
          icon={<ShieldCheck size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("safetyModel")}
          subtitle={t("contractGuarded")}
        >
          <p>{t("docSafetyModel")}</p>
        </OpenUiPanel>
        <OpenUiPanel
          className="vault-info-drawer__panel"
          icon={<WalletCards size={18} strokeWidth={2.35} aria-hidden="true" />}
          title={t("oneGateFlow")}
          subtitle={t("shareQr")}
        >
          <p>{t("docOneGateFlow")}</p>
        </OpenUiPanel>
      </div>
    </OpenUiProvider>
  );

  // ============ CLAIM SCREEN ============
  if (isOneGateClaimLaunch) {
    const scene = (
      <div className="vault-scene" data-state={claimSucceeded ? "success" : claimIsAnimating ? "claiming" : lastError ? "error" : "ready"}>
        <div className={["vault-scene__vault-shell", claimIsAnimating ? "vault-scene__vault-shell--claiming" : null, claimSucceeded ? "vault-scene__vault-shell--success" : null].filter(Boolean).join(" ")}>
          <img className="vault-scene__vault-art" src={VAULT_ART} alt="" aria-hidden="true" draggable={false} decoding="async" />
          <div className="vault-scene__vault-badge" aria-hidden="true">
            <CoinArt size={30} variant="gas" />
          </div>
        </div>
        {claimIsAnimating && (
          <div className="vault-scene__coin-stream" aria-hidden="true">
            {Array.from({ length: 5 }, (_, i) => <CoinArt key={i} size={20} variant="gas" className={`vault-scene__coin vault-scene__coin--${i + 1}`} />)}
          </div>
        )}
        {claimSucceeded && <ParticleBurst coins count={14} />}
        <div className="vault-scene__ticket" aria-hidden={!displayClaimKey}>
          <span>{t("claimKeyLabel")}</span>
          <strong>{displayClaimKey || t("claimKeyPending")}</strong>
        </div>
        <p className="vault-scene__status" aria-live="polite">
          {claimSucceeded ? t("claimCongratsTitle") : claimIsAnimating ? t("claimProgressSubmitting") : lastError ? claimError.message : t("claimPoolDescription")}
        </p>
      </div>
    );

    return (
      <div className="gas-pool-playarea mx2 mx2-cat-defi">
        <PlayStage
          category="defi"
          className="gas-pool-playstage gas-pool-playstage--claim"
          stage={{
            eyebrow: t("vaultName"),
            title: claimSucceeded ? t("claimCongratsTitle") : t("claimPoolTitle"),
            subtitle: claimSucceeded ? t("claimCongratsBody") : t("claimPoolDescription"),
            badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {currentRange}</span>,
          }}
          scene={scene}
          score={
            claimSucceeded
              ? [
                  { label: t("claimAmountLabel"), value: formatGas(lastClaimAmount), accent: true },
                  { label: t("luckPercentLabel"), value: lastClaimLuckPercent || "—" },
                  { label: t("claimNetworkLabel"), value: claimNetworkLabel },
                ]
              : [
                  { label: t("claimKeyLabel"), value: displayClaimKey || "—" },
                  { label: t("rewardRange"), value: currentRange },
                  { label: t("claimNetworkLabel"), value: claimNetworkLabel },
                ]
          }
          actions={{
            primary: {
              label: claimSucceeded ? t("viewOnExplorer") : claimIsAnimating ? t("claimProgressSubmitting") : t("claimReward"),
              onClick: () => void (claimSucceeded ? window.open(explorerTxUrl(lastTxid, launchContext.network), "_blank") : handleClaim()),
              disabled: !claimSucceeded && (!claimKey.trim() || claimIsAnimating),
              loading: claimIsAnimating,
            },
          }}
          drawerToggleLabel={t("howItWorks")}
          drawer={{ title: t("howItWorks"), children: infoDrawer }}
        />
      </div>
    );
  }

  // ============ CREATOR WORKSPACE ============
  const displayTotal = totalAmount.trim() ? `${totalAmount.trim()} GAS` : t("rewardPoolUnset");
  const displayRange = `${minClaim || "1"}-${maxClaim || "5"} GAS`;
  const displaySlots = maxClaims.trim() ? t("rewardSlotsCount", { count: maxClaims.trim() }) : t("rewardSlotsUnset");
  const fillPct = rewardPlanReady ? Math.min(100, Math.round((slotCountNumber / 50) * 100)) : 0;
  const activePlan = REWARD_PLAN_PRESETS.find((plan) => plan.amount === totalAmount && plan.min === minClaim && plan.max === maxClaim && plan.slots === maxClaims && plan.expiry === expiryHours)?.key ?? "";
  const drawerModeOptions: Array<{ label: string; value: DrawerMode }> = [
    { label: t("rewardPlanTitle"), value: "plan" },
    { label: t("poolControlsTitle"), value: "pool" },
    { label: t("gasCreditTitle"), value: "credit" },
    { label: t("howItWorks"), value: "guide" },
  ];
  const creatorDrawer = (
    <OpenUiProvider>
      <div className="vault-drawer-grid" data-mode={drawerMode}>
        <OpenUiSegmented
          className="vault-drawer-tabs"
          segmentedClassName="vault-drawer-tabs__group"
          label={t("manageExistingTitle")}
          value={drawerMode}
          onChange={setDrawerModeSafe}
          options={drawerModeOptions.map((option) => ({
            value: option.value,
            label: <span className="vault-drawer-tab">{option.label}</span>,
          }))}
        />

        {drawerMode === "plan" && (
          <OpenUiPanel
            className="vault-drawer-panel vault-drawer-panel--plan"
            icon={<SlidersHorizontal size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("rewardPlanTitle")}
            subtitle={t("createPoolDescription")}
          >
            <div className="vault-drawer__advanced">
              <div className="vault-tuner">
                <span className="vault-controls__label">{t("totalAmount")}</span>
                <div className="vault-stepper" role="group" aria-label={t("totalAmount")}>
                  <button type="button" onClick={() => adjustTotalAmount(-5)} disabled={createAnimating} aria-label={t("decreaseTotalAmount")}>-</button>
                  <output>{displayTotal}</output>
                  <button type="button" onClick={() => adjustTotalAmount(5)} disabled={createAnimating} aria-label={t("increaseTotalAmount")}>+</button>
                </div>
                <OpenUiSegmented
                  className="vault-preset-field"
                  segmentedClassName="vault-controls__presets vault-controls__presets--amount"
                  label={t("totalAmount")}
                  value={TOTAL_AMOUNT_PRESETS.includes(totalAmount) ? totalAmount : ""}
                  onChange={setTotalAmount}
                  disabled={createAnimating}
                  options={TOTAL_AMOUNT_PRESETS.map((preset) => ({
                    value: preset,
                    label: <span className="vault-preset">{preset}</span>,
                  }))}
                />
              </div>

              <div className="vault-tuner">
                <span className="vault-controls__label">{t("maxClaims")}</span>
                <div className="vault-stepper" role="group" aria-label={t("maxClaims")}>
                  <button type="button" onClick={() => adjustMaxClaims(-5)} disabled={createAnimating} aria-label={t("decreaseMaxClaims")}>-</button>
                  <output>{displaySlots}</output>
                  <button type="button" onClick={() => adjustMaxClaims(5)} disabled={createAnimating} aria-label={t("increaseMaxClaims")}>+</button>
                </div>
                <OpenUiSegmented
                  className="vault-preset-field"
                  segmentedClassName="vault-controls__presets vault-controls__presets--slots"
                  label={t("maxClaims")}
                  value={CLAIM_SLOT_PRESETS.includes(maxClaims) ? maxClaims : ""}
                  onChange={setMaxClaims}
                  disabled={createAnimating}
                  options={CLAIM_SLOT_PRESETS.map((preset) => ({
                    value: preset,
                    label: <span className="vault-preset">{preset}</span>,
                  }))}
                />
              </div>

              <div className="vault-controls__group vault-controls__group--range">
                <span className="vault-controls__label">{t("claimRangeHint")}</span>
                <OpenUiSegmented
                  className="vault-preset-field vault-preset-field--range"
                  segmentedClassName="vault-controls__presets vault-controls__presets--range"
                  label={t("claimRangeHint")}
                  value={CLAIM_RANGE_PRESETS.find((preset) => minClaim === preset.min && maxClaim === preset.max)?.key ?? ""}
                  onChange={applyClaimRangePreset}
                  disabled={createAnimating}
                  options={CLAIM_RANGE_PRESETS.map((preset) => ({
                    value: preset.key,
                    label: (
                      <span className="vault-preset vault-preset--range">
                        <span>{t(preset.label)}</span>
                        <small>{preset.min}-{preset.max} GAS</small>
                      </span>
                    ),
                  }))}
                />
              </div>

              <div className="vault-drawer__setting">
                <span>{t("expiryHours")}</span>
                <OpenUiSegmented
                  className="vault-drawer__chips-field"
                  segmentedClassName="vault-drawer__chips"
                  label={t("expiryHours")}
                  value={expiryHours}
                  onChange={setExpiryPreset}
                  options={EXPIRY_PRESETS.map((hours) => ({
                    value: hours,
                    label: <span className="vault-drawer__chip">{t("rewardExpiryHours", { hours })}</span>,
                  }))}
                />
                <p>{t("expiryHoursHint")}</p>
              </div>
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "pool" && (
          <OpenUiPanel
            className="vault-drawer-panel vault-drawer-panel--pool"
            icon={<Search size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("poolControlsTitle")}
            subtitle={t("poolControlsHint")}
          >
            <div className="vault-drawer-field-row">
              <OpenUiTextField
                className="vault-drawer-field vault-drawer-field--pool"
                label={t("poolIdLabel")}
                value={poolId}
                onChange={(e) => setPoolId(e.target.value)}
                placeholder={t("poolIdPlaceholder")}
              />
              <OpenUiTextField
                className="vault-drawer-field vault-drawer-field--topup"
                label={t("topUpAmount")}
                value={topUpAmount}
                onChange={(e) => setTopUpAmount(e.target.value)}
                placeholder={t("topUpAmount")}
                inputMode="decimal"
              />
            </div>
            <div className="vault-drawer__actions">
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleManage("loadPool")} disabled={!poolId.trim() || isLoading}>{t("inspectPool")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleManage("refundPool")} disabled={!poolId.trim() || isRefunding}>{t("refundPool")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void handleManage("topUpPool", undefined, topUpAmount)} disabled={!poolId.trim() || !topUpAmount.trim() || isFunding}>{t("topUpPool")}</button>
            </div>
            <OpenUiNotice className="vault-drawer-notice" icon={<Info size={16} aria-hidden="true" />} title={t("distributionPathsTitle")}>
              {t("pathOnChain")}
            </OpenUiNotice>
          </OpenUiPanel>
        )}

        {drawerMode === "credit" && (
          <OpenUiPanel
            className="vault-drawer-panel vault-drawer-panel--credit"
            icon={<WalletCards size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("gasCreditTitle")}
            subtitle={t("gasCreditDescription")}
          >
            <dl className="vault-drawer-credit">
              <div><dt>{t("gasCredit")}</dt><dd>{formatGas(gasCredit)}</dd></div>
            </dl>
            <div className="vault-drawer__actions">
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("loadGasCredit")} disabled={isCreditLoading}>{t("checkGasCredit")}</button>
              <button type="button" className="mx2-btn mx2-btn--ghost" onClick={() => void dispatch("withdrawGasCredit")} disabled={isWithdrawingCredit || gasCredit <= 0n}>{t("withdrawGasCredit")}</button>
            </div>
          </OpenUiPanel>
        )}

        {drawerMode === "guide" && (
          <OpenUiPanel
            className="vault-drawer-panel vault-drawer-panel--docs"
            icon={<Clock3 size={18} strokeWidth={2.35} aria-hidden="true" />}
            title={t("howItWorks")}
            subtitle={t("oneGateFlow")}
          >
            <div className="vault-drawer-docs">
              <OpenUiNotice className="vault-drawer-notice" icon={<Info size={16} aria-hidden="true" />} title={t("howItWorks")}>{t("docHowItWorks")}</OpenUiNotice>
              <OpenUiNotice className="vault-drawer-notice" icon={<ShieldCheck size={16} aria-hidden="true" />} title={t("safetyModel")}>{t("docSafetyModel")}</OpenUiNotice>
              <OpenUiNotice className="vault-drawer-notice" icon={<WalletCards size={16} aria-hidden="true" />} title={t("oneGateFlow")}>{t("docOneGateFlow")}</OpenUiNotice>
            </div>
          </OpenUiPanel>
        )}
      </div>
    </OpenUiProvider>
  );

  const scene = (
    <div className="vault-scene" data-state={createSucceeded ? "success" : createAnimating ? "funding" : rewardPlanReady ? "ready" : "draft"}>
      <div className={["vault-scene__vault-shell", createAnimating ? "vault-scene__vault-shell--funding" : null, createSucceeded ? "vault-scene__vault-shell--success" : null, rewardPlanReady ? "vault-scene__vault-shell--ready" : null].filter(Boolean).join(" ")}>
        <img className="vault-scene__vault-art" src={VAULT_ART} alt="" aria-hidden="true" draggable={false} decoding="async" />
        <div className="vault-scene__vault-badge" aria-hidden="true">
          <CoinArt size={30} variant="gas" />
        </div>
      </div>
      <div className="vault-scene__hud">
        <div className="vault-scene__readout">
          <span>{t("totalAmount")}</span>
          <strong>{displayTotal}</strong>
        </div>
        <div className="vault-scene__readout">
          <span>{t("maxClaims")}</span>
          <strong>{displaySlots}</strong>
        </div>
      </div>
      <div className="vault-scene__meter" aria-hidden="true">
        <span style={{ width: `${Math.max(8, fillPct)}%` }} />
      </div>
      {createSucceeded && <ParticleBurst coins count={14} />}
      {createAnimating && <ParticleBurst coins count={8} />}
      {createAnimating && (
        <div className="vault-scene__coin-stream" aria-hidden="true">
          {Array.from({ length: 5 }, (_, i) => <CoinArt key={i} size={20} variant="gas" className={`vault-scene__coin vault-scene__coin--${i + 1}`} />)}
        </div>
      )}
      {/* reward route */}
      <div className="vault-scene__route">
        <span>{t("rewardRouteCharge")}</span>
        <span>→</span>
        <span>{t("rewardRouteSplit")}</span>
        <span>→</span>
        <span>{t("rewardRouteScan")}</span>
        <span>→</span>
        <span>{t("rewardRouteUnwrap")}</span>
      </div>
      <p className="vault-scene__status" aria-live="polite">
        {createSucceeded ? t("claimCongratsTitle") : createAnimating ? t("creatingPool") : rewardPlanReady ? t("rewardMachineReady") : t("rewardMachineDraft")}
      </p>
    </div>
  );

  const controls = (
    <div className="vault-controls">
      <div className="vault-controls__intro">
        <span>{t("rewardPlanTitle")}</span>
        <strong>{rewardPlanReady ? displayTotal : t("rewardPresetCta")}</strong>
        <small>{rewardPlanReady ? `${displaySlots} · ${displayRange}` : t("rewardPresetHint")}</small>
      </div>
      <div className="vault-plan-grid" role="list" aria-label={t("rewardPlanTitle")}>
        {REWARD_PLAN_PRESETS.map((plan) => (
          <button
            key={plan.key}
            type="button"
            className={["vault-plan-card", activePlan === plan.key ? "vault-plan-card--active" : null].filter(Boolean).join(" ")}
            onClick={() => applyRewardPlan(plan)}
            disabled={createAnimating}
            aria-pressed={activePlan === plan.key}
          >
            <span className="vault-plan-card__coin" aria-hidden="true">
              <CoinArt size={34} variant="gas" decorative />
            </span>
            <span className="vault-plan-card__copy">
              <span className="vault-plan-card__label">{t(plan.label)}</span>
              <strong>{plan.amount} GAS</strong>
              <span>{t("rewardSlotsCount", { count: plan.slots })} · {plan.min}-{plan.max} GAS</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="gas-pool-playarea mx2 mx2-cat-defi">
      <PlayStage
        category="defi"
        className="gas-pool-playstage gas-pool-playstage--creator"
        stage={{
          eyebrow: t("workspaceHeroEyebrow"),
          title: t("createPoolTitle"),
          subtitle: t("createPoolDescription"),
          badges: <span className="mx2-badge" data-tone="accent"><span className="mx2-badge__dot" /> {displayRange}</span>,
        }}
        scene={<div className="vault-workspace">{scene}{controls}</div>}
        score={[
          { label: t("totalAmount"), value: displayTotal, accent: true },
          { label: t("rewardRange"), value: displayRange },
          { label: t("maxClaims"), value: displaySlots },
        ]}
        actions={{
          primary: {
            label: createSucceeded ? t("viewOnExplorer") : createAnimating ? t("creatingPool") : t("createPool"),
            onClick: () => void (createSucceeded ? window.open(explorerTxUrl(lastTxid, launchContext.network), "_blank") : handleCreate()),
            disabled: !createSucceeded && (createAnimating || !rewardPlanReady),
            loading: createAnimating,
          },
        }}
        drawerToggleLabel={t("manageExistingTitle")}
        drawer={{
          title: t("manageExistingTitle"),
          children: creatorDrawer,
        }}
      />
    </div>
  );
}
