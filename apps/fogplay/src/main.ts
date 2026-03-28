/**
 * FogPlay (Coin Flip) -- Entry Point (New Pattern)
 *
 * This miniapp demonstrates OracleService integration with the
 * defineMiniApp() pattern. The oracle.requestRandom() call provides
 * verifiable randomness (VRF) for provably fair coin-flip results.
 *
 * Structure:
 *   1. Import the play area component (the only custom UI)
 *   2. Import the manifest (declarative config for platform sections)
 *   3. Import i18n messages
 *   4. Import the domain composable
 *   5. Call defineMiniApp() with a setup function that wires them together
 *
 * The setup function:
 *   - Receives a MiniAppContext with `t` (i18n), `services`, `setStatus`, etc.
 *   - Creates PlatformServices to get ChainService, OracleService, EventBus
 *   - Instantiates the domain composable (passing services as constructor params)
 *   - Returns `state` whose keys match manifest valueKeys for stats/sidebar
 *   - Returns `loadData` for the platform to call on mount and wallet-connect
 *   - Registers action handlers for placeBet, setChoice, setBetAmount, etc.
 */

import { defineMiniApp } from "@shared/utils/defineMiniApp";
import { PlatformServices } from "@shared/services";
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
   * Setup function -- the bridge between domain logic and the platform.
   *
   * Called once when the miniapp mounts. The platform provides:
   *   ctx.t         -- i18n translation function
   *   ctx.services  -- platform services (stub until full integration)
   *   ctx.setStatus -- show a toast/status message
   *   ctx.registerAction -- register operation panel action handlers
   *
   * Returns:
   *   state    -- reactive values matching manifest valueKey entries
   *   loadData -- called by the platform on mount and wallet reconnect
   */
  setup(ctx) {
    // Create the real PlatformServices with the i18n function.
    // This gives the composable access to ChainService, OracleService,
    // EventBus, etc.
    const platformServices = PlatformServices.create("miniapp-fogplay", {
      t: ctx.t as (key: string) => string,
    });

    const coinFlip = useCoinFlip({
      chain: platformServices.chain,
      oracle: platformServices.oracle,
      eventBus: platformServices.events,
      t: ctx.t,
    });

    const { notify } = platformServices;

    // Register actions so they can be called from the PlayArea via the
    // injected action registry, or from operation panels.
    ctx.registerAction("placeBet", async () => {
      await notify.guard(() => coinFlip.placeBet(), "youWon", "flipFailed");
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

      // -- Cleanup ------------------------------------------------------------
      // Called by the platform on unmount.
      cleanup: () => {
        platformServices.destroy();
      },
    };
  },
});
