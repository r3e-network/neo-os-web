/**
 * Burn League — React Entry Point
 *
 * Drives the standalone on-chain MiniAppBurnLeague contract directly via
 * ctx.framework.chain (no OS service proxies). The composable owns all contract
 * reads/writes; this file wires the chain service, the burn/settle/refresh
 * actions, and the 1s season-countdown ticker.
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useBurnLeague } from "./composables/useBurnLeague";

function normalizeLaunchAmount(value: unknown): string {
  const raw = String(value ?? "")
    .trim()
    .replace(/\s*GAS$/i, "");
  if (!raw) return "";

  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) return "";

  const boundedAmount = Math.max(1, Math.min(amount, 1_000));
  return Number(boundedAmount.toFixed(8)).toString();
}

defineMiniApp({
  appId: "miniapp-burn-league",
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    // getAddress omitted: the composable defaults to app.chain.address.get(),
    // which is the same observable passthrough.
    const burn = useBurnLeague({
      app: ctx.framework,
      t: ctx.t,
    });

    burn.setAddress(ctx.framework.chain.address.get() ?? null);

    // Tick the season countdown / phase derivation once per second.
    const tickerInterval = setInterval(() => burn.updateNow(), 1000);

    const launchAmount = normalizeLaunchAmount(
      ctx.launchContext.params.amount ??
        ctx.launchContext.params.burnAmount ??
        ctx.launchContext.params.stake,
    );
    if (launchAmount) burn.burnAmount.set(launchAmount);

    // successKey delegates the success/error toasts to the framework's own
    // notify.guardResult wrapping — same semantics as the hand-rolled
    // app.notify.guard (toast on success, toast + swallow on error).
    ctx.framework.actions.register(
      "burn",
      async (amount: unknown) => {
        await burn.burnTokens(String(amount));
      },
      { successKey: "burnSuccess" },
    );

    ctx.framework.actions.register(
      "settle",
      async () => {
        await burn.settleSeason();
      },
      { successKey: "settleSuccess" },
    );

    ctx.framework.actions.register("withdrawCredit", async () => {
      await ctx.framework.notify.guard(async () => {
        const { amount } = await burn.withdrawCredit();
        if (amount > 0) {
          ctx.framework.notify.success("creditWithdrawn", {
            amount: Number(amount.toFixed(4)),
            tokenGas: ctx.t("tokenGas"),
          });
        }
      });
    });

    ctx.framework.actions.register("setBurnAmount", async (amount: unknown) => {
      if (typeof amount === "string") burn.burnAmount.set(amount);
    });

    return {
      state: {
        totalBurned: burn.totalBurned,
        userBurned: burn.userBurned,
        rewardPool: burn.rewardPool,
        rank: burn.rank,
        burnCount: burn.burnCount,
        leaderboard: burn.leaderboard,
        burnAmount: burn.burnAmount,
        minBurnGas: burn.minBurnGas,
        maxBurnGas: burn.maxBurnGas,
        isBurning: burn.isBurning,
        isSettling: burn.isSettling,
        isLoading: burn.isLoading,
        leagueDataAvailable: burn.leagueDataAvailable,
        serviceNotice: burn.serviceNotice,
        actionNotice: burn.actionNotice,
        burnValidationError: burn.burnValidationError,
        lastSubmittedAmount: burn.lastSubmittedAmount,
        prepaidCredit: burn.prepaidCredit,
        prepaidCreditDisplay: burn.prepaidCreditDisplay,
        totalBurnedDisplay: burn.totalBurnedDisplay,
        userBurnedDisplay: burn.userBurnedDisplay,
        rewardPoolDisplay: burn.rewardPoolDisplay,
        formattedRank: burn.formattedRank,
        leaderboardSize: burn.leaderboardSize,
        projectedTotalBurnedDisplay: burn.projectedTotalBurnedDisplay,
        leaderboardPreview: burn.leaderboardPreview,
        // Season lifecycle + real prize model
        seasonPhase: burn.seasonPhase,
        isSeasonActive: burn.isSeasonActive,
        needsSettle: burn.needsSettle,
        countdown: burn.countdown,
        seasonStatusLabel: burn.seasonStatusLabel,
        formattedSeason: burn.formattedSeason,
        seasonDurationLabel: burn.seasonDurationLabel,
        prizePoolDisplay: burn.prizePoolDisplay,
        topBurnedDisplay: burn.topBurnedDisplay,
        leaderLabel: burn.leaderLabel,
        userIsLeader: burn.userIsLeader,
        lastSettleResult: burn.lastSettleResult,
      },
      loadData: burn.loadAll,
      cleanup: () => {
        clearInterval(tickerInterval);
      },
    };
  },
});
