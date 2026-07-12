import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasLuckyPool } from "./composables/useGasLuckyPool";
import {
  createGuestEngine,
  normalizeGuestRange,
  type GuestBoardRow,
  type GuestRange,
} from "./logic/guest-engine";
import { GAS_LUCKY_REWARD_PLANS } from "./logic/game-rules";

// Default range (in local "luck points") for a guest draw when a caller does not
// carry a tier (the create-tab tier cards supply their own min/max).
const DEFAULT_GUEST_RANGE: GuestRange = { min: 1, max: 5 };
// Runtime kill-switch: the published hashes currently resolve to
// MiniAppRedEnvelope, not the PlatformSocial RangeGasPool ABI. Keep this false
// even for forged `mode=gamefi` launch parameters until a verified deployment,
// VRF policy and end-to-end recovery test are bound to the manifest.
export const GAS_LUCKY_GUEST_LOCAL_ENABLED = true;
export const GAS_LUCKY_ONEGATE_CLAIM_ENABLED = false;
export const GAS_LUCKY_RANGE_POOL_ENABLED = false;
export const GAS_LUCKY_GAMEFI_ENABLED =
  GAS_LUCKY_ONEGATE_CLAIM_ENABLED || GAS_LUCKY_RANGE_POOL_ENABLED;

function guestRangeFromForm(input: unknown): GuestRange {
  const form = (typeof input === "object" && input !== null ? input : {}) as {
    minClaim?: unknown;
    maxClaim?: unknown;
  };
  const min = Number(form.minClaim);
  const max = Number(form.maxClaim);
  return normalizeGuestRange({
    min: Number.isFinite(min) && min > 0 ? min : DEFAULT_GUEST_RANGE.min,
    max: Number.isFinite(max) && max > 0 ? max : DEFAULT_GUEST_RANGE.max,
  });
}

type OneGateClaimActionParams = {
  appId?: unknown;
  miniappId?: unknown;
  oneGateAppId?: unknown;
  oneGateId?: unknown;
  onegateAppId?: unknown;
  pool?: unknown;
  poolId?: unknown;
  campaignId?: unknown;
  address?: unknown;
  wallet?: unknown;
  walletAddress?: unknown;
  wallet_address?: unknown;
  account?: unknown;
  accountAddress?: unknown;
  account_address?: unknown;
  neoAddress?: unknown;
  neo_address?: unknown;
  recipient?: unknown;
  recipientAddress?: unknown;
  recipient_address?: unknown;
  userAddress?: unknown;
  user_address?: unknown;
  toAddress?: unknown;
  to_address?: unknown;
};

const WALLET_ADDRESS_ACTION_KEYS = [
  "address",
  "wallet",
  "walletAddress",
  "wallet_address",
  "account",
  "accountAddress",
  "account_address",
  "neoAddress",
  "neo_address",
  "recipient",
  "recipientAddress",
  "recipient_address",
  "userAddress",
  "user_address",
  "toAddress",
  "to_address",
] as const;

function walletAddressActionParams(params: OneGateClaimActionParams) {
  return Object.fromEntries(
    WALLET_ADDRESS_ACTION_KEYS.map((key) => [key, params[key]]),
  );
}

defineMiniApp({
  appId: "miniapp-gas-lucky-pool",
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const pool = useGasLuckyPool({
      app,
      launchContext: ctx.launchContext,
      t: ctx.t,
      paidLaneEnabled: GAS_LUCKY_GAMEFI_ENABLED,
      oneGateClaimEnabled: GAS_LUCKY_ONEGATE_CLAIM_ENABLED,
    });
    const isClaimLaunch =
      Boolean(pool.currentClaimKey.get()) &&
      (!ctx.launchContext.operation ||
        ctx.launchContext.operation === "claimPool" ||
        ctx.launchContext.operation === "claimOneGateVault");
    const isGuestMode = () => !GAS_LUCKY_RANGE_POOL_ENABLED || app.mode.isGuest();

    // ── Guest (free / local) mode ─────────────────────────────────────────────
    // GUEST reuses the SAME dispatch actions + scene observables, driven by a
    // purely local lucky-draw engine — no chain/oracle/reward calls. `appMode`
    // is surfaced to the PlayArea so its copy branches to local framing; the
    // guest stat observables feed the local score panel + off-chain board.
    const appMode = createObservable<string>(app.mode.get());
    if (isGuestMode()) appMode.set("guest");
    const guestBest = createObservable(0);
    const guestLast = createObservable(0);
    const guestDraws = createObservable(0);
    const guestBoard = createObservable<GuestBoardRow[]>([]);
    const a11yPlanIndex = createObservable(1);
    const a11yPlanRevision = createObservable(0);

    const guest = createGuestEngine({
      lastClaimAmount: pool.lastClaimAmount,
      lastClaimLuckPercent: pool.lastClaimLuckPercent,
      lastError: pool.lastError,
      lastTxid: pool.lastTxid,
      lastSuccessType: pool.lastSuccessType,
      claimStatus: pool.claimStatus,
      claimProgress: pool.claimProgress,
      currentClaimKey: pool.currentClaimKey,
      currentPoolId: pool.currentPoolId,
      currentPool: pool.currentPool,
      recentPools: pool.recentPools,
      recentClaims: pool.recentClaims,
      gasCredit: pool.gasCredit,
      guestBest,
      guestLast,
      guestDraws,
      guestBoard,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });
    // Switching to guest at the launcher resets to a clean local lobby and loads
    // the off-chain guest board (replacing the on-chain read done on mount).
    app.mode.onChange((mode) => {
      const effectiveMode = GAS_LUCKY_RANGE_POOL_ENABLED ? mode : "guest";
      appMode.set(effectiveMode);
      if (effectiveMode === "guest") {
        void guest.enter({ preserveClaimContext: isClaimLaunch });
      }
    });

    ctx.framework.actions.register("selectGuestPlan", async (...args: unknown[]) => {
      if (!isGuestMode()) return;
      const index = Number((args[0] as { index?: unknown } | undefined)?.index);
      if (!Number.isInteger(index) || index < 0 || index >= GAS_LUCKY_REWARD_PLANS.length) return;
      a11yPlanIndex.set(index);
      a11yPlanRevision.set(a11yPlanRevision.get() + 1);
    });

    ctx.framework.actions.register("createPool", async (...args: unknown[]) => {
      if (!GAS_LUCKY_RANGE_POOL_ENABLED || app.mode.isGuest()) {
        if (GAS_LUCKY_GUEST_LOCAL_ENABLED) {
          guest.draw(guestRangeFromForm(args[0]));
        }
        return;
      }
      const form = (args[0] ?? {}) as {
        totalAmount?: string;
        minClaim?: string;
        maxClaim?: string;
        maxClaims?: string;
        expiryHours?: string;
      };
      await ctx.framework.notify.guard(
        () => pool.createPool(form),
        { successKey: "poolCreated", errorKey: "createFailed" },
      );
    });

    const handleClaim = async (...args: unknown[]) => {
      const first = args[0];
      const params =
        typeof first === "object" && first !== null
          ? (first as OneGateClaimActionParams)
          : {};
      const claimKey =
        typeof first === "object" && first !== null
          ? String(
              (first as { claimKey?: unknown }).claimKey ??
                pool.currentClaimKey.get(),
            )
          : String(pool.currentClaimKey.get() || "");
      const poolId =
        typeof first === "object" && first !== null
          ? String(
              params.poolId ??
                params.pool ??
                params.campaignId ??
                pool.currentPoolId.get(),
            )
          : String(first ?? pool.currentPoolId.get());
      const wantsOneGateClaim = Boolean(claimKey);
      if (
        (wantsOneGateClaim && !GAS_LUCKY_ONEGATE_CLAIM_ENABLED) ||
        (!wantsOneGateClaim && !GAS_LUCKY_RANGE_POOL_ENABLED)
      ) {
        ctx.setStatus(ctx.t("gameFiMaintenanceBody"), "warning");
        return;
      }
      if (claimKey) pool.setClaimKey(claimKey);
      if (poolId) pool.setPoolId(poolId);
      await ctx.framework.notify.guard(
        () =>
          pool.claimPool(
            claimKey
              ? {
                  claimKey,
                  poolId,
                  oneGateAppId:
                    params.oneGateAppId ??
                    params.oneGateId ??
                    params.onegateAppId,
                  appId: params.appId ?? params.miniappId,
                  ...walletAddressActionParams(params),
                }
              : { poolId },
          ),
        {
          successKey: isClaimLaunch ? undefined : "claimSubmitted",
          errorKey: "claimFailed",
        },
      );
    };

    ctx.framework.actions.register("claimPool", handleClaim);
    // The host operation_panel "Claim Reward" button dispatches the manifest's
    // declared method name (claimOneGateVault); without this alias the host
    // primary button silently no-ops (MiniAppRoot console.warns on the missing
    // handler). Reuse the exact claimPool body so both entry points behave the
    // same.
    ctx.framework.actions.register("claimOneGateVault", handleClaim);

    ctx.framework.actions.register("checkClaimStatus", async (...args: unknown[]) => {
      if (!GAS_LUCKY_ONEGATE_CLAIM_ENABLED) return;
      const first = args[0];
      const params =
        typeof first === "object" && first !== null
          ? (first as OneGateClaimActionParams)
          : {};
      const claimKey =
        typeof first === "object" && first !== null
          ? String(
              (first as { claimKey?: unknown }).claimKey ??
                pool.currentClaimKey.get(),
            )
          : String(first ?? pool.currentClaimKey.get());
      if (claimKey) pool.setClaimKey(claimKey);
      await ctx.framework.notify.guard(
        () =>
          pool.checkClaimStatus({
            claimKey,
            poolId: params.poolId ?? params.pool ?? params.campaignId,
            oneGateAppId:
              params.oneGateAppId ?? params.oneGateId ?? params.onegateAppId,
            appId: params.appId ?? params.miniappId,
            ...walletAddressActionParams(params),
          }),
        { errorKey: "claimStatusFailed" },
      );
    });

    ctx.framework.actions.register("loadPool", async (...args: unknown[]) => {
      if (!GAS_LUCKY_RANGE_POOL_ENABLED || app.mode.isGuest()) return;
      const first = args[0];
      const poolId =
        typeof first === "object" && first !== null
          ? String((first as { poolId?: unknown }).poolId ?? pool.currentPoolId.get())
          : String(first ?? pool.currentPoolId.get());
      pool.setPoolId(poolId);
      await ctx.framework.notify.guard(
        () => pool.loadPool(poolId),
        { errorKey: "loadFailed" },
      );
    });

    ctx.framework.actions.register("refundPool", async (...args: unknown[]) => {
      if (!GAS_LUCKY_RANGE_POOL_ENABLED || app.mode.isGuest()) return;
      const first = args[0];
      const poolId =
        typeof first === "object" && first !== null
          ? String((first as { poolId?: unknown }).poolId ?? pool.currentPoolId.get())
          : String(first ?? pool.currentPoolId.get());
      pool.setPoolId(poolId);
      await ctx.framework.notify.guard(
        () => pool.refundPool(poolId),
        { successKey: "refundSubmitted", errorKey: "refundFailed" },
      );
    });

    ctx.framework.actions.register("topUpPool", async (...args: unknown[]) => {
      if (!GAS_LUCKY_RANGE_POOL_ENABLED || app.mode.isGuest()) return;
      const first = args[0];
      const poolId =
        typeof first === "object" && first !== null
          ? String((first as { poolId?: unknown }).poolId ?? pool.currentPoolId.get())
          : String(first ?? pool.currentPoolId.get());
      const amount =
        typeof first === "object" && first !== null
          ? String((first as { amount?: unknown }).amount ?? "")
          : String(args[1] ?? "");
      pool.setPoolId(poolId);
      await ctx.framework.notify.guard(
        () => pool.topUpPool({ poolId, amount }),
        { successKey: "topUpSubmitted", errorKey: "topUpFailed" },
      );
    });

    ctx.framework.actions.register("loadGasCredit", async () => {
      if (!GAS_LUCKY_RANGE_POOL_ENABLED || app.mode.isGuest()) return;
      await ctx.framework.notify.guard(
        () => pool.loadGasCredit(),
        { successKey: "gasCreditLoaded", errorKey: "loadFailed" },
      );
    });

    ctx.framework.actions.register("withdrawGasCredit", async () => {
      if (!GAS_LUCKY_RANGE_POOL_ENABLED || app.mode.isGuest()) return;
      await ctx.framework.notify.guard(
        () => pool.withdrawGasCredit(),
        { successKey: "gasCreditWithdrawn", errorKey: "withdrawGasCreditFailed" },
      );
    });

    return {
      state: {
        currentPoolId: pool.currentPoolId,
        currentClaimKey: pool.currentClaimKey,
        currentPool: pool.currentPool,
        recentPools: pool.recentPools,
        recentClaims: pool.recentClaims,
        isLoading: pool.isLoading,
        isCreating: pool.isCreating,
        isClaiming: pool.isClaiming,
        isRefunding: pool.isRefunding,
        isFunding: pool.isFunding,
        isCreditLoading: pool.isCreditLoading,
        isWithdrawingCredit: pool.isWithdrawingCredit,
        lastTxid: pool.lastTxid,
        lastClaimAmount: pool.lastClaimAmount,
        lastClaimPoolId: pool.lastClaimPoolId,
        lastClaimKey: pool.lastClaimKey,
        lastClaimLuckPercent: pool.lastClaimLuckPercent,
        claimStatus: pool.claimStatus,
        claimProgress: pool.claimProgress,
        lastRefundAmount: pool.lastRefundAmount,
        lastRefundPoolId: pool.lastRefundPoolId,
        lastFundAmount: pool.lastFundAmount,
        lastFundPoolId: pool.lastFundPoolId,
        lastSuccessType: pool.lastSuccessType,
        lastError: pool.lastError,
        gasCredit: pool.gasCredit,
        gasCreditGas: pool.gasCreditGas,
        poolCount: pool.poolCount,
        claimCount: pool.claimCount,
        activePoolCount: pool.activePoolCount,
        totalRemaining: pool.totalRemaining,
        totalRemainingGas: pool.totalRemainingGas,
        currentShareUrl: pool.currentShareUrl,
        currentRange: pool.currentRange,
        appMode,
        guestBest,
        guestLast,
        guestDraws,
        guestBoard,
        a11yPlanIndex,
        a11yPlanRevision,
      },
      // loadData runs on mount (default "gamefi") and again on a guest switch.
      // In guest we skip every on-chain read and (re)initialize the local lobby
      // so a mount-time gamefi read never overwrites the guest surface.
      loadData: async () => {
        if (!GAS_LUCKY_RANGE_POOL_ENABLED || app.mode.isGuest()) {
          await guest.enter({ preserveClaimContext: isClaimLaunch });
          return;
        }
        if (isClaimLaunch) return;
        await pool.loadAll();
      },
    };
  },
});
