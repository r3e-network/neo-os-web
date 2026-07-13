import { createObservable, defineMiniApp } from "@shared/react";
import PhaserPlayArea from "./PhaserPlayArea";
import { messages } from "./locale/messages";
import { createGuestEngine } from "./logic/guest-engine";
import type { ScrewSortStats } from "./logic/guest-engine";
import { createSession } from "./logic/screw-engine";
import { manifest } from "./manifest";

const appId = "miniapp-screw-sort";

defineMiniApp({
  appId,
  playArea: PhaserPlayArea,
  manifest,
  messages,
  storagePrefix: "miniapp-screw-sort:",

  setup(ctx) {
    const app = ctx.framework;
    // Screw Sort is local-only until a real contract, oracle proof, funded
    // pool, and end-to-end settlement have all been deployed and verified.
    app.mode.set("guest");

    const gameSession = createObservable(createSession("welcome-workshop"));
    const stats = createObservable<ScrewSortStats>({ wins: 0, bestMoves: 0, bestStars: 0, lastSeed: "" });
    const lastStatus = createObservable(ctx.t("statusReady"));
    const appMode = createObservable(app.mode.get());

    const guest = createGuestEngine({
      session: gameSession,
      stats,
      lastStatus,
      storage: app.storage.local,
      t: ctx.t,
      setStatus: ctx.setStatus,
      submitScore: (score) => app.mode.guestLeaderboard.submit(score),
    });

    const ensureGuestMode = (): boolean => {
      if (app.mode.isGuest()) return true;
      const message = ctx.t("rewardsUnavailable");
      lastStatus.set(message);
      ctx.setStatus(message, "warning");
      return false;
    };

    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") {
        guest.enter();
      } else {
        const message = ctx.t("rewardsUnavailable");
        lastStatus.set(message);
        ctx.setStatus(message, "warning");
      }
    });

    app.actions.register("startGame", async (payload?: unknown) => {
      if (!ensureGuestMode()) return false;
      const seed = payload && typeof payload === "object" && "seed" in payload
        ? String((payload as { seed?: unknown }).seed ?? "")
        : undefined;
      guest.startGame(seed || undefined);
      return true;
    });
    app.actions.register("selectScrew", async (screwId: unknown) => {
      if (!ensureGuestMode()) return false;
      return guest.selectScrew(String(screwId ?? ""));
    });
    app.actions.register("useUndo", async () => ensureGuestMode() && guest.undo());
    app.actions.register("restartGame", async () => {
      if (!ensureGuestMode()) return false;
      guest.restart();
      return true;
    });
    app.actions.register("newPuzzle", async () => {
      if (!ensureGuestMode()) return false;
      guest.newPuzzle();
      return true;
    });
    app.actions.register("togglePause", async () => ensureGuestMode() && guest.togglePause());

    return {
      state: { gameSession, stats, lastStatus, appMode },
      loadData: async () => {
        if (!ensureGuestMode()) return;
        guest.enter();
      },
    };
  },
});
