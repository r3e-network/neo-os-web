/**
 * Burn League — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
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
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const burn = useBurnLeague({
      gameService: ctx.os.game,
      leaderboardService: ctx.os.leaderboard,
      badgeService: ctx.os.badge,
      t: ctx.t,
      getAddress: () => ctx.services.chain.address.get(),
    });

    const launchAmount = normalizeLaunchAmount(
      ctx.launchContext.params.amount ??
        ctx.launchContext.params.burnAmount ??
        ctx.launchContext.params.stake,
    );
    if (launchAmount) burn.burnAmount.set(launchAmount);

    ctx.registerAction("burn", async (amount: unknown) => {
      await ctx.services.notify.guard(
        () => burn.burnTokens(String(amount)),
        "burnSuccess",
      );
    });

    ctx.registerAction("setBurnAmount", async (amount: unknown) => {
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
        isBurning: burn.isBurning,
        isLoading: burn.isLoading,
        leagueDataAvailable: burn.leagueDataAvailable,
        serviceNotice: burn.serviceNotice,
        actionNotice: burn.actionNotice,
        burnValidationError: burn.burnValidationError,
        lastSubmittedAmount: burn.lastSubmittedAmount,
        totalBurnedDisplay: burn.totalBurnedDisplay,
        userBurnedDisplay: burn.userBurnedDisplay,
        rewardPoolDisplay: burn.rewardPoolDisplay,
        formattedRank: burn.formattedRank,
        leaderboardSize: burn.leaderboardSize,
        estimatedReward: burn.estimatedReward,
        projectedTotalBurnedDisplay: burn.projectedTotalBurnedDisplay,
        leaderboardPreview: burn.leaderboardPreview,
      },
      loadData: burn.loadAll,
    };
  },
});
