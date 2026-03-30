/**
 * FogPlay (Coin Flip) -- Entry Point (OS Services Pattern)
 *
 * This miniapp uses OS service proxies (ctx.os.game, ctx.os.payment,
 * ctx.os.storage, ctx.os.badge) instead of direct chain calls. The proxies
 * handle all contract interaction through edge functions, so the miniapp
 * never touches contract hashes, parameter encoding, or event parsing.
 *
 * Oracle VRF randomness is accessed through ctx.services.oracle, which is
 * a platform service (not an OS contract proxy).
 *
 * Architecture:
 *   main.ts -> defineMiniApp({ playArea, manifest, setup })
 *   setup() -> useCoinFlip({ gameService, paymentService, storageService,
 *                             badgeService, oracle, eventBus, t })
 *
 * The composable calls:
 *   ctx.os.payment.deposit(amount, memo)           -- prepay GAS for bet
 *   ctx.os.game.placeBet("current", betParams)     -- place bet on contract
 *   ctx.os.game.getPoolState("resolve:<betId>")    -- poll for settlement
 *   ctx.os.storage.get("playerStats")              -- load player stats
 *   ctx.os.storage.list("history:", 20)             -- load game history
 *   ctx.os.badge.award("first-flip", "")            -- hint achievements
 *   ctx.services.oracle.requestRandom(context)      -- VRF randomness
 *
 * Everything else (manifest, PlayArea, i18n) stays the same.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { registerActions } from "@shared/utils/createActionHandlers";
import PlayArea from "./PlayArea.vue";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useCoinFlip } from "./composables/useCoinFlip";

defineMiniApp({
  appId: "miniapp-fogplay",
  playArea: PlayArea,
  manifest,
  messages,

  /**
   * Setup function -- wires OS services + oracle to reactive state.
   *
   * Called once when the miniapp mounts. Uses ctx.os (OS service proxies)
   * for all contract interaction and ctx.services.oracle for VRF randomness
   * instead of ctx.services.chain directly.
   */
  setup(ctx) {
    const coinFlip = useCoinFlip({
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      oracle: ctx.services.oracle,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    // Register actions so they can be called from the PlayArea via the
    // injected action registry, or from operation panels.
    registerActions(ctx, {
      placeBet: {
        handler: async () => {
          await coinFlip.placeBet();
        },
        successKey: "youWon",
        errorKey: "flipFailed",
      },
    });

    ctx.registerAction("dismissOverlay", () => {
      coinFlip.dismissOverlay();
    });

    ctx.registerAction("setChoice", (side: unknown) => {
      if (side === "heads" || side === "tails") {
        coinFlip.choice.value = side;
      }
    });

    ctx.registerAction("setBetAmount", (amount: unknown) => {
      if (typeof amount === "string") {
        coinFlip.betAmount.value = amount;
      }
    });

    ctx.registerAction("resetGame", () => {
      coinFlip.resetGame();
    });

    return {
      // -- State bindings -----------------------------------------------------
      // Keys must match the `valueKey` fields in manifest.ts.
      // The platform reads these to render stats grid, sidebar, etc.
      state: {
        // Stats (for manifest stat/sidebar bindings)
        wins: coinFlip.wins,
        losses: coinFlip.losses,
        totalGames: coinFlip.totalGames,
        totalWon: coinFlip.totalWon,
        formattedTotalWon: coinFlip.formattedTotalWon,

        // Game state (read by PlayArea via props)
        betAmount: coinFlip.betAmount,
        choice: coinFlip.choice,
        isFlipping: coinFlip.isFlipping,
        result: coinFlip.result,
        displayOutcome: coinFlip.displayOutcome,
        showWinOverlay: coinFlip.showWinOverlay,
        winAmount: coinFlip.winAmount,
        validationError: coinFlip.validationError,
        canBet: coinFlip.canBet,
        gameHistory: coinFlip.gameHistory,
      },

      // -- Lifecycle ----------------------------------------------------------
      // Called by the platform on mount and when the wallet reconnects.
      loadData: coinFlip.loadAll,
    };
  },
});
