/**
 * guest-engine.ts — free local engine for Goose Basket Shuffle.
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
  applyExtractShelf,
  applyRemoveToShelf,
  compactTray,
  EMPTY_EXTRACT_RECEIPT,
  generateItems,
  isTrayStuck,
  makeRng,
  SHELF_SLOTS,
  type ExtractReceipt,
  type ItemInstance,
} from "./engine-zhuada";
import {
  COMBO_BONUS_PER_STEP,
  COMBO_WINDOW_MS,
  MAX_LOGICAL_ITEMS,
  SCORE_PER_MATCH,
  TIME_BONUS_PER_SEC,
  TOTAL_LEVELS,
  TRAY_SLOTS,
  milestonesFor,
  randomizedSpecOf,
  seedFor,
  specOf,
  type MilestonePlan,
} from "./game-rules";
import {
  claimDailyReward,
  computeDailyView,
  dateSeed,
  loadDailyState,
  saveDailyState,
  todayKey,
  DAILY_CHALLENGE_LEVEL,
  type DailyState,
} from "./daily-reward";
import {
  EMPTY_PROGRESS,
  progressAfterAttempt,
  progressAfterFailure,
  progressAfterWin,
  type GooseProgress,
} from "./progress";
import { SCENES } from "./scenes";
import { computeGoosePassive, EMPTY_GOOSE_PASSIVE, type GoosePassive } from "./goose-passive";
import { createItemStream, refillItemStream } from "./item-stream";
import { sound } from "./sound";
import { haptics } from "./haptics";
import { isGameThemeId, themeOf, THEME_ITEM_COUNT, type GameThemeId } from "./themes";
import { gameStorage } from "./game-storage";
import {
  clearRunSnapshot,
  loadRunSnapshot,
  loadStoredProgress,
  saveRunSnapshot,
  saveStoredProgress,
  type StringStorage,
} from "./progress-store";

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
export const SHAKE_CD_MS = 5000;
/** R3 — floor for the shake cooldown after the pond goose shortens it. */
const SHAKE_CD_MIN = 2000;

/** Per-level power-up loadout (original-trio parity, G2). */
export interface PowerupCounts {
  shuffle: number;
  hint: number;
  remove: number;
  undo: number;
  addTime: number;
}

/** Logical-only interrupted run; the 3D pile is safely rebuilt on resume. */
export interface StoredRunState {
  level: number;
  themeId: GameThemeId;
  timedMode: boolean;
  active: ItemInstance[];
  reserve: ItemInstance[];
  tray: (number | null)[];
  shelf: (number | null)[];
  score: number;
  powerups: PowerupCounts;
  lastGrab: { itemId: number; kind: number; slot: number } | null;
  timeLeftMs: number;
  elapsedMs: number;
  shakeCooldownMs: number;
  /** One recovery feather is available per fresh run and survives reloads. */
  continueUsed: boolean;
}

function isStoredItem(value: unknown): value is ItemInstance {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<ItemInstance>;
  return Number.isInteger(item.id) && Number(item.id) >= 0
    && Number.isInteger(item.kind) && Number(item.kind) >= 0 && Number(item.kind) < THEME_ITEM_COUNT
    && Number.isFinite(item.px) && Number.isFinite(item.py) && Number.isFinite(item.pz)
    && (item.spawnMode === undefined || item.spawnMode === "drop" || item.spawnMode === "reservoir");
}

function isSlotList(value: unknown, length: number): value is (number | null)[] {
  return Array.isArray(value) && value.length === length && value.every((slot) =>
    slot === null || (Number.isInteger(slot) && Number(slot) >= 0 && Number(slot) < THEME_ITEM_COUNT));
}

function isPowerupCounts(value: unknown): value is PowerupCounts {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<PowerupCounts>;
  return [p.shuffle, p.hint, p.remove, p.undo, p.addTime]
    .every((count) => Number.isInteger(count) && Number(count) >= 0 && Number(count) <= 999);
}

export function isStoredRunState(value: unknown): value is StoredRunState {
  if (!value || typeof value !== "object") return false;
  const run = value as Partial<StoredRunState>;
  if (!Number.isInteger(run.level) || Number(run.level) < 1 || Number(run.level) > TOTAL_LEVELS) return false;
  if (!isGameThemeId(run.themeId) || typeof run.timedMode !== "boolean" || typeof run.continueUsed !== "boolean") return false;
  if (!Array.isArray(run.active) || !Array.isArray(run.reserve)) return false;
  if (
    run.active.length > 54
    || run.active.length + run.reserve.length < 1
    || run.active.length + run.reserve.length > MAX_LOGICAL_ITEMS
  ) return false;
  if (!run.active.every(isStoredItem) || !run.reserve.every(isStoredItem)) return false;
  const ids = [...run.active, ...run.reserve].map((item) => item.id);
  if (new Set(ids).size !== ids.length) return false;
  if (!isSlotList(run.tray, TRAY_SLOTS) || !isSlotList(run.shelf, SHELF_SLOTS)) return false;
  if (!Number.isInteger(run.score) || Number(run.score) < 0 || Number(run.score) > 999_999_999) return false;
  if (!isPowerupCounts(run.powerups)) return false;
  if (run.lastGrab !== null) {
    if (!run.lastGrab || !Number.isInteger(run.lastGrab.itemId) || Number(run.lastGrab.itemId) < 0
      || !Number.isInteger(run.lastGrab.kind) || Number(run.lastGrab.kind) < 0 || Number(run.lastGrab.kind) >= THEME_ITEM_COUNT
      || !Number.isInteger(run.lastGrab.slot) || Number(run.lastGrab.slot) < 0 || Number(run.lastGrab.slot) >= TRAY_SLOTS) return false;
  }
  return [run.timeLeftMs, run.elapsedMs, run.shakeCooldownMs].every((amount) =>
    Number.isFinite(amount) && Number(amount) >= 0 && Number(amount) <= 86_400_000);
}

export interface GuestEngineDeps {
  obs: GameSessionObservables;
  items: Obs<ItemInstance[]>;
  /** Logical items still below the live physics window. */
  reserveCount: Obs<number>;
  tray: Obs<(number | null)[]>;
  /** Side shelf (G2 移出 target) — 3 slots, still matches with the tray. */
  shelf: Obs<(number | null)[]>;
  score: Obs<number>;
  comboCount: Obs<number>;
  /** R6 Frenzy: remaining free auto-pulls granted by a high combo. */
  frenzyCharges: Obs<number>;
  /** R6 Frenzy: monotonic nonce, bumped on each frenzy pulse for a UI burst. */
  frenzyFx: Obs<number>;
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
  /** Monotonic id for each fresh deal. Retries must reset the 3D scene even
   * when level/status stay unchanged and item ids are reused from zero. */
  dealNonce: Obs<number>;
  shakeNonce: Obs<number>;
  shuffleNonce: Obs<number>;
  hintNonce: Obs<number>;
  /** Pick acknowledgement consumed by the scene for exact-slot animation. */
  extractReceipt: Obs<ExtractReceipt>;
  /** Last accepted physical shake intensity (0.75 soft, 1.25 strong). */
  shakeStrength: Obs<number>;
  /** Player-selected presentation theme (themes share gameplay/rank rules). */
  themeId: Obs<GameThemeId>;
  /** Valid, unexpired interrupted run waiting in local storage. */
  resumeAvailable: Obs<boolean>;
  resumeLevel: Obs<number>;
  /** A frozen failed run can spend its one recovery feather. */
  continueAvailable: Obs<boolean>;
  /** R4 — persisted daily sign-in/streak state (kept out of GooseProgress). */
  dailyState: Obs<DailyState>;
  /** R4 — true when today's claim is still available (drives the claim card). */
  dailyClaimable: Obs<boolean>;
  /** R4 — powerups granted by the current day's claim (claim-card preview). */
  dailyGrants: Obs<PowerupCounts>;
  /** R4 — monotonic nonce bumped on a 7-day milestone for a celebration burst. */
  dailyMilestoneFx: Obs<number>;
  /** Meta progression (unlocked level / wins / best per level / geese). */
  progress: Obs<GooseProgress>;
  /** Scene id of a goose unlocked by the LAST win (-1 = none) — transient. */
  unlockNotice: Obs<number>;
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
  shake(strength?: number): void;
  /** Add `ms` to the clock (timed-challenge mode only). */
  addTime(ms: number): void;
  /** Flip the timed-challenge preference (idle only; persisted). */
  setTimedMode(on: boolean): void;
  /** Resume the validated local run snapshot advertised in the lobby. */
  resumeRun(): void;
  /** Permanently discard the interrupted local run. */
  discardRun(): void;
  /** Continue the frozen failed run once, without starting a new layout. */
  continueAfterFailure(): void;
  /** R4 — claim today's sign-in reward (idempotent within a day). */
  claimDaily(): void;
  /** R4 — start the date-seeded daily challenge (shared layout for the day). */
  startDailyChallenge(): void;
  enter(): void;
  /** Debug-only: jump straight to the win/fail overlay (playtest convenience). */
  debugWin?: () => void;
  debugLose?: (reason?: FailReason) => void;
}

const TIMED_KEY = "zhuada-e:timed-mode";
// v7 invalidates the six-silhouette challenge openings. Those saves may still
// contain valid 48-kind/864-item records, but their first 54 bodies do not
// satisfy the current twelve-silhouette mix with six paired near-match
// families and six additional silhouettes.
const RUN_RULES_VERSION = 7;
const RUN_SAVE_DEBOUNCE_MS = 140;

// R6 Frenzy — a combo climax. Reaching FRENZY_TRIGGER_COMBO grants
// FRENZY_CHARGES "free pulls": the next N matches each auto-attract one copy
// of the just-cleared kind from the box into the tray (a saved click + burst).
// Bounded by charges; re-arms every time the combo climbs back to the trigger
// after a reset, so a sustained chain keeps pulsing every few steps.
const FRENZY_TRIGGER_COMBO = 5; // [ACCEPTED-SIM] Proposed 5 (band 4–7); balance-frenzy.mjs gate PASS (struggling 0 triggers, skilled frequent) — see GDD §9.1; human feel-test still recommended
const FRENZY_CHARGES = 2; // [ACCEPTED-SIM] Proposed 2 (band 1–3); gate PASS — see GDD §9.1; human feel-test still recommended

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
    return gameStorage.getItem(TIMED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveTimedPref(on: boolean): void {
  try {
    gameStorage.setItem(TIMED_KEY, on ? "1" : "0");
  } catch {
    /* best-effort */
  }
}

function browserStorage(): StringStorage | null {
  try {
    return gameStorage;
  } catch {
    return null;
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
  const { obs, items, reserveCount, tray, shelf, score, comboCount, frenzyCharges, frenzyFx, timeLeftMs, level, isPlaying, clearedFx, shelfClearedFx, failReason, powerups, undoable, timedMode, shakeReadyAt, dealNonce, shakeNonce, shuffleNonce, hintNonce, extractReceipt, shakeStrength, themeId, resumeAvailable, resumeLevel, continueAvailable, dailyState, dailyClaimable, dailyGrants, dailyMilestoneFx, progress, unlockNotice, t, setStatus } = deps;

  let deadline = 0;
  let comboTimer: ReturnType<typeof setTimeout> | null = null;
  let tickTimer: ReturnType<typeof setInterval> | null = null;
  let unlockTimer: ReturnType<typeof setTimeout> | null = null;
  let runSaveTimer: ReturnType<typeof setTimeout> | null = null;
  let lastExtractAt = 0;
  let milestones: MilestonePlan = milestonesFor(specOf(1));
  let nextHintAt = milestones.hintStep;
  let nextAddTimeAt = milestones.addTimeStep;
  /** Wall-clock instant the tab went hidden mid-level (0 = not paused). */
  let hiddenAt = 0;
  /** Last whole second an urgency tick played for (dedupes the 100ms poll). */
  let lastTickSec = -1;
  /** Wall-clock start used to preserve elapsed time in interrupted-run snapshots. */
  let runStartedAt = 0;
  let runId = "";
  let continueUsed = false;
  let failedTimeLeftMs = 0;
  /** Monotonic per-engine nonce guarantees consecutive restarts cannot reuse a layout. */
  let runNonce = 0;
  /** R3 — aggregated passive bonus of the player's collected geese, recomputed per run. */
  let goosePassive: GoosePassive = { ...EMPTY_GOOSE_PASSIVE };
  /** R3 — per-run combo window, extended by the farm goose's bonus. */
  let comboWindowMs = COMBO_WINDOW_MS;
  /** R7 — per-run Frenzy trigger, lowered by the abyss goose's bonus (min 3). */
  let frenzyTriggerCombo = FRENZY_TRIGGER_COMBO;
  /** Hundreds of logical items can back a run without becoming live Cannon bodies. */
  let reserveItems: ItemInstance[] = [];
  let refillRng: () => number = makeRng(1);
  /**
   * The last grab, while it is still undoable (G2 撤回): set on every placed,
   * un-matched extract; cleared by a match, a shuffle, a remove, or an undo.
   */
  let lastGrab: { itemId: number; kind: number; slot: number } | null = null;

  const setLastGrab = (g: typeof lastGrab): void => {
    lastGrab = g;
    undoable.set(g !== null);
  };

  let storageWarningShown = false;
  const warnStorage = (futureVersion = false): void => {
    if (storageWarningShown) return;
    storageWarningShown = true;
    setStatus(t(futureVersion ? "progressFutureVersion" : "progressSaveFailed"), "warning");
  };

  const readProgress = (): GooseProgress => {
    const storage = browserStorage();
    if (!storage) {
      warnStorage();
      return { ...EMPTY_PROGRESS, levels: {}, best: {}, geese: [] };
    }
    const loaded = loadStoredProgress(storage);
    if (loaded.status === "storage-error" || (loaded.writeBack && !loaded.writeBack.ok)) warnStorage();
    if (loaded.readOnly) warnStorage(true);
    return loaded.progress;
  };

  const persistProgress = (next: GooseProgress): void => {
    const storage = browserStorage();
    if (!storage) {
      warnStorage();
      return;
    }
    const result = saveStoredProgress(storage, next);
    if (!result.ok) warnStorage(result.reason === "future-version");
  };

  const runState = (): StoredRunState => ({
    level: level.get(),
    themeId: themeId.get(),
    timedMode: timedMode.get(),
    // A resumed active body uses a normal safe re-drop. Bottom-emergence is a
    // one-shot animation command and must not replay after every reload.
    active: items.get().map((item) => ({ ...item, spawnMode: "drop" as const })),
    reserve: reserveItems.map((item) => ({ ...item })),
    tray: tray.get().slice(),
    shelf: shelf.get().slice(),
    score: score.get(),
    powerups: { ...powerups.get() },
    lastGrab: lastGrab ? { ...lastGrab } : null,
    timeLeftMs: timedMode.get() ? Math.max(0, deadline - Date.now()) : 0,
    elapsedMs: Math.max(0, Date.now() - runStartedAt),
    shakeCooldownMs: Math.max(0, shakeReadyAt.get() - Date.now()),
    continueUsed,
  });

  const flushRunSnapshot = (): void => {
    if (runSaveTimer) {
      clearTimeout(runSaveTimer);
      runSaveTimer = null;
    }
    if (!isPlaying.get() || obs.gameStatus.get() !== "dealt" || !runId) return;
    const storage = browserStorage();
    if (!storage) {
      warnStorage();
      return;
    }
    const saved = saveRunSnapshot(storage, {
      rulesVersion: RUN_RULES_VERSION,
      runId,
      state: runState(),
    });
    if (!saved.ok) warnStorage(saved.reason === "future-version");
    else {
      resumeAvailable.set(true);
      resumeLevel.set(level.get());
    }
  };

  const scheduleRunSnapshot = (): void => {
    if (runSaveTimer) clearTimeout(runSaveTimer);
    runSaveTimer = setTimeout(flushRunSnapshot, RUN_SAVE_DEBOUNCE_MS);
  };

  const clearPersistedRun = (): void => {
    if (runSaveTimer) {
      clearTimeout(runSaveTimer);
      runSaveTimer = null;
    }
    const storage = browserStorage();
    if (storage) {
      const existing = loadRunSnapshot<StoredRunState>(storage, {
        expectedRulesVersion: RUN_RULES_VERSION,
        validateState: isStoredRunState,
      });
      if (existing.status === "future-version") {
        warnStorage(true);
        resumeAvailable.set(false);
        resumeLevel.set(0);
        return;
      }
      const cleared = clearRunSnapshot(storage);
      if (!cleared.ok) warnStorage();
    }
    runId = "";
    resumeAvailable.set(false);
    resumeLevel.set(0);
  };

  const resumableSnapshot = () => {
    const storage = browserStorage();
    if (!storage) return null;
    const loaded = loadRunSnapshot<StoredRunState>(storage, {
      expectedRulesVersion: RUN_RULES_VERSION,
      validateState: isStoredRunState,
    });
    if (loaded.status === "future-version") warnStorage(true);
    if (loaded.status === "storage-error") warnStorage();
    const snapshot = loaded.status === "ready" ? loaded.snapshot : null;
    // Never resume a level that the validated progress no longer unlocks.
    if (snapshot && snapshot.state.level <= progress.get().level) return snapshot;
    return null;
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
    if (unlockTimer) { clearTimeout(unlockTimer); unlockTimer = null; }
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
        if (isPlaying.get() && hiddenAt === 0) {
          flushRunSnapshot();
          hiddenAt = Date.now();
        }
      } else if (hiddenAt > 0) {
        deadline += Date.now() - hiddenAt;
        hiddenAt = 0;
      }
    });
  }
  if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", flushRunSnapshot);
  }

  const enterLevel = (lvl: number, seedSaltOverride?: number): void => {
    stopTimers();
    clearPersistedRun();
    continueUsed = false;
    failedTimeLeftMs = 0;
    continueAvailable.set(false);
    runNonce += 1;
    // A deterministic override (the daily challenge) must NOT fold in runNonce
    // or Date.now — otherwise the "shared layout for the day" would differ per
    // session. Random runs keep their volatile salt for anti-replay variety.
    const salt = seedSaltOverride ?? ((randomSeedSalt() ^ Math.imul(runNonce, 0x9e3779b1) ^ Date.now()) >>> 0);
    runId = `${Date.now().toString(36)}-${salt.toString(36)}-${runNonce.toString(36)}`;
    const rng = makeRng(seedFor(lvl, salt));
    const spec = randomizedSpecOf(lvl, rng, themeId.get());
    const generated = generateItems(spec, rng);
    const stream = createItemStream(generated, rng, themeOf(themeId.get()).items);
    reserveItems = stream.reserve;
    reserveCount.set(reserveItems.length);
    refillRng = makeRng(seedFor(lvl, salt ^ 0xa511e9b3));
    sound.setPlaying(true);
    const timed = timedMode.get();
    level.set(lvl);
    const attempted = progressAfterAttempt(progress.get(), lvl, themeId.get());
    progress.set(attempted);
    persistProgress(attempted);
    items.set(stream.active);
    tray.set(Array<number | null>(TRAY_SLOTS).fill(null));
    shelf.set(Array<number | null>(SHELF_SLOTS).fill(null));
    score.set(0);
    comboCount.set(0);
    // Untimed by default (parity G1): the clock only exists in the optional
    // timed-challenge mode; otherwise the tray jam is the only way to lose.
    timeLeftMs.set(timed ? spec.timeMs : 0);
    deadline = timed ? Date.now() + spec.timeMs : 0;
    hiddenAt = 0;
    runStartedAt = Date.now();
    lastTickSec = -1;
    clearedFx.set([]);
    shelfClearedFx.set([]);
    failReason.set("");
    unlockNotice.set(-1);
    // R3 — recompute the collected-geese passive. Geese only grow within a run
    // (a win can unlock one), so computing here — before the grant — is enough.
    goosePassive = computeGoosePassive(progress.get().geese);
    comboWindowMs = COMBO_WINDOW_MS + goosePassive.comboWindowDeltaMs;
    frenzyTriggerCombo = Math.max(3, FRENZY_TRIGGER_COMBO - goosePassive.frenzyTriggerDelta);
    // R4 — fold today's sign-in bonus on top of the base per-run grant. The
    // bonus is bounded by streak (recomputed each claim), so it can never
    // snowball into a trivialized resource across many days.
    const bonus = dailyState.get().dailyBonus;
    powerups.set({
      shuffle: GRANT_SHUFFLE + bonus.shuffle + goosePassive.extraShuffle,
      hint: GRANT_HINT + bonus.hint + goosePassive.extraHint,
      remove: GRANT_REMOVE + bonus.remove + goosePassive.extraRemove,
      undo: GRANT_UNDO + bonus.undo + goosePassive.extraUndo,
      addTime: (timed ? GRANT_ADDTIME : 0) + bonus.addTime,
    });
    setLastGrab(null);
    shakeReadyAt.set(0);
    shakeNonce.set(0);
    shuffleNonce.set(0);
    hintNonce.set(0);
    milestones = milestonesFor(spec, goosePassive.milestoneThresholdScale);
    nextHintAt = milestones.hintStep;
    nextAddTimeAt = milestones.addTimeStep;
    // Publish only after every run-owned observable above is ready. The scene
    // consumes this as the authoritative reset boundary for start/retry/next.
    dealNonce.set(dealNonce.get() + 1);
    obs.gameStatus.set("dealt");
    isPlaying.set(true);
    obs.lastStatus.set(t("statusPlaying"));
    if (timed) startTick();
    scheduleRunSnapshot();
  };

  const restoreRun = (snapshot: { runId: string; state: StoredRunState }): void => {
    stopTimers();
    const saved = snapshot.state;
    runId = snapshot.runId;
    continueUsed = saved.continueUsed;
    failedTimeLeftMs = 0;
    continueAvailable.set(false);
    runNonce += 1;
    const now = Date.now();
    themeId.set(saved.themeId);
    sound.setTheme(themeOf(saved.themeId).ambience);
    sound.setPlaying(true);
    timedMode.set(saved.timedMode);
    level.set(saved.level);
    items.set(saved.active.map((item) => ({ ...item, spawnMode: "drop" as const })));
    reserveItems = saved.reserve.map((item) => ({ ...item }));
    reserveCount.set(reserveItems.length);
    refillRng = makeRng(seedFor(saved.level, randomSeedSalt()));
    tray.set(saved.tray.slice());
    shelf.set(saved.shelf.slice());
    score.set(saved.score);
    comboCount.set(0);
    timeLeftMs.set(saved.timedMode ? saved.timeLeftMs : 0);
    deadline = saved.timedMode ? now + saved.timeLeftMs : 0;
    hiddenAt = 0;
    runStartedAt = now - saved.elapsedMs;
    lastTickSec = -1;
    clearedFx.set([]);
    shelfClearedFx.set([]);
    failReason.set("");
    unlockNotice.set(-1);
    powerups.set({ ...saved.powerups });
    const undoTarget = saved.lastGrab
      && saved.tray[saved.lastGrab.slot] === saved.lastGrab.kind
      ? { ...saved.lastGrab }
      : null;
    setLastGrab(undoTarget);
    shakeReadyAt.set(now + saved.shakeCooldownMs);
    shakeNonce.set(0);
    shuffleNonce.set(0);
    hintNonce.set(0);
    extractReceipt.set({ ...EMPTY_EXTRACT_RECEIPT });
    shakeStrength.set(1);
    goosePassive = computeGoosePassive(progress.get().geese);
    comboWindowMs = COMBO_WINDOW_MS + goosePassive.comboWindowDeltaMs;
    frenzyTriggerCombo = Math.max(3, FRENZY_TRIGGER_COMBO - goosePassive.frenzyTriggerDelta);
    milestones = milestonesFor(specOf(saved.level), goosePassive.milestoneThresholdScale);
    nextHintAt = (Math.floor(saved.score / milestones.hintStep) + 1) * milestones.hintStep;
    nextAddTimeAt = (Math.floor(saved.score / milestones.addTimeStep) + 1) * milestones.addTimeStep;
    dealNonce.set(dealNonce.get() + 1);
    obs.gameStatus.set("dealt");
    isPlaying.set(true);
    resumeAvailable.set(false);
    resumeLevel.set(0);
    obs.lastStatus.set(t("statusRunResumed", { level: saved.level }));
    if (saved.timedMode) startTick();
    scheduleRunSnapshot();
  };

  const winLevel = (): void => {
    stopTimers();
    sound.setPlaying(false);
    isPlaying.set(false);
    clearPersistedRun();
    continueAvailable.set(false);
    // Time bonus only exists in timed-challenge mode; in the untimed default
    // the score is pure match+combo skill (no clock dimension to reward).
    const timed = timedMode.get();
    const leftSec = timed ? Math.max(0, Math.round((deadline - Date.now()) / 1000)) : 0;
    const timeBonus = Math.round(leftSec * TIME_BONUS_PER_SEC * (1 + goosePassive.scoreBonus));
    const finalScore = score.get() + timeBonus;
    score.set(finalScore);
    obs.gameStatus.set("solved");
    const caughtMsg = timed ? t("statusCaught", { bonus: timeBonus }) : t("statusCaughtUntimed");
    obs.lastStatus.set(caughtMsg);
    haptics.play("win");

    // ── Meta progression: unlock next level, wins/best, scene goose (G4). ──
    const outcome = progressAfterWin(progress.get(), level.get(), finalScore, {
      mode: timed ? "timed" : "relaxed",
      theme: themeId.get(),
    });
    progress.set(outcome.next);
    persistProgress(outcome.next);
    if (outcome.unlockedGoose >= 0) {
      unlockNotice.set(outcome.unlockedGoose);
      const scene = SCENES[outcome.unlockedGoose];
      // Let the catch fanfare land before the collection flourish.
      unlockTimer = setTimeout(() => sound.play("unlock"), 760);
      setStatus(t("gooseUnlocked", { name: t(scene?.gooseNameKey ?? "statusWonTitle") }), "success");
    } else if (outcome.allClear) {
      setStatus(t("statusAllClear"), "success");
    } else {
      setStatus(caughtMsg, "success");
    }

  };

  const failLevel = (reason: FailReason): void => {
    stopTimers();
    sound.setPlaying(false);
    isPlaying.set(false);
    failedTimeLeftMs = timedMode.get() ? Math.max(0, timeLeftMs.get()) : 0;
    clearPersistedRun();
    const failed = progressAfterFailure(progress.get(), level.get(), themeId.get());
    progress.set(failed);
    persistProgress(failed);
    failReason.set(reason);
    continueAvailable.set(!continueUsed);
    obs.gameStatus.set("expired");
    // Failure must be READABLE: a timeout and a jammed tray are different
    // mistakes and get different copy (+ different scene stamps).
    const msg = reason === "timeout" ? t("statusFailedTimeout") : t("statusFailedTrayFull");
    obs.lastStatus.set(msg);
    setStatus(msg, "info");
    haptics.play("fail");
  };

  /**
   * R6 Frenzy free pull: auto-attract one copy of `pullKind` from the box into
   * the tray (the side shelf participates in matching, exactly like a manual
   * grab). Bounded by the caller's charge — it refunds the charge when the pull
   * is impossible (no copy left in the box, or the tray is full) so a wasted
   * charge is never silently lost. It deliberately never touches comboCount or
   * score (it's a bonus, not a player action) and never re-arms Frenzy, so the
   * closure can safely run inside `extract` without recursing.
   */
  const applyFrenzyPull = (pullKind: number): void => {
    const list = items.get();
    const pullIdx = list.findIndex((it) => it.kind === pullKind);
    if (pullIdx === -1) {
      frenzyCharges.set(frenzyCharges.get() + 1); // refund: nothing to pull
      return;
    }
    const res = applyExtractShelf(tray.get(), shelf.get(), pullKind);
    if (!res.placed) {
      frenzyCharges.set(frenzyCharges.get() + 1); // refund: tray full, no room
      return;
    }
    tray.set(res.tray);
    shelf.set(res.shelf);
    const next = list.slice();
    next.splice(pullIdx, 1);
    const streamed = refillItemStream(next, reserveItems, refillRng, specOf(level.get()).boxSize);
    reserveItems = streamed.reserve;
    reserveCount.set(reserveItems.length);
    items.set(streamed.active);
    if (res.matched) {
      clearedFx.set(res.clearedTray);
      shelfClearedFx.set(res.clearedShelf);
    }
    frenzyFx.set(frenzyFx.get() + 1); // UI burst flash
  };

  const engine: GuestEngine = {
    startLevel(lvl: number): void {
      // A level is playable only once unlocked (level-select map, G4).
      const maxUnlocked = Math.max(1, Math.min(TOTAL_LEVELS, progress.get().level));
      enterLevel(Math.max(1, Math.min(maxUnlocked, lvl)));
    },

    claimDaily(): void {
      const current = loadDailyState();
      const result = claimDailyReward(current);
      saveDailyState(result.next);
      dailyState.set(result.next);
      dailyClaimable.set(false);
      dailyGrants.set(result.grants);
      if (result.milestone) dailyMilestoneFx.set(dailyMilestoneFx.get() + 1);
      // Hand the granted powerups to the live run immediately — if a run is
      // active the player feels the reward now; otherwise it lands on the next
      // run via the dailyBonus folded into enterLevel's grant.
      const p = powerups.get();
      powerups.set({
        shuffle: p.shuffle + result.grants.shuffle,
        hint: p.hint + result.grants.hint,
        remove: p.remove + result.grants.remove,
        undo: p.undo + result.grants.undo,
        addTime: p.addTime + result.grants.addTime,
      });
      sound.play("powerup");
      obs.lastStatus.set(
        result.milestone
          ? t("dailyMilestoneStatus", { streak: result.streak })
          : t("dailyClaimedStatus", { streak: result.streak }),
      );
    },

    startDailyChallenge(): void {
      // Date-seeded so every player on the same day (same build) shares a
      // layout. Deterministic salt keeps enterLevel from folding in runNonce /
      // Date.now (those would break the shared-layout guarantee).
      const seed = dateSeed(todayKey());
      enterLevel(DAILY_CHALLENGE_LEVEL, seed);
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
      // Shuffle only the currently active window. Reserve packets stay intact,
      // and every re-dropped active item uses the normal above-rim mode instead
      // of replaying a consumed one-shot bottom-emergence command.
      const next = list.map((it, i) => ({ ...it, kind: kinds[i]!, spawnMode: "drop" as const }));
      items.set(next);
      powerups.set({ ...p, shuffle: p.shuffle - 1 });
      shuffleNonce.set(shuffleNonce.get() + 1);
      // A shuffle re-rolls kinds, so the "last grab" no longer corresponds to
      // anything real in the pile — it stops being undoable (GDD §12).
      setLastGrab(null);
      obs.lastStatus.set(t("puUsedShuffle"));
      scheduleRunSnapshot();
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
      scheduleRunSnapshot();
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
      tray.set(compactTray(nextTray));
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
      scheduleRunSnapshot();
    },

    shake(strength = 1): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const now = Date.now();
      if (now < shakeReadyAt.get()) return; // still cooling down
      // R3 — the pond goose shortens the cooldown; clamp so it can never reach 0.
      const cd = Math.max(SHAKE_CD_MIN, SHAKE_CD_MS + goosePassive.shakeCdDeltaMs);
      shakeReadyAt.set(now + cd);
      shakeStrength.set(Math.max(0.65, Math.min(1.35, strength)));
      shakeNonce.set(shakeNonce.get() + 1);
      obs.lastStatus.set(t("puUsedShake"));
      scheduleRunSnapshot();
    },

    hint(): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      const p = powerups.get();
      if (p.hint <= 0) return;
      powerups.set({ ...p, hint: p.hint - 1 });
      hintNonce.set(hintNonce.get() + 1);
      obs.lastStatus.set(t("puUsedHint"));
      scheduleRunSnapshot();
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
      scheduleRunSnapshot();
    },

    setTimedMode(on: boolean): void {
      // Mode switches between runs only — mid-level flips would let a losing
      // timed run escape its clock (or grant a surprise one).
      if (isPlaying.get()) return;
      timedMode.set(on);
      saveTimedPref(on);
    },

    resumeRun(): void {
      if (isPlaying.get() || obs.gameStatus.get() !== "idle") return;
      const snapshot = resumableSnapshot();
      if (!snapshot) {
        resumeAvailable.set(false);
        resumeLevel.set(0);
        setStatus(t("statusResumeUnavailable"), "info");
        return;
      }
      restoreRun(snapshot);
    },

    discardRun(): void {
      if (isPlaying.get()) return;
      clearPersistedRun();
      obs.lastStatus.set(t("statusRunDiscarded"));
      setStatus(t("statusRunDiscarded"), "info");
    },

    continueAfterFailure(): void {
      if (
        obs.gameStatus.get() !== "expired"
        || isPlaying.get()
        || continueUsed
        || !continueAvailable.get()
      ) return;

      continueUsed = true;
      continueAvailable.set(false);
      if (failReason.get() === "trayFull") {
        const nextTray = tray.get().slice();
        const occupied = nextTray
          .map((kind, index) => ({ kind, index }))
          .filter((entry): entry is { kind: number; index: number } => entry.kind !== null)
          .slice(-3);
        const maxId = [...items.get(), ...reserveItems]
          .reduce((maximum, item) => Math.max(maximum, item.id), -1);
        const returned = occupied.map((entry, index): ItemInstance => {
          nextTray[entry.index] = null;
          return {
            id: maxId + index + 1,
            kind: entry.kind,
            px: 0,
            py: 0.7,
            pz: 0,
          };
        });
        tray.set(compactTray(nextTray));
        reserveItems = [...returned, ...reserveItems];
        const streamed = refillItemStream(items.get(), reserveItems, refillRng, specOf(level.get()).boxSize);
        reserveItems = streamed.reserve;
        reserveCount.set(reserveItems.length);
        items.set(streamed.active);
        setLastGrab(null);
      }

      const timed = timedMode.get();
      if (timed) {
        const rescueMs = failReason.get() === "timeout"
          ? 30_000
          : Math.max(1_000, failedTimeLeftMs);
        deadline = Date.now() + rescueMs;
        timeLeftMs.set(rescueMs);
        lastTickSec = -1;
      }
      failedTimeLeftMs = 0;
      failReason.set("");
      comboCount.set(0);
      runId = `${Date.now().toString(36)}-${randomSeedSalt().toString(36)}-continue`;
      obs.gameStatus.set("dealt");
      isPlaying.set(true);
      sound.setPlaying(true);
      sound.play("powerup");
      haptics.play("match");
      obs.lastStatus.set(t("statusContinued"));
      setStatus(t("statusContinued"), "success");
      if (timed) startTick();
      scheduleRunSnapshot();
    },

    extract(itemId: number): void {
      if (obs.gameStatus.get() !== "dealt" || !isPlaying.get()) return;
      // R6 Frenzy: kind to auto-pull after this match resolves (-1 = none).
      let frenzyPullKind = -1;
      const list = items.get();
      const idx = list.findIndex((it) => it.id === itemId);
      const receiptNonce = extractReceipt.get().nonce + 1;
      if (idx === -1) {
        extractReceipt.set({
          ...EMPTY_EXTRACT_RECEIPT,
          nonce: receiptNonce,
          itemId,
        });
        return; // already removed
      }

      // Use the AUTHORITATIVE kind from the item list — a client-supplied
      // kind can go stale in the one-flush window after a shuffle and would
      // break the multiple-of-3 solvability invariant.
      const kind = list[idx]!.kind;
      const res = applyExtractShelf(tray.get(), shelf.get(), kind);
      extractReceipt.set({
        nonce: receiptNonce,
        itemId,
        kind,
        accepted: res.placed,
        placedIndex: res.placedIndex,
        matched: res.matched,
        landingTray: res.landingTray,
        settledTray: res.tray,
        clearedTray: res.clearedTray,
      });
      if (!res.placed) return; // tray full: rescue (remove/undo) or jam, no landing
      tray.set(res.tray);
      shelf.set(res.shelf);
      // Soft landing click for every accepted grab (match SFX layer on top below).
      sound.play("traySlot");
      if (res.matched) {
        clearedFx.set(res.clearedTray);
        shelfClearedFx.set(res.clearedShelf);
        setLastGrab(null); // a matched grab is gone — nothing to undo
        const now = Date.now();
        if (now - lastExtractAt <= comboWindowMs) comboCount.set(comboCount.get() + 1);
        else comboCount.set(1);
        lastExtractAt = now;
        // Feed the combo depth to the sound engine so the match/combo SFX rise
        // in pitch as the chain grows (handled internally by setComboStep).
        sound.setComboStep(comboCount.get());
        const gained = Math.round(
          (SCORE_PER_MATCH + (comboCount.get() - 1) * COMBO_BONUS_PER_STEP) * (1 + goosePassive.scoreBonus),
        );
        score.set(score.get() + gained);
        obs.lastStatus.set(t("statusMatched", { gained, combo: comboCount.get() }));
        // Match / combo SFX (timing-correct here: comboCount is already updated).
        sound.play(comboCount.get() > 1 ? "combo" : "match");
        haptics.play("match");
        if (comboTimer) clearTimeout(comboTimer);
        comboTimer = setTimeout(() => {
          comboCount.set(0);
          // Audio feedback that the chain was lost: drop the pitch step back to
          // base and play the soft descending break tone.
          sound.setComboStep(0);
          sound.play("comboBreak");
        }, comboWindowMs);
        // Skill milestones refund power-ups mid-level (per-level thresholds —
        // see milestonesFor). `while` handles a single gain crossing several
        // steps (long combo chains on small-ceiling levels).
        while (score.get() >= nextHintAt) {
          nextHintAt += milestones.hintStep;
          powerups.set({ ...powerups.get(), hint: powerups.get().hint + 1 });
        }
        while (score.get() >= nextAddTimeAt) {
          nextAddTimeAt += milestones.addTimeStep;
          if (timedMode.get()) {
            // Timed mode: extend the clock.
            powerups.set({ ...powerups.get(), addTime: powerups.get().addTime + 1 });
          } else {
            // Untimed mode (the default): the clock is absent, so the same
            // milestone refunds a space rescue the player can actually spend
            // (R1). Previously this branch did nothing — a dead resource for
            // every untimed run.
            const next = { ...powerups.get() };
            next[milestones.untimedRefund] += 1;
            powerups.set(next);
          }
        }
        if (comboCount.get() === milestones.comboHintAt) {
          powerups.set({ ...powerups.get(), hint: powerups.get().hint + 1 });
        }
        // R6 Frenzy: a combo climax. Reaching the trigger (and not already
        // mid-frenzy) arms FRENZY_CHARGES free pulls and flashes a burst. The
        // trigger match itself does NOT pull — only the next N matches do, so
        // "the next 2 eliminations" are exactly the post-trigger ones.
        const frenzyTriggered = comboCount.get() >= frenzyTriggerCombo && frenzyCharges.get() === 0;
        if (frenzyTriggered) {
          frenzyCharges.set(FRENZY_CHARGES);
          frenzyFx.set(frenzyFx.get() + 1);
        }
        // A match while armed spends one charge and queues a free pull of the
        // just-cleared kind. (The triggering match is excluded above.)
        if (!frenzyTriggered && frenzyCharges.get() > 0) {
          frenzyCharges.set(frenzyCharges.get() - 1);
          frenzyPullKind = kind;
        }
      } else {
        // Un-matched grab → this becomes the undo target (G2 撤回).
        setLastGrab({ itemId, kind, slot: res.placedIndex });
        obs.lastStatus.set(t("statusTray", { left: res.tray.filter((s) => s === null).length }));
      }

      // Remove the live logical item. The full level can contain hundreds of
      // items, but only a mobile-safe physics window is observable at once;
      // after roughly two triples are excavated, the next complete-triple wave
      // emerges from the reserve under the pile.
      const next = list.slice();
      next.splice(idx, 1);
      // A terminal jam must not consume/publish a fresh reserve wave behind the
      // loss overlay. Rescue availability is evaluated against the updated
      // tray and last-grab state before any refill side effect.
      if (isTrayStuck(res.tray) && !canRescue()) {
        items.set(next);
        failLevel("trayFull");
        return;
      }
      const streamed = refillItemStream(next, reserveItems, refillRng, specOf(level.get()).boxSize);
      reserveItems = streamed.reserve;
      reserveCount.set(reserveItems.length);
      items.set(streamed.active);
      if (streamed.activated.length > 0) {
        obs.lastStatus.set(t("statusStreamRefill", {
          count: streamed.activated.length,
          remaining: reserveItems.length,
        }));
      }

      // R6 Frenzy: resolve the queued free pull now that the player's match has
      // settled (fresh box snapshot — avoids double-counting the stale list).
      if (frenzyPullKind >= 0) {
        applyFrenzyPull(frenzyPullKind);
        frenzyPullKind = -1;
      }

      // Win when the box is empty. (Counts are multiples of 3 and any 3rd copy
      // across tray+shelf clears immediately, so an empty box implies an empty
      // tray AND shelf — asserted in engine-zhuada tests.) Reads live
      // observables so a Frenzy pull that empties the box still wins.
      const trayEmpty = tray.get().every((slot) => slot === null);
      const shelfEmpty = shelf.get().every((slot) => slot === null);
      if (items.get().length === 0 && reserveItems.length === 0 && trayEmpty && shelfEmpty) {
        winLevel();
        return;
      }
      scheduleRunSnapshot();
      // Tray full with no triple: jam. If a rescue (remove with a free shelf /
      // undo of this grab) is still in hand this is a LAST-STAND state, not a
      // loss — the original's tools exist exactly for this moment (GDD §12).
      if (isTrayStuck(res.tray)) {
        if (canRescue()) {
          setStatus(t("statusTrayRescue"), "warning");
          obs.lastStatus.set(t("statusTrayRescue"));
          // This is a deliberate last-stand state, not frozen input. A sharp
          // audio tick plus a distinct two-stage vibration makes the state
          // change impossible to miss while the React shell highlights the
          // exact Remove / Undo rescue buttons.
          sound.play("tick");
          haptics.play("jam");
        } else {
          failLevel("trayFull");
        }
      }
    },

    enter(): void {
      if (isPlaying.get() && obs.gameStatus.get() === "dealt") flushRunSnapshot();
      stopTimers();
      sound.setPlaying(false);
      const saved = readProgress();
      progress.set(saved);
      timedMode.set(loadTimedPref());
      // R4 — hydrate daily sign-in/streak state and publish its view so the
      // lobby can show the claim card / streak badge without a round-trip.
      const daily = loadDailyState();
      dailyState.set(daily);
      const view = computeDailyView(daily);
      dailyClaimable.set(view.claimable);
      dailyGrants.set(view.grants);
      reserveItems = [];
      reserveCount.set(0);
      items.set([]);
      tray.set(Array<number | null>(TRAY_SLOTS).fill(null));
      shelf.set(Array<number | null>(SHELF_SLOTS).fill(null));
      score.set(0);
      comboCount.set(0);
      timeLeftMs.set(0);
      level.set(saved.lastPlayedLevel);
      isPlaying.set(false);
      obs.gameStatus.set("idle");
      obs.lastStatus.set(t("statusReady"));
      clearedFx.set([]);
      shelfClearedFx.set([]);
      failReason.set("");
      continueUsed = false;
      failedTimeLeftMs = 0;
      continueAvailable.set(false);
      unlockNotice.set(-1);
      setLastGrab(null);
      shakeReadyAt.set(0);
      const interrupted = resumableSnapshot();
      resumeAvailable.set(interrupted !== null);
      resumeLevel.set(interrupted?.state.level ?? 0);
      obs.lastStatus.set(interrupted
        ? t("statusResumeAvailable", { level: interrupted.state.level })
        : t("statusReady"));
    },

  };

  if (import.meta.env.DEV) {
    engine.debugWin = (): void => {
      if (obs.gameStatus.get() !== "dealt") return;
      winLevel();
    };
    engine.debugLose = (reason: FailReason = "timeout"): void => {
      if (obs.gameStatus.get() !== "dealt") return;
      failLevel(reason);
    };
  }

  return engine;
}
