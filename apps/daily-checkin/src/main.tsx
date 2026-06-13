/**
 * Daily Check-in — React Entry Point
 *
 * Uses the React defineMiniApp runtime. The domain logic talks directly to the
 * app's standalone on-chain contract via ctx.services.chain (the legacy
 * ctx.os.checkin Morpheus proxy is non-operational).
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useCheckin } from "./composables/useCheckin";

defineMiniApp({
  appId: "miniapp-dailycheckin",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const checkin = useCheckin({
      chain: ctx.services.chain,
      t: ctx.t,
    });

    checkin.startTimer();

    ctx.registerAction("doCheckIn", async () => {
      await ctx.services.notify.guard(() => checkin.doCheckIn(), "checkinSuccess");
    });

    ctx.registerAction("claimRewards", async () => {
      await ctx.services.notify.guard(() => checkin.claimRewards(), "claimSuccess");
    });

    ctx.registerAction("refreshStatus", async () => {
      await ctx.services.notify.guard(() => checkin.refreshStatus(), "statusLoaded");
    });

    return {
      state: {
        currentStreak: checkin.formattedCurrentStreak,
        highestStreak: checkin.formattedHighestStreak,
        totalUserCheckins: checkin.totalUserCheckins,
        unclaimedRewards: checkin.unclaimedRewards,
        totalClaimed: checkin.totalClaimed,
        checkInFee: checkin.checkInFee,
        totalGlobalCheckins: checkin.totalGlobalCheckins,
        totalGlobalUsers: checkin.totalGlobalUsers,
        totalGlobalRewarded: checkin.totalGlobalRewarded,
        rewardPoolBalance: checkin.rewardPoolBalance,
        isPaused: checkin.isPaused,
        rewardsUnderfunded: checkin.rewardsUnderfunded,
        claimableButUnfunded: checkin.claimableButUnfunded,
        currentStreakRaw: checkin.currentStreak,
        highestStreakRaw: checkin.highestStreak,
        canCheckIn: checkin.canCheckIn,
        hasLoadedStatus: checkin.hasLoadedStatus,
        isLoading: checkin.isLoading,
        isClaiming: checkin.isClaiming,
        isCheckingIn: checkin.isCheckingIn,
        isRefreshing: checkin.isRefreshing,
        workflowStatus: checkin.workflowStatus,
        lastError: checkin.lastError,
        latestRequest: checkin.latestRequest,
        latestResult: checkin.latestResult,
        utcTimeDisplay: checkin.utcTimeDisplay,
        nextUtcMidnight: checkin.nextUtcMidnight,
        checkinHistory: checkin.checkinHistory,
      },
      loadData: checkin.loadAll,
      cleanup: checkin.stopTimer,
    };
  },
});
