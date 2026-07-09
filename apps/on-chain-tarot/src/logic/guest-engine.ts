/**
 * Guest (free / local) engine for On-Chain Tarot.
 *
 * Guest mode is a purely LOCAL tarot reading: the three-card spread is shuffled
 * with the Web-Crypto RNG (the local analog of the contract's on-chain
 * Runtime.GetRandom), dealt and revealed entirely client-side, and the running
 * reading tally is (optionally) recorded to the OFF-CHAIN guest leaderboard. The
 * engine drives the SAME observables the Phaser scene + PlayArea already read
 * (drawn / readingMode / readingsCount / isLoading / question / prepaidCredit),
 * so the frozen scene contract is reused verbatim. It NEVER makes a chain,
 * oracle, or reward call — the framework guest guard therefore never fires.
 *
 * This is the (b) "chance game, no engine" recipe from the adoption contract: a
 * faithful local single-player draw of the tarot mechanic. The gamefi flow
 * (useTarot: deposit fee → on-chain draw() → ReadingDrawn event) is untouched.
 */
import { TAROT_DECK } from "../data/tarot-data";
import { cardFromIndex, type Card } from "../composables/useTarot";

/** Structural (method-syntax → bivariant) observable handle. */
interface Obs<T> {
  get(): T;
  set(value: T): void;
}

/** Off-chain guest leaderboard surface (app.mode.guestLeaderboard). */
interface GuestLeaderboardApi {
  submit(score: number | string): Promise<void>;
  get(limit?: number): Promise<Array<{ user: string; score: string }>>;
}

/** app.storage.local surface (framework-owned, localStorage-backed). */
interface LocalStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
}

export interface TarotGuestEngineDeps {
  drawn: Obs<Card[]>;
  readingMode: Obs<"idle" | "oracle">;
  readingsCount: Obs<number>;
  prepaidCredit: Obs<number>;
  isLoading: Obs<boolean>;
  question: Obs<string>;
  guestLeaderboard: GuestLeaderboardApi;
  storage: LocalStore;
  t: (key: string, params?: Record<string, string | number>) => string;
  setStatus: (msg: string, type: "success" | "error" | "warning" | "info") => void;
}

export interface TarotGuestEngine {
  /** Shuffle + deal a local three-card spread (mirrors the gamefi draw action). */
  draw(): Promise<void>;
  /** Reload the local readings tally (mirrors refreshReadingState). */
  refresh(): Promise<void>;
  /** No credit concept in guest — acknowledge and no-op (never reached via UI). */
  withdrawCredit(): void;
  /** Reset to a clean local lobby + restore the on-device tally (on entering guest). */
  enter(): Promise<void>;
}

/** The contract reveals exactly three distinct cards; the local sim matches it. */
const CARDS_PER_READING = 3;

/**
 * Local readings tally persisted on-device via app.storage.local (the framework
 * adds its own `neo:<appId>:` namespace). Guest-scoped, so it never mixes with
 * the on-chain playerReadingCount the gamefi flow reads.
 */
const GUEST_READINGS_KEY = "guest:readings";

/** Uniform random integer in [0, max) from the Web-Crypto RNG (Math.random fallback). */
function randomInt(max: number): number {
  if (max <= 0) return 0;
  const webCrypto = globalThis.crypto;
  if (webCrypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    webCrypto.getRandomValues(buf);
    return buf[0]! % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Draw `count` DISTINCT card indices from the 78-card deck with the Web-Crypto
 * RNG (a partial Fisher-Yates shuffle), mirroring the contract's guarantee of
 * three distinct cards per reading.
 */
function drawDistinctCardIds(count: number): number[] {
  const indices = TAROT_DECK.map((card) => card.id);
  const deckSize = indices.length;
  const take = Math.min(count, deckSize);
  for (let i = 0; i < take; i += 1) {
    const j = i + randomInt(deckSize - i);
    const tmp = indices[i]!;
    indices[i] = indices[j]!;
    indices[j] = tmp;
  }
  return indices.slice(0, take);
}

export function createTarotGuestEngine(deps: TarotGuestEngineDeps): TarotGuestEngine {
  const {
    drawn,
    readingMode,
    readingsCount,
    prepaidCredit,
    isLoading,
    question,
    guestLeaderboard,
    storage,
    t,
    setStatus,
  } = deps;

  const loadCount = (): number => {
    const raw = storage.get<number>(GUEST_READINGS_KEY, 0);
    const value = Number(raw ?? 0);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
  };

  const submitScore = async (score: number): Promise<void> => {
    if (score <= 0) return;
    try {
      await guestLeaderboard.submit(score);
    } catch {
      /* off-chain board unreachable / no wallet — guest scores are best-effort */
    }
  };

  return {
    async draw(): Promise<void> {
      if (isLoading.get()) return;
      isLoading.set(true);
      try {
        // Shuffle + deal three distinct cards locally — no chain, no oracle.
        const ids = drawDistinctCardIds(CARDS_PER_READING);
        drawn.set(ids.map(cardFromIndex));
        readingMode.set("oracle");

        // Advance the on-device readings tally and record it off-chain.
        const nextCount = loadCount() + 1;
        storage.set(GUEST_READINGS_KEY, nextCount);
        readingsCount.set(nextCount);
        question.set("");
        await submitScore(nextCount);
      } finally {
        isLoading.set(false);
      }
    },

    async refresh(): Promise<void> {
      readingsCount.set(loadCount());
      prepaidCredit.set(0);
    },

    withdrawCredit(): void {
      // Guest mode has no draw fee and no prepaid credit — nothing to withdraw.
      setStatus(t("noCredit"), "info");
    },

    async enter(): Promise<void> {
      // Reset to a clean local lobby.
      drawn.set([]);
      readingMode.set("idle");
      isLoading.set(false);
      question.set("");
      // Zero the on-chain-only credit so a prior gamefi read (from the mount-time
      // loadData) never bleeds into the guest surface, then restore the local
      // readings tally from the device store.
      prepaidCredit.set(0);
      readingsCount.set(loadCount());
    },
  };
}
