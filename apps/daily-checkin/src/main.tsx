import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  useCheckin,
  type DailyCheckinActionResult,
} from "./composables/useCheckin";

defineMiniApp({
  appId: "miniapp-dailycheckin",
  playArea: PlayArea,
  manifest,
  messages,
  storagePrefix: "daily-checkin:",

  setup(ctx) {
    const checkin = useCheckin({ app: ctx.framework, t: ctx.t });
    checkin.startTimer();

    const showOutcome = (result: DailyCheckinActionResult | null | undefined) => {
      if (!result) return result;
      if (result.status === "confirmed") {
        ctx.setStatus(ctx.t("transactionConfirmed"), "success");
      } else if (result.status === "fault") {
        ctx.setStatus(ctx.t("transactionFaulted"), "error");
      } else {
        ctx.setStatus(ctx.t("transactionPending"), "warning");
      }
      return result;
    };

    ctx.framework.actions.register("connectWallet", async () => {
      const address = await checkin.connectWallet();
      if (address) ctx.setStatus(ctx.t("walletConnected"), "success");
      return address;
    });
    ctx.framework.actions.register("doCheckIn", async () =>
      showOutcome(await checkin.doCheckIn()));
    ctx.framework.actions.register("claimRewards", async () =>
      showOutcome(await checkin.claimRewards()));
    ctx.framework.actions.register("refreshStatus", async () => {
      await checkin.refreshStatus();
      ctx.setStatus(ctx.t("statusLoaded"), "success");
    });
    ctx.framework.actions.register("recoverPending", async () =>
      showOutcome(await checkin.recoverPendingOperation()));

    return {
      state: {
        network: checkin.network,
        contractHash: checkin.contractHash,
        hasLoadedContext: checkin.hasLoadedContext,
        dataSource: checkin.dataSource,
        walletAddress: checkin.walletAddress,
        currentStreak: checkin.formattedCurrentStreak,
        highestStreak: checkin.formattedHighestStreak,
        currentStreakRaw: checkin.currentStreak,
        highestStreakRaw: checkin.highestStreak,
        totalUserCheckins: checkin.totalUserCheckins,
        unclaimedRewards: checkin.formattedUnclaimed,
        unclaimedRewardsRaw: checkin.unclaimedRewards,
        totalClaimed: checkin.formattedTotalClaimed,
        checkInFee: checkin.formattedCheckInFee,
        totalGlobalCheckins: checkin.totalGlobalCheckins,
        totalGlobalUsers: checkin.totalGlobalUsers,
        totalGlobalRewarded: checkin.formattedTotalRewarded,
        rewardPoolBalance: checkin.formattedRewardPool,
        weekRewardLabel: checkin.formattedWeekReward,
        twoWeekRewardLabel: checkin.formattedTwoWeekReward,
        isPaused: checkin.isPaused,
        streakWillReset: checkin.streakWillReset,
        nextRewardDay: checkin.nextRewardDay,
        rewardsUnderfunded: checkin.rewardsUnderfunded,
        claimableButUnfunded: checkin.claimableButUnfunded,
        hasClaimableRewards: checkin.hasClaimableRewards,
        canCheckIn: checkin.canCheckIn,
        hasLoadedPlatform: checkin.hasLoadedPlatform,
        hasLoadedStatus: checkin.hasLoadedStatus,
        isLoading: checkin.isLoading,
        isSubmitting: checkin.isSubmitting,
        isRecovering: checkin.isRecovering,
        isWalletConnecting: checkin.isWalletConnecting,
        activeAction: checkin.activeAction,
        workflowStatus: checkin.workflowStatus,
        lastError: checkin.lastError,
        lastSuccess: checkin.lastSuccess,
        transactionNotice: checkin.transactionNotice,
        lastConfirmedKind: checkin.lastConfirmedKind,
        latestRequest: checkin.latestRequest,
        latestResult: checkin.latestResult,
        pendingOperation: checkin.pendingOperation,
        utcTimeDisplay: checkin.utcTimeDisplay,
        nextUtcMidnight: checkin.nextUtcMidnight,
        currentUtcDay: checkin.currentUtcDay,
        checkinHistory: checkin.checkinHistory,
      },
      loadData: async () => {
        await checkin.loadAll();
        if (checkin.pendingOperation.get() && checkin.walletAddress.get()) {
          await checkin.recoverPendingOperation();
        }
      },
      cleanup: checkin.cleanup,
    };
  },
});
