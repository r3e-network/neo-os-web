/**
 * Goose Basket Shuffle · 鹅篮翻翻乐 — physics-extraction edition.
 *
 * Free local mode (no blockchain). The guest engine owns the logical item list
 * + tray + timer + scoring; the Three.js scene renders the physics pile and
 * reports picks back through the bridge as `extract` actions.
 */
import { createObservable, defineMiniApp } from "@shared/react";
import PlayArea from "./PlayArea";
import { manifest } from "./manifest";
import { messages } from "./locale/messages";
import { createGuestEngine, loadTimedPref, type FailReason, type PowerupCounts } from "./logic/guest-engine";
import { TOTAL_LEVELS } from "./logic/game-rules";
import { EMPTY_PROGRESS, bestOverall, clearedLevels, type GooseProgress } from "./logic/progress";
import { EMPTY_DAILY, type DailyState } from "./logic/daily-reward";
import { SCENES } from "./logic/scenes";
import { sound } from "./logic/sound";
import { haptics } from "./logic/haptics";
import { EMPTY_EXTRACT_RECEIPT, type ItemInstance } from "./logic/engine-zhuada";
import { isGameThemeId, loadThemePref, saveThemePref, themeOf, type GameThemeId } from "./logic/themes";
import { initializeGameStorage } from "./logic/game-storage";

const appId = "miniapp-zhuada-e";

async function boot(): Promise<void> {
  await initializeGameStorage();
  sound.reloadStoredPreference();
  haptics.reloadStoredPreference();

  defineMiniApp({
  appId,
  playArea: PlayArea,
  manifest,
  messages,

  setup(ctx) {
    const app = ctx.framework;
    const simulatorQaParams = import.meta.env.DEV && typeof window !== "undefined"
      ? new URLSearchParams(window.location.search)
      : null;
    const simulatorQaTheme = simulatorQaParams?.get("simTheme");
    const initialThemeId = isGameThemeId(simulatorQaTheme)
      ? simulatorQaTheme
      : loadThemePref();

    // Standard session observables (reused everywhere — same object the guest mutates).
    const obs = app.game.session.observables(ctx.t);

    // ── Game-specific observables ──────────────────────────────────────────────
    const items = createObservable<ItemInstance[]>([]);
    const reserveCount = createObservable(0);
    const tray = createObservable<(number | null)[]>(Array(7).fill(null));
    const shelf = createObservable<(number | null)[]>(Array(3).fill(null));
    const score = createObservable(0);
    const comboCount = createObservable(0);
    // R6 Frenzy: free-pull charges (armed after a combo climax) + a monotonic
    // nonce bumped on each frenzy pulse so the UI can flash a burst.
    const frenzyCharges = createObservable(0);
    const frenzyFx = createObservable(0);
    const timeLeftMs = createObservable(0);
    const level = createObservable(1);
    const isPlaying = createObservable(false);
    const clearedFx = createObservable<number[]>([]);
    const shelfClearedFx = createObservable<number[]>([]);
    const failReason = createObservable<FailReason | "">("");
    // NOTE: isStarting comes from the framework session observables (`obs`);
    // a local duplicate here would be shadowed by the `...obs` spread in the
    // returned state and the UI would never see updates to it.
    const isStarting = obs.isStarting;
    const powerups = createObservable<PowerupCounts>({
      shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0,
    });
    const undoable = createObservable(false);
    // Untimed by default (parity G1); persisted timed-challenge preference.
    const timedMode = createObservable(loadTimedPref());
    const shakeReadyAt = createObservable(0);
    const dealNonce = createObservable(0);
    const shakeNonce = createObservable(0);
    const shakeStrength = createObservable(1);
    const shuffleNonce = createObservable(0);
    const hintNonce = createObservable(0);
    const extractReceipt = createObservable({ ...EMPTY_EXTRACT_RECEIPT });
    // Resolve the simulator theme before the guest engine and first deal are
    // created. Applying it later through setTheme is racy by design because
    // setTheme correctly refuses to mutate an active run.
    const themeId = createObservable<GameThemeId>(initialThemeId);
    const resumeAvailable = createObservable(false);
    const resumeLevel = createObservable(0);
    const continueAvailable = createObservable(false);
    sound.setTheme(themeOf(themeId.get()).ambience);
    // Meta progression (G4): persisted unlocks / wins / best / goose collection.
    const progress = createObservable<GooseProgress>(EMPTY_PROGRESS);
    // R4 — daily sign-in / streak state (persisted separately, see daily-reward).
    const dailyState = createObservable<DailyState>(EMPTY_DAILY);
    const dailyClaimable = createObservable(false);
    const dailyGrants = createObservable<PowerupCounts>({
      shuffle: 0, hint: 0, remove: 0, undo: 0, addTime: 0,
    });
    const dailyMilestoneFx = createObservable(0);
    // Scene id of the goose unlocked by the LAST win (-1 = none) — transient.
    const unlockNotice = createObservable(-1);

    // ── Local stats: manifest sidebar/stat bindings (never dead-zero again) ──
    // The framework mySolves/myTotalWon observables are chain-fed and stay 0 in
    // guest mode, so the sidebar binds these locally-derived keys instead.
    const statWins = createObservable(0);
    const statBest = createObservable(0);
    const statCleared = createObservable(0);
    const statGeese = createObservable(`0/${SCENES.length}`);
    progress.subscribe(() => {
      const p = progress.get();
      statWins.set(p.wins);
      statBest.set(bestOverall(p));
      statCleared.set(clearedLevels(p));
      statGeese.set(`${p.geese.length}/${SCENES.length}`);
      // Mirror into the framework session stats too, so any shared surface
      // reading mySolves/myTotalWon reflects local play instead of zero.
      obs.mySolves.set(p.wins);
      obs.myTotalWon.set(bestOverall(p));
    });

    // ── Guest (free / local) engine ────────────────────────────────────────────
    const guest = createGuestEngine({
      obs,
      items,
      reserveCount,
      tray,
      shelf,
      score,
      comboCount,
      frenzyCharges,
      frenzyFx,
      timeLeftMs,
      level,
      isPlaying,
      clearedFx,
      shelfClearedFx,
      failReason,
      powerups,
      undoable,
      timedMode,
      shakeReadyAt,
      dealNonce,
      shakeNonce,
      shakeStrength,
      shuffleNonce,
      hintNonce,
      extractReceipt,
      themeId,
      resumeAvailable,
      resumeLevel,
      continueAvailable,
      dailyState,
      dailyClaimable,
      dailyGrants,
      dailyMilestoneFx,
      progress,
      unlockNotice,
      t: ctx.t,
      setStatus: ctx.setStatus,
    });

    // clearedFx / shelfClearedFx are transient pulses so the scene/UI can
    // re-trigger the same clear animation on repeat events.
    let fxTimer: ReturnType<typeof setTimeout> | null = null;
    clearedFx.subscribe(() => {
      if (fxTimer) clearTimeout(fxTimer);
      if (clearedFx.get().length === 0) return;
      fxTimer = setTimeout(() => clearedFx.set([]), 200);
    });
    let shelfFxTimer: ReturnType<typeof setTimeout> | null = null;
    shelfClearedFx.subscribe(() => {
      if (shelfFxTimer) clearTimeout(shelfFxTimer);
      if (shelfClearedFx.get().length === 0) return;
      shelfFxTimer = setTimeout(() => shelfClearedFx.set([]), 200);
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
      const form = (args[0] ?? {}) as { itemId?: unknown };
      const itemId = Number(form.itemId);
      if (!Number.isInteger(itemId)) return;
      // kind is intentionally NOT read from the payload — the engine looks it
      // up from the authoritative item list (stale-kind safety).
      guest.extract(itemId);
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

    app.actions.register("removeToShelf", async () => {
      sound.play("powerup");
      guest.removeToShelf();
    });

    app.actions.register("undo", async () => {
      sound.play("powerup");
      guest.undo();
    });

    app.actions.register("shake", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as {
        intensity?: unknown;
        magnitude?: unknown;
        strength?: unknown;
        source?: unknown;
      };
      const intensity = Math.max(0.65, Math.min(1.35, Number(form.intensity) || 1));
      const before = shakeNonce.get();
      guest.shake(intensity);
      const accepted = shakeNonce.get() !== before;
      // The rattle only plays when the shake actually fired (not on cooldown).
      if (accepted) {
        sound.play("shake", intensity);
        haptics.play("shake");
      }
      if (
        import.meta.env.VITE_DEVICE_QA === "1"
        && new URLSearchParams(window.location.search).get("deviceQa") === "1"
      ) {
        window.dispatchEvent(new CustomEvent("zhuada-e:device-qa-shake", {
          detail: {
            source: form.source === "device-motion" ? "device-motion" : "screen",
            accepted,
            strength: typeof form.strength === "string" ? form.strength : undefined,
            intensity,
            magnitude: Number(form.magnitude) || 0,
          },
        }));
      }
    });

    app.actions.register("setTheme", async (...args: unknown[]) => {
      if (isPlaying.get()) return;
      const form = (args[0] ?? {}) as { id?: unknown };
      if (!isGameThemeId(form.id)) return;
      themeId.set(form.id);
      saveThemePref(form.id);
      sound.setTheme(themeOf(form.id).ambience);
      sound.play("click");
    });

    app.actions.register("setTimedMode", async (...args: unknown[]) => {
      const form = (args[0] ?? {}) as { on?: unknown };
      sound.play("click");
      guest.setTimedMode(form.on === true || form.on === "true");
    });

    app.actions.register("resumeRun", async () => {
      sound.unlock();
      sound.play("click");
      guest.resumeRun();
    });

    app.actions.register("discardRun", async () => {
      sound.play("click");
      guest.discardRun();
    });

    app.actions.register("continueRun", async () => {
      sound.unlock();
      guest.continueAfterFailure();
    });

    app.actions.register("claimDaily", async () => {
      sound.unlock();
      sound.play("click");
      guest.claimDaily();
    });

    app.actions.register("startDaily", async () => {
      if (isStarting.get()) return;
      sound.unlock();
      sound.play("click");
      isStarting.set(true);
      guest.startDailyChallenge();
      isStarting.set(false);
    });

    // Playtest shortcuts are removed from production bundles, not merely
    // hidden behind ?debug=1. A public dispatch surface must never be able to
    // mint a real win/progress record without playing the level.
    if (import.meta.env.DEV) {
      const debugWin = guest.debugWin;
      const debugLose = guest.debugLose;
      if (debugWin && debugLose) {
        app.actions.register("debugWin", async () => {
          debugWin();
        });
        app.actions.register("debugLose", async (...args: unknown[]) => {
          const form = (args[0] ?? {}) as { reason?: unknown };
          debugLose(form.reason === "trayFull" ? "trayFull" : "timeout");
        });
        app.actions.register("debugShake", async (...args: unknown[]) => {
          const form = (args[0] ?? {}) as { intensity?: unknown };
          const intensity = Math.max(0.65, Math.min(1.35, Number(form.intensity) || 1));
          shakeStrength.set(intensity);
          shakeNonce.set(shakeNonce.get() + 1);
        });
      }
    }

    app.actions.register("enter", async () => {
      guest.enter();
    });

    if (
      import.meta.env.DEV &&
      simulatorQaParams?.get("simQa") === "1"
    ) {
      window.setTimeout(() => {
        app.mode.set("guest");
        guest.enter();
        guest.startLevel(progress.get().lastPlayedLevel || 1);
      }, 0);
    }

    return {
      state: {
        items,
        reserveCount,
        tray,
        shelf,
        score,
        comboCount,
        frenzyCharges,
        frenzyFx,
        timeLeftMs,
        level,
        isPlaying,
        clearedFx,
        shelfClearedFx,
        failReason,
        powerups,
        undoable,
        timedMode,
        shakeReadyAt,
        dealNonce,
        shakeNonce,
        shakeStrength,
        shuffleNonce,
        hintNonce,
        extractReceipt,
        themeId,
        resumeAvailable,
        resumeLevel,
        continueAvailable,
        dailyState,
        dailyClaimable,
        dailyGrants,
        dailyMilestoneFx,
        progress,
        unlockNotice,
        statWins,
        statBest,
        statCleared,
        statGeese,
        appMode,
        ...obs,
      },
      loadData: async () => {
        // Guest is purely local: skip every chain read. Entering guest mode
        // already opens the lobby synchronously; a late framework reload must
        // never reset a run that the player started or resumed immediately.
        if (!isPlaying.get()) guest.enter();
      },
    };
  },
  });
}

void boot();
