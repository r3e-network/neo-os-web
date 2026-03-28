/**
 * Daily Check-in — Entry Point (New Pattern)
 *
 * This is the REFERENCE implementation of the defineMiniApp() pattern.
 * Every miniapp should follow this structure:
 *
 *   1. Import the play area component (the only custom UI)
 *   2. Import the manifest (declarative config for platform sections)
 *   3. Import i18n messages
 *   4. Import the domain composable
 *   5. Call defineMiniApp() with a setup function that wires them together
 *
 * The setup function:
 *   - Receives a MiniAppContext with `t` (i18n), `services`, `setStatus`, etc.
 *   - Instantiates the domain composable (passing chain + events from services)
 *   - Returns `state` whose keys match manifest valueKeys for stats/sidebar
 *   - Returns `loadData` for the platform to call on mount and wallet-connect
 *   - Registers action handlers for any operation panel buttons
 *
 * The platform then:
 *   - Mounts the Vue app with the standard shell
 *   - Renders tabs, sidebar, stats from manifest + state bindings
 *   - Renders PlayArea in the content slot (receiving t, state, services as props)
 *   - Handles wallet connection, error boundaries, fireworks, etc.
 *
 * Compare with the legacy initialization (3 files, ~170 lines, mixed concerns):
 *   Legacy: main.ts -> App.vue -> StandardAppShell -> IndexPage
 *           -> createMiniApp() -> useCheckinPage() -> useCheckinContract()
 *   New:    main.ts -> defineMiniApp({ playArea, manifest, setup })
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import { PlatformServices } from "@shared/services";
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
   * Setup function — the bridge between domain logic and the platform.
   *
   * Called once when the miniapp mounts. The platform provides:
   *   ctx.t         — i18n translation function
   *   ctx.services  — platform services (stub until full integration)
   *   ctx.setStatus — show a toast/status message
   *   ctx.registerAction — register operation panel action handlers
   *
   * Returns:
   *   state    — reactive values matching manifest valueKey entries
   *   loadData — called by the platform on mount and wallet reconnect
   */
  setup(ctx) {
    // Create the real PlatformServices with the i18n function.
    // This gives the composable access to ChainService, EventBus, etc.
    const platformServices = PlatformServices.create("miniapp-dailycheckin", {
      t: ctx.t as (key: string) => string,
    });

    const checkin = useCheckin({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // Start the UTC countdown timer immediately
    checkin.startTimer();

    // Register actions so they can be called from operation panels or
    // from the PlayArea via the injected action registry.
    registerActions(ctx, {
      doCheckIn: { handler: checkin.doCheckIn, successKey: "checkinSuccess" },
      claimRewards: { handler: checkin.claimRewards, successKey: "claimSuccess" },
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

      // ── Cleanup ───────────────────────────────────────────────────
      // Called by the platform on unmount.
      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
