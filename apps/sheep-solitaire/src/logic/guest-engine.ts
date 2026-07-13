/**
 * Guest (free / local) engine for Sheep Solitaire.
 *
 * Guest mode is a purely LOCAL match-3 tile game: the card layout is generated
 * with the Web-Crypto RNG (the local analog of the enclave seed), played and
 * scored entirely client-side, and (optionally) submitted to the OFF-CHAIN
 * guest leaderboard. The engine drives the SAME observables + dispatch actions
 * the Phaser scene reads (gameStatus / pileCards / slotCards / isMatching /
 * isGameOver / shuffleLeft / remove3Left / undosUsed / lastStatus / ...), so
 * the frozen scene contract is reused verbatim. It NEVER makes a chain, oracle,
 * or reward call — the framework guest guard therefore never fires.
 *
 * P1 (2026-07-13): the engine now ships the 羊了个羊 "soul" — a TIGHT layout
 * generator (symbol copies scattered across layers → real slot pressure), a
 * DAILY two-level structure (level 1 teaching / level 2 devil, deterministic
 * per-day seed so everyone shares the same board), and a REVIVE hook (one free
 * retry on a lost level-2 run). No region/province layer — the game stays a
 * simple, globally-playable match-3.
 */
import {
  computeExposed,
  generateTightLayout,
  generateDailyLevel,
  dailyDateSeed,
} from "./sheep-engine";
import type { CardData } from "./sheep-engine";
import { MATCH_COUNT, MAX_SLOTS, MAX_UNDOS, ruleOf } from "./game-rules";

/** Structural (method-syntax, so bivariant) observable handle. */
interface Obs<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
}

/** Off-chain guest leaderboard surface (app.mode.guestLeaderboard). */
interface GuestLeaderboardApi {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
}

/** Card as the scene reads it (bridgeState `pileCards` / `slotCards`). */
interface CardView {
  id: number;
  symbol: number;
  layer: number;
  col?: number;
  row?: number;
  exposed: boolean;
  picked: boolean;
}

interface LeaderEntry {
  rank: number;
  address: string;
  totalWon: number;
  solves: number;
  isUser: boolean;
}

export interface GuestEngineDeps {
  // Session / lifecycle observables the scene reads.
  gameStatus: Obs<string>;
  activeGameId: Obs<string>;
  gameDifficulty: Obs<number>;
  commitment: Obs<string>;
  dealtAt: Obs<number>;
  deadline: Obs<number>;
  undosUsed: Obs<number>;
  // P1 — level / daily / revive / mode observables.
  level: Obs<number>;
  dailyDate: Obs<number>;
  revivesLeft: Obs<number>;
  mode: Obs<string>;
  // Board observables.
  pileCards: Obs<CardView[]>;
  slotCards: Obs<CardView[]>;
  isMatching: Obs<boolean>;
  isGameOver: Obs<boolean>;
  failureReason: Obs<"none" | "tray" | "timeout">;
  shuffleLeft: Obs<number>;
  remove3Left: Obs<number>;
  // Transient flags.
  isStarting: Obs<boolean>;
  isDealing: Obs<boolean>;
  isSubmitting: Obs<boolean>;
  isUndoing: Obs<boolean>;
  isPicking: Obs<boolean>;
  // Result / stat observables.
  lastPayout: Obs<string>;
  lastElapsedMs: Obs<number>;
  leaderboard: Obs<LeaderEntry[]>;
  myRank: Obs<number>;
  myTotalWon: Obs<number>;
  mySolves: Obs<number>;
  myHistory: Obs<unknown[]>;
  credit: Obs<number>;
  poolFree: Obs<number>;
  lastStatus: Obs<string>;
  // Off-chain board + UI helpers.
  guestLeaderboard: GuestLeaderboardApi;
  /** App-namespaced persistence supplied by the MiniApp framework. */
  storage?: GuestStorage;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface GuestStorage {
  get<T>(key: string, fallback: T): T;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
}

export interface GuestEngine {
  startGame(arg: number | StartOpts): void;
  pickCard(cardId: number): void;
  useUndo(): void;
  useShuffle(): void;
  useRemove3(): void;
  submitRun(): Promise<void>;
  returnToLobby(): void;
  expireGame(): void;
  refreshLeaderboard(): Promise<void>;
  /** P1 — advance from a cleared level 1 to the daily level 2. */
  advanceLevel(): void;
  /** P1 — revive a lost daily level-2 run (one free retry). */
  revive(): void;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
  /** Cancel local timers when the miniapp or mode is torn down. */
  dispose(): void;
}

/** P1 — start argument: a bare number means practice at that difficulty (back-compat). */
export interface StartOpts {
  mode?: "daily" | "practice";
  level?: number;
  difficulty?: number;
}

const GUEST_GAME_ID = "guest";
const MATCH_ANIM_MS = 600;
export const GUEST_RUN_STORAGE_KEY = "guest-run:v1";
export const GUEST_PROFILE_STORAGE_KEY = "guest-profile:v1";

// ── P1 tuning constants ([PLACEHOLDER] — lock via playtest) ───────────────────
/** Practice-mode spread by difficulty: easy / medium / hard. */
const PRACTICE_SPREADS = [0.12, 0.45, 0.82] as const;
/** Daily level symbol counts: level 1 (teaching) / level 2 (devil). */
const DAILY_TYPES = { 1: 8, 2: 15 } as const;
/** Free revives granted on a daily level-2 run. */
const REVIVE_PER_DAILY_L2 = 1;

interface SavedGuestRun {
  version: 1;
  status: "dealt" | "solved";
  difficulty: number;
  // P1 fields
  level: number;
  dailyDate: number;
  mode: "daily" | "practice";
  revivesUsed: number;
  // board
  pile: CardData[];
  slots: CardData[];
  totalCards: number;
  dealtAt: number;
  deadline: number;
  undosUsed: number;
  shuffleLeft: number;
  remove3Left: number;
  isGameOver: boolean;
  failureReason: "none" | "tray" | "timeout";
  lastElapsedMs: number;
}

interface SavedGuestProfile {
  version: 1;
  bestCleared: number;
  solves: number;
}

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Web-Crypto seed for the local practice board. Never downgrade to Math.random. */
function randomSeed(): number {
  const buffer = new Uint32Array(1);
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) throw new Error("secure randomness unavailable");
  webCrypto.getRandomValues(buffer);
  return buffer[0]! | 0;
}

/** Uniform Web-Crypto integer in [0, upperExclusive), with rejection sampling. */
function cryptoIndex(upperExclusive: number): number {
  if (!Number.isSafeInteger(upperExclusive) || upperExclusive <= 0) return 0;
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) throw new Error("secure randomness unavailable");
  const sample = new Uint32Array(1);
  const limit = Math.floor(0x1_0000_0000 / upperExclusive) * upperExclusive;
  do {
    webCrypto.getRandomValues(sample);
  } while (sample[0]! >= limit);
  return sample[0]! % upperExclusive;
}

/** Fisher-Yates over a number[] using unbiased Web-Crypto randomness. */
function cryptoShuffle<T>(values: T[]): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = cryptoIndex(i + 1);
    const current = out[i]!;
    out[i] = out[j]!;
    out[j] = current;
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseStoredCards(value: unknown): CardData[] | null {
  if (!Array.isArray(value)) return null;
  const seen = new Set<number>();
  const cards: CardData[] = [];
  for (const item of value) {
    if (!isRecord(item)) return null;
    const card: CardData = {
      id: Number(item.id),
      symbol: Number(item.symbol),
      layer: Number(item.layer),
      col: Number(item.col),
      row: Number(item.row),
    };
    if (
      !Number.isSafeInteger(card.id) || card.id < 0 || seen.has(card.id) ||
      !Number.isSafeInteger(card.symbol) || card.symbol < 0 || card.symbol > 14 ||
      !Number.isSafeInteger(card.layer) || card.layer < 0 || card.layer > 2 ||
      !Number.isSafeInteger(card.col) || card.col < 0 || card.col > 5 ||
      !Number.isSafeInteger(card.row) || card.row < 0 || card.row > 4
    ) return null;
    seen.add(card.id);
    cards.push(card);
  }
  return cards;
}

function parseSavedRun(value: unknown): SavedGuestRun | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const status = value.status;
  const difficulty = Number(value.difficulty);
  const level = Number(value.level);
  const dailyDate = Number(value.dailyDate);
  const mode = value.mode;
  const revivesUsed = Number(value.revivesUsed);
  if (
    (status !== "dealt" && status !== "solved") ||
    ![0, 1, 2].includes(difficulty) ||
    ![1, 2].includes(level) ||
    !["daily", "practice"].includes(String(mode)) ||
    !Number.isSafeInteger(revivesUsed) || revivesUsed < 0 || revivesUsed > MAX_UNDOS + 1
  ) return null;
  const pile = parseStoredCards(value.pile);
  const slots = parseStoredCards(value.slots);
  if (!pile || !slots) return null;
  const allIds = new Set(pile.map((card) => card.id));
  if (slots.some((card) => allIds.has(card.id))) return null;

  const rule = ruleOf(difficulty);
  const combinedCards = [...pile, ...slots];
  const symbolCounts = new Map<number, number>();
  for (const card of combinedCards) {
    symbolCounts.set(card.symbol, (symbolCounts.get(card.symbol) ?? 0) + 1);
  }
  const totalCards = Number(value.totalCards);
  const dealtAt = Number(value.dealtAt);
  const deadline = Number(value.deadline);
  const storedUndos = Number(value.undosUsed);
  const storedShuffle = Number(value.shuffleLeft);
  const storedRemove3 = Number(value.remove3Left);
  const lastElapsed = Number(value.lastElapsedMs);
  const failure = value.failureReason;
  if (
    totalCards !== rule.cardTypes * MATCH_COUNT ||
    pile.length + slots.length > totalCards ||
    slots.length > MAX_SLOTS ||
    combinedCards.some((card) => card.id >= totalCards || card.symbol >= rule.cardTypes) ||
    [...symbolCounts.values()].some((count) => count > MATCH_COUNT) ||
    (status === "solved" && (pile.length !== 0 || slots.length !== 0)) ||
    (status === "dealt" && pile.length === 0 && slots.length === 0) ||
    !Number.isSafeInteger(dealtAt) || dealtAt <= 0 ||
    !Number.isSafeInteger(deadline) || deadline - dealtAt !== rule.limitMs ||
    !Number.isSafeInteger(storedUndos) || storedUndos < 0 || storedUndos > MAX_UNDOS ||
    ![0, 1].includes(storedShuffle) || ![0, 1].includes(storedRemove3) ||
    !Number.isSafeInteger(lastElapsed) || lastElapsed < 0 ||
    !["none", "tray", "timeout"].includes(String(failure)) ||
    typeof value.isGameOver !== "boolean"
  ) return null;
  if (
    (status === "solved" && (value.isGameOver || failure !== "none")) ||
    (value.isGameOver && failure === "none") ||
    (!value.isGameOver && failure !== "none")
  ) return null;

  return {
    version: 1,
    status,
    difficulty,
    level,
    dailyDate,
    mode: mode as "daily" | "practice",
    revivesUsed,
    pile,
    slots,
    totalCards,
    dealtAt,
    deadline,
    undosUsed: storedUndos,
    shuffleLeft: storedShuffle,
    remove3Left: storedRemove3,
    isGameOver: value.isGameOver,
    failureReason: failure as SavedGuestRun["failureReason"],
    lastElapsedMs: lastElapsed,
  };
}

function parseSavedProfile(value: unknown): SavedGuestProfile | null {
  if (!isRecord(value) || value.version !== 1) return null;
  const bestCleared = Number(value.bestCleared);
  const solves = Number(value.solves);
  if (
    !Number.isSafeInteger(bestCleared) || bestCleared < 0 || bestCleared > 45 ||
    !Number.isSafeInteger(solves) || solves < 0
  ) return null;
  return {
    version: 1,
    bestCleared,
    solves,
  };
}

export function createGuestEngine(deps: GuestEngineDeps): GuestEngine {
  const {
    gameStatus,
    activeGameId,
    gameDifficulty,
    commitment,
    dealtAt,
    deadline,
    undosUsed,
    level,
    dailyDate,
    revivesLeft,
    mode,
    pileCards,
    slotCards,
    isMatching,
    isGameOver,
    failureReason,
    shuffleLeft,
    remove3Left,
    isStarting,
    isDealing,
    isSubmitting,
    isUndoing,
    isPicking,
    lastPayout,
    lastElapsedMs,
    leaderboard,
    myRank,
    myTotalWon,
    mySolves,
    myHistory,
    credit,
    poolFree,
    lastStatus,
    guestLeaderboard,
    storage,
    t,
    setStatus,
  } = deps;

  // ── Local board model (never leaves this closure) ──────────────────────────
  let pile: CardData[] = [];
  let slots: CardData[] = [];
  let totalCards = 0;
  let matchTimer: ReturnType<typeof setTimeout> | null = null;
  let deadlineTimer: ReturnType<typeof setTimeout> | null = null;

  const storageGet = <T,>(key: string, fallback: T): T => {
    if (!storage) return fallback;
    try {
      return storage.get(key, fallback);
    } catch {
      return fallback;
    }
  };

  const storageSet = <T,>(key: string, value: T): void => {
    if (!storage) return;
    try {
      storage.set(key, value);
    } catch {
      /* A private/locked browser can reject persistence; play stays available. */
    }
  };

  const storageDelete = (key: string): void => {
    if (!storage) return;
    try {
      storage.delete(key);
    } catch {
      /* Nothing else should make a local game unplayable. */
    }
  };

  const clearMatchTimer = (): void => {
    if (matchTimer !== null) {
      clearTimeout(matchTimer);
      matchTimer = null;
    }
  };

  const clearDeadlineTimer = (): void => {
    if (deadlineTimer !== null) {
      clearTimeout(deadlineTimer);
      deadlineTimer = null;
    }
  };

  /** Exposure over the CURRENT pile only (a blocker removed re-exposes what it covered). */
  const emitPile = (): void => {
    const exposedArr = computeExposed(pile);
    pileCards.set(
      pile.map((card) => ({
        id: card.id,
        symbol: card.symbol,
        layer: card.layer,
        col: card.col,
        row: card.row,
        // computeExposed indexes by card.id and only writes `false` for blocked
        // cards, so anything not explicitly false is exposed.
        exposed: exposedArr[card.id] !== false,
        picked: false,
      })),
    );
  };

  const emitSlots = (): void => {
    slotCards.set(
      slots.map((card) => ({
        id: card.id,
        symbol: card.symbol,
        layer: card.layer,
        col: card.col,
        row: card.row,
        exposed: true,
        picked: true,
      })),
    );
  };

  const clearedCount = (): number => Math.max(0, totalCards - (pile.length + slots.length));

  const persistProfile = (): void => {
    storageSet<SavedGuestProfile>(GUEST_PROFILE_STORAGE_KEY, {
      version: 1,
      bestCleared: Math.max(0, Math.min(45, Math.floor(myTotalWon.get()))),
      solves: Math.max(0, Math.floor(mySolves.get())),
    });
  };

  const restoreProfile = (): void => {
    const profile = parseSavedProfile(storageGet<unknown>(GUEST_PROFILE_STORAGE_KEY, null));
    if (!profile) return;
    myTotalWon.set(profile.bestCleared);
    mySolves.set(profile.solves);
  };

  const persistRun = (): void => {
    const status = gameStatus.get();
    if (activeGameId.get() !== GUEST_GAME_ID || (status !== "dealt" && status !== "solved")) return;
    storageSet<SavedGuestRun>(GUEST_RUN_STORAGE_KEY, {
      version: 1,
      status,
      difficulty: gameDifficulty.get(),
      level: level.get(),
      dailyDate: dailyDate.get(),
      mode: mode.get() === "daily" ? "daily" : "practice",
      revivesUsed: REVIVE_PER_DAILY_L2 - revivesLeft.get(),
      pile,
      slots,
      totalCards,
      dealtAt: dealtAt.get(),
      deadline: deadline.get(),
      undosUsed: undosUsed.get(),
      shuffleLeft: shuffleLeft.get(),
      remove3Left: remove3Left.get(),
      isGameOver: isGameOver.get(),
      failureReason: failureReason.get(),
      lastElapsedMs: lastElapsedMs.get(),
    });
  };

  const clearPersistedRun = (): void => storageDelete(GUEST_RUN_STORAGE_KEY);

  const resetToLobby = (): void => {
    clearMatchTimer();
    clearDeadlineTimer();
    pile = [];
    slots = [];
    totalCards = 0;
    gameStatus.set("idle");
    activeGameId.set("0");
    commitment.set("");
    dealtAt.set(0);
    deadline.set(0);
    undosUsed.set(0);
    level.set(1);
    dailyDate.set(0);
    revivesLeft.set(0);
    mode.set("practice");
    shuffleLeft.set(1);
    remove3Left.set(1);
    isMatching.set(false);
    isGameOver.set(false);
    failureReason.set("none");
    isStarting.set(false);
    isDealing.set(false);
    isPicking.set(false);
    isUndoing.set(false);
    isSubmitting.set(false);
    lastPayout.set("");
    pileCards.set([]);
    slotCards.set([]);
    lastStatus.set(t("statusReady"));
    clearPersistedRun();
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* off-chain board unreachable / no wallet — guest scores are best-effort */
    }
  };

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
      leaderboard.set(ranked);
    } catch {
      leaderboard.set([]);
    }
  };

  const saveAndRefresh = async (score: number): Promise<void> => {
    await submitScore(score);
    await refreshLeaderboard();
  };

  // ── Run-end transitions ────────────────────────────────────────────────────
  const finishWin = (): void => {
    clearMatchTimer();
    clearDeadlineTimer();
    isMatching.set(false);
    failureReason.set("none");
    lastElapsedMs.set(Math.max(0, Date.now() - dealtAt.get()));
    // No GAS in guest: leaving lastPayout empty makes the result screen show its
    // neutral "board cleared" sub instead of a "Payout: N GAS" line.
    lastPayout.set("");
    // Keep activeGameId on the guest sentinel so the scene's win screen renders
    // (its "canSettle" path) — the claim button routes to guest.submitRun.
    gameStatus.set("solved");
    myTotalWon.set(Math.max(myTotalWon.get(), totalCards));
    mySolves.set(mySolves.get() + 1);

    // Daily level-2 clear = "today fully cleared": a clean win, no province
    // layer. Keep the daily clear state and toast generic so it reads the same
    // for every player regardless of region.
    if (mode.get() === "daily" && level.get() === 2) {
      persistProfile();
      lastStatus.set(t("dailyFullyClearedTitle"));
      setStatus(t("dailyFullyClearedTitle"), "success");
    } else {
      lastStatus.set(t("statusWonTitle"));
      setStatus(t("guestRunComplete", { count: totalCards }), "success");
    }
    persistRun();
    void saveAndRefresh(totalCards);
  };

  const finishGameOver = (): void => {
    clearMatchTimer();
    clearDeadlineTimer();
    isMatching.set(false);
    const cleared = clearedCount();
    myTotalWon.set(Math.max(myTotalWon.get(), cleared));
    isGameOver.set(true);
    failureReason.set("tray");
    // P1 — a lost daily level-2 run with a revive left shows the revive button
    // (scene reads revivesLeft + daily + level-2 + isGameOver).
    lastStatus.set(t("gameOverBanner"));
    persistProfile();
    persistRun();
    void saveAndRefresh(cleared);
    setStatus(t("gameOverBanner"), "info");
  };

  const finishTimeout = (): void => {
    if (gameStatus.get() !== "dealt" || isGameOver.get()) return;
    clearMatchTimer();
    clearDeadlineTimer();
    isMatching.set(false);
    isGameOver.set(true);
    failureReason.set("timeout");
    const cleared = clearedCount();
    myTotalWon.set(Math.max(myTotalWon.get(), cleared));
    lastStatus.set(t("guestTimeUpHint"));
    persistProfile();
    persistRun();
    void saveAndRefresh(cleared);
    setStatus(t("guestTimeUpHint"), "info");
  };

  const stopIfExpired = (): boolean => {
    const expiresAt = deadline.get();
    if (expiresAt <= 0 || Date.now() < expiresAt) return false;
    finishTimeout();
    return true;
  };

  /** Return selected slotted cards to the pile. */
  const drainSlotsToPile = (count = Number.POSITIVE_INFINITY): void => {
    const moved = slots.splice(0, Math.min(count, slots.length));
    pile.push(...moved);
  };

  const restoreRun = (): boolean => {
    const saved = parseSavedRun(storageGet<unknown>(GUEST_RUN_STORAGE_KEY, null));
    if (!saved) {
      clearPersistedRun();
      return false;
    }

    pile = saved.pile;
    slots = saved.slots;
    totalCards = saved.totalCards;
    gameStatus.set(saved.status);
    activeGameId.set(GUEST_GAME_ID);
    gameDifficulty.set(saved.difficulty);
    level.set(saved.level);
    dailyDate.set(saved.dailyDate);
    mode.set(saved.mode);
    revivesLeft.set(Math.max(0, REVIVE_PER_DAILY_L2 - saved.revivesUsed));
    commitment.set("");
    dealtAt.set(saved.dealtAt);
    deadline.set(saved.deadline);
    undosUsed.set(saved.undosUsed);
    shuffleLeft.set(saved.shuffleLeft);
    remove3Left.set(saved.remove3Left);
    isMatching.set(false);
    isGameOver.set(saved.isGameOver);
    failureReason.set(saved.failureReason);
    isStarting.set(false);
    isDealing.set(false);
    isPicking.set(false);
    isUndoing.set(false);
    isSubmitting.set(false);
    lastPayout.set("");
    lastElapsedMs.set(saved.lastElapsedMs);
    emitPile();
    emitSlots();

    if (saved.status === "solved") {
      lastStatus.set(t("statusWonTitle"));
      return true;
    }
    if (saved.isGameOver) {
      lastStatus.set(t(saved.failureReason === "timeout" ? "guestTimeUpHint" : "gameOverBanner"));
      return true;
    }
    if (Date.now() >= saved.deadline) {
      finishTimeout();
      return true;
    }
    clearDeadlineTimer();
    deadlineTimer = setTimeout(finishTimeout, Math.max(0, saved.deadline - Date.now()));
    lastStatus.set(t("guestProgressRestored"));
    setStatus(t("guestProgressRestored"), "info");
    return true;
  };

  return {
    startGame(arg: number | StartOpts): void {
      if (isStarting.get() || isDealing.get() || gameStatus.get() !== "idle") return;

      let modeVal: "daily" | "practice" = "practice";
      let levelVal = 1;
      let diff = 0;
      if (typeof arg === "object" && arg !== null) {
        modeVal = arg.mode === "daily" ? "daily" : "practice";
        levelVal = modeVal === "daily" ? (arg.level === 2 ? 2 : 1) : 1;
        diff = clampDifficulty(arg.difficulty ?? 0);
      } else {
        diff = clampDifficulty(arg);
      }
      const rule = ruleOf(diff);

      isStarting.set(true);
      clearMatchTimer();

      let layout: ReturnType<typeof generateTightLayout>;
      try {
        if (modeVal === "daily") {
          const types = DAILY_TYPES[levelVal as 1 | 2] ?? 8; // [PLACEHOLDER]
          const dseed = dailyDateSeed();
          layout = generateDailyLevel(dseed, levelVal as 1 | 2, types);
          if (layout.cards.length === 0) throw new Error("empty daily layout");
        } else {
          const spread = PRACTICE_SPREADS[diff] ?? 0.45; // [PLACEHOLDER]
          layout = generateTightLayout(randomSeed(), rule.cardTypes, { spread });
        }
      } catch {
        isStarting.set(false);
        lastStatus.set(t("secureRandomUnavailable"));
        setStatus(t("secureRandomUnavailable"), "error");
        return;
      }

      pile = [...layout.cards];
      slots = [];
      totalCards = layout.totalCards;
      gameDifficulty.set(diff);
      level.set(levelVal);
      mode.set(modeVal);
      dailyDate.set(modeVal === "daily" ? dailyDateSeed() : 0);
      revivesLeft.set(modeVal === "daily" && levelVal === 2 ? REVIVE_PER_DAILY_L2 : 0);
      activeGameId.set(GUEST_GAME_ID);
      commitment.set("");
      undosUsed.set(0);
      shuffleLeft.set(1);
      remove3Left.set(1);
      isGameOver.set(false);
      failureReason.set("none");
      isMatching.set(false);
      isSubmitting.set(false);
      lastPayout.set("");
      const now = Date.now();
      dealtAt.set(now);
      deadline.set(now + rule.limitMs);
      clearDeadlineTimer();
      deadlineTimer = setTimeout(finishTimeout, rule.limitMs);
      emitPile();
      emitSlots();
      gameStatus.set("dealt");
      lastStatus.set(t("guestDealtStage"));
      isStarting.set(false);
      persistRun();
    },

    advanceLevel(): void {
      // P1 — from a cleared daily level 1 to the daily level 2 (same day seed).
      if (mode.get() !== "daily" || level.get() !== 1 || gameStatus.get() !== "solved") return;
      const date = dailyDate.get();
      let layout: ReturnType<typeof generateDailyLevel>;
      try {
        layout = generateDailyLevel(date, 2, DAILY_TYPES[2]);
        if (layout.cards.length === 0) throw new Error("empty level-2 layout");
      } catch {
        lastStatus.set(t("secureRandomUnavailable"));
        setStatus(t("secureRandomUnavailable"), "error");
        return;
      }
      pile = [...layout.cards];
      slots = [];
      totalCards = layout.totalCards;
      level.set(2);
      gameDifficulty.set(2);
      activeGameId.set(GUEST_GAME_ID);
      undosUsed.set(0);
      shuffleLeft.set(1);
      remove3Left.set(1);
      revivesLeft.set(REVIVE_PER_DAILY_L2);
      isGameOver.set(false);
      failureReason.set("none");
      isMatching.set(false);
      isSubmitting.set(false);
      lastPayout.set("");
      const now = Date.now();
      const rule = ruleOf(2);
      dealtAt.set(now);
      deadline.set(now + rule.limitMs);
      clearDeadlineTimer();
      deadlineTimer = setTimeout(finishTimeout, rule.limitMs);
      emitPile();
      emitSlots();
      gameStatus.set("dealt");
      lastStatus.set(t("guestDealtStage"));
      persistRun();
    },

    revive(): void {
      // P1 — free retry on a lost daily level-2 run: return the tray to the pile
      // and continue the SAME board (the props already spent stay spent).
      if (gameStatus.get() !== "dealt" || !isGameOver.get()) return;
      if (mode.get() !== "daily" || level.get() !== 2) return;
      if (revivesLeft.get() <= 0) return;
      clearMatchTimer();
      isMatching.set(false);
      drainSlotsToPile();
      revivesLeft.set(revivesLeft.get() - 1);
      isGameOver.set(false);
      failureReason.set("none");
      emitPile();
      emitSlots();
      lastStatus.set(t("guestRevived"));
      setStatus(t("guestRevived"), "info");
      persistRun();
    },

    pickCard(cardId: number): void {
      if (gameStatus.get() !== "dealt" || isGameOver.get()) return;
      if (stopIfExpired()) return;
      if (slots.length >= MAX_SLOTS) return;
      const index = pile.findIndex((card) => card.id === cardId);
      if (index < 0) return;
      // Only exposed cards are pickable (mirror the scene's own gate).
      const exposedArr = computeExposed(pile);
      if (exposedArr[cardId] === false) return;

      const [card] = pile.splice(index, 1);
      const picked = card!;
      // Cluster same-symbol tiles so a completed triple sits together in the tray.
      let insertAt = slots.length;
      for (let i = slots.length - 1; i >= 0; i -= 1) {
        if (slots[i]!.symbol === picked.symbol) {
          insertAt = i + 1;
          break;
        }
      }
      slots.splice(insertAt, 0, picked);

      let matched = false;
      if (slots.filter((c) => c.symbol === picked.symbol).length >= MATCH_COUNT) {
        matched = true;
        let removed = 0;
        slots = slots.filter((c) => {
          if (c.symbol === picked.symbol && removed < MATCH_COUNT) {
            removed += 1;
            return false;
          }
          return true;
        });
      }

      emitPile();
      emitSlots();

      if (matched) {
        isMatching.set(true);
        clearMatchTimer();
        matchTimer = setTimeout(() => {
          isMatching.set(false);
          matchTimer = null;
        }, MATCH_ANIM_MS);
      }

      // Board math: every symbol matches exactly when its 3rd copy is picked, so
      // an empty pile means an empty tray means a full clear.
      if (pile.length === 0 && slots.length === 0) {
        finishWin();
        return;
      }
      if (slots.length >= MAX_SLOTS) {
        finishGameOver();
        return;
      }
      persistRun();
    },

    useUndo(): void {
      if (gameStatus.get() !== "dealt" || isUndoing.get() || isGameOver.get()) return;
      if (stopIfExpired()) return;
      if (slots.length === 0 || undosUsed.get() >= MAX_UNDOS) return;
      isUndoing.set(true);
      clearMatchTimer();
      isMatching.set(false);
      const last = slots.pop();
      if (last) pile.push(last);
      undosUsed.set(undosUsed.get() + 1);
      emitPile();
      emitSlots();
      lastStatus.set(t("guestUndoUsed"));
      setStatus(t("guestUndoUsed"), "info");
      isUndoing.set(false);
      persistRun();
    },

    useShuffle(): void {
      if (gameStatus.get() !== "dealt" || shuffleLeft.get() <= 0 || isGameOver.get()) return;
      if (stopIfExpired()) return;
      clearMatchTimer();
      isMatching.set(false);
      drainSlotsToPile();
      // P1 — tight boards scatter symbol copies across layers, so the old
      // "shuffle triples within each layer" rule no longer applies (it could
      // even turn a valid tight board into an impossible one). Instead we
      // globally reshuffle the symbols across all pile cards, keeping each
      // card's position/layer — every symbol still appears exactly 3×, so the
      // board stays legal.
      const symbols = pile.map((card) => card.symbol);
      let shuffled: number[];
      try {
        shuffled = cryptoShuffle(symbols);
      } catch {
        lastStatus.set(t("secureRandomUnavailable"));
        setStatus(t("secureRandomUnavailable"), "error");
        return;
      }
      pile = pile.map((card, index) => ({ ...card, symbol: shuffled[index]! }));
      shuffleLeft.set(0);
      emitPile();
      emitSlots();
      lastStatus.set(t("guestShuffled"));
      setStatus(t("guestShuffled"), "info");
      persistRun();
    },

    useRemove3(): void {
      if (gameStatus.get() !== "dealt" || remove3Left.get() <= 0 || isGameOver.get()) return;
      if (stopIfExpired()) return;
      if (slots.length < MATCH_COUNT) return;
      clearMatchTimer();
      isMatching.set(false);
      // Free the tray by returning up to 3 tiles to the pile.
      drainSlotsToPile(MATCH_COUNT);
      remove3Left.set(0);
      emitPile();
      emitSlots();
      lastStatus.set(t("guestRemoved3"));
      setStatus(t("guestRemoved3"), "info");
      persistRun();
    },

    async submitRun(): Promise<void> {
      // The score is recorded off-chain the moment a run resolves (finishWin /
      // finishGameOver); the claim button just refreshes the board and returns
      // to a clean local lobby.
      if (isSubmitting.get()) return;
      isSubmitting.set(true);
      await refreshLeaderboard();
      resetToLobby();
      isSubmitting.set(false);
    },

    returnToLobby(): void {
      resetToLobby();
    },

    expireGame(): void {
      resetToLobby();
    },

    refreshLeaderboard,

    async enter(): Promise<void> {
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read never bleeds into the guest surface. Local profile and an
      // active board are restored independently from the app-namespaced cache.
      clearMatchTimer();
      clearDeadlineTimer();
      credit.set(0);
      poolFree.set(0);
      myRank.set(0);
      myTotalWon.set(0);
      mySolves.set(0);
      myHistory.set([]);
      restoreProfile();
      if (!restoreRun()) resetToLobby();
      await refreshLeaderboard();
    },

    dispose(): void {
      persistRun();
      clearMatchTimer();
      clearDeadlineTimer();
    },
  };
}
