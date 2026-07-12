/**
 * FogPlay (Coin Flip) — React Entry Point
 *
 * Two-mode game:
 *  - GAMEFI (default): the on-chain commit/reveal coin flip (unchanged).
 *  - GUEST: a purely local coin-flip streak game driven by ./logic/guest-engine,
 *    which makes ZERO chain/oracle/reward calls. Every guarded action branches on
 *    `app.mode.isGuest()` BEFORE any chain call, so the framework guest guard
 *    never fires; every chain-reading loader is gated the same way.
 */

import { createObservable } from "@shared/react";
import { defineMiniApp } from "@shared/react/defineMiniApp";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { useCoinFlip } from "./composables/useCoinFlip";
import { createGuestEngine } from "./logic/guest-engine";

defineMiniApp({
  appId: "miniapp-fogplay",
  playArea: PhaserPlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const coinFlip = useCoinFlip({
      app,
      t: ctx.t,
    });

    // ── Two-mode surface ──────────────────────────────────────────────────────
    // `mode` mirrors app.mode.current into the reactive state so the PlayArea +
    // scene can branch GAS-centric copy to local framing. `streak` is the guest
    // local score (consecutive wins) surfaced to the play area.
    const mode = createObservable(app.mode.get());
    const streak = createObservable(0);

    // Guest (free / local) engine — reuses the SAME observables + dispatch
    // actions the scene reads, driven purely locally (no chain/oracle/reward).
    const guest = createGuestEngine({
      betAmount: coinFlip.betAmount,
      choice: coinFlip.choice,
      isFlipping: coinFlip.isFlipping,
      revealing: coinFlip.revealing,
      result: coinFlip.result,
      displayOutcome: coinFlip.displayOutcome,
      showWinOverlay: coinFlip.showWinOverlay,
      winAmount: coinFlip.winAmount,
      validationError: coinFlip.validationError,
      wins: coinFlip.wins,
      losses: coinFlip.losses,
      totalWon: coinFlip.totalWon,
      gameHistory: coinFlip.gameHistory,
      streak,
      bankrollBase: coinFlip.bankrollBase,
      freeBankrollBase: coinFlip.freeBankrollBase,
      creditBase: coinFlip.creditBase,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
    });

    // Switching to guest at the launcher resets to a clean local lobby.
    const stopModeSync = app.mode.onChange((next) => {
      mode.set(next);
      if (next === "guest") void guest.enter();
      else guest.dispose();
    });

    // app.actions.register already guards every handler with the platform
    // notifier (error toast on throw), so the actions below only add the
    // outcome-dependent toasts. A blanket action successKey cannot be used for
    // placeBet/revealResult — placeBet commits, waits the beacon window, then
    // settles and resolves on both a win and a loss, so an unconditional
    // "youWon" key would celebrate losses. The win/loss branch instead calls
    // app.notify.success/info directly with the outcome-specific key.
    app.actions.register("placeBet", async () => {
      if (app.mode.isGuest()) {
        const result = await guest.placeBet();
        if (!result.outcome) return;
        if (result.won) app.notify.success("youWon");
        else app.notify.info("youLost");
        return;
      }
      const result = await coinFlip.placeBet();
      if (result.won) app.notify.success("youWon");
      else app.notify.info("youLost");
    });

    app.actions.register("revealResult", async () => {
      // Guest has no on-chain pending bet — nothing to reveal.
      if (app.mode.isGuest()) return;
      // Permissionless, idempotent retry of settle() for the persisted pending
      // bet — used by the "Reveal result" button when the inline reveal failed.
      const result = await coinFlip.revealResult();
      if (result.won) app.notify.success("youWon");
      else app.notify.info("youLost");
    });

    app.actions.register("withdrawCredit", async () => {
      // Guest never holds on-chain credit — branch before the guarded invoke.
      if (app.mode.isGuest()) return;
      await coinFlip.withdrawCredit();
      app.notify.success("creditWithdrawn");
    });

    app.actions.register("dismissOverlay", async () => {
      coinFlip.dismissOverlay();
    });

    app.actions.register("setChoice", async (side: unknown) => {
      if (side === "heads" || side === "tails") {
        coinFlip.choice.set(side);
      }
    });

    app.actions.register("setBetAmount", async (amount: unknown) => {
      if (typeof amount === "string") {
        coinFlip.setBetAmount(amount);
      }
    });

    app.actions.register("resetGame", async () => {
      coinFlip.resetGame();
    });

    return {
      state: {
        mode,
        streak,
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
        bankrollAvailable: coinFlip.bankrollAvailable,
        creditBase: coinFlip.creditBase,
        maxPayableBet: coinFlip.maxPayableBet,
        formattedMaxPayable: coinFlip.formattedMaxPayable,
        formattedCredit: coinFlip.formattedCredit,
        hasCredit: coinFlip.hasCredit,
      },
      // GameFi reads chain on mount; guest resets to a clean local lobby. The
      // launcher sets app.mode BEFORE this runs, so a guest player never incurs
      // the chain reads (defense-in-depth against the guest surface bleed).
      loadData: async () => {
        if (app.mode.isGuest()) {
          await guest.enter();
          return;
        }
        await coinFlip.loadAll();
      },
      cleanup: () => {
        stopModeSync();
        guest.dispose();
      },
    };
  },
});
