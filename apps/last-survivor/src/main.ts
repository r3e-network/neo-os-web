/**
 * Last Survivor — Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.game, ctx.os.payment,
 * ctx.os.leaderboard, ctx.os.badge, ctx.os.storage) instead of direct
 * chain calls. The proxies handle all contract interaction through edge
 * functions, so the miniapp never touches contract hashes, parameter
 * encoding, or event parsing.
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useLastSurvivor({ gameService, paymentService, ... })
 *
 * The composable calls:
 *   ctx.os.game.getPoolState("current")       — load round state
 *   ctx.os.game.placeBet("current", keyCount)  — buy keys
 *   ctx.os.game.settle("current", ...)         — claim prize
 *   ctx.os.payment.deposit(amount, memo)       — deposit GAS for keys
 *   ctx.os.leaderboard.get(10)                 — load winners
 *   ctx.os.storage.get(`playerKeys:${round}`)  — load user keys
 *   ctx.os.storage.list("events:", 40)          — load event history
 *   ctx.os.badge.award(badgeId, user)          — hint achievements
 *
 * Everything else (manifest, PlayArea, i18n, timer) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import { useTicker } from "@shared/composables/useTicker";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useLastSurvivor } from "./composables/useLastSurvivor";

defineMiniApp({
  appId: "miniapp-last-survivor",
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
    const game = useLastSurvivor({
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      leaderboardService: ctx.os.leaderboard,
      badgeService: ctx.os.badge,
      storageService: ctx.os.storage,
      t: ctx.t,
    });

    // Start the countdown ticker
    const timerTicker = useTicker(() => game.updateNow(), 1000);
    timerTicker.start();

    // Register actions so they can be called from operation panels or
    // from the PlayArea via the injected action registry.
    registerActions(ctx, {
      buyKeys: {
        handler: async (keyCount: unknown) => {
          await game.buyKeys(String(keyCount));
        },
        successKey: "keysPurchased",
      },
      claimPrize: {
        handler: async () => {
          await game.claimPrize();
        },
        successKey: "prizeClaimed",
      },
    });

    return {
      // ── State bindings ────────────────────────────────────────────
      // Keys must match the `valueKey` fields in manifest.ts.
      // The platform reads these to render stats grid, sidebar, etc.
      state: {
        roundId: game.roundId,
        totalPot: game.totalPot,
        isRoundActive: game.isRoundActive,
        lastBuyer: game.lastBuyer,
        userKeys: game.userKeys,
        keyCount: game.keyCount,
        keyValidationError: game.keyValidationError,
        history: game.history,
        isBuyingKeys: game.isBuyingKeys,
        isClaiming: game.isClaiming,
        isLoading: game.isLoading,
        countdown: game.countdown,
        dangerLevel: game.dangerLevel,
        dangerLevelText: game.dangerLevelText,
        dangerProgress: game.dangerProgress,
        shouldPulse: game.shouldPulse,
        lastBuyerLabel: game.lastBuyerLabel,
        formattedRound: game.formattedRound,
        totalPotDisplay: game.totalPotDisplay,
        roundStatusDisplay: game.roundStatusDisplay,
        canClaim: game.canClaim,
        estimatedCost: game.estimatedCost,
      },

      // ── Lifecycle ─────────────────────────────────────────────────
      // Called by the platform on mount and when the wallet reconnects.
      loadData: game.loadAll,

      cleanup: () => {
        timerTicker.stop();
      },
    };
  },
});
