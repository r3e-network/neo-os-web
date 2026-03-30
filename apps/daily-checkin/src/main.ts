/**
 * Daily Check-in — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.checkin) instead of
 * direct chain calls. The CheckinProxy handles all contract interaction
 * through edge functions, so the miniapp never touches contract hashes,
 * parameter encoding, or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useCheckin({ checkinService: ctx.os.checkin, t })
 *
 * The composable calls:
 *   ctx.os.checkin.getStreak()    — load user stats
 *   ctx.os.checkin.checkIn()      — perform daily check-in
 *   ctx.os.checkin.claimRewards() — claim accumulated rewards
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useCheckin } from "./composables/useCheckin";

defineMiniApp({
  appId: "miniapp-dailycheckin",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function — wires OS checkin service to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os.checkin (the OS
   * CheckinProxy) for all data loading and mutations instead of
   * ctx.services.chain directly.
   */
  setup(ctx) {
    const checkin = useCheckin({
      checkinService: ctx.os.checkin,
      t: ctx.t,
    });

    // Start the UTC countdown timer immediately
    checkin.startTimer();

    // Register actions so they can be called from operation panels or
    // from the PlayArea via the injected action registry.
    registerActions(ctx, {
      doCheckIn: { handler: checkin.doCheckIn, successKey: "checkinSuccess" },
      claimRewards: {
        handler: checkin.claimRewards,
        successKey: "claimSuccess",
      },
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys must match the `valueKey` fields in manifest.ts.
      // The platform reads these to render stats grid, sidebar, etc.
      state: {
        // User stats (formatted for display)
        currentStreak: checkin.formattedCurrentStreak,
        highestStreak: checkin.formattedHighestStreak,
        totalUserCheckins: checkin.totalUserCheckins,
        unclaimedRewards: checkin.unclaimedRewards,
        totalClaimed: checkin.totalClaimed,

        // Global stats (raw numbers — platform formats via manifest)
        totalGlobalCheckins: checkin.totalGlobalCheckins,
        totalGlobalUsers: checkin.totalGlobalUsers,
        totalGlobalRewarded: checkin.totalGlobalRewarded,

        // Additional state the PlayArea reads via props
        currentStreakRaw: checkin.currentStreak,
        highestStreakRaw: checkin.highestStreak,
        canCheckIn: checkin.canCheckIn,
        isLoading: checkin.isLoading,
        isClaiming: checkin.isClaiming,
        utcTimeDisplay: checkin.utcTimeDisplay,
        nextUtcMidnight: checkin.nextUtcMidnight,
        checkinHistory: checkin.checkinHistory,
      },

      // ── Lifecycle ─────────────────────────────────────────────────
      // Called by the platform on mount and when the wallet reconnects.
      loadData: checkin.loadAll,
    };
  },
});
