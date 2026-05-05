/**
 * useTarot — Domain logic for On-Chain Tarot (OS Services)
 *
 * Migrated to OS service proxies. Contract interaction is delegated to
 * OS services (GameProxy, StorageProxy, BadgeProxy) via edge functions.
 * The oracle service (ctx.services.oracle) is preserved as-is since
 * oracle callbacks require the platform service layer.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.ensureWallet()
 *     chain.invokeWithPayment(fee, memo, "requestReading", [...])
 *     chain.listAllEvents("ReadingRequested")
 *     chain.listAllEvents("ReadingCompleted")
 *
 *   AFTER (OS proxy):
 *     gameService.placeBet("tarot", "reading")       — request reading (includes payment)
 *     storageService.get(`reading:${readingId}`)      — poll for completed reading
 *     storageService.list("reading:")                 — load reading count
 *     badgeService.award(badgeId, user)               — award tarot badges
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Card deck mapping and flip logic
 *   - Loading UI flags
 *   - Question input state
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { TAROT_CARD_BACK, TAROT_DECK } from "../pages/index/components/tarot-data";
import type { TarotCardDefinition } from "../pages/index/components/tarot-data";

export interface Card extends TarotCardDefinition {
  flipped: boolean;
}

export interface UseTarotOptions {
  /** OS GameProxy instance from ctx.os.game */
  gameService: GameProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

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

function extractReadingId(value: unknown): string {
  const result = unwrapServiceData(value);
  if (!result || typeof result !== "object") return "";
  const data = result as Record<string, unknown>;
  return String(data.readingId ?? data.reading_id ?? data.poolId ?? data.pool_id ?? "").trim();
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
  gameService,
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
   * Poll for a completed reading via StorageProxy.
   * The edge function returns the reading result once the oracle has
   * completed the VRF callback and the ReadingCompleted event fires.
   */
  const waitForReading = async (readingId: string): Promise<ReadingResult | null> => {
    const maxAttempts = 30;
    const pollIntervalMs = 1500;

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
   * 1. Place a "bet" via GameProxy (includes GAS payment via edge function)
   * 2. Poll StorageProxy for the completed reading (oracle VRF callback)
   * 3. Map returned card IDs to the tarot deck
   */
  const draw = async () => {
    if (isLoading.get()) return;
    isLoading.set(true);

    try {
      const prompt = question.get().trim() || t("defaultQuestion");
      let result: unknown;
      try {
        result = await gameService.placeBet("tarot", prompt.slice(0, 200));
      } catch {
        throw new Error(t("readingUnavailable"));
      }
      const readingId = extractReadingId(result);
      if (!readingId) throw new Error(t("readingUnavailable"));

      // Step 2: Poll for completed reading via StorageProxy.
      const reading = await waitForReading(readingId);
      if (!reading) throw new Error(t("readingPending"));
      const cardIds = reading.cards;

      // Step 3: Map card IDs to deck entries
      drawn.set(normalizeReadingCards(cardIds).map((cardId: number) => {
        const card = tarotDeck.find((item) => item.id === cardId);
        if (!card) {
          return {
            id: cardId,
            name: `Card ${cardId}`,
            icon: "\uD83C\uDCA0",
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
