/**
 * Daily Check-in — React Entry Point
 *
 * Uses the React defineMiniApp runtime. The domain logic talks directly to the
 * app's standalone on-chain contract via the framework chain layer
 * (ctx.framework.chain — the legacy ctx.os.checkin Morpheus proxy is
 * non-operational).
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
      app: ctx.framework,
      t: ctx.t,
    });

    checkin.startTimer();

    ctx.framework.actions.register("doCheckIn", () => checkin.doCheckIn(), {
      successKey: "checkinSuccess",
    });
    ctx.framework.actions.register("claimRewards", () => checkin.claimRewards(), {
      successKey: "claimSuccess",
    });
    ctx.framework.actions.register("refreshStatus", () => checkin.refreshStatus(), {
      successKey: "statusLoaded",
    });

    return {
      state: {
        currentStreak: checkin.formattedCurrentStreak,
        highestStreak: checkin.formattedHighestStreak,
        totalUserCheckins: checkin.totalUserCheckins,
        // GAS amounts are formatted "<amount> GAS" strings for display — the
        // composable keeps the raw base-unit observables for its own guards.
        unclaimedRewards: checkin.formattedUnclaimed,
        totalClaimed: checkin.formattedTotalClaimed,
        checkInFee: checkin.checkInFee,
        totalGlobalCheckins: checkin.totalGlobalCheckins,
        totalGlobalUsers: checkin.totalGlobalUsers,
        totalGlobalRewarded: checkin.formattedTotalRewarded,
        rewardPoolBalance: checkin.formattedRewardPool,
        weekRewardLabel: checkin.formattedWeekReward,
        twoWeekRewardLabel: checkin.formattedTwoWeekReward,
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
