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
      // The toast must reflect the actual outcome — placeBet commits, waits one
      // block, then settles and resolves on both a win and a loss, so a blanket
      // "youWon" success key would celebrate losses.
      const result = await ctx.services.notify.guard(() => coinFlip.placeBet());
      if (result) {
        if (result.won) ctx.services.notify.success("youWon");
        else ctx.services.notify.info("youLost");
      }
    });

    ctx.registerAction("revealResult", async () => {
      // Permissionless, idempotent retry of settle() for the persisted pending
      // bet — used by the "Reveal result" button when the inline reveal failed.
      const result = await ctx.services.notify.guard(() => coinFlip.revealResult());
      if (result) {
        if (result.won) ctx.services.notify.success("youWon");
        else ctx.services.notify.info("youLost");
      }
    });

    ctx.registerAction("withdrawCredit", async () => {
      await ctx.services.notify.guard(() => coinFlip.withdrawCredit(), "creditWithdrawn");
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
