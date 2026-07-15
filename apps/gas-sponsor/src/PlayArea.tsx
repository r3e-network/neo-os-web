/**
 * Gas Sponsor — on-chain community refill station.
 *
 * The pool itself is the primary object. Exact amounts and lifecycle controls
 * stay in the secondary drawer so the main surface never becomes a form.
 */
import { useState } from "react";
import {
  ArrowLeftRight,
  Clock3,
  Coins,
  Fuel,
  Gauge,
  HandCoins,
  History,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
  WalletCards,
} from "lucide-react";
import { CoinArt } from "@shared/art";
import { PhaseValue, resolvePhase } from "@shared/components-react/v2";
import { PlayStage } from "@shared/components-react/v2/PlayStage";
import {
  OpenUiLiteProvider,
  OpenUiLiteSegmented,
  OpenUiLiteTextField,
} from "@shared/components-react/v2/OpenUiLite";
import { useStateBindings } from "@shared/react/hooks/useStateBindings";
import type { ObservableState } from "@shared/react/context";
import "./PlayArea.scss";

interface PlayAreaProps {
  t: (key: string, p?: Record<string, string | number>) => string;
  state: ObservableState;
  dispatch: (name: string, ...args: unknown[]) => Promise<unknown>;
}

type SponsorMode = "browse" | "create" | "manage";
type DrawerMode = "receipt" | "tune" | "manage";

interface GasSponsorPoolView {
  id: string | number;
  sponsor: string;
  poolType: number;
  initialAmountRaw: string;
  remainingAmountRaw: string;
  maxClaimPerUserRaw: string;
  totalClaimedRaw: string;
  claimCount: string | number;
  createTimeMs: string | number;
  expiryTimeMs: string | number;
  active: boolean;
  description: string;
  status: string;
  isMine?: boolean;
}

interface GasSponsorPlatformStatsView {
  totalPools?: string | number;
  activePools?: string | number;
  totalSponsoredRaw?: string;
  totalClaimedRaw?: string;
  totalSponsors?: string | number;
  totalBeneficiaries?: string | number;
  minSponsorshipRaw?: string;
  maxClaimPerTxRaw?: string;
  topUpMinRaw?: string;
  defaultExpiryMs?: string | number;
  defaultExpirySeconds?: string | number;
}

interface GasSponsorOutcomeView {
  status?: "idle" | "pending" | "confirmed" | "failed" | "unknown";
  operation?: string;
  message?: string;
  txid?: string;
}

const CREATE_AMOUNTS = ["1", "5", "10"];
const CLAIM_AMOUNTS = ["0.01", "0.05", "0.1"];
const EXTEND_DURATIONS = [
  { value: String(60 * 60 * 1000), key: "extendOneHour" },
  { value: String(24 * 60 * 60 * 1000), key: "extendOneDay" },
  { value: String(7 * 24 * 60 * 60 * 1000), key: "extendOneWeek" },
];

function clean(value: unknown): string {
  return String(value ?? "").trim();
}

function rawInteger(value: unknown): bigint {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return 0n;
  try {
    return BigInt(raw);
  } catch {
    return 0n;
  }
}

function decimalToFixed8(value: unknown): bigint {
  const raw = clean(value);
  if (!/^\d+(?:\.\d{1,8})?$/.test(raw)) return 0n;
  const [whole, fraction = ""] = raw.split(".");
  try {
    return BigInt(whole ?? "0") * 100_000_000n + BigInt(fraction.padEnd(8, "0"));
  } catch {
    return 0n;
  }
}

function formatFixed8(value: unknown, fallback = "—"): string {
  const raw = clean(value);
  if (!/^\d+$/.test(raw)) return fallback;
  const amount = rawInteger(raw);
  const whole = amount / 100_000_000n;
  const fraction = (amount % 100_000_000n).toString().padStart(8, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

function compact(value: unknown, head = 8, tail = 6): string {
  const text = clean(value);
  if (!text) return "—";
  return text.length <= head + tail + 1 ? text : `${text.slice(0, head)}…${text.slice(-tail)}`;
}

function asMillis(value: unknown): number {
  const parsed = Number(clean(value));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return parsed < 10_000_000_000 ? parsed * 1000 : parsed;
}

function timeRemaining(value: unknown, t: PlayAreaProps["t"]): string {
  const expiry = asMillis(value);
  if (!expiry) return t("unknownTime");
  const diff = expiry - Date.now();
  if (diff <= 0) return t("expired");
  const minutes = Math.max(1, Math.ceil(diff / 60_000));
  if (minutes < 60) return t("minutesRemaining", { count: minutes });
  const hours = Math.ceil(minutes / 60);
  if (hours < 48) return t("hoursRemaining", { count: hours });
  return t("daysRemaining", { count: Math.ceil(hours / 24) });
}

function poolPercent(pool: GasSponsorPoolView | null): number {
  if (!pool) return 0;
  const initial = rawInteger(pool.initialAmountRaw);
  const remaining = rawInteger(pool.remainingAmountRaw);
  if (initial <= 0n) return 0;
  return Math.max(0, Math.min(100, Number((remaining * 10_000n) / initial) / 100));
}

function poolId(pool: GasSponsorPoolView): string {
  return clean(pool.id);
}

export default function PlayArea({ t, state, dispatch }: PlayAreaProps) {
  const { str, bool, val } = useStateBindings(state);
  const mode = (str("mode", "browse") as SponsorMode);
  const network = str("network");
  const contractHash = str("contractHash");
  const pools = val<GasSponsorPoolView[]>("pools", []) ?? [];
  const platformStats = val<GasSponsorPlatformStatsView>("platformStats", {}) ?? {};
  const selectedPool = val<GasSponsorPoolView | null>("selectedPool", null) ?? null;
  const selectedPoolId = str("selectedPoolId");
  const walletAddress = str("walletAddress");
  const walletGasBalanceFixed8 = str("walletGasBalanceFixed8");
  const walletGasBalanceKnown = bool("walletGasBalanceKnown");
  const userClaimedFixed8 = str("userClaimedFixed8");
  const userClaimedKnown = bool("userClaimedKnown");
  const selectedPoolClaimAvailableRaw = str("selectedPoolClaimAvailableRaw");
  const selectedPoolIsMine = bool("selectedPoolIsMine") || Boolean(selectedPool?.isMine);
  const pendingOperation = val<Record<string, unknown> | null>("pendingOperation", null);
  const outcome = val<GasSponsorOutcomeView>("outcome", { status: "idle" }) ?? { status: "idle" };
  const poolsLoading = bool("poolsLoading");
  const selectedPoolLoading = bool("selectedPoolLoading");
  const actionBusy = bool("actionBusy");
  const hasMorePools = bool("hasMorePools");
  const canClaim = bool("canClaim");
  const canCreate = bool("canCreate");
  const canTopUp = bool("canTopUp");
  const canWithdraw = bool("canWithdraw");
  const canExtend = bool("canExtend");
  const canResumePending = bool("canResumePending");
  const claimAmount = str("claimAmount", "0.01");
  const createAmount = str("createAmount", "1");
  const createMaxClaim = str("createMaxClaim", "0.05");
  const createDescription = str("createDescription", "Community GAS refill");
  const topUpAmount = str("topUpAmount", "0.5");
  const extendDurationMs = str("extendDurationMs", String(24 * 60 * 60 * 1000));

  const [drawerMode, setDrawerMode] = useState<DrawerMode>("receipt");
  const [withdrawArmed, setWithdrawArmed] = useState(false);

  const connected = Boolean(walletAddress);
  const busy = poolsLoading || selectedPoolLoading || actionBusy;
  const pending = Boolean(pendingOperation) || outcome.status === "pending" || outcome.status === "unknown";
  const activePools = pools.filter(
    (pool) => pool.active && asMillis(pool.expiryTimeMs) > Date.now() && rawInteger(pool.remainingAmountRaw) > 0n,
  );
  const visiblePools = activePools.length > 0 ? activePools : pools.slice(0, 6);
  const fuelPercent = poolPercent(selectedPool);
  const availableRaw = rawInteger(selectedPoolClaimAvailableRaw || selectedPool?.remainingAmountRaw);
  const claimOptions = CLAIM_AMOUNTS.filter((amount) => decimalToFixed8(amount) <= availableRaw);
  if (claimOptions.length === 0 && availableRaw > 0n) claimOptions.push(formatFixed8(availableRaw.toString(), "0.01"));

  const setObservable = (key: string, value: unknown) => state[key]?.set(value);
  const setMode = (next: SponsorMode) => {
    setWithdrawArmed(false);
    void dispatch("setMode", next);
  };
  const selectPool = (id: string) => {
    setWithdrawArmed(false);
    void dispatch("selectPool", id);
  };

  const statsPoolCount = clean(platformStats.totalPools) || String(pools.length);
  const statsActiveCount = clean(platformStats.activePools) || String(activePools.length);
  const totalSponsored = formatFixed8(platformStats.totalSponsoredRaw);
  const totalClaimed = formatFixed8(platformStats.totalClaimedRaw);
  /**
   * Platform aggregates across the three honest phases. `formatFixed8` falls
   * back to an em dash, so the headline stat rail opened as "SPONSORED — GAS"
   * next to "ACTIVE POOLS 0" on every cold start. A settled-empty read cannot
   * honestly claim 0 GAS sponsored either — that is a number we do not have —
   * so it renders zero-state copy rather than a fabricated total.
   */
  const statsPhase = resolvePhase({
    loading: poolsLoading,
    settled: !poolsLoading,
    hasData: Boolean(String(platformStats.totalSponsoredRaw ?? "").trim()),
  });
  const expiryValue = platformStats.defaultExpiryMs ?? platformStats.defaultExpirySeconds;
  const networkLabel = network === "testnet" ? t("testnet") : network === "mainnet" ? t("mainnet") : t("networkUnknown");

  const stageTitle = mode === "create"
    ? t("createTitle")
    : mode === "manage"
      ? t("manageTitle")
      : t("browseTitle");
  const stageSubtitle = mode === "create"
    ? t("createSubtitle")
    : mode === "manage"
      ? t("manageSubtitle")
      : t("browseSubtitle");

  const modeOptions = [
    { value: "browse", label: <span><Fuel size={15} /> {t("modeBrowse")}</span> },
    { value: "create", label: <span><HandCoins size={15} /> {t("modeCreate")}</span> },
    ...(selectedPoolIsMine ? [{ value: "manage", label: <span><Gauge size={15} /> {t("modeManage")}</span> }] : []),
  ];

  const browseScene = (
    <>
      <section className="sponsor-hero" data-empty={!selectedPool || undefined}>
        <img src="gas-sponsor-refill-station.webp" alt="" aria-hidden="true" className="sponsor-hero__art" />
        <div className="sponsor-hero__card">
          {selectedPool ? (
            <>
              <div className="sponsor-hero__kicker">
                <span className="sponsor-live-dot" data-live={selectedPool.active || undefined} />
                {selectedPool.active ? t("poolLive") : t("poolEnded")} · #{poolId(selectedPool)}
              </div>
              <div className="sponsor-hero__amount">
                <CoinArt size={34} variant="gas" />
                <strong>{formatFixed8(selectedPool.remainingAmountRaw)}</strong>
                <span>GAS</span>
              </div>
              <progress
                className="sponsor-fuel-progress"
                max={100}
                value={fuelPercent}
                aria-label={t("poolFuelLevel")}
              />
              <div className="sponsor-hero__facts">
                <span><Gauge size={14} /> {t("fuelPercent", { percent: Math.round(fuelPercent) })}</span>
                <span><Clock3 size={14} /> {timeRemaining(selectedPool.expiryTimeMs, t)}</span>
              </div>
              <p>{selectedPool.description || t("communityPoolFallback")}</p>
            </>
          ) : (
            <>
              {/*
                * The eyebrow used to assert `stationReady` unconditionally, so a
                * cold start read "REFILL STATION READY" directly above the
                * headline "Finding live pools…" — claiming to be ready and still
                * searching in the same breath. While the read is in flight the
                * eyebrow names the surface and lets the headline carry the state.
                */}
              <div className="sponsor-hero__kicker">
                <Sparkles size={15} /> {poolsLoading ? t("stationKicker") : t("stationReady")}
              </div>
              <h3>{poolsLoading ? t("findingPools") : t("noActivePools")}</h3>
              <p>{poolsLoading ? t("findingPoolsDetail") : t("noActivePoolsDetail")}</p>
            </>
          )}
        </div>
      </section>

      {visiblePools.length > 0 && (
        <section className="sponsor-pool-rack" aria-label={t("poolRackLabel")}>
          <div className="sponsor-pool-rack__head">
            <span><History size={15} /> {activePools.length > 0 ? t("activePumps") : t("recentPumps")}</span>
            <small>{t("poolCount", { count: statsPoolCount })}</small>
          </div>
          <div className="sponsor-pool-rack__items">
            {visiblePools.map((pool) => {
              const selected = poolId(pool) === selectedPoolId;
              return (
                <button
                  type="button"
                  key={poolId(pool)}
                  className="sponsor-pool-chip"
                  data-selected={selected || undefined}
                  data-active={pool.active || undefined}
                  onClick={() => selectPool(poolId(pool))}
                >
                  <CoinArt size={22} variant="gas" />
                  <span><strong>#{poolId(pool)}</strong><small>{formatFixed8(pool.remainingAmountRaw)} GAS</small></span>
                  <em>{Math.round(poolPercent(pool))}%</em>
                </button>
              );
            })}
          </div>
          {hasMorePools && (
            <button type="button" className="sponsor-load-more" onClick={() => void dispatch("loadMorePools")} disabled={busy}>
              {t("loadMorePools")}
            </button>
          )}
        </section>
      )}

      {selectedPool && selectedPool.active && claimOptions.length > 0 && (
        <OpenUiLiteSegmented
          className="sponsor-fuel-cells"
          segmentedClassName="sponsor-fuel-cells__group"
          label={t("claimAmountLabel")}
          value={claimAmount}
          onChange={(value) => setObservable("claimAmount", value)}
          options={claimOptions.map((amount) => ({
            value: amount,
            disabled: busy,
            label: <span className="sponsor-fuel-cell"><CoinArt size={20} variant="gas" /><strong>{amount}</strong><small>GAS</small></span>,
          }))}
        />
      )}
    </>
  );

  const createScene = (
    <>
      <section className="sponsor-create-scene">
        <img src="gas-sponsor-refill-station.webp" alt="" aria-hidden="true" className="sponsor-create-scene__art" />
        <div className="sponsor-create-scene__card">
          <span className="sponsor-create-scene__eyebrow"><HandCoins size={15} /> {t("publicPool")}</span>
          <div className="sponsor-create-scene__amount"><CoinArt size={38} variant="gas" /><strong>{createAmount}</strong><span>GAS</span></div>
          <p>{t("createPlanSummary", { claim: createMaxClaim })}</p>
          <dl>
            <div><dt>{t("poolAccess")}</dt><dd>{t("openToEveryone")}</dd></div>
            <div><dt>{t("contractLifetime")}</dt><dd>{expiryValue ? t("contractDefaultDuration", { duration: timeRemaining(Date.now() + Number(expiryValue), t) }) : t("readAfterCreation")}</dd></div>
          </dl>
        </div>
      </section>
      <div className="sponsor-plan-grid">
        <OpenUiLiteSegmented
          className="sponsor-plan-field"
          segmentedClassName="sponsor-plan-field__group"
          label={t("tankSize")}
          value={createAmount}
          onChange={(value) => setObservable("createAmount", value)}
          options={CREATE_AMOUNTS.map((amount) => ({
            value: amount,
            disabled: busy,
            label: <span><CoinArt size={22} variant="gas" /><strong>{amount}</strong><small>GAS</small></span>,
          }))}
        />
        <OpenUiLiteSegmented
          className="sponsor-plan-field"
          segmentedClassName="sponsor-plan-field__group"
          label={t("maxPerWallet")}
          value={createMaxClaim}
          onChange={(value) => setObservable("createMaxClaim", value)}
          options={CLAIM_AMOUNTS.map((amount) => ({
            value: amount,
            disabled: busy || decimalToFixed8(amount) > decimalToFixed8(createAmount),
            label: <span><Fuel size={18} /><strong>{amount}</strong><small>{t("each")}</small></span>,
          }))}
        />
      </div>
    </>
  );

  const manageScene = selectedPool ? (
    <section className="sponsor-manage-scene">
      <div className="sponsor-manage-scene__identity">
        <CoinArt size={52} variant="gas" />
        <span>{t("yourPool")}</span>
        <strong>#{poolId(selectedPool)}</strong>
        <small>{compact(selectedPool.sponsor)}</small>
      </div>
      <div className="sponsor-manage-scene__meter">
        <div><span>{t("remainingFuel")}</span><strong>{formatFixed8(selectedPool.remainingAmountRaw)} GAS</strong></div>
        <progress max={100} value={fuelPercent} aria-label={t("poolFuelLevel")} />
        <div className="sponsor-manage-scene__facts">
          <span><Users size={14} /> {t("claimsCount", { count: clean(selectedPool.claimCount) || 0 })}</span>
          <span><Clock3 size={14} /> {timeRemaining(selectedPool.expiryTimeMs, t)}</span>
        </div>
      </div>
    </section>
  ) : (
    <section className="sponsor-manage-empty"><Gauge size={32} /><strong>{t("selectYourPool")}</strong></section>
  );

  const scene = (
    <div className="sponsor-station-shell" data-mode={mode} data-outcome={outcome.status || "idle"}>
      <div className="sponsor-mode-row">
        <OpenUiLiteSegmented
          className="sponsor-mode-switch"
          segmentedClassName="sponsor-mode-switch__group"
          label={t("modeLabel")}
          value={mode}
          onChange={(value) => setMode(value as SponsorMode)}
          options={modeOptions.map((option) => ({ ...option, disabled: actionBusy }))}
        />
        <span className="sponsor-network-badge"><ShieldCheck size={14} /> {networkLabel}</span>
      </div>

      {outcome.status && outcome.status !== "idle" && (
        <div className="sponsor-outcome" data-status={outcome.status} role={outcome.status === "failed" ? "alert" : "status"}>
          <span>{outcome.status === "confirmed" ? <ShieldCheck size={16} /> : outcome.status === "failed" ? <RefreshCw size={16} /> : <Clock3 size={16} />}</span>
          <div><strong>{t(`outcome_${outcome.status}`)}</strong><small>{outcome.message || t("outcomeFallback")}</small></div>
          {outcome.status === "confirmed" && <button type="button" onClick={() => void dispatch("dismissOutcome")}>{t("dismiss")}</button>}
        </div>
      )}

      {mode === "create" ? createScene : mode === "manage" ? manageScene : browseScene}
    </div>
  );

  const receiptDrawer = (
    <dl className="sponsor-receipt">
      <div><dt>{t("network")}</dt><dd>{networkLabel}</dd></div>
      <div><dt>{t("contract")}</dt><dd><code>{compact(contractHash)}</code></dd></div>
      <div><dt>{t("wallet")}</dt><dd><code>{compact(walletAddress)}</code></dd></div>
      <div><dt>{t("walletGas")}</dt><dd>{walletGasBalanceKnown ? `${formatFixed8(walletGasBalanceFixed8)} GAS` : "—"}</dd></div>
      <div><dt>{t("totalSponsored")}</dt><dd>{totalSponsored} GAS</dd></div>
      <div><dt>{t("totalClaimed")}</dt><dd>{totalClaimed} GAS</dd></div>
      {selectedPool && <>
        <div><dt>{t("sponsor")}</dt><dd><code>{compact(selectedPool.sponsor)}</code></dd></div>
        <div><dt>{t("yourClaimed")}</dt><dd>{userClaimedKnown ? `${formatFixed8(userClaimedFixed8)} GAS` : "—"}</dd></div>
        <div><dt>{t("expires")}</dt><dd>{new Date(asMillis(selectedPool.expiryTimeMs)).toLocaleString()}</dd></div>
      </>}
    </dl>
  );

  const tuneDrawer = mode === "create" ? (
    <div className="sponsor-tune-grid">
      <OpenUiLiteTextField label={t("exactPoolAmount")} value={createAmount} inputMode="decimal" onChange={(event) => setObservable("createAmount", event.target.value)} disabled={actionBusy} />
      <OpenUiLiteTextField label={t("exactMaxClaim")} value={createMaxClaim} inputMode="decimal" onChange={(event) => setObservable("createMaxClaim", event.target.value)} disabled={actionBusy} />
      <OpenUiLiteTextField className="sponsor-tune-grid__wide" label={t("poolDescription")} value={createDescription} maxLength={200} onChange={(event) => setObservable("createDescription", event.target.value)} disabled={actionBusy} />
      <p className="sponsor-drawer-hint"><ShieldCheck size={14} /> {t("createPaymentHint")}</p>
    </div>
  ) : (
    <div className="sponsor-tune-grid">
      <OpenUiLiteTextField label={t("exactClaimAmount")} value={claimAmount} inputMode="decimal" onChange={(event) => setObservable("claimAmount", event.target.value)} disabled={actionBusy} />
      <p className="sponsor-drawer-hint"><ShieldCheck size={14} /> {t("claimLimitHint", { amount: formatFixed8(selectedPoolClaimAvailableRaw) })}</p>
    </div>
  );

  const manageDrawer = selectedPoolIsMine && selectedPool ? (
    <div className="sponsor-manage-controls">
      <section>
        <div><Plus size={16} /><span><strong>{t("topUpPool")}</strong><small>{t("topUpPoolHint")}</small></span></div>
        <OpenUiLiteTextField label={t("topUpAmount")} value={topUpAmount} inputMode="decimal" onChange={(event) => setObservable("topUpAmount", event.target.value)} disabled={actionBusy} />
        <button type="button" onClick={() => void dispatch("topUpPool")} disabled={!canTopUp || actionBusy}>{t("topUpAction")}</button>
      </section>
      <section>
        <div><Clock3 size={16} /><span><strong>{t("extendPool")}</strong><small>{t("extendPoolHint")}</small></span></div>
        <OpenUiLiteSegmented
          className="sponsor-extend-field"
          segmentedClassName="sponsor-extend-field__group"
          label={t("extendDuration")}
          value={extendDurationMs}
          onChange={(value) => setObservable("extendDurationMs", value)}
          options={EXTEND_DURATIONS.map((option) => ({ value: option.value, label: t(option.key), disabled: actionBusy }))}
        />
        <button type="button" onClick={() => void dispatch("extendPool")} disabled={!canExtend || actionBusy}>{t("extendAction")}</button>
      </section>
      <section className="sponsor-manage-controls__withdraw">
        <div><ArrowLeftRight size={16} /><span><strong>{t("withdrawPool")}</strong><small>{t("withdrawPoolHint")}</small></span></div>
        <button
          type="button"
          data-armed={withdrawArmed || undefined}
          onClick={() => {
            if (!withdrawArmed) setWithdrawArmed(true);
            else {
              setWithdrawArmed(false);
              void dispatch("withdrawPool");
            }
          }}
          disabled={!canWithdraw || actionBusy}
        >
          {withdrawArmed ? t("confirmWithdraw") : t("reviewWithdraw")}
        </button>
      </section>
    </div>
  ) : <p className="sponsor-drawer-hint"><WalletCards size={15} /> {t("manageOwnPoolOnly")}</p>;

  const drawerModes = [
    { value: "receipt", label: t("drawerReceipt") },
    { value: "tune", label: t("drawerTune") },
    ...(selectedPoolIsMine ? [{ value: "manage", label: t("drawerManage") }] : []),
  ];
  const drawer = (
    <div className="sponsor-drawer">
      <OpenUiLiteSegmented
        className="sponsor-drawer-tabs"
        segmentedClassName="sponsor-drawer-tabs__group"
        label={t("drawerLabel")}
        value={drawerMode}
        onChange={(value) => setDrawerMode(value as DrawerMode)}
        options={drawerModes}
      />
      <div className="sponsor-drawer__panel" data-mode={drawerMode}>
        {drawerMode === "receipt" ? receiptDrawer : drawerMode === "manage" ? manageDrawer : tuneDrawer}
      </div>
    </div>
  );

  const primary = (() => {
    if (pending && canResumePending) {
      const pendingKind = clean(pendingOperation?.kind);
      return {
        label: actionBusy
          ? t("resumingTransaction")
          : t(pendingKind === "topUp" ? "resumeTopUp" : "resumeCreate"),
        icon: <ArrowLeftRight size={16} />,
        onClick: () => void dispatch("resumePending"),
        disabled: actionBusy,
        loading: actionBusy,
      };
    }
    if (pending) return {
      label: actionBusy ? t("checkingTransaction") : t("checkTransaction"),
      icon: <RefreshCw size={16} />,
      onClick: () => void dispatch("recoverPending"),
      disabled: actionBusy,
      loading: actionBusy,
    };
    if (!connected) return {
      label: actionBusy ? t("connectingWallet") : t("connectWallet"),
      icon: <WalletCards size={16} />,
      onClick: () => void dispatch("connectWallet"),
      disabled: actionBusy,
      loading: actionBusy,
    };
    if (mode === "create") return {
      label: actionBusy ? t("openingPool") : t("openPool"),
      icon: <HandCoins size={16} />,
      onClick: () => void dispatch("createPool"),
      disabled: !canCreate || actionBusy,
      loading: actionBusy,
    };
    if (mode === "manage") return {
      label: t("refreshPool"),
      icon: <RefreshCw size={16} />,
      onClick: () => void dispatch("refreshSelectedPool"),
      disabled: !selectedPool || actionBusy,
      loading: actionBusy,
    };
    if (!selectedPool || activePools.length === 0) return {
      label: t("startSponsorPool"),
      icon: <HandCoins size={16} />,
      onClick: () => setMode("create"),
      disabled: actionBusy,
      loading: actionBusy,
    };
    return {
      label: actionBusy ? t("claimingGas") : t("claimGas", { amount: claimAmount }),
      icon: <Fuel size={16} />,
      onClick: () => void dispatch("claimPool"),
      disabled: !canClaim || actionBusy,
      loading: actionBusy,
    };
  })();

  const secondary = mode === "browse"
    ? [
        { label: t("becomeSponsor"), icon: <HandCoins size={15} />, onClick: () => setMode("create"), disabled: actionBusy },
        ...(selectedPoolIsMine ? [{ label: t("managePool"), icon: <Gauge size={15} />, onClick: () => setMode("manage"), disabled: actionBusy }] : []),
      ]
    : [{ label: t("browsePools"), icon: <Fuel size={15} />, onClick: () => setMode("browse"), disabled: actionBusy }];

  return (
    <OpenUiLiteProvider>
      <div className="gas-sponsor-play-area mx2 mx2-cat-defi">
        <PlayStage
          category="defi"
          stage={{
            eyebrow: t("eyebrow"),
            title: stageTitle,
            subtitle: stageSubtitle,
            badges: <>
              <span className="mx2-badge" data-tone="success"><span className="mx2-badge__dot" /> {t("onChainPools")}</span>
              <span className="mx2-badge"><Coins size={13} /> {t("activePoolBadge", { count: statsActiveCount })}</span>
            </>,
          }}
          scene={scene}
          score={[
            { label: <span><Fuel size={14} /> {t("activePools")}</span>, value: statsActiveCount, accent: true },
            {
              label: <span><HandCoins size={14} /> {t("sponsored")}</span>,
              value: (
                <PhaseValue phase={statsPhase} placeholder={t("statsNeedNetwork")} skeletonWidth="4.5em">
                  {`${totalSponsored} GAS`}
                </PhaseValue>
              ),
            },
            { label: <span><Users size={14} /> {t("beneficiaries")}</span>, value: clean(platformStats.totalBeneficiaries) || "0" },
          ]}
          actions={{ primary, secondary }}
          drawerToggleLabel={t("details")}
          drawer={{ title: t("drawerTitle"), children: drawer }}
        />
      </div>
    </OpenUiLiteProvider>
  );
}
