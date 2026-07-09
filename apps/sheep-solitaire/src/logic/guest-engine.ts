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
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
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
}

const GUEST_GAME_ID = "guest";
const MATCH_ANIM_MS = 600;

function clampDifficulty(value: number): number {
  return Math.max(0, Math.min(2, Number.isFinite(value) ? Math.round(value) : 0));
}

/** Web-Crypto (Math.random fallback) 32-bit seed — local analog of the enclave seed. */
function randomSeed(): number {
  const buffer = new Uint32Array(1);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(buffer);
  } else {
    buffer[0] = Math.floor(Math.random() * 0x1_0000_0000);
  }
  return buffer[0]! | 0;
}

/** Fisher-Yates over a number[] using Web-Crypto randomness. */
function cryptoShuffle(values: number[]): number[] {
  const out = [...values];
  const rand = new Uint32Array(out.length);
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    webCrypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < rand.length; i += 1) rand[i] = Math.floor(Math.random() * 0x1_0000_0000);
  }
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = rand[i]! % (i + 1);
    const current = out[i]!;
    out[i] = out[j]!;
    out[j] = current;
  }
  return out;
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
    t,
    setStatus,
  } = deps;

  // ── Local board model (never leaves this closure) ──────────────────────────
  let pile: CardData[] = [];
  let slots: CardData[] = [];
  let totalCards = 0;
  let matchTimer: ReturnType<typeof setTimeout> | null = null;

  const clearMatchTimer = (): void => {
    if (matchTimer !== null) {
      clearTimeout(matchTimer);
      matchTimer = null;
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
        exposed: true,
        picked: true,
      })),
    );
  };

  const clearedCount = (): number => Math.max(0, totalCards - (pile.length + slots.length));

  const resetToLobby = (): void => {
    clearMatchTimer();
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
    isPicking.set(false);
    isUndoing.set(false);
    isSubmitting.set(false);
    lastPayout.set("");
    pileCards.set([]);
    slotCards.set([]);
    lastStatus.set(t("statusReady"));
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
    isMatching.set(false);
    lastElapsedMs.set(Math.max(0, Date.now() - dealtAt.get()));
    // No GAS in guest: leaving lastPayout empty makes the result screen show its
    // neutral "board cleared" sub instead of a "Payout: N GAS" line.
    lastPayout.set("");
    // Keep activeGameId on the guest sentinel so the scene's win screen renders
    // (its "canSettle" path) — the claim button routes to guest.submitRun.
    gameStatus.set("solved");
    lastStatus.set(t("statusWonTitle"));
    void saveAndRefresh(totalCards);
    setStatus(t("guestRunComplete", { count: totalCards }), "success");
  };

  const finishGameOver = (): void => {
    clearMatchTimer();
    isMatching.set(false);
    const cleared = clearedCount();
    isGameOver.set(true);
    lastStatus.set(t("gameOverBanner"));
    void saveAndRefresh(cleared);
    setStatus(t("gameOverBanner"), "info");
  };

  /** Return every slotted card to the pile (undo / shuffle / remove-3 share this). */
  const drainSlotsToPile = (count = Number.POSITIVE_INFINITY): void => {
    const moved = slots.splice(0, Math.min(count, slots.length));
    pile.push(...moved);
  };

  return {
    startGame(difficulty: number): void {
      if (isStarting.get() || isDealing.get()) return;
      const diff = clampDifficulty(difficulty);
      const rule = ruleOf(diff);
      isStarting.set(true);
      clearMatchTimer();
      const layout = generateCardLayout(randomSeed(), rule.cardTypes);
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
      isMatching.set(false);
      isSubmitting.set(false);
      lastPayout.set("");
      const now = Date.now();
      dealtAt.set(now);
      deadline.set(now + rule.limitMs);
      emitPile();
      emitSlots();
      gameStatus.set("dealt");
      lastStatus.set(t("guestDealtStage"));
      isStarting.set(false);
    },

    pickCard(cardId: number): void {
      if (gameStatus.get() !== "dealt" || isGameOver.get()) return;
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
      }
    },

    useUndo(): void {
      if (gameStatus.get() !== "dealt" || isUndoing.get()) return;
      if (slots.length === 0 || undosUsed.get() >= MAX_UNDOS) return;
      isUndoing.set(true);
      clearMatchTimer();
      isMatching.set(false);
      drainSlotsToPile();
      undosUsed.set(undosUsed.get() + 1);
      emitPile();
      emitSlots();
      lastStatus.set(t("guestUndoUsed"));
      setStatus(t("guestUndoUsed"), "info");
      isUndoing.set(false);
    },

    useShuffle(): void {
      if (gameStatus.get() !== "dealt" || shuffleLeft.get() <= 0) return;
      clearMatchTimer();
      isMatching.set(false);
      drainSlotsToPile();
      // Reshuffle symbols across the remaining board positions (each symbol keeps
      // its {0,3} multiplicity, so the board stays a valid match-3 layout).
      const symbols = cryptoShuffle(pile.map((card) => card.symbol));
      pile = pile.map((card, i) => ({ ...card, symbol: symbols[i]! }));
      shuffleLeft.set(0);
      emitPile();
      emitSlots();
      lastStatus.set(t("guestShuffled"));
      setStatus(t("guestShuffled"), "info");
    },

    useRemove3(): void {
      if (gameStatus.get() !== "dealt" || remove3Left.get() <= 0) return;
      if (slots.length === 0) return;
      clearMatchTimer();
      isMatching.set(false);
      // Free the tray by returning up to 3 tiles to the pile.
      drainSlotsToPile(MATCH_COUNT);
      remove3Left.set(0);
      emitPile();
      emitSlots();
      lastStatus.set(t("guestRemoved3"));
      setStatus(t("guestRemoved3"), "info");
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
      resetToLobby();
      // Guest never reads chain — zero the on-chain-only counters so a prior
      // gamefi read (from the mount-time loadData) never bleeds into the guest
      // surface, then load the off-chain guest board.
      credit.set(0);
      poolFree.set(0);
      myRank.set(0);
      myTotalWon.set(0);
      mySolves.set(0);
      myHistory.set([]);
      await refreshLeaderboard();
    },
  };
}
