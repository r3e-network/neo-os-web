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

import { ref, computed } from "vue";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { Card } from "../pages/index/components/TarotCard.vue";
import { TAROT_DECK } from "../pages/index/components/tarot-data";

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

export function useTarot({
  gameService,
  storageService,
  badgeService,
  t,
}: UseTarotOptions) {
  const tarotDeck = TAROT_DECK;
  const drawn = ref<Card[]>([]);
  const hasDrawn = computed(() => drawn.value.length === 3);
  const allFlipped = computed(() => drawn.value.every((c) => c.flipped));
  const readingsCount = ref(0);
  const question = ref("");
  const isLoading = ref(false);

  /**
   * Poll for a completed reading via StorageProxy.
   * The edge function returns the reading result once the oracle has
   * completed the VRF callback and the ReadingCompleted event fires.
   */
  const waitForReading = async (readingId: string): Promise<ReadingResult | null> => {
    const maxAttempts = 30;
    const pollIntervalMs = 1500;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await storageService.get(`reading:${readingId}`);
        if (result && typeof result === "object") {
          const data = result as Record<string, unknown>;
          if (data.status === "completed" && Array.isArray(data.cards)) {
            return {
              readingId: String(data.readingId || readingId),
              cards: (data.cards as unknown[]).map(Number),
              status: "completed",
            };
          }
        }
      } catch {
        // Continue polling
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
    if (isLoading.value) return;
    isLoading.value = true;

    try {
      const prompt = question.value.trim() || t("defaultQuestion");

      // Step 1: Request reading via GameProxy — the edge function handles
      // wallet connection, GAS payment, and requestReading contract invocation
      const result = await gameService.placeBet("tarot", prompt.slice(0, 200)) as unknown as Record<string, unknown>;

      // Extract reading ID from the response
      const readingId = String(result?.readingId || result?.poolId || Date.now());

      // Step 2: Poll for completed reading via StorageProxy
      const reading = await waitForReading(readingId);
      if (!reading) throw new Error(t("readingPending"));

      // Step 3: Map card IDs to deck entries
      drawn.value = reading.cards.map((cardId: number) => {
        const card = tarotDeck.find((item) => item.id === cardId);
        if (!card) {
          return { id: cardId, name: `Card ${cardId}`, icon: "\uD83C\uDCA0", flipped: false };
        }
        return { ...card, flipped: false };
      });

      readingsCount.value += 1;
      question.value = "";

      // Award first-reading badge (fire-and-forget)
      if (readingsCount.value === 1) {
        badgeService.award("first-reading", "").catch(() => {});
      }

      isLoading.value = false;
      return { success: true };
    } catch (e) {
      isLoading.value = false;
      throw e;
    }
  };

  const flipCard = (index: number) => {
    if (drawn.value[index]) {
      drawn.value[index].flipped = true;
    }
  };

  const reset = () => {
    drawn.value = [];
  };

  const getReading = () => {
    if (drawn.value.length !== 3) return t("readingText");
    const [past, present, future] = drawn.value;
    return `${t("past")}: ${past.name} \u00B7 ${t("present")}: ${present.name} \u00B7 ${t("future")}: ${future.name}`;
  };

  /**
   * Load reading count via StorageProxy.
   * The edge function aggregates ReadingCompleted events.
   */
  const loadReadingCount = async () => {
    try {
      const raw = await storageService.list("reading:");
      if (raw && typeof raw === "object") {
        readingsCount.value = Object.keys(raw).length;
      }
    } catch (_e) {
      console.warn("[on-chain-tarot] reading count load failed:", _e instanceof Error ? _e.message : String(_e));
      readingsCount.value = Math.max(readingsCount.value, 0);
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
    readingsCount,
    question,
    isLoading,

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
