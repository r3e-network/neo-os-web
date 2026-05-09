import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useGasLuckyPool } from "./composables/useGasLuckyPool";

defineMiniApp({
  appId: "miniapp-gas-lucky-pool",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const pool = useGasLuckyPool({
      chain: ctx.services.chain,
      launchContext: ctx.launchContext,
      t: ctx.t,
    });

    ctx.registerAction("createPool", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        totalAmount?: string;
        minClaim?: string;
        maxClaim?: string;
        maxClaims?: string;
        expiryHours?: string;
      };
      await ctx.services.notify.guard(
        () => pool.createPool(form),
        "poolCreated",
        "createFailed",
      );
    });

    ctx.registerAction("claimPool", async (...args: unknown[]) => {
      const first = args[0];
      const params =
        typeof first === "object" && first !== null
          ? (first as {
              appId?: unknown;
              miniappId?: unknown;
              oneGateAppId?: unknown;
              oneGateId?: unknown;
              onegateAppId?: unknown;
              pool?: unknown;
              poolId?: unknown;
              campaignId?: unknown;
            })
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
      await ctx.services.notify.guard(
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
                }
              : { poolId },
          ),
        "claimSubmitted",
        "claimFailed",
      );
    });

    ctx.registerAction("checkClaimStatus", async (...args: unknown[]) => {
      const first = args[0];
      const params =
        typeof first === "object" && first !== null
          ? (first as {
              appId?: unknown;
              miniappId?: unknown;
              oneGateAppId?: unknown;
              oneGateId?: unknown;
              onegateAppId?: unknown;
              pool?: unknown;
              poolId?: unknown;
              campaignId?: unknown;
            })
          : {};
      const claimKey =
        typeof first === "object" && first !== null
          ? String(
              (first as { claimKey?: unknown }).claimKey ??
                pool.currentClaimKey.get(),
            )
          : String(first ?? pool.currentClaimKey.get());
      if (claimKey) pool.setClaimKey(claimKey);
      await ctx.services.notify.guard(
        () =>
          pool.checkClaimStatus({
            claimKey,
            poolId: params.poolId ?? params.pool ?? params.campaignId,
            oneGateAppId:
              params.oneGateAppId ?? params.oneGateId ?? params.onegateAppId,
            appId: params.appId ?? params.miniappId,
          }),
        undefined,
        "claimStatusFailed",
      );
    });

    ctx.registerAction("loadPool", async (...args: unknown[]) => {
      const first = args[0];
      const poolId =
        typeof first === "object" && first !== null
          ? String((first as { poolId?: unknown }).poolId ?? pool.currentPoolId.get())
          : String(first ?? pool.currentPoolId.get());
      pool.setPoolId(poolId);
      await ctx.services.notify.guard(
        () => pool.loadPool(poolId),
        undefined,
        "loadFailed",
      );
    });

    ctx.registerAction("refundPool", async (...args: unknown[]) => {
      const first = args[0];
      const poolId =
        typeof first === "object" && first !== null
          ? String((first as { poolId?: unknown }).poolId ?? pool.currentPoolId.get())
          : String(first ?? pool.currentPoolId.get());
      pool.setPoolId(poolId);
      await ctx.services.notify.guard(
        () => pool.refundPool(poolId),
        "refundSubmitted",
        "refundFailed",
      );
    });

    ctx.registerAction("topUpPool", async (...args: unknown[]) => {
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
      await ctx.services.notify.guard(
        () => pool.topUpPool({ poolId, amount }),
        "topUpSubmitted",
        "topUpFailed",
      );
    });

    ctx.registerAction("loadGasCredit", async () => {
      await ctx.services.notify.guard(
        () => pool.loadGasCredit(),
        "gasCreditLoaded",
        "loadFailed",
      );
    });

    ctx.registerAction("withdrawGasCredit", async () => {
      await ctx.services.notify.guard(
        () => pool.withdrawGasCredit(),
        "gasCreditWithdrawn",
        "withdrawGasCreditFailed",
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
      },
      loadData: pool.loadAll,
    };
  },
});
