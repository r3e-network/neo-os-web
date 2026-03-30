/**
 * Burn League — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.game, ctx.os.nft,
 * ctx.os.leaderboard, ctx.os.badge) instead of direct chain calls.
 * The proxies handle all contract interaction through edge functions,
 * so the miniapp never touches contract hashes, parameter encoding,
 * or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useBurnLeague({ gameService, nftService, leaderboardService, badgeService, t })
 *
 * The composable calls:
 *   ctx.os.game.getPoolState("burn-league")   — load burn stats
 *   ctx.os.leaderboard.get(100)               — load leaderboard
 *   ctx.os.nft.burn(amount)                   — burn tokens
 *   ctx.os.leaderboard.submitScore(amount)    — update leaderboard
 *   ctx.os.badge.award(badgeId, user)         — award achievements
 *
 * Everything else (manifest, PlayArea, i18n, actions) stays the same.
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
   * Setup function — wires OS services to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os (OS service proxies)
   * for all data loading and mutations instead of ctx.services.chain.
   */
  setup(ctx) {
    const league = useBurnLeague({
      gameService: ctx.os.game,
      nftService: ctx.os.nft,
      leaderboardService: ctx.os.leaderboard,
      badgeService: ctx.os.badge,
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
    };
  },
});
