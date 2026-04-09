/**
 * Daily Check-in — React Entry Point
 *
 * Uses the React defineMiniApp runtime with OS service proxies.
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
      checkinService: ctx.os.checkin,
      t: ctx.t,
    });

    checkin.startTimer();

    ctx.registerAction("doCheckIn", async () => {
      await ctx.services.notify.guard(() => checkin.doCheckIn(), "checkinSuccess");
    });

    ctx.registerAction("claimRewards", async () => {
      await ctx.services.notify.guard(() => checkin.claimRewards(), "claimSuccess");
    });

    return {
      state: {
        currentStreak: checkin.formattedCurrentStreak,
        highestStreak: checkin.formattedHighestStreak,
        totalUserCheckins: checkin.totalUserCheckins,
        unclaimedRewards: checkin.unclaimedRewards,
        totalClaimed: checkin.totalClaimed,
        totalGlobalCheckins: checkin.totalGlobalCheckins,
        totalGlobalUsers: checkin.totalGlobalUsers,
        totalGlobalRewarded: checkin.totalGlobalRewarded,
        currentStreakRaw: checkin.currentStreak,
        highestStreakRaw: checkin.highestStreak,
        canCheckIn: checkin.canCheckIn,
        isLoading: checkin.isLoading,
        isClaiming: checkin.isClaiming,
        utcTimeDisplay: checkin.utcTimeDisplay,
        nextUtcMidnight: checkin.nextUtcMidnight,
        checkinHistory: checkin.checkinHistory,
      },
      loadData: checkin.loadAll,
    };
  },
});
