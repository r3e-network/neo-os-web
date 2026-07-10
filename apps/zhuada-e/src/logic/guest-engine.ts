/**
 * guest-engine.ts — free local engine for Catch the Goose (B-class physics).
 *
 * Pure client-side: level seed from Web Crypto, items generated locally, tray
 * matching + scoring + timer all local. Drives the SAME observables the Three
 * scene reads (gameStatus / items / tray / score / combo / timeLeftMs / …) so
 * the scene contract is reused. No chain / oracle / reward calls.
 *
 * The physics simulation itself lives in the Three scene; this module owns the
 * logical item list (id+kind) and the tray. On `extract(itemId)` it removes the
 * logical item and updates the tray; the scene mirrors the removal on its bodies.
 */

import type { GameSessionObservables, LeaderEntry } from "@framework/game";
import {
  applyExtractShelf,
  applyRemoveToShelf,
  generateItems,
  isTrayStuck,
  makeRng,
  SHELF_SLOTS,
  type ItemInstance,
} from "./engine-zhuada";
import {
  COMBO_BONUS_PER_STEP,
  COMBO_WINDOW_MS,
  SCORE_PER_MATCH,
  TIME_BONUS_PER_SEC,
  TOTAL_LEVELS,
  TRAY_SLOTS,
  milestonesFor,
  specOf,
  type MilestonePlan,
} from "./game-rules";
import {
  EMPTY_PROGRESS,
  parseProgress,
  progressAfterWin,
  serializeProgress,
  type GooseProgress,
} from "./progress";
import { SCENES } from "./scenes";
import { sound } from "./sound";
import { haptics } from "./haptics";

interface Obs<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

/** Why the level was lost — drives distinct copy + scene stamps. */
export type FailReason = "timeout" | "trayFull";

/** Countdown urgency: audible tick starts inside this window (last 5s). */
const TICK_URGENCY_MS = 5000;

/** Shake (晃一晃) cooldown — free rescue, throttled instead of consumable. */
export const SHAKE_CD_MS = 10000;

/** Per-level power-up loadout (original-trio parity, G2). */
export interface PowerupCounts {
  shuffle: number;
  hint: number;
  remove: number;
  undo: number;
  addTime: number;
}

/** Off-chain guest leaderboard surface (framework `app.mode.guestLeaderboard`). */
export interface GuestLeaderboardApi {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  items: Obs<ItemInstance[]>;
  tray: Obs<(number | null)[]>;
  /** Side shelf (G2 移出 target) — 3 slots, still matches with the tray. */
  shelf: Obs<(number | null)[]>;
  score: Obs<number>;
  comboCount: Obs<number>;
  timeLeftMs: Obs<number>;
  level: Obs<number>;
  isPlaying: Obs<boolean>;
  clearedFx: Obs<number[]>; // tray indices just cleared
  shelfClearedFx: Obs<number[]>; // shelf indices just cleared (cross-zone match)
  failReason: Obs<FailReason | "">; // why the last loss happened ("" while alive)
  powerups: Obs<PowerupCounts>;
  /** True when the last grab is undoable (placed, un-matched, not invalidated). */
  undoable: Obs<boolean>;
  /** Untimed by default (parity G1); true = optional timed-challenge mode. */
  timedMode: Obs<boolean>;
  /** Epoch ms when shake comes off cooldown (0 = ready now). */
  shakeReadyAt: Obs<number>;
  shakeNonce: Obs<number>;
  shuffleNonce: Obs<number>;
  hintNonce: Obs<number>;
  /** Meta progression (unlocked level / wins / best per level / geese). */
  progress: Obs<GooseProgress>;
  /** Scene id of a goose unlocked by the LAST win (-1 = none) — transient. */
  unlockNotice: Obs<number>;
  guestLeaderboard: GuestLeaderboardApi;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startLevel(level: number): void;
  /** Pull item `itemId` into the tray (kind is looked up authoritatively). */
  extract(itemId: number): void;
  /** Re-roll the kinds of remaining box items and re-drop them. */
  shuffle(): void;
  /** Surface a helpful item (scene pulses it). */
  hint(): void;
  /** G2 移出: park the first 3 tray items on the side shelf. */
  removeToShelf(): void;
  /** G2 撤回: return the last un-matched grab to the top of the pile. */
  undo(): void;
  /** G3 晃一晃: jolt the pile (scene applies impulses) — cooldown, no charge. */
  shake(): void;
  /** Add `ms` to the clock (timed-challenge mode only). */
  addTime(ms: number): void;
  /** Flip the timed-challenge preference (idle only; persisted). */
  setTimedMode(on: boolean): void;
  enter(): void;
  /** Debug-only: jump straight to the win/fail overlay (playtest convenience). */
  debugWin(): void;
  debugLose(reason?: FailReason): void;
}

const GUEST_KEY = "zhuada-e:progress";
const TIMED_KEY = "zhuada-e:timed-mode";

/** Power-ups granted at the start of every level (tune.mjs models this grant). */
const GRANT_SHUFFLE = 1;
const GRANT_HINT = 3;
const GRANT_REMOVE = 1;
const GRANT_UNDO = 1;
const GRANT_ADDTIME = 1;
// Skill milestones that refund power-ups mid-level are PER-LEVEL now — see
// milestonesFor() in game-rules.ts (thresholds scale with the level's base
// score ceiling so every refund is reachable on every level).

/** Read the persisted timed-challenge preference (defaults OFF — parity G1). */
export function loadTimedPref(): boolean {
  try {
    return globalThis.localStorage?.getItem(TIMED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveTimedPref(on: boolean): void {
  try {
    globalThis.localStorage?.setItem(TIMED_KEY, on ? "1" : "0");
  } catch {
    /* best-effort */
  }
}

/** Read the persisted meta progression (v2 schema; v1 `{level}` migrates). */
function loadProgress(): GooseProgress {
  try {
    return parseProgress(globalThis.localStorage?.getItem(GUEST_KEY));
  } catch {
    return { ...EMPTY_PROGRESS, best: {}, geese: [] };
  }
}

function saveProgress(p: GooseProgress): void {
  try {
    globalThis.localStorage?.setItem(GUEST_KEY, serializeProgress(p));
  } catch {
    /* best-effort */
  }
}

function randomSeedSalt(): number {
  const c = globalThis.crypto;
  if (c?.getRandomValues) {
    const b = new Uint32Array(1);
    c.getRandomValues(b);
    return b[0] ?? 1;
  }
  return Math.floor(Math.random() * 0xffffffff);
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const { obs, items, tray, shelf, score, comboCount, timeLeftMs, level, isPlaying, clearedFx, shelfClearedFx, failReason, powerups, undoable, timedMode, shakeReadyAt, shakeNonce, shuffleNonce, hintNonce, progress, unlockNotice, guestLeaderboard, t, setStatus } = deps;

  let deadline = 0;
  let comboTimer: ReturnType<typeof setTimeout> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let lastExtractAt = 0;
  let milestones: MilestonePlan = milestonesFor(specOf(1));
  let nextHintAt = milestones.hintStep;
  let nextAddTimeAt = milestones.addTimeStep;
  /** Wall-clock instant the tab went hidden mid-level (0 = not paused). */
  let hiddenAt = 0;
  /** Last whole second an urgency tick played for (dedupes the 100ms poll). */
  let lastTickSec = -1;
  /**
   * The last grab, while it is still undoable (G2 撤回): set on every placed,
   * un-matched extract; cleared by a match, a shuffle, a remove, or an undo.
   */
  let lastGrab: { itemId: number; kind: number; slot: number } | null = null;

  const setLastGrab = (g: typeof lastGrab): void => {
    lastGrab = g;
    undoable.set(g !== null);
  };

  /** Can the player still self-rescue out of a jammed tray? */
  const canRescue = (): boolean => {
    const p = powerups.get();
    const shelfFree = shelf.get().every((s) => s === null);
    return (p.remove > 0 && shelfFree) || (p.undo > 0 && lastGrab !== null);
  };

  const stopTimers = (): void => {
    if (comboTimer) { clearTimeout(comboTimer); comboTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  };

  const startTick = (): void => {
    stopTimers();
    tickTimer = setInterval(() => {
      // Countdown is PAUSED while the tab is hidden — the deadline shifts by
      // the hidden duration on resume (see the visibilitychange handler), so
      // switching apps on mobile never silently drains the clock.
      if (hiddenAt > 0) return;
      const left = Math.max(0, deadline - Date.now());
      timeLeftMs.set(left);
      // Final-seconds urgency: one audible tick per remaining second.
      if (left > 0 && left <= TICK_URGENCY_MS) {
        const sec = Math.ceil(left / 1000);
        if (sec !== lastTickSec) {
          lastTickSec = sec;
          sound.play("tick");
        }
      }
      if (left <= 0) failLevel("timeout");
    }, 100);
  };

  // Pause/resume the countdown across tab visibility changes. The engine is a
  // singleton for the iframe's lifetime, so the listener needs no teardown
  // (same lifecycle as the interval timers above).
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        if (isPlaying.get() && hiddenAt === 0) hiddenAt = Date.now();
      } else if (hiddenAt > 0) {
        deadline += Date.now() - hiddenAt;
        hiddenAt = 0;
      }
    });
  }

  /** Best-effort off-chain leaderboard refresh (guest board, ranked locally). */
  const refreshLeaderboard = async (): Promise<void> => {
    try {
      const rows = await guestLeaderboard.get(50);
      const ranked: LeaderEntry[] = rows
        .map((row) => ({ address: row.user, score: Number(row.score) || 0 }))
        .sort((a, b) => b.score - a.score)
        .map((row, index) => ({
          rank: index + 1,
          address: row.address,
          totalWon: row.score,
          solves: 1,
          isUser: false,
        }));
      obs.leaderboard.set(ranked);
    } catch {
      obs.leaderboard.set([]);
    }
  };

  const enterLevel = (lvl: number): void => {
    stopTimers();
    const spec = specOf(lvl);
    const salt = randomSeedSalt();
    const rng = makeRng((lvl * 2654435761 + salt) >>> 0);
    const generated = generateItems(spec, rng);
    const timed = timedMode.get();
    level.set(lvl);
    items.set(generated);
    tray.set(Array<number | null>(TRAY_SLOTS).fill(null));
    shelf.set(Array<number | null>(SHELF_SLOTS).fill(null));
    score.set(0);
    comboCount.set(0);
    // Untimed by default (parity G1): the clock only exists in the optional
    // timed-challenge mode; otherwise the tray jam is the only way to lose.
    timeLeftMs.set(timed ? spec.timeMs : 0);
    deadline = timed ? Date.now() + spec.timeMs : 0;
    hiddenAt = 0;
    lastTickSec = -1;
    clearedFx.set([]);
    shelfClearedFx.set([]);
    failReason.set("");
    unlockNotice.set(-1);
    powerups.set({
      shuffle: GRANT_SHUFFLE,
      hint: GRANT_HINT,
      remove: GRANT_REMOVE,
      undo: GRANT_UNDO,
      addTime: timed ? GRANT_ADDTIME : 0,
    });
    setLastGrab(null);
    shakeReadyAt.set(0);
    shakeNonce.set(0);
    shuffleNonce.set(0);
    hintNonce.set(0);
    milestones = milestonesFor(spec);
    nextHintAt = milestones.hintStep;
    nextAddTimeAt = milestones.addTimeStep;
    obs.gameStatus.set("dealt");
    isPlaying.set(true);
    obs.lastStatus.set(t("statusPlaying"));
    if (timed) startTick();
  };

  const winLevel = (): void => {
    stopTimers();
    isPlaying.set(false);
    // Time bonus only exists in timed-challenge mode; in the untimed default
    // the score is pure match+combo skill (no clock dimension to reward).
    const timed = timedMode.get();
    const leftSec = timed ? Math.max(0, Math.round((deadline - Date.now()) / 1000)) : 0;
    const timeBonus = leftSec * TIME_BONUS_PER_SEC;
    const finalScore = score.get() + timeBonus;
    score.set(finalScore);
    obs.gameStatus.set("solved");
    const caughtMsg = timed ? t("statusCaught", { bonus: timeBonus }) : t("statusCaughtUntimed");
    obs.lastStatus.set(caughtMsg);
    haptics.play("win");

    // ── Meta progression: unlock next level, wins/best, scene goose (G4). ──
    const outcome = progressAfterWin(progress.get(), level.get(), finalScore);
    progress.set(outcome.next);
    saveProgress(outcome.next);
    if (outcome.unlockedGoose >= 0) {
      unlockNotice.set(outcome.unlockedGoose);
      const scene = SCENES[outcome.unlockedGoose];
      sound.play("unlock");
      setStatus(t("gooseUnlocked", { name: t(scene?.gooseNameKey ?? "statusWonTitle") }), "success");
    } else if (outcome.allClear) {
      setStatus(t("statusAllClear"), "success");
    } else {
      setStatus(caughtMsg, "success");
    }

    // ── G6: best-effort off-chain guest leaderboard (never blocks play). ──
    void (async () => {
      try {
        if (finalScore > 0) await guestLeaderboard.submit(finalScore);
      } catch {
        /* optional board unavailable — local play continues */
      }
      await refreshLeaderboard();
    })();
  };

  const failLevel = (reason: FailReason): void => {
    stopTimers();
    isPlaying.set(false);
    failReason.set(reason);
    obs.gameStatus.set("expired");
    // Failure must be READABLE: a timeout and a jammed tray are different
    // mistakes and get different copy (+ different scene stamps).
    const msg = reason === "timeout" ? t("statusFailedTimeout") : t("statusFailedTrayFull");
    obs.lastStatus.set(msg);
    setStatus(msg, "info");
    haptics.play("fail");
  };

  return {
    startLevel(lvl: number): void {
      // A level is playable only once unlocked (level-select map, G4).
      const maxUnlocked = Math.max(1, Math.min(TOTAL_LEVELS, progress.get().level));
      enterLevel(Math.max(1, Math.min(maxUnlocked, lvl)));
    },

    shuffle(): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const p = powerups.get();
      if (p.shuffle <= 0) return;
      const list = items.get();
      if (list.length === 0) return;
      // Re-roll the kind assignment across the remaining items (counts stay a
      // multiple of 3, so the level stays solvable). The scene re-drops them.
      const r = makeRng((Date.now() ^ (list.length * 2654435761)) >>> 0);
      const kinds = list.map((it) => it.kind);
      for (let i = kinds.length - 1; i > 0; i -= 1) {
        const j = Math.floor(r() * (i + 1));
        const tmp = kinds[i]!;
        kinds[i] = kinds[j]!;
        kinds[j] = tmp;
      }
      const next = list.map((it, i) => ({ ...it, kind: kinds[i]! }));
      items.set(next);
      powerups.set({ ...p, shuffle: p.shuffle - 1 });
      shuffleNonce.set(shuffleNonce.get() + 1);
      // A shuffle re-rolls kinds, so the "last grab" no longer corresponds to
      // anything real in the pile — it stops being undoable (GDD §12).
      setLastGrab(null);
      obs.lastStatus.set(t("puUsedShuffle"));
    },

    removeToShelf(): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const p = powerups.get();
      if (p.remove <= 0) return;
      const applied = applyRemoveToShelf(tray.get(), shelf.get());
      if (!applied) return; // shelf occupied or fewer than 3 tray items
      tray.set(applied.tray);
      shelf.set(applied.shelf);
      powerups.set({ ...p, remove: p.remove - 1 });
      // The last grab may have just moved zones — no longer undoable.
      setLastGrab(null);
      obs.lastStatus.set(t("puUsedRemove"));
    },

    undo(): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const p = powerups.get();
      if (p.undo <= 0 || lastGrab === null) return;
      const { itemId, kind, slot } = lastGrab;
      const slots = tray.get();
      if (slots[slot] !== kind) return; // defensive: tray diverged somehow
      const nextTray = slots.slice();
      nextTray[slot] = null;
      tray.set(nextTray);
      // Return the item to the TOP of the pile: fresh drop coordinates, same
      // id + kind (the scene spawns a new body falling in from above).
      const r = makeRng((Date.now() ^ (itemId * 2654435761)) >>> 0);
      const spec = specOf(level.get());
      const half = spec.boxSize / 2 - 0.6;
      const back: ItemInstance = {
        id: itemId,
        kind,
        px: (r() * 2 - 1) * half,
        py: spec.boxSize / 2 + r() * spec.boxSize,
        pz: (r() * 2 - 1) * half,
      };
      items.set([...items.get(), back]);
      powerups.set({ ...p, undo: p.undo - 1 });
      setLastGrab(null);
      obs.lastStatus.set(t("puUsedUndo"));
    },

    shake(): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const now = Date.now();
      if (now < shakeReadyAt.get()) return; // still cooling down
      shakeReadyAt.set(now + SHAKE_CD_MS);
      shakeNonce.set(shakeNonce.get() + 1);
      obs.lastStatus.set(t("puUsedShake"));
    },

    hint(): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const p = powerups.get();
      if (p.hint <= 0) return;
      powerups.set({ ...p, hint: p.hint - 1 });
      hintNonce.set(hintNonce.get() + 1);
      obs.lastStatus.set(t("puUsedHint"));
    },

    addTime(ms: number): void {
      // Meaningless without a clock — only reachable in timed-challenge mode.
      if (!timedMode.get()) return;
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const p = powerups.get();
      if (p.addTime <= 0 || ms <= 0) return;
      deadline += ms;
      timeLeftMs.set(Math.max(0, timeLeftMs.get() + ms));
      powerups.set({ ...p, addTime: p.addTime - 1 });
      obs.lastStatus.set(t("puUsedAddTime", { sec: Math.round(ms / 1000) }));
    },

    setTimedMode(on: boolean): void {
      // Mode switches between runs only — mid-level flips would let a losing
      // timed run escape its clock (or grant a surprise one).
      if (isPlaying.get()) return;
      timedMode.set(on);
      saveTimedPref(on);
    },

    extract(itemId: number): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const list = items.get();
      const idx = list.findIndex((it) => it.id === itemId);
      if (idx === -1) return; // already removed

      // Use the AUTHORITATIVE kind from the item list — a client-supplied
      // kind can go stale in the one-flush window after a shuffle and would
      // break the multiple-of-3 solvability invariant.
      const kind = list[idx]!.kind;
      const res = applyExtractShelf(tray.get(), shelf.get(), kind);
      if (!res.placed) return; // tray full: rescue (remove/undo) or jam, no landing
      tray.set(res.tray);
      shelf.set(res.shelf);
      if (res.matched) {
        clearedFx.set(res.clearedTray);
        shelfClearedFx.set(res.clearedShelf);
        setLastGrab(null); // a matched grab is gone — nothing to undo
        const now = Date.now();
        if (now - lastExtractAt <= COMBO_WINDOW_MS) comboCount.set(comboCount.get() + 1);
        else comboCount.set(1);
        lastExtractAt = now;
        const gained = SCORE_PER_MATCH + (comboCount.get() - 1) * COMBO_BONUS_PER_STEP;
        score.set(score.get() + gained);
        obs.lastStatus.set(t("statusMatched", { gained, combo: comboCount.get() }));
        // Match / combo SFX (timing-correct here: comboCount is already updated).
        sound.play(comboCount.get() > 1 ? "combo" : "match");
        haptics.play("match");
        if (comboTimer) clearTimeout(comboTimer);
        comboTimer = setTimeout(() => comboCount.set(0), COMBO_WINDOW_MS);
        // Skill milestones refund power-ups mid-level (per-level thresholds —
        // see milestonesFor). `while` handles a single gain crossing several
        // steps (long combo chains on small-ceiling levels).
        while (score.get() >= nextHintAt) {
          nextHintAt += milestones.hintStep;
          powerups.set({ ...powerups.get(), hint: powerups.get().hint + 1 });
        }
        while (score.get() >= nextAddTimeAt) {
          nextAddTimeAt += milestones.addTimeStep;
          // The add-time refund only exists where a clock does.
          if (timedMode.get()) {
            powerups.set({ ...powerups.get(), addTime: powerups.get().addTime + 1 });
          }
        }
        if (comboCount.get() === milestones.comboHintAt) {
          powerups.set({ ...powerups.get(), hint: powerups.get().hint + 1 });
        }
      } else {
        // Un-matched grab → this becomes the undo target (G2 撤回).
        setLastGrab({ itemId, kind, slot: res.placedIndex });
        obs.lastStatus.set(t("statusTray", { left: res.tray.filter((s) => s === null).length }));
      }

      // Remove the logical item from the box.
      const next = list.slice();
      next.splice(idx, 1);
      items.set(next);

      // Win when the box is empty. (Counts are multiples of 3 and any 3rd copy
      // across tray+shelf clears immediately, so an empty box implies an empty
      // tray AND shelf — asserted in engine-zhuada tests.)
      if (next.length === 0) {
        winLevel();
        return;
      }
      // Tray full with no triple: jam. If a rescue (remove with a free shelf /
      // undo of this grab) is still in hand this is a LAST-STAND state, not a
      // loss — the original's tools exist exactly for this moment (GDD §12).
      if (isTrayStuck(res.tray)) {
        if (canRescue()) {
          setStatus(t("statusTrayRescue"), "warning");
          obs.lastStatus.set(t("statusTrayRescue"));
        } else {
          failLevel("trayFull");
        }
      }
    },

    enter(): void {
      stopTimers();
      const saved = loadProgress();
      progress.set(saved);
      timedMode.set(loadTimedPref());
      items.set([]);
      tray.set(Array<number | null>(TRAY_SLOTS).fill(null));
      shelf.set(Array<number | null>(SHELF_SLOTS).fill(null));
      score.set(0);
      comboCount.set(0);
      timeLeftMs.set(0);
      level.set(saved.level);
      isPlaying.set(false);
      obs.gameStatus.set("idle");
      obs.lastStatus.set(t("statusReady"));
      clearedFx.set([]);
      shelfClearedFx.set([]);
      failReason.set("");
      unlockNotice.set(-1);
      setLastGrab(null);
      shakeReadyAt.set(0);
      void refreshLeaderboard();
    },

    debugWin(): void {
      if (obs.gameStatus.get() !== "dealt") return;
      winLevel();
    },
    debugLose(reason: FailReason = "timeout"): void {
      if (obs.gameStatus.get() !== "dealt") return;
      failLevel(reason);
    },
  };
}
