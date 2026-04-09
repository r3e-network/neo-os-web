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
      gameService: ctx.os.game,
      paymentService: ctx.os.payment,
      storageService: ctx.os.storage,
      badgeService: ctx.os.badge,
      oracle: ctx.services.oracle,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    ctx.registerAction("placeBet", async () => {
      await ctx.services.notify.guard(() => coinFlip.placeBet(), "youWon");
    });

    ctx.registerAction("dismissOverlay", async () => {
      coinFlip.dismissOverlay();
    });

    ctx.registerAction("setChoice", async (side: unknown) => {
      if (side === "heads" || side === "tails") {
        coinFlip.choice.set(side);
      }
    });

    ctx.registerAction("setBetAmount", async (amount: unknown) => {
      if (typeof amount === "string") {
        coinFlip.betAmount.set(amount);
      }
    });

    ctx.registerAction("resetGame", async () => {
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
        result: coinFlip.result,
        displayOutcome: coinFlip.displayOutcome,
        showWinOverlay: coinFlip.showWinOverlay,
        winAmount: coinFlip.winAmount,
        validationError: coinFlip.validationError,
        canBet: coinFlip.canBet,
        gameHistory: coinFlip.gameHistory,
      },
      loadData: coinFlip.loadAll,
    };
  },
});
