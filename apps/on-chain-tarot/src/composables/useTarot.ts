/**
 * Domain logic for the asynchronous MiniAppTarotVrf contract.
 *
 * A wallet first deposits reusable reading credit, then requests Morpheus
 * randomness with a live oracle-fe cap. `ReadingRequested` means only that the
 * ritual is pending; cards are rendered exclusively after `getReading` reports
 * STATUS_DRAWN. Oracle failures and timeouts restore the full reading fee to
 * withdrawable credit. The selected question remains local to this device.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import type { ClipboardService } from "@shared/services/ClipboardService";
import { eventValue } from "@shared/utils/chain-events";
import { fromFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { localizeTarotCard, TAROT_CARD_BACK, TAROT_DECK } from "../data/tarot-data";
import type { TarotCardDefinition } from "../data/tarot-data";

export interface Card extends TarotCardDefinition {
  flipped: boolean;
}

export type TarotReadingMode = "idle" | "pending" | "oracle" | "refunded" | "local";

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

/** Exact memo accepted by MiniAppTarotVrf.OnNEP17Payment for user credit. */
const CREDIT_MEMO = "miniapp-tarot-vrf:credit";

/** Cards per reading (the contract reveals exactly three). */
const CARDS_PER_READING = 3;

/**
 * app.storage.local key prefix for the on-device question store, keyed by
 * readingId (the framework adds its own `neo:<appId>:` namespace).
 */
const QUESTION_KEY_PREFIX = "tarot:question:";
const PENDING_KEY_PREFIX = "tarot:pending:";

const STATUS_PENDING = 1;
const STATUS_DRAWN = 2;
const STATUS_EXPIRED_REFUNDED = 4;

type ContractReading = {
  id: string;
  requestId: string;
  status: number;
  cards: unknown;
  expiresAt: number;
};

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

function asRecord(value: unknown): Record<string, unknown> {
  if (value instanceof Map) {
    return Object.fromEntries(Array.from(value.entries(), ([key, entry]) => [String(key), entry]));
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("reading not found");
  }
  return value as Record<string, unknown>;
}

function parseReading(value: unknown): ContractReading {
  const record = asRecord(value);
  const id = parseBigInt(record.id).toString();
  const requestId = parseBigInt(record.requestId).toString();
  const status = Number(parseBigInt(record.status));
  const expiresAt = Number(parseBigInt(record.expiresAt));
  if (!/^[1-9]\d*$/.test(id) || !Number.isInteger(status) || status < 1 || status > 4) {
    throw new Error("invalid reading record");
  }
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= 0) {
    throw new Error("invalid reading expiry");
  }
  return { id, requestId, status, cards: record.cards, expiresAt };
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
  const drawn = createObservable<Card[]>([]);
  const readingsCount = createObservable(0);
  const prepaidCredit = createObservable(0);
  const readingFee = createObservable(0);
  const oracleFee = createObservable(0);
  const pendingReadingId = createObservable("");
  const pendingRequestId = createObservable("");
  const pendingExpiresAt = createObservable(0);
  const pendingExpired = createObservable(false);
  const refundReason = createObservable<"" | "oracle" | "expired">("");
  const question = createObservable("");
  const isLoading = createObservable(false);
  const readingMode = createObservable<TarotReadingMode>("idle");
  const hasCredit = createDerived(() => prepaidCredit.get() > 0, [prepaidCredit]);
  const hasDrawn = createDerived(() => drawn.get().length === CARDS_PER_READING, [drawn]);
  const hasPending = createDerived(
    () => readingMode.get() === "pending" && Boolean(pendingReadingId.get()),
    [readingMode, pendingReadingId],
  );
  const allFlipped = createDerived(() => {
    const cards = drawn.get();
    return cards.length > 0 && cards.every((c) => c.flipped);
  }, [drawn]);
  const cardsDrawnCount = createDerived(() => readingsCount.get() * CARDS_PER_READING, [readingsCount]);
  const allRevealedDisplay = createDerived(() => (allFlipped.get() ? t("yes") : t("no")), [drawn]);

  const address = createObservable<string | null>(app.chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };
  const hasContractAddress = () => Boolean(app.chain.contractAddress.get());
  const pendingStorageKey = (account: string) =>
    `${PENDING_KEY_PREFIX}${account.trim().toLowerCase()}`;

  const persistQuestion = (readingId: string, text: string) => {
    const trimmed = text.trim();
    if (!readingId || !trimmed) return;
    app.storage.local.set(`${QUESTION_KEY_PREFIX}${readingId}`, trimmed);
  };

  /** Restore the on-device question for a reading id (empty when absent). */
  const restoreQuestion = (readingId: string): string =>
    app.storage.local.get<string>(`${QUESTION_KEY_PREFIX}${readingId}`) ?? "";

  const persistPendingId = (readingId: string | null) => {
    const account = address.get();
    if (!account) return;
    const key = pendingStorageKey(account);
    if (readingId) app.storage.local.set(key, readingId);
    else app.storage.local.delete(key);
  };

  const clearPendingState = (clearStorage: boolean) => {
    if (clearStorage) persistPendingId(null);
    pendingReadingId.set("");
    pendingRequestId.set("");
    pendingExpiresAt.set(0);
    pendingExpired.set(false);
  };

  const readReading = async (readingId: string): Promise<ContractReading> => {
    const reading = await app.chain
      .query("getReading", [app.chain.arg.integer(readingId)])
      .as(parseReading);
    if (reading.id !== readingId) throw new Error("reading id mismatch");
    return reading;
  };

  const applyReading = (reading: ContractReading) => {
    if (reading.status === STATUS_PENDING) {
      drawn.set([]);
      refundReason.set("");
      readingMode.set("pending");
      pendingReadingId.set(reading.id);
      pendingRequestId.set(reading.requestId);
      pendingExpiresAt.set(reading.expiresAt);
      pendingExpired.set(Date.now() >= reading.expiresAt);
      persistPendingId(reading.id);
      return "pending" as const;
    }

    if (reading.status === STATUS_DRAWN) {
      drawn.set(normalizeReadingCards(reading.cards).map(cardFromIndex));
      refundReason.set("");
      readingMode.set("oracle");
      clearPendingState(true);
      const restored = restoreQuestion(reading.id);
      if (restored) question.set(restored);
      return "drawn" as const;
    }

    drawn.set([]);
    refundReason.set(
      reading.status === STATUS_EXPIRED_REFUNDED ? "expired" : "oracle",
    );
    readingMode.set("refunded");
    clearPendingState(true);
    return "refunded" as const;
  };

  const reconcileReading = async (readingId: string) =>
    applyReading(await readReading(readingId));

  const loadFees = async (): Promise<{ reading: bigint; oracle: bigint }> => {
    const reading = await app.chain.query("readingFee", []).asBigInt();
    const oracle = await app.chain.query("currentOracleFee", []).asBigInt();
    if (reading <= 0n || oracle < 0n || oracle > reading) {
      throw new Error(t("readingUnavailable"));
    }
    readingFee.set(fromFixed8(reading));
    oracleFee.set(fromFixed8(oracle));
    return { reading, oracle };
  };

  const activeReadingId = async (playerArg: ReturnType<typeof app.chain.arg.hash160>) => {
    const active = await app.chain.query("activeReadingOf", [playerArg]).asBigInt();
    if (active < 0n) throw new Error("invalid active reading");
    return active.toString();
  };

  const reconcilePendingReading = async () => {
    if (!hasContractAddress()) return "none" as const;
    const playerAddr = address.get();
    if (!playerAddr) return "none" as const;
    const playerArg = app.chain.arg.hash160(playerAddr);
    const activeId = await activeReadingId(playerArg);
    const storedId = app.storage.local.get<string>(pendingStorageKey(playerAddr)) ?? "";
    const readingId = activeId !== "0" ? activeId : storedId;
    if (!readingId) {
      if (readingMode.get() === "pending") {
        clearPendingState(true);
        readingMode.set("idle");
      }
      return "none" as const;
    }
    return reconcileReading(readingId);
  };

  /**
   * Deposit reusable credit when needed, then enqueue the asynchronous VRF
   * request. A successful request deliberately renders no cards: only a later
   * terminal `getReading` record may unlock the spread.
   */
  const draw = async () => {
    if (isLoading.get()) return { status: "busy" as const };
    isLoading.set(true);
    let deposited = false;
    let submitted = false;

    try {
      const prompt = question.get().trim() || t("defaultQuestion");
      const playerAddr = address.get() || (await app.chain.ensureWallet());
      if (!playerAddr) throw new Error(t("walletNotConnected"));
      setAddress(playerAddr);
      const playerArg = app.chain.arg.hash160(playerAddr);

      const contractHash = app.chain.contractAddress.get();
      if (!contractHash) throw new Error(t("readingUnavailable"));

      const existingId = await activeReadingId(playerArg);
      if (existingId !== "0") {
        await reconcileReading(existingId);
        return { status: "pending" as const, readingId: existingId };
      }

      const fees = await loadFees();
      const credit = await app.chain.query("creditOf", [playerArg]).asBigInt();
      if (credit < 0n) throw new Error(t("readingUnavailable"));

      if (credit < fees.reading) {
        // The contract accepts exact reading-fee multiples. Deposit one complete
        // fee rather than a partial top-up; any prior partial credit remains
        // withdrawable and never gets stranded by the memo validation rule.
        await app.chain.invoke(
          "transfer",
          [
            playerArg,
            app.chain.arg.hash160(contractHash),
            app.chain.arg.integer(fees.reading),
            app.chain.arg.string(CREDIT_MEMO),
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH, waitForEvent: "Credited" },
        );
        deposited = true;
      }

      const result = await app.chain.invoke(
        "requestReading",
        [playerArg, app.chain.arg.integer(fees.oracle)],
        { waitForEvent: "ReadingRequested" },
      );
      submitted = true;

      let readingId = "0";
      let requestId = "0";
      let expiresAt = 0;
      try {
        readingId = parseBigInt(eventValue(result.event, 0)).toString();
        requestId = parseBigInt(eventValue(result.event, 1)).toString();
        expiresAt = Number(parseBigInt(eventValue(result.event, 5)));
      } catch {
        readingId = await activeReadingId(playerArg);
      }
      if (!/^[1-9]\d*$/.test(readingId)) {
        throw new Error(t("readingRequestUnconfirmed"));
      }

      persistQuestion(readingId, prompt);
      persistPendingId(readingId);
      drawn.set([]);
      refundReason.set("");
      readingMode.set("pending");
      pendingReadingId.set(readingId);
      pendingRequestId.set(requestId === "0" ? "" : requestId);
      pendingExpiresAt.set(Number.isSafeInteger(expiresAt) ? expiresAt : 0);
      pendingExpired.set(expiresAt > 0 && Date.now() >= expiresAt);
      question.set("");

      await Promise.all([loadReadingCount(), loadCredit()]);
      return { status: "pending" as const, readingId };
    } catch (error) {
      if (submitted) throw new Error(t("readingRequestUnconfirmed"));
      if (deposited) throw new Error(t("depositPrepaidNoReading"));
      throw error;
    } finally {
      isLoading.set(false);
    }
  };

  // ── Flip / reset / formatting ───────────────────────────────────────

  const flipCard = (index: number) => {
    const cards = drawn.get();
    if (!cards[index] || cards[index].flipped) return;
    drawn.set(cards.map((card, cardIndex) => (cardIndex === index ? { ...card, flipped: true } : card)));
  };

  const reset = () => {
    if (readingMode.get() === "pending") return;
    drawn.set([]);
    refundReason.set("");
    readingMode.set("idle");
  };

  const getReading = () => {
    const cards = drawn.get();
    if (cards.length !== CARDS_PER_READING) return t("readingText");
    const localized = cards.map((card) => localizeTarotCard(card, t("localeCode")));
    const positionKeys = ["past", "present", "future"] as const;
    return localized
      .map((card, index) => {
        const position = t(positionKeys[index]!);
        const meaning = card.reading ? `：${card.reading}` : "";
        return `${position}（${card.name}）${meaning}`;
      })
      .join(" · ");
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

  const loadReadingCount = async () => {
    if (!hasContractAddress()) {
      readingsCount.set(Math.max(readingsCount.get(), 0));
      return;
    }

    try {
      const playerAddr = address.get();

      if (playerAddr) {
        readingsCount.set(
          await app.chain
            .query("playerCompletedReadingCount", [app.chain.arg.hash160(playerAddr)])
            .asInt(),
        );
        return;
      }

      readingsCount.set(await app.chain.query("completedReadingsCount", []).asInt());
    } catch (e) {
      console.warn(
        "[on-chain-tarot] reading count load failed:",
        e instanceof Error ? e.message : String(e),
      );
      readingsCount.set(Math.max(readingsCount.get(), 0));
    }
  };

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
      const credit = await app.chain
        .query("creditOf", [app.chain.arg.hash160(playerAddr)])
        .asBigInt();
      prepaidCredit.set(fromFixed8(credit));
    } catch (e) {
      console.warn(
        "[on-chain-tarot] creditOf read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  const withdrawCredit = async (): Promise<{ amount: number }> => {
    if (isLoading.get()) return { amount: 0 };

    const accountAddr = address.get() || (await app.chain.ensureWallet());
    if (!accountAddr) throw new Error(t("walletNotConnected"));
    const accountArg = app.chain.arg.hash160(accountAddr);
    setAddress(accountAddr);

    isLoading.set(true);
    try {
      // Read the live credit first — the contract reverts "no credit" on an empty
      // balance, so surface a clean message before prompting the wallet. RPC
      // failures propagate instead of being misreported as a zero balance.
      const credit = await app.chain.query("creditOf", [accountArg]).asBigInt();
      if (credit <= 0n) throw new Error(t("noCredit"));

      const result = await app.chain.invoke(
        "withdrawAllCredit",
        [accountArg],
        { waitForEvent: "CreditWithdrawn" },
      );

      // OnCreditWithdrawn(account, amount) — amount is state index 1.
      const amountBase = parseBigInt(eventValue(result.event, 1));
      const amount = amountBase > 0n ? fromFixed8(amountBase) : fromFixed8(credit);

      await loadCredit();
      return { amount };
    } finally {
      isLoading.set(false);
    }
  };

  const refundExpiredReading = async (): Promise<{ amount: number }> => {
    if (isLoading.get()) return { amount: 0 };
    const readingId = pendingReadingId.get();
    if (!readingId) throw new Error(t("noPendingReading"));

    isLoading.set(true);
    try {
      const current = await readReading(readingId);
      if (current.status !== STATUS_PENDING) {
        applyReading(current);
        await loadCredit();
        return { amount: 0 };
      }
      if (Date.now() < current.expiresAt) {
        pendingExpiresAt.set(current.expiresAt);
        pendingExpired.set(false);
        throw new Error(t("readingNotExpired"));
      }

      const result = await app.chain.invoke(
        "refundExpiredReading",
        [app.chain.arg.integer(readingId)],
        { waitForEvent: "ReadingRefunded" },
      );
      const amountBase = parseBigInt(eventValue(result.event, 3));
      try {
        await reconcileReading(readingId);
      } catch {
        drawn.set([]);
        refundReason.set("expired");
        readingMode.set("refunded");
        clearPendingState(true);
      }
      await Promise.all([loadCredit(), loadReadingCount()]);
      return { amount: fromFixed8(amountBase) };
    } finally {
      isLoading.set(false);
    }
  };

  const loadAll = async () => {
    setAddress(app.chain.address.get() ?? null);
    if (!hasContractAddress()) {
      readingsCount.set(0);
      prepaidCredit.set(0);
      readingFee.set(0);
      oracleFee.set(0);
      return;
    }
    await Promise.all([loadReadingCount(), loadCredit(), loadFees()]);
    await reconcilePendingReading();
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
    readingFee,
    oracleFee,
    hasCredit,
    hasPending,
    pendingReadingId,
    pendingRequestId,
    pendingExpiresAt,
    pendingExpired,
    refundReason,
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
    refundExpiredReading,
    reconcilePendingReading,
    loadReadingCount,
    loadCredit,
    loadAll,
  };
}

export type UseTarotReturn = ReturnType<typeof useTarot>;
