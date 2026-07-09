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

import type { GameSessionObservables } from "@framework/game";
import {
  applyExtract,
  generateItems,
  isTrayStuck,
  makeRng,
  type ItemInstance,
} from "./engine-zhuada";
import {
  COMBO_BONUS_PER_STEP,
  COMBO_WINDOW_MS,
  SCORE_PER_MATCH,
  TIME_BONUS_PER_SEC,
  TOTAL_LEVELS,
  TRAY_SLOTS,
  specOf,
} from "./game-rules";
import { sound } from "./sound";

interface Obs<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  items: Obs<ItemInstance[]>;
  tray: Obs<(number | null)[]>;
  score: Obs<number>;
  comboCount: Obs<number>;
  timeLeftMs: Obs<number>;
  level: Obs<number>;
  isPlaying: Obs<boolean>;
  clearedFx: Obs<number[]>; // tray indices just cleared
  powerups: Obs<{ shuffle: number; hint: number; addTime: number }>;
  shuffleNonce: Obs<number>;
  hintNonce: Obs<number>;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestEngine {
  startLevel(level: number): void;
  /** Pull item `itemId` (of `kind`) into the tray. */
  extract(itemId: number, kind: number): void;
  /** Re-roll the kinds of remaining box items and re-drop them. */
  shuffle(): void;
  /** Surface a helpful item (scene pulses it). */
  hint(): void;
  /** Add `ms` to the clock. */
  addTime(ms: number): void;
  enter(): void;
  /** Debug-only: jump straight to the win/fail overlay (playtest convenience). */
  debugWin(): void;
  debugLose(): void;
}

const GUEST_KEY = "zhuada-e:progress";

/** Power-ups granted at the start of every level. */
const GRANT_SHUFFLE = 1;
const GRANT_HINT = 3;
const GRANT_ADDTIME = 1;
/** Skill milestones that refund power-ups during a level. */
const HINT_EVERY_SCORE = 100;
const ADDTIME_EVERY_SCORE = 200;
const ADDTIME_COMBO_AT = 4; // a chain of this length refunds +1 add-time

function loadProgress(): number {
  try {
    const raw = globalThis.localStorage?.getItem(GUEST_KEY);
    if (!raw) return 1;
    const n = Number(JSON.parse(raw).level);
    return Number.isFinite(n) && n >= 1 ? Math.min(n, TOTAL_LEVELS) : 1;
  } catch {
    return 1;
  }
}

function saveProgress(level: number): void {
  try {
    globalThis.localStorage?.setItem(GUEST_KEY, JSON.stringify({ level }));
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
  const { obs, items, tray, score, comboCount, timeLeftMs, level, isPlaying, clearedFx, powerups, shuffleNonce, hintNonce, t, setStatus } = deps;

  let deadline = 0;
  let comboTimer: ReturnType<typeof setTimeout> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let lastExtractAt = 0;
  let nextHintAt = HINT_EVERY_SCORE;
  let nextAddTimeAt = ADDTIME_EVERY_SCORE;

  const stopTimers = (): void => {
    if (comboTimer) { clearTimeout(comboTimer); comboTimer = null; }
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null; }
  };

  const startTick = (): void => {
    stopTimers();
    tickTimer = setInterval(() => {
      const left = Math.max(0, deadline - Date.now());
      timeLeftMs.set(left);
      if (left <= 0) failLevel();
    }, 100);
  };

  const enterLevel = (lvl: number): void => {
    stopTimers();
    const spec = specOf(lvl);
    const salt = randomSeedSalt();
    const rng = makeRng((lvl * 2654435761 + salt) >>> 0);
    const generated = generateItems(spec, rng);
    level.set(lvl);
    items.set(generated);
    tray.set(Array<number | null>(TRAY_SLOTS).fill(null));
    score.set(0);
    comboCount.set(0);
    timeLeftMs.set(spec.timeMs);
    deadline = Date.now() + spec.timeMs;
    clearedFx.set([]);
    powerups.set({ shuffle: GRANT_SHUFFLE, hint: GRANT_HINT, addTime: GRANT_ADDTIME });
    shuffleNonce.set(0);
    hintNonce.set(0);
    nextHintAt = HINT_EVERY_SCORE;
    nextAddTimeAt = ADDTIME_EVERY_SCORE;
    obs.gameStatus.set("dealt");
    isPlaying.set(true);
    obs.lastStatus.set(t("statusPlaying"));
    startTick();
  };

  const winLevel = (): void => {
    stopTimers();
    isPlaying.set(false);
    const leftSec = Math.max(0, Math.round((deadline - Date.now()) / 1000));
    const timeBonus = leftSec * TIME_BONUS_PER_SEC;
    score.set(score.get() + timeBonus);
    obs.gameStatus.set("solved");
    obs.lastStatus.set(t("statusCaught", { bonus: timeBonus }));
    setStatus(t("statusCaught", { bonus: timeBonus }), "success");
    saveProgress(Math.min(TOTAL_LEVELS, level.get() + 1));
  };

  const failLevel = (): void => {
    stopTimers();
    isPlaying.set(false);
    obs.gameStatus.set("expired");
    obs.lastStatus.set(t("statusFailed"));
    setStatus(t("statusFailed"), "info");
  };

  return {
    startLevel(lvl: number): void {
      enterLevel(Math.max(1, Math.min(TOTAL_LEVELS, lvl)));
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
      obs.lastStatus.set(t("puUsedShuffle"));
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
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const p = powerups.get();
      if (p.addTime <= 0 || ms <= 0) return;
      deadline += ms;
      timeLeftMs.set(Math.max(0, timeLeftMs.get() + ms));
      powerups.set({ ...p, addTime: p.addTime - 1 });
      obs.lastStatus.set(t("puUsedAddTime", { sec: Math.round(ms / 1000) }));
    },

    extract(itemId: number, kind: number): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const list = items.get();
      const idx = list.findIndex((it) => it.id === itemId);
      if (idx === -1) return; // already removed

      const res = applyExtract(tray.get(), kind);
      tray.set(res.slots);
      if (res.matched) {
        clearedFx.set(res.cleared);
        const now = Date.now();
        if (now - lastExtractAt <= COMBO_WINDOW_MS) comboCount.set(comboCount.get() + 1);
        else comboCount.set(1);
        lastExtractAt = now;
        const gained = SCORE_PER_MATCH + (comboCount.get() - 1) * COMBO_BONUS_PER_STEP;
        score.set(score.get() + gained);
        obs.lastStatus.set(t("statusMatched", { gained, combo: comboCount.get() }));
        // Match / combo SFX (timing-correct here: comboCount is already updated).
        sound.play(comboCount.get() > 1 ? "combo" : "match");
        if (comboTimer) clearTimeout(comboTimer);
        comboTimer = setTimeout(() => comboCount.set(0), COMBO_WINDOW_MS);
        // Skill milestones refund power-ups mid-level.
        if (score.get() >= nextHintAt) {
          nextHintAt += HINT_EVERY_SCORE;
          powerups.set({ ...powerups.get(), hint: powerups.get().hint + 1 });
        }
        if (score.get() >= nextAddTimeAt) {
          nextAddTimeAt += ADDTIME_EVERY_SCORE;
          powerups.set({ ...powerups.get(), addTime: powerups.get().addTime + 1 });
        }
        if (comboCount.get() === ADDTIME_COMBO_AT) {
          powerups.set({ ...powerups.get(), addTime: powerups.get().addTime + 1 });
        }
      } else {
        obs.lastStatus.set(t("statusTray", { left: res.slots.filter((s) => s === null).length }));
      }

      // Remove the logical item from the box.
      const next = list.slice();
      next.splice(idx, 1);
      items.set(next);

      // Win when the box is empty.
      if (next.length === 0) {
        winLevel();
        return;
      }
      // Lose when the tray is stuck (full, no triple).
      if (isTrayStuck(res.slots)) {
        failLevel();
      }
    },

    enter(): void {
      stopTimers();
      items.set([]);
      tray.set(Array<number | null>(TRAY_SLOTS).fill(null));
      score.set(0);
      comboCount.set(0);
      timeLeftMs.set(0);
      level.set(loadProgress());
      isPlaying.set(false);
      obs.gameStatus.set("idle");
      obs.lastStatus.set(t("statusReady"));
      clearedFx.set([]);
    },

    debugWin(): void {
      if (obs.gameStatus.get() !== "dealt") return;
      winLevel();
    },
    debugLose(): void {
      if (obs.gameStatus.get() !== "dealt") return;
      failLevel();
    },
  };
}
