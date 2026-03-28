/**
 * Burn League — Entry Point (New Pattern)
 *
 * Follows the defineMiniApp() pattern established by the daily-checkin reference.
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
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useBurnLeague } from "./composables/useBurnLeague";

defineMiniApp({
  appId: "miniapp-burn-league",
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
    const platformServices = ctx.services;

    const league = useBurnLeague({
      chain: platformServices.chain,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    // Register actions so they can be called from operation panels or
    // from the PlayArea via the injected action registry.
    registerActions(ctx, {
      burnTokens: {
        handler: () => league.burnTokens(),
        successKey: "burnSuccess",
        errorKey: "loadFailed",
      },
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys must match the `valueKey` fields in manifest.ts.
      // The platform reads these to render stats grid, sidebar, etc.
      state: {
        // Raw stats (for stats grid with format: "gas" / "number")
        totalBurned: league.totalBurned,
        userBurned: league.userBurned,
        rewardPool: league.rewardPool,
        burnCount: league.burnCount,

        // Formatted display values (for sidebar with format: "text")
        totalBurnedDisplay: league.totalBurnedDisplay,
        userBurnedDisplay: league.userBurnedDisplay,
        rewardPoolDisplay: league.rewardPoolDisplay,
        formattedRank: league.formattedRank,
        leaderboardSize: league.leaderboardSize,

        // Additional state the PlayArea reads via props
        rank: league.rank,
        leaderboard: league.leaderboard,
        isBurning: league.isBurning,
        isLoading: league.isLoading,

        // Local UI state and derived values for PlayArea
        burnAmount: league.burnAmount,
        estimatedReward: league.estimatedReward,
        leaderboardPreview: league.leaderboardPreview,
      },

      // ── Lifecycle ─────────────────────────────────────────────────
      // Called by the platform on mount and when the wallet reconnects.
      loadData: league.loadAll,

      // ── Cleanup ───────────────────────────────────────────────────
      // Called by the platform on unmount.
    };
  },
});
