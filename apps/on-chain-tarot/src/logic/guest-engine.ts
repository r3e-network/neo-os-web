/**
 * Guest (free / local) engine for On-Chain Tarot.
 *
 * Guest mode is a purely LOCAL tarot reading: the three-card spread is shuffled
 * with the Web-Crypto RNG (the local analog of the contract's Morpheus-backed
 * shuffle), dealt and revealed entirely client-side, and the running
 * reading tally is stored only on this device. The engine drives the SAME
 * observables the Phaser scene + PlayArea already read
 * (drawn / readingMode / readingsCount / isLoading / question / prepaidCredit),
 * so the frozen scene contract is reused verbatim. It NEVER makes a chain,
 * oracle, or reward call — the framework guest guard therefore never fires.
 *
 * This is the (b) "chance game, no engine" recipe from the adoption contract: a
 * faithful local single-player draw of the tarot mechanic. The GameFi flow is
 * asynchronous: credit deposit → requestReading → Morpheus callback → readback.
 */
import { TAROT_DECK } from "../data/tarot-data";
import {
  cardFromIndex,
  type Card,
  type TarotReadingMode,
} from "../composables/useTarot";
import type { Observable as Obs } from "@framework/reactive";

/** app.storage.local surface (framework-owned, localStorage-backed). */
interface LocalStore {
  get<T>(key: string, fallback?: T | null): T | null;
  set(key: string, value: unknown): void;
}

export interface TarotGuestEngineDeps {
  drawn: Obs<Card[]>;
  readingMode: Obs<TarotReadingMode>;
  readingsCount: Obs<number>;
  prepaidCredit: Obs<number>;
  isLoading: Obs<boolean>;
  question: Obs<string>;
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
 * the successful-reading counter the GameFi flow reads.
 */
const GUEST_READINGS_KEY = "guest:readings";

/** Uniform random integer in [0, max) from the Web-Crypto RNG. */
function randomInt(max: number): number {
  if (max <= 0) return 0;
  const webCrypto = globalThis.crypto;
  if (!webCrypto?.getRandomValues) {
    throw new Error("secure-random-unavailable");
  }

  // Reject the incomplete range at the top of uint32 instead of using a
  // biased modulo directly. The deck is tiny, so a retry is vanishingly rare.
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / max) * max;
  const buf = new Uint32Array(1);
  do {
    webCrypto.getRandomValues(buf);
  } while (buf[0]! >= limit);
  return buf[0]! % max;
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
    storage,
    t,
    setStatus,
  } = deps;

  const loadCount = (): number => {
    try {
      const raw = storage.get<number>(GUEST_READINGS_KEY, 0);
      const value = Number(raw ?? 0);
      return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
    } catch {
      // Private mode and storage-policy failures must never block a reading.
      return 0;
    }
  };

  const saveCount = (value: number): void => {
    try {
      storage.set(GUEST_READINGS_KEY, value);
    } catch {
      // The tally is secondary. Keep the drawn spread usable even when local
      // persistence is unavailable or quota constrained.
    }
  };

  return {
    async draw(): Promise<void> {
      if (isLoading.get()) return;
      isLoading.set(true);
      try {
        // Shuffle + deal three distinct cards locally — no chain, no oracle.
        let ids: number[];
        try {
          ids = drawDistinctCardIds(CARDS_PER_READING);
        } catch (error) {
          if (error instanceof Error && error.message === "secure-random-unavailable") {
            throw new Error(t("secureRandomUnavailable"));
          }
          throw error;
        }
        drawn.set(ids.map(cardFromIndex));
        readingMode.set("local");

        // Advance the on-device readings tally. A private tarot draw should
        // not trigger an unrelated remote leaderboard request.
        const nextCount = loadCount() + 1;
        saveCount(nextCount);
        readingsCount.set(nextCount);
        question.set("");
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
      // Enter with a real, stable default selection. Setting this inside the
      // guest transition avoids the mode-change reset racing the React effect
      // that initializes the selected ritual token.
      question.set(t("questionPresetDecision"));
      // Zero the on-chain-only credit so a prior gamefi read (from the mount-time
      // loadData) never bleeds into the guest surface, then restore the local
      // readings tally from the device store.
      prepaidCredit.set(0);
      readingsCount.set(loadCount());
    },
  };
}
