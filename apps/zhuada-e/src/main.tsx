/**
 * Catch the Goose (抓大鹅) — B-class physics-extraction edition.
 *
 * Free local mode (no blockchain). The guest engine owns the logical item list
 * + tray + timer + scoring; the Three.js scene renders the physics pile and
 * reports picks back through the bridge as `extract` actions.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { createGuestEngine } from "./logic/guest-engine";
import { TOTAL_LEVELS } from "./logic/game-rules";
import { sound } from "./logic/sound";
import type { ItemInstance } from "./logic/engine-zhuada";

const appId = "miniapp-zhuada-e";

defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;

    // Standard session observables (reused everywhere — same object the guest mutates).
    const obs = app.game.session.observables(ctx.t);

    // ── Game-specific observables ──────────────────────────────────────────────
    const items = createObservable<ItemInstance[]>([]);
    const tray = createObservable<(number | null)[]>(Array(7).fill(null));
    const score = createObservable(0);
    const comboCount = createObservable(0);
    const timeLeftMs = createObservable(0);
    const level = createObservable(1);
    const isPlaying = createObservable(false);
    const clearedFx = createObservable<number[]>([]);
    const isStarting = createObservable(false);
    const powerups = createObservable<{ shuffle: number; hint: number; addTime: number }>({
      shuffle: 0, hint: 0, addTime: 0,
    });
    const shuffleNonce = createObservable(0);
    const hintNonce = createObservable(0);

    // ── Guest (free / local) engine ────────────────────────────────────────────
    const guest = createGuestEngine({
      obs,
      items,
      tray,
      score,
      comboCount,
      timeLeftMs,
      level,
      isPlaying,
      clearedFx,
      powerups,
      shuffleNonce,
      hintNonce,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });

    // clearedFx is a transient pulse so the scene can re-trigger the same clear.
    let fxTimer: ReturnType<typeof setTimeout> | null = null;
    clearedFx.subscribe(() => {
      if (fxTimer) clearTimeout(fxTimer);
      if (clearedFx.get().length === 0) return;
      fxTimer = setTimeout(() => clearedFx.set([]), 200);
    });

    // Mirror launcher mode into an observable.
    const appMode = createObservable<string>(app.mode.get());
    app.mode.onChange((mode) => {
      appMode.set(mode);
      if (mode === "guest") guest.enter();
    });

    // ── Actions ─────────────────────────────────────────────────────────────────
    app.actions.register("startLevel", async (...args: unknown[]) => {
      if (isStarting.get()) return;
      const form = (args[0] ?? {}) as { level?: unknown };
      const lvl = Math.max(1, Math.min(TOTAL_LEVELS, Number(form.level ?? level.get()) || 1));
      sound.unlock();
      sound.play("click");
      isStarting.set(true);
      guest.startLevel(lvl);
      isStarting.set(false);
    });

    app.actions.register("extract", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { itemId?: unknown; kind?: unknown };
      const itemId = Number(form.itemId);
      const kind = Number(form.kind);
      if (!Number.isInteger(itemId) || !Number.isInteger(kind)) return;
      guest.extract(itemId, kind);
    });

    app.actions.register("nextLevel", async () => {
      if (level.get() >= TOTAL_LEVELS) {
        ctx.setStatus(ctx.t("statusAllClear"), "success");
        return;
      }
      sound.play("click");
      guest.startLevel(level.get() + 1);
    });

    app.actions.register("retry", async () => {
      sound.play("click");
      guest.startLevel(level.get());
    });

    app.actions.register("shuffle", async () => {
      sound.play("shuffle");
      guest.shuffle();
    });

    app.actions.register("hint", async () => {
      sound.play("powerup");
      guest.hint();
    });

    app.actions.register("addTime", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { ms?: unknown };
      sound.play("powerup");
      guest.addTime(Number(form.ms) || 0);
    });

    // Debug-only playtest shortcuts (used by the ?debug=1 panel).
    app.actions.register("debugWin", async () => {
      guest.debugWin();
    });
    app.actions.register("debugLose", async () => {
      guest.debugLose();
    });

    app.actions.register("enter", async () => {
      guest.enter();
    });

    return {
      state: {
        items,
        tray,
        score,
        comboCount,
        timeLeftMs,
        level,
        isPlaying,
        clearedFx,
        isStarting,
        powerups,
        shuffleNonce,
        hintNonce,
        appMode,
        ...obs,
      },
      loadData: async () => {
        // Guest is purely local: skip every chain read.
        guest.enter();
      },
    };
  },
});
