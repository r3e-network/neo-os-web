import { defineMiniApp } from "@shared/react/defineMiniApp";
import { createObservable } from "@shared/react/context";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasLuckyPool } from "./composables/useGasLuckyPool";
import { createGuestEngine, type GuestBoardRow, type GuestRange } from "./logic/guest-engine";

// Default range (in local "luck points") for a guest draw when a caller does not
// carry a tier (the create-tab tier cards supply their own min/max).
const DEFAULT_GUEST_RANGE: GuestRange = { min: 1, max: 5 };

function guestRangeFromForm(input: unknown): GuestRange {
  const form = (typeof input === "object" && input !== null ? input : {}) as {
    minClaim?: unknown;
    maxClaim?: unknown;
  };
  const min = Number(form.minClaim);
  const max = Number(form.maxClaim);
  return {
    min: Number.isFinite(min) && min > 0 ? min : DEFAULT_GUEST_RANGE.min,
    max: Number.isFinite(max) && max > 0 ? max : DEFAULT_GUEST_RANGE.max,
  };
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
    });
    const isClaimLaunch =
      Boolean(pool.currentClaimKey.get()) &&
      (!ctx.launchContext.operation ||
        ctx.launchContext.operation === "claimPool" ||
        ctx.launchContext.operation === "claimOneGateVault");

    // ── Guest (free / local) mode ─────────────────────────────────────────────
    // GUEST reuses the SAME dispatch actions + scene observables, driven by a
    // purely local lucky-draw engine — no chain/oracle/reward calls. `appMode`
    // is surfaced to the PlayArea so its copy branches to local framing; the
    // guest stat observables feed the local score panel + off-chain board.
    const appMode = createObservable<string>(app.mode.get());
    const guestBest = createObservable(0);
    const guestLast = createObservable(0);
    const guestDraws = createObservable(0);
    const guestBoard = createObservable<GuestBoardRow[]>([]);

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
      appMode.set(mode);
      if (mode === "guest") void guest.enter();
    });

    ctx.framework.actions.register("createPool", async (...args: unknown[]) => {
      if (app.mode.isGuest()) { guest.draw(guestRangeFromForm(args[0])); return; }
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
      if (app.mode.isGuest()) { guest.draw(DEFAULT_GUEST_RANGE); return; }
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
      if (app.mode.isGuest()) return;
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
      if (app.mode.isGuest()) return;
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
      if (app.mode.isGuest()) return;
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
      if (app.mode.isGuest()) return;
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
      if (app.mode.isGuest()) return;
      await ctx.framework.notify.guard(
        () => pool.loadGasCredit(),
        { successKey: "gasCreditLoaded", errorKey: "loadFailed" },
      );
    });

    ctx.framework.actions.register("withdrawGasCredit", async () => {
      if (app.mode.isGuest()) return;
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
      },
      // loadData runs on mount (default "gamefi") and again on a guest switch.
      // In guest we skip every on-chain read and (re)initialize the local lobby
      // so a mount-time gamefi read never overwrites the guest surface.
      loadData: async () => {
        if (app.mode.isGuest()) {
          await guest.enter();
          return;
        }
        if (isClaimLaunch) return;
        await pool.loadAll();
      },
    };
  },
});
