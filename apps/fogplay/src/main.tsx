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
      chain: ctx.services.chain,
      eventBus: ctx.services.events,
      t: ctx.t,
    });

    coinFlip.setAddress(ctx.services.chain.address.get() ?? null);

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
        coinFlip.setBetAmount(amount);
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
