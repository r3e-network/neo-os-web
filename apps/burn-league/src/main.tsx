/**
 * Burn League — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useBurnLeague } from "./composables/useBurnLeague";

defineMiniApp({
  appId: "miniapp-burn-league",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const burn = useBurnLeague({
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      leaderboardService: ctx.os.leaderboard,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      t: ctx.t,
    });

    ctx.registerAction("burn", async (amount: unknown) => {
      await ctx.services.notify.guard(
        () => burn.burnGas(String(amount)),
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
        leaderboard: burn.leaderboard,
        burnAmount: burn.burnAmount,
        isBurning: burn.isBurning,
        isLoading: burn.isLoading,
        totalBurnedDisplay: burn.totalBurnedDisplay,
        userBurnedDisplay: burn.userBurnedDisplay,
        rewardPoolDisplay: burn.rewardPoolDisplay,
        formattedRank: burn.formattedRank,
        leaderboardSize: burn.leaderboardSize,
        estimatedReward: burn.estimatedReward,
        leaderboardPreview: burn.leaderboardPreview,
      },
      loadData: burn.loadAll,
    };
  },
});
