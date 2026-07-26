/**
 * Gomoku Arena — miniapp entry point.
 *
 * All game logic is local (guest mode). The setup function expresses only the
 * game-specific logic: board management, AI turns, and scoring.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import PhaserPlayArea from "./PhaserPlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import {
  DIFFICULTY_RULES,
  GAMEFI_NEW_ENTRIES_ENABLED,
} from "./logic/game-rules";
import { createGuestEngine } from "./logic/guest-engine";
import type { BoardStorage } from "./logic/guest-engine";
import type { GameSessionStatus, LeaderEntry, SolveRow } from "@framework/game";

const appId = "miniapp-gomoku";

export type { LeaderEntry, SolveRow };

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,
  storagePrefix: "miniapp-gomoku:",

  setup(ctx) {
    const app = ctx.framework;

    // Standard game session observables
    const obs = app.game.session.observables<SolveRow>(ctx.t);

    // Gomoku-specific extras
    const walletConnected = createObservable(app.wallet.isConnected());
    const isPaused = createObservable(false);
    const appMode = createObservable<string>(app.mode.get());

    // Guest engine
    const guest = createGuestEngine({
      obs,
      walletConnected,
      isPaused,
      storage: app.storage.local as BoardStorage,
      guestLeaderboard: app.mode.guestLeaderboard,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });

    // Mode sync
    const stopModeSync = app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") {
        void guest.enter();
      }
    });

    // Wallet sync
    const stopWalletSync = app.wallet.onAccountChanged(() => {
      walletConnected.set(app.wallet.isConnected());
    });

    // ── Actions ──────────────────────────────────────────────────────────────
    app.actions.register("startGame", async (...args: unknown[]) => {
      guest.startGame(args[0]);
    });

    app.actions.register("selectDifficulty", async (...args: unknown[]) => {
      guest.selectDifficulty(args[0]);
    });

    app.actions.register("placeStone", async (...args: unknown[]) => {
      guest.placeStone(args[0]);
    });

    app.actions.register("useUndo", async () => {
      guest.useUndo();
    });

    app.actions.register("togglePause", async () => {
      guest.togglePause();
    });

    app.actions.register("restartGame", async (...args: unknown[]) => {
      guest.restartGame(args[0]);
    });

    app.actions.register("expireGame", async () => {
      guest.expireGame();
    });

    app.actions.register("retryDeal", async () => {
      guest.retryDeal();
    });

    app.actions.register("refreshLeaderboard", async () => {
      await guest.refreshLeaderboard();
    });

    // ── State ────────────────────────────────────────────────────────────────
    return {
      state: {
        ...obs,
        walletConnected,
        isPaused,
        appMode,
      },
      loadData: async () => {
        await guest.enter();
      },
      cleanup: () => {
        stopWalletSync();
        stopModeSync();
      },
    };
  },
});
