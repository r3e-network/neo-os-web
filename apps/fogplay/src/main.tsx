/**
 * FogPlay (Coin Flip) — React Entry Point
 */

import { defineMiniApp } from "@shared/react/defineMiniApp";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useCoinFlip } from "./composables/useCoinFlip";

defineMiniApp({
  appId: "miniapp-fogplay",
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const coinFlip = useCoinFlip({
      app: ctx.framework,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    // app.actions.register already guards every handler with the platform
    // notifier (error toast on throw), so the actions below only add the
    // outcome-dependent toasts. A blanket action successKey cannot be used for
    // placeBet/revealResult — placeBet commits, waits the beacon window, then
    // settles and resolves on both a win and a loss, so an unconditional
    // "youWon" key would celebrate losses. The framework exposes no
    // success/info notify surface, so those two toasts stay on ctx.services.
    ctx.framework.actions.register("placeBet", async () => {
      const result = await coinFlip.placeBet();
      if (result.won) ctx.services.notify.success("youWon");
      else ctx.services.notify.info("youLost");
    });

    ctx.framework.actions.register("revealResult", async () => {
      // Permissionless, idempotent retry of settle() for the persisted pending
      // bet — used by the "Reveal result" button when the inline reveal failed.
      const result = await coinFlip.revealResult();
      if (result.won) ctx.services.notify.success("youWon");
      else ctx.services.notify.info("youLost");
    });

    ctx.framework.actions.register(
      "withdrawCredit",
      () => coinFlip.withdrawCredit(),
      { successKey: "creditWithdrawn" },
    );

    ctx.framework.actions.register("dismissOverlay", async () => {
      coinFlip.dismissOverlay();
    });

    ctx.framework.actions.register("setChoice", async (side: unknown) => {
      if (side === "heads" || side === "tails") {
        coinFlip.choice.set(side);
      }
    });

    ctx.framework.actions.register("setBetAmount", async (amount: unknown) => {
      if (typeof amount === "string") {
        coinFlip.setBetAmount(amount);
      }
    });

    ctx.framework.actions.register("resetGame", async () => {
      coinFlip.resetGame();
    });

    return {
      state: {
        wins: coinFlip.wins,
        losses: coinFlip.losses,
        totalGames: coinFlip.totalGames,
        totalWon: coinFlip.totalWon,
        formattedTotalWon: coinFlip.formattedTotalWon,
        betAmount: coinFlip.betAmount,
        choice: coinFlip.choice,
        isFlipping: coinFlip.isFlipping,
        revealing: coinFlip.revealing,
        result: coinFlip.result,
        displayOutcome: coinFlip.displayOutcome,
        showWinOverlay: coinFlip.showWinOverlay,
        winAmount: coinFlip.winAmount,
        validationError: coinFlip.validationError,
        canBet: coinFlip.canBet,
        hasPendingBet: coinFlip.hasPendingBet,
        revealFailed: coinFlip.revealFailed,
        gameHistory: coinFlip.gameHistory,
        bankrollBase: coinFlip.bankrollBase,
        creditBase: coinFlip.creditBase,
        maxPayableBet: coinFlip.maxPayableBet,
        formattedMaxPayable: coinFlip.formattedMaxPayable,
        formattedCredit: coinFlip.formattedCredit,
        hasCredit: coinFlip.hasCredit,
      },
      loadData: coinFlip.loadAll,
    };
  },
});
