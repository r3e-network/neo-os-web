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
 * The match-3 rules (exposure, pick, triple-elimination, win, tray-full) are a
 * faithful local re-implementation of the enclave session, built on the pure,
 * already-tested `./sheep-engine` layout/exposure module.
 */
import { computeExposed, generateCardLayout } from "./sheep-engine";
import type { CardData } from "./sheep-engine";
import { MATCH_COUNT, MAX_SLOTS, MAX_UNDOS, ruleOf } from "./game-rules";

/** Structural (method-syntax, so bivariant) observable handle. */
interface Obs<T> {
  get(): T;
  set(value: T): void;
  subscribe(listener: () => void): () => void;
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

/** Off-chain guest leaderboard surface (app.mode.guestLeaderboard). */
interface GuestLeaderboardApi {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
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
  startGame(difficulty: number): void;
  pickCard(cardId: number): void;
  useUndo(): void;
  useShuffle(): void;
  useRemove3(): void;
  submitRun(): Promise<void>;
  returnToLobby(): void;
  expireGame(): void;
  refreshLeaderboard(): Promise<void>;
  /** Reset to a clean local lobby + load the guest board (on entering guest). */
  enter(): Promise<void>;
  /** Cancel local timers when the miniapp or mode is torn down. */
  dispose(): void;
}

const GUEST_GAME_ID = "guest";
const MATCH_ANIM_MS = 600;
export const GUEST_RUN_STORAGE_KEY = "guest-run:v1";
export const GUEST_PROFILE_STORAGE_KEY = "guest-profile:v1";

interface SavedGuestRun {
  version: 1;
  status: "dealt" | "solved";
  difficulty: number;
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
  if ((status !== "dealt" && status !== "solved") || ![0, 1, 2].includes(difficulty)) return null;
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
  return { version: 1, bestCleared, solves };
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
    lastStatus.set(t("statusWonTitle"));
    persistProfile();
    persistRun();
    void saveAndRefresh(totalCards);
    setStatus(t("guestRunComplete", { count: totalCards }), "success");
  };

  const finishGameOver = (): void => {
    clearMatchTimer();
    clearDeadlineTimer();
    isMatching.set(false);
    const cleared = clearedCount();
    myTotalWon.set(Math.max(myTotalWon.get(), cleared));
    isGameOver.set(true);
    failureReason.set("tray");
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
    startGame(difficulty: number): void {
      if (isStarting.get() || isDealing.get() || gameStatus.get() !== "idle") return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      isStarting.set(true);
      clearMatchTimer();
      let layout: ReturnType<typeof generateCardLayout>;
      try {
        layout = generateCardLayout(randomSeed(), rule.cardTypes);
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
      const originalPile = [...pile];
      const originalSlots = [...slots];
      drainSlotsToPile();
      // Shuffle complete triples WITHIN each layer. This preserves the generator's
      // constructive solution: clear exposed top triples, then middle, then bottom.
      // A recovery tool must never turn a valid board into an impossible one.
      for (const layer of [0, 1, 2]) {
        const indexes = pile.flatMap((card, index) => card.layer === layer ? [index] : []);
        if (indexes.length % MATCH_COUNT !== 0) {
          pile = originalPile;
          slots = originalSlots;
          lastStatus.set(t("guestShuffleUnavailable"));
          setStatus(t("guestShuffleUnavailable"), "info");
          return;
        }
        const layerSymbols = indexes.map((index) => pile[index]!.symbol);
        const groups = new Map<number, number>();
        for (const symbol of layerSymbols) groups.set(symbol, (groups.get(symbol) ?? 0) + 1);
        if ([...groups.values()].some((count) => count % MATCH_COUNT !== 0)) {
          pile = originalPile;
          slots = originalSlots;
          lastStatus.set(t("guestShuffleUnavailable"));
          setStatus(t("guestShuffleUnavailable"), "info");
          return;
        }
        let assignments: number[];
        try {
          const triples = cryptoShuffle(
            [...groups.entries()].flatMap(([symbol, count]) =>
              Array.from({ length: count / MATCH_COUNT }, () => symbol),
            ),
          );
          assignments = cryptoShuffle(triples.flatMap((symbol) => [symbol, symbol, symbol]));
        } catch {
          pile = originalPile;
          slots = originalSlots;
          lastStatus.set(t("secureRandomUnavailable"));
          setStatus(t("secureRandomUnavailable"), "error");
          return;
        }
        indexes.forEach((index, assignmentIndex) => {
          pile[index] = { ...pile[index]!, symbol: assignments[assignmentIndex]! };
        });
      }
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
