/**
 * useTarot — Domain logic for On-Chain Tarot (OS Services)
 *
 * Value flow is delegated to OS service proxies (PaymentProxy, StorageProxy,
 * BadgeProxy) via edge functions. The draw is paid for through the OS payment
 * service and the reading itself is derived deterministically on the client
 * from the resulting transaction id (see note below).
 *
 * Reading source — design decision (client-derived):
 *
 *   The OS kernel exposes only generic primitives (payment / storage / escrow /
 *   game pools) — there is NO oracle/edge producer that writes a tarot
 *   "reading:<id>" record. The previous implementation called
 *   `gameService.placeBet("tarot", <question text>)`, which is malformed:
 *   os-game-bet requires a numeric poolId + decimal amount, so passing a free
 *   text question made `parseDecimalToInt` throw and the draw was unreachable.
 *   It then polled `storage.get("reading:<id>")` for a key that nothing ever
 *   wrote, so `waitForReading` could never resolve.
 *
 *   New flow (uses only existing OS primitives):
 *     1. paymentService.deposit(DRAW_FEE, question)  — a real "draw fee" value
 *        call. The edge function returns an invocation intent; EdgeClient pops
 *        the wallet confirmation, submits it, and returns the on-chain txid.
 *        That txid (or, if unavailable, a locally generated unique id) becomes
 *        the readingId / random seed.
 *     2. The three cards are derived DETERMINISTICALLY from that seed (a
 *        dependency-free hash → 3 unique deck indices). Same seed ⇒ same
 *        reading, so the result is reproducible and auditable from the txid.
 *     3. storageService.set("reading:<readingId>", {status,cards,...})        —
 *        persists the reading so `storage.list("reading:")` can enumerate the
 *        history index and the existing poll resolves immediately.
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Card deck mapping and flip logic
 *   - Loading UI flags
 *   - Question input state
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { TAROT_CARD_BACK, TAROT_DECK } from "../pages/index/components/tarot-data";
import type { TarotCardDefinition } from "../pages/index/components/tarot-data";

export interface Card extends TarotCardDefinition {
  flipped: boolean;
}

export interface UseTarotOptions {
  /** OS PaymentProxy instance from ctx.os.payment */
  paymentService: PaymentProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/** Draw fee (GAS) charged through the OS payment service for each reading. */
const DRAW_FEE = "0.1";

/**
 * Shape of a completed reading returned by the edge function.
 */
interface ReadingResult {
  readingId: string;
  cards: number[];
  status: "completed" | "pending";
}

function unwrapServiceData(value: unknown): unknown {
  if (value && typeof value === "object" && "ok" in value && "data" in value) {
    return (value as { data: unknown }).data;
  }
  return value;
}

/**
 * Extract a stable reading id from a payment-deposit response.
 *
 * EdgeClient resolves the deposit invocation intent through the wallet and
 * merges the on-chain transaction id back onto the payload as `txid`/`tx`.
 * We accept those first, then fall back to any explicit id fields, then to a
 * hash of the nested invocation. An empty string means no id could be derived
 * and the caller will generate a local unique id instead.
 */
function extractReadingId(value: unknown): string {
  const result = unwrapServiceData(value);
  if (!result || typeof result !== "object") return "";
  const data = result as Record<string, unknown>;
  const direct = String(
    data.txid ??
      data.tx ??
      data.txId ??
      data.transactionId ??
      data.readingId ??
      data.reading_id ??
      data.poolId ??
      data.pool_id ??
      "",
  ).trim();
  if (direct) return direct;

  // Last resort: derive a stable id from the invocation intent itself.
  const invocation = data.invocation;
  if (invocation && typeof invocation === "object") {
    return `inv-${hashSeed(JSON.stringify(invocation)).toString(16)}`;
  }
  return "";
}

/**
 * Deterministic, dependency-free 32-bit hash (xmur3-style) used to turn a
 * reading id / seed string into a reproducible numeric seed.
 */
function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

/**
 * Mulberry32 PRNG seeded from a 32-bit integer. Deterministic: the same seed
 * always yields the same sequence, so a reading is fully reproducible from its
 * readingId (transaction id).
 */
function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Derive three unique card indices in [0, TAROT_DECK.length) from a seed
 * string via a partial Fisher-Yates draw over the deck order. The output is
 * deterministic for a given seed and always satisfies normalizeReadingCards.
 */
function deriveReadingCards(seed: string): number[] {
  const rng = createSeededRng(hashSeed(seed || "tarot"));
  const indices = Array.from({ length: TAROT_DECK.length }, (_, i) => i);
  const picks: number[] = [];
  for (let drawCount = 0; drawCount < 3; drawCount++) {
    const remaining = indices.length - drawCount;
    const swapWith = drawCount + Math.floor(rng() * remaining);
    const chosen = indices[swapWith]!;
    indices[swapWith] = indices[drawCount]!;
    indices[drawCount] = chosen;
    picks.push(chosen);
  }
  return picks;
}

function normalizeReadingCards(cards: unknown): number[] {
  if (!Array.isArray(cards)) throw new Error("invalid reading cards");

  const ids = cards.slice(0, 3).map((cardId) => Number(cardId));
  const unique = new Set(ids);
  const invalid = ids.some((cardId) => !Number.isInteger(cardId) || cardId < 0 || cardId >= TAROT_DECK.length);

  if (ids.length !== 3 || unique.size !== 3 || invalid) {
    throw new Error("invalid reading cards");
  }

  return ids;
}

export function useTarot({
  paymentService,
  storageService,
  badgeService,
  t,
}: UseTarotOptions) {
  const tarotDeck = TAROT_DECK;
  const drawn = createObservable<Card[]>([]);
  const readingsCount = createObservable(0);
  const hasDrawn = createDerived(() => drawn.get().length === 3, [drawn]);
  const allFlipped = createDerived(() => {
    const cards = drawn.get();
    return cards.length > 0 && cards.every((c) => c.flipped);
  }, [drawn]);
  const cardsDrawnCount = createDerived(() => readingsCount.get() * 3, [readingsCount]);
  const allRevealedDisplay = createDerived(() => allFlipped.get() ? t("yes") : t("no"), [drawn]);
  const question = createObservable("");
  const isLoading = createObservable(false);
  const readingMode = createObservable<"idle" | "oracle">("idle");

  /**
   * Read back the persisted reading via StorageProxy.
   *
   * The reading is written by `draw()` immediately after the draw fee is paid,
   * so this normally resolves on the first attempt. A short retry loop is kept
   * to tolerate eventual-consistency on the storage edge function.
   */
  const waitForReading = async (readingId: string): Promise<ReadingResult | null> => {
    const maxAttempts = 5;
    const pollIntervalMs = 500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      let result: unknown;
      try {
        result = unwrapServiceData(await storageService.get(`reading:${readingId}`));
      } catch {
        // Continue polling
      }

      if (result && typeof result === "object") {
        const data = result as Record<string, unknown>;
        if (data.status === "completed" && Array.isArray(data.cards)) {
          return {
            readingId: String(data.readingId || readingId),
            cards: normalizeReadingCards(data.cards),
            status: "completed",
          };
        }
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
    return null;
  };

  /**
   * Draw tarot cards via OS services.
   *
   * Flow:
   * 1. Pay the draw fee via PaymentProxy.deposit (wallet-confirmed value call);
   *    the resulting transaction id is captured as the readingId / seed.
   * 2. Derive three unique cards deterministically from that seed and persist
   *    the reading via StorageProxy.set so it joins the "reading:" history
   *    index and can be read back.
   * 3. Read the persisted reading back and map card IDs to the tarot deck.
   */
  const draw = async () => {
    if (isLoading.get()) return;
    isLoading.set(true);

    try {
      const prompt = question.get().trim() || t("defaultQuestion");

      // Step 1: Pay the draw fee through the OS payment service. The wallet
      // confirms the value call and EdgeClient returns the on-chain tx id.
      let result: unknown;
      try {
        result = await paymentService.deposit(DRAW_FEE, prompt.slice(0, 200));
      } catch {
        throw new Error(t("readingUnavailable"));
      }

      // Use the tx id as the reading id / seed. Fall back to a locally unique
      // id if the wallet adapter did not surface a tx id (e.g. test harness).
      const readingId =
        extractReadingId(result) ||
        `local-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;

      // Step 2: Derive the reading deterministically from the seed and persist
      // it so the history index ("reading:" prefix) and the read-back resolve.
      const derivedCards = normalizeReadingCards(deriveReadingCards(readingId));
      try {
        await storageService.set(`reading:${readingId}`, {
          readingId,
          status: "completed",
          cards: derivedCards,
          question: prompt.slice(0, 200),
          createdAt: Date.now(),
        });
      } catch {
        // Persistence is best-effort for the history index; the reading below
        // falls back to the in-memory derived cards if the read-back fails.
      }

      // Step 3: Read the persisted reading back; fall back to derived cards.
      const reading = await waitForReading(readingId);
      const cardIds = reading ? reading.cards : derivedCards;

      // Step 3: Map card IDs to deck entries
      drawn.set(normalizeReadingCards(cardIds).map((cardId: number) => {
        const card = tarotDeck.find((item) => item.id === cardId);
        if (!card) {
          return {
            id: cardId,
            name: `Card ${cardId}`,
            icon: "M",
            suit: "major",
            number: cardId,
            arcana: "Major Arcana",
            suitLabel: "Unknown",
            keywords: ["Oracle"],
            image: TAROT_CARD_BACK,
            backImage: TAROT_CARD_BACK,
            flipped: false,
          };
        }
        return { ...card, flipped: false };
      }));
      readingMode.set("oracle");

      readingsCount.set(readingsCount.get() + 1);
      question.set("");

      // Award first-reading badge (fire-and-forget)
      if (readingsCount.get() === 1) {
        badgeService.award("first-reading", "").catch(() => {});
      }

      isLoading.set(false);
      return { success: true };
    } catch (e) {
      isLoading.set(false);
      throw e;
    }
  };

  const flipCard = (index: number) => {
    const cards = drawn.get();
    if (!cards[index] || cards[index].flipped) return;
    drawn.set(cards.map((card, cardIndex) => cardIndex === index ? { ...card, flipped: true } : card));
  };

  const reset = () => {
    drawn.set([]);
    readingMode.set("idle");
  };

  const getReading = () => {
    const cards = drawn.get();
    if (cards.length !== 3) return t("readingText");
    return `${t("past")}: ${cards[0]!.name} \u00B7 ${t("present")}: ${cards[1]!.name} \u00B7 ${t("future")}: ${cards[2]!.name}`;
  };

  /**
   * Load reading count via StorageProxy.
   * The edge function aggregates ReadingCompleted events.
   */
  const loadReadingCount = async () => {
    try {
      const raw = unwrapServiceData(await storageService.list("reading:"));
      if (raw && typeof raw === "object") {
        readingsCount.set(Object.keys(raw).length);
      }
    } catch (_e) {
      console.warn("[on-chain-tarot] reading count load failed:", _e instanceof Error ? _e.message : String(_e));
      readingsCount.set(Math.max(readingsCount.get(), 0));
    }
  };

  const loadAll = async () => {
    await loadReadingCount();
  };

  return {
    // State
    drawn,
    hasDrawn,
    allFlipped,
    allRevealedDisplay,
    readingsCount,
    cardsDrawnCount,
    question,
    isLoading,
    readingMode,

    // Actions
    draw,
    flipCard,
    reset,
    getReading,
    loadReadingCount,
    loadAll,
  };
}

export type UseTarotReturn = ReturnType<typeof useTarot>;
