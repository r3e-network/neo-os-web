/**
 * useTarot — Domain logic for On-Chain Tarot.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppTarot) via
 * the MiniApp framework SDK (ctx.framework). The earlier path paid a "draw fee" to the OS payment
 * kernel (which moved nothing), polled OS storage for a reading the kernel
 * never wrote, and derived the three cards CLIENT-SIDE from the deposit tx id.
 * That made the reading client-trusted rather than authoritative.
 *
 * MiniAppTarot is self-contained: draw() consumes a prepaid 0.1 GAS fee and
 * picks three DISTINCT cards from the 78-card deck ON-CHAIN with Neo N3's
 * Runtime.GetRandom in the same transaction — no oracle, no client seed. This
 * composable drives it directly, so the three card indices come from the
 * contract's ReadingDrawn event and are authoritative.
 *
 * Contract interaction model (verified against MiniAppTarot.cs / ABI):
 *
 *   READS (app.chain.readRaw, default app contract script hash):
 *     drawFee()                          -> Integer (0.1 GAS in base units)
 *     readingsCount()                    -> Integer (global reading id counter)
 *     creditOf(player)                   -> Integer (prepaid GAS credit, base units)
 *     playerReadingCount(player)         -> Integer
 *     getPlayerReadings(player,off,limit) -> Integer[] (reading ids)
 *     getReading(readingId)              -> Map{id,player,cards(int[3]),time}
 *
 *   MUTATIONS (app.chain.invoke):
 *     1. DEPOSIT (fund a draw) — a GAS transfer to the contract with the memo
 *        "miniapp-tarot:draw" so OnNEP17Payment credits the player's draw
 *        balance:
 *          transfer(player, CONTRACT, drawFee, "miniapp-tarot:draw")
 *          { scriptHash: GAS_HASH }
 *     2. draw(player) -> readingId. Consumes one draw fee from credit and
 *        reveals three distinct card indices in the SAME tx. The three cards are
 *        read from the "ReadingDrawn" event:
 *          ReadingDrawn(readingId, player, card0, card1, card2)
 *        i.e. state slots [2], [3], [4]. They are also retrievable via
 *        getReading(readingId).
 *
 * Post-deposit draw failure: if the deposit lands but draw() reverts, the credit
 * simply remains on the contract under the player as REUSABLE PREPAID credit for
 * the next draw — there is no refund call (and none is needed; funds are not
 * lost). The next draw skips the deposit when creditOf(player) already covers
 * the fee.
 *
 * AMOUNT CONVENTION: the contract takes/returns BASE UNITS (GAS × 1e8). The draw
 * fee is read from drawFee() with a 0.1 GAS fallback.
 *
 * The question the user typed is NOT stored on-chain. It is kept in composable
 * state for the active reading and, so the history can surface it, persisted
 * on-device keyed by readingId via app.storage.local (framework-owned,
 * localStorage-backed, `neo:<appId>:`-prefixed — same keys the earlier
 * CacheService wrote, so previously saved questions remain readable).
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Card deck mapping and flip logic
 *   - Loading UI flags + question input state
 *   - The three card indices read from the ReadingDrawn event of the draw tx
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { ClipboardService } from "@shared/services/ClipboardService";
import { eventValue } from "@shared/utils/chain-events";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { TAROT_CARD_BACK, TAROT_DECK } from "../data/tarot-data";
import type { TarotCardDefinition } from "../data/tarot-data";

export interface Card extends TarotCardDefinition {
  flipped: boolean;
}

export interface UseTarotOptions {
  /** MiniApp framework SDK (ctx.framework) — chain/arg + storage surface. */
  app: MiniAppFramework;
  /** Clipboard service from ctx.services.clipboard (copy/share reading). */
  clipboard: ClipboardService;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Constants
// ============================================================================

/** Memo the contract requires on the draw-funding transfer. */
const DRAW_MEMO = "miniapp-tarot:draw";

/** Draw fee fallback (0.1 GAS in base units) when drawFee() can't be read. */
const DRAW_FEE_FALLBACK = 10_000_000n;

/** Cards per reading (the contract reveals exactly three). */
const CARDS_PER_READING = 3;

/** How many reading ids to page in per refresh of the player's history. */
const HISTORY_PAGE_LIMIT = 100;

/**
 * app.storage.local key prefix for the on-device question store, keyed by
 * readingId (the framework adds its own `neo:<appId>:` namespace).
 */
const QUESTION_KEY_PREFIX = "tarot:question:";

// ============================================================================
// Event parsing
// ============================================================================

// ============================================================================
// Card mapping
// ============================================================================

/**
 * Validate three card indices: exactly three, distinct, each a valid deck
 * index in [0, TAROT_DECK.length). Throws on anything else so a malformed draw
 * never renders a partial / duplicate spread.
 */
function normalizeReadingCards(cards: unknown): number[] {
  if (!Array.isArray(cards)) throw new Error("invalid reading cards");

  const ids = cards.slice(0, CARDS_PER_READING).map((cardId) => Number(cardId));
  const unique = new Set(ids);
  const invalid = ids.some(
    (cardId) => !Number.isInteger(cardId) || cardId < 0 || cardId >= TAROT_DECK.length,
  );

  if (ids.length !== CARDS_PER_READING || unique.size !== CARDS_PER_READING || invalid) {
    throw new Error("invalid reading cards");
  }

  return ids;
}

/** Map a validated card index to a deck entry (or a neutral fallback card). */
export function cardFromIndex(cardId: number): Card {
  const card = TAROT_DECK.find((item) => item.id === cardId);
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
}

// ============================================================================
// Composable
// ============================================================================

export function useTarot({ app, clipboard, t }: UseTarotOptions) {
  const tarotDeck = TAROT_DECK;
  const drawn = createObservable<Card[]>([]);
  const readingsCount = createObservable(0);
  /** Connected wallet's unused prepaid draw-credit (human GAS). */
  const prepaidCredit = createObservable(0);
  const hasCredit = createDerived(() => prepaidCredit.get() > 0, [prepaidCredit]);
  const hasDrawn = createDerived(() => drawn.get().length === CARDS_PER_READING, [drawn]);
  const allFlipped = createDerived(() => {
    const cards = drawn.get();
    return cards.length > 0 && cards.every((c) => c.flipped);
  }, [drawn]);
  const cardsDrawnCount = createDerived(() => readingsCount.get() * CARDS_PER_READING, [readingsCount]);
  const allRevealedDisplay = createDerived(() => (allFlipped.get() ? t("yes") : t("no")), [drawn]);
  const question = createObservable("");
  const isLoading = createObservable(false);
  const readingMode = createObservable<"idle" | "oracle">("idle");

  // Connected wallet address (synced from main.tsx / chain).
  const address = createObservable<string | null>(app.chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };
  const hasContractAddress = () => Boolean(app.chain.contractAddress.get());

  // ── On-device question store (not on-chain) ──────────────────────────

  /** Persist the question for a reading id on-device (best-effort). */
  const persistQuestion = (readingId: string, text: string) => {
    const trimmed = text.trim();
    if (!readingId || !trimmed) return;
    app.storage.local.set(`${QUESTION_KEY_PREFIX}${readingId}`, trimmed);
  };

  /** Restore the on-device question for a reading id (empty when absent). */
  const restoreQuestion = (readingId: string): string =>
    app.storage.local.get<string>(`${QUESTION_KEY_PREFIX}${readingId}`) ?? "";

  // ── Fee resolution ───────────────────────────────────────────────────

  /** Read the on-chain draw fee in base units, falling back to 0.1 GAS. */
  const loadDrawFee = async (): Promise<bigint> => {
    try {
      const raw = await app.chain.readRaw("drawFee", []);
      const fee = parseBigInt(raw);
      return fee > 0n ? fee : DRAW_FEE_FALLBACK;
    } catch {
      return DRAW_FEE_FALLBACK;
    }
  };

  // ── Draw (deposit-then-draw, cards from the ReadingDrawn event) ──────

  /**
   * Draw three cards against the standalone contract.
   *
   * Two steps, both signed by the player:
   *   1. DEPOSIT — if creditOf(player) < drawFee, transfer the fee in GAS to the
   *      contract with the "miniapp-tarot:draw" memo so OnNEP17Payment credits
   *      the player's draw balance.
   *   2. draw(player) — consumes one fee from credit and reveals three DISTINCT
   *      cards ON-CHAIN in the same tx. The three card indices are read from the
   *      "ReadingDrawn" event (state slots [2],[3],[4]), falling back to
   *      getReading(readingId). They are mapped to the deck and rendered.
   *
   * The typed question is kept in state for the active reading and persisted
   * on-device keyed by readingId so the history can surface it.
   *
   * If step 1 lands but step 2 reverts, the prepaid credit persists on the
   * contract under the player and is reused on the next draw — no refund call.
   */
  const draw = async () => {
    if (isLoading.get()) return;
    isLoading.set(true);

    try {
      const prompt = question.get().trim() || t("defaultQuestion");

      const playerAddr = address.get() || (await app.chain.ensureWallet());
      if (!playerAddr) throw new Error(t("walletNotConnected"));
      const playerArg = app.chain.arg.hash160(playerAddr);
      setAddress(playerAddr);

      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) throw new Error(t("readingUnavailable"));

      const fee = await loadDrawFee();

      // Step 1: DEPOSIT — only top up when the existing credit can't cover the
      // fee (credit may persist from a prior aborted draw).
      let credit = 0n;
      try {
        credit = parseBigInt(
          await app.chain.readRaw("creditOf", [playerArg]),
        );
      } catch {
        credit = 0n;
      }

      if (credit < fee) {
        // Wait for the contract's "Credited" event so the deposit is confirmed
        // in a block before draw() consumes it — an unconfirmed deposit lets the
        // draw execute first and fault on what should have been a clean first
        // draw (intra-block ordering is fee/hash-based).
        await app.chain.invoke(
          "transfer",
          [
            playerArg,
            app.chain.arg.hash160(contractHash),
            app.chain.arg.integer(fee - credit),
            app.chain.arg.string(DRAW_MEMO),
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH, waitForEvent: "Credited" },
        );
      }

      // Step 2: draw — consumes one fee and reveals three cards ON-CHAIN. Read
      // the card indices from the ReadingDrawn event of this tx. If the deposit
      // landed but this reverts, the credit persists as reusable prepaid credit.
      let result;
      try {
        result = await app.chain.invoke(
          "draw",
          [playerArg],
          { waitForEvent: "ReadingDrawn" },
        );
      } catch (drawErr) {
        console.error(
          "[on-chain-tarot] draw failed after deposit settled:",
          drawErr instanceof Error ? drawErr.message : String(drawErr),
        );
        // Deposit landed, draw did not — credit is held under the player and is
        // reused on the next draw (no refund needed).
        throw new Error(t("depositPrepaidNoReading"));
      }

      // ReadingDrawn(readingId, player, card0, card1, card2): id slot 0, cards
      // slots 2..4.
      const readingId = parseBigInt(eventValue(result.event, 0)).toString();
      let cardIds: number[];
      try {
        cardIds = normalizeReadingCards([
          eventValue(result.event, 2),
          eventValue(result.event, 3),
          eventValue(result.event, 4),
        ]);
      } catch {
        // Event unavailable / unparsed — read the authoritative reading back.
        cardIds = await readReadingCards(readingId);
      }

      // The question is NOT on-chain: persist it on-device keyed by readingId so
      // the history can surface it later.
      if (readingId && readingId !== "0") {
        persistQuestion(readingId, prompt);
      }

      drawn.set(cardIds.map(cardFromIndex));
      readingMode.set("oracle");

      // Reconcile the readings counter from the contract's authoritative total.
      await loadReadingCount();
      question.set("");

      isLoading.set(false);
      return { success: true };
    } catch (e) {
      isLoading.set(false);
      throw e;
    }
  };

  // ── Reading reads (authoritative cards from the contract) ───────────

  /**
   * Read a reading's three card indices from getReading(readingId). Used as the
   * fallback when the ReadingDrawn event could not be parsed, and to rebuild the
   * player's history.
   */
  const readReadingCards = async (readingId: string): Promise<number[]> => {
    const raw = await app.chain.readRaw("getReading", [app.chain.arg.integer(readingId)]);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
      throw new Error("reading not found");
    }
    const record = raw as Record<string, unknown>;
    return normalizeReadingCards(record.cards);
  };

  // ── Flip / reset / formatting ───────────────────────────────────────

  const flipCard = (index: number) => {
    const cards = drawn.get();
    if (!cards[index] || cards[index].flipped) return;
    drawn.set(cards.map((card, cardIndex) => (cardIndex === index ? { ...card, flipped: true } : card)));
  };

  const reset = () => {
    drawn.set([]);
    readingMode.set("idle");
  };

  const getReading = () => {
    const cards = drawn.get();
    if (cards.length !== CARDS_PER_READING) return t("readingText");
    return `${t("past")}: ${cards[0]!.name} · ${t("present")}: ${cards[1]!.name} · ${t("future")}: ${cards[2]!.name}`;
  };

  /**
   * Copy the formatted Past/Present/Future reading to the clipboard. Returns
   * false (with a real error notification surfaced by ClipboardService) when no
   * complete reading exists or the clipboard write fails, so the UI never shows
   * a false "Copied" confirmation.
   */
  const copyReading = async (): Promise<boolean> => {
    if (drawn.get().length !== CARDS_PER_READING) return false;
    return clipboard.copy(getReading(), "readingCopied");
  };

  // ── Data loading (direct chain reads) ───────────────────────────────

  /**
   * Load the player's reading count from playerReadingCount(player). Falls back
   * to the global readingsCount() when no wallet is connected so the stat is
   * never blank. The count reflects authoritative on-chain state.
   */
  const loadReadingCount = async () => {
    if (!hasContractAddress()) {
      readingsCount.set(Math.max(readingsCount.get(), 0));
      return;
    }

    try {
      const playerAddr = address.get();

      if (playerAddr) {
        const raw = await app.chain.readRaw("playerReadingCount", [
          app.chain.arg.hash160(playerAddr),
        ]);
        readingsCount.set(Number(parseBigInt(raw)));
        return;
      }

      const globalRaw = await app.chain.readRaw("readingsCount", []);
      readingsCount.set(Number(parseBigInt(globalRaw)));
    } catch (e) {
      console.warn(
        "[on-chain-tarot] reading count load failed:",
        e instanceof Error ? e.message : String(e),
      );
      readingsCount.set(Math.max(readingsCount.get(), 0));
    }
  };

  /**
   * Refresh the connected wallet's unused prepaid draw-credit from
   * creditOf(player). Base units → human GAS. A missing wallet yields 0; a read
   * failure leaves the last known value (the withdraw path re-reads first).
   */
  const loadCredit = async () => {
    if (!hasContractAddress()) {
      prepaidCredit.set(0);
      return;
    }

    const playerAddr = address.get();
    if (!playerAddr) {
      prepaidCredit.set(0);
      return;
    }
    try {
      const raw = await app.chain.readRaw("creditOf", [
        app.chain.arg.hash160(playerAddr),
      ]);
      prepaidCredit.set(fromFixed8(parseBigInt(raw)));
    } catch (e) {
      console.warn(
        "[on-chain-tarot] creditOf read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  /**
   * Withdraw the connected wallet's unused prepaid draw-credit via
   * withdraw(account). The contract pays the WHOLE credit back to the wallet —
   * the recovery path when a deposit landed but draw() never completed. Returns
   * the withdrawn amount in human GAS (from the "CreditWithdrawn" event,
   * state[1] = amount).
   */
  const withdrawCredit = async (): Promise<{ amount: number }> => {
    if (isLoading.get()) return { amount: 0 };

    const accountAddr = address.get() || (await app.chain.ensureWallet());
    if (!accountAddr) throw new Error(t("walletNotConnected"));
    const accountArg = app.chain.arg.hash160(accountAddr);
    setAddress(accountAddr);

    isLoading.set(true);
    try {
      // Read the live credit first — the contract reverts "no credit" on an empty
      // balance, so surface a clean message before prompting the wallet.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await app.chain.readRaw("creditOf", [accountArg]),
        );
      } catch {
        credit = 0n;
      }
      if (credit <= 0n) throw new Error(t("noCredit"));

      const result = await app.chain.invoke(
        "withdraw",
        [accountArg],
        { waitForEvent: "CreditWithdrawn" },
      );

      // OnCreditWithdrawn(account, amount) — amount is state index 1.
      const amountBase = parseBigInt(eventValue(result.event, 1));
      const amount = amountBase > 0n ? fromFixed8(amountBase) : fromFixed8(credit);

      await loadAll();
      return { amount };
    } finally {
      isLoading.set(false);
    }
  };

  const loadAll = async () => {
    setAddress(app.chain.address.get() ?? null);
    await loadReadingCount();
    await loadCredit();
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
    prepaidCredit,
    hasCredit,
    address,

    // Actions
    setAddress,
    draw,
    flipCard,
    reset,
    getReading,
    copyReading,
    restoreQuestion,
    withdrawCredit,
    loadReadingCount,
    loadCredit,
    loadAll,
  };
}

export type UseTarotReturn = ReturnType<typeof useTarot>;
