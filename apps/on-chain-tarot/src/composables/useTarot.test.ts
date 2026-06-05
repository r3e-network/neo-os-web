import { describe, expect, it, vi } from "vitest";
import { useTarot } from "./useTarot";
import type { UseTarotOptions } from "./useTarot";
import type { ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0xb680225a1be276b03ecd7de82ea985dcc7435cec";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const DRAW_MEMO = "miniapp-tarot:draw";
const DRAW_FEE = "10000000"; // 0.1 GAS base units

const t = (key: string) => {
  const messages: Record<string, string> = {
    defaultQuestion: "tarot",
    readingUnavailable: "Reading unavailable",
    walletNotConnected: "Connect your wallet to draw",
    depositPrepaidNoReading: "Draw fee prepaid but reading did not complete",
    yes: "Yes",
    no: "No",
    past: "Past",
    present: "Present",
    future: "Future",
    readingText: "Reading text",
    readingCopied: "Reading copied",
  };
  return messages[key] ?? key;
};

/**
 * Build a `ReadingDrawn` event payload:
 *   ReadingDrawn(readingId, player, card0, card1, card2)
 * The composable reads the readingId from slot 0 and the three card indices from
 * slots 2..4 (same shape the live contract emits).
 */
function readingDrawnEvent(readingId: number, cards: [number, number, number]) {
  return {
    state: [
      { type: "Integer", value: String(readingId) },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: String(cards[0]) },
      { type: "Integer", value: String(cards[1]) },
      { type: "Integer", value: String(cards[2]) },
    ],
  };
}

/**
 * Minimal ChainService stand-in. Records invoke/read calls so tests can assert
 * the deposit-then-draw argument shapes, and resolves drawFee / creditOf /
 * playerReadingCount / getReading against the configured fixtures.
 */
function makeChain(
  opts: {
    credit?: string;
    cards?: [number, number, number];
    readingId?: number;
    playerReadingCount?: string;
    emitEvent?: boolean;
    drawThrows?: boolean;
    getReadingCards?: [number, number, number];
  } = {},
) {
  const cards = opts.cards ?? [0, 21, 47];
  const readingId = opts.readingId ?? 1;
  const emitEvent = opts.emitEvent !== false;

  const invoke = vi.fn(
    async (op: string, _args: ContractArg[], options?: { waitForEvent?: string }): Promise<TxResult> => {
      if (op === "draw") {
        if (opts.drawThrows) throw new Error("draw reverted");
        const event =
          emitEvent && options?.waitForEvent === "ReadingDrawn"
            ? readingDrawnEvent(readingId, cards)
            : undefined;
        return { txid: "0xdraw", event, success: true };
      }
      // transfer (deposit) and anything else.
      return { txid: "0xtransfer", success: true };
    },
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    if (op === "drawFee") return DRAW_FEE;
    if (op === "creditOf") return opts.credit ?? "0";
    if (op === "playerReadingCount") return opts.playerReadingCount ?? "1";
    if (op === "readingsCount") return "1";
    if (op === "getReading") {
      const fallback = opts.getReadingCards ?? cards;
      return { id: readingId, player: PLAYER_HASH, cards: fallback, time: 0 };
    }
    return {};
  });

  const readArray = vi.fn(async (): Promise<unknown[]> => []);

  // On-device question store backed by an in-memory map (models localStorage).
  const store = new Map<string, unknown>();
  const cache = {
    persist: vi.fn((key: string, data: unknown) => store.set(key, data)),
    restore: vi.fn((key: string) => (store.has(key) ? store.get(key) : null)),
  };

  const clipboard = {
    copy: vi.fn(async () => true),
  };

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    read,
    readArray,
  } as unknown as UseTarotOptions["chain"];

  return {
    chain,
    cache: cache as unknown as UseTarotOptions["cache"],
    clipboard: clipboard as unknown as UseTarotOptions["clipboard"],
    invoke,
    read,
    cacheMock: cache,
    clipboardMock: clipboard,
  };
}

function setup(opts: Parameters<typeof makeChain>[0] = {}) {
  const deps = makeChain(opts);
  const tarot = useTarot({ chain: deps.chain, cache: deps.cache, clipboard: deps.clipboard, t });
  tarot.setAddress(PLAYER);
  return { tarot, ...deps };
}

/** Find a recorded invoke call for an operation. */
function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useTarot (direct MiniAppTarot contract)", () => {
  it("deposits the draw fee then draws, reading the three cards from the ReadingDrawn event", async () => {
    const { tarot, invoke, read } = setup({ cards: [5, 33, 70], readingId: 7 });

    tarot.question.set("What should I focus on?");
    await tarot.draw();

    // Step 1: DEPOSIT — GAS transfer to the contract with the draw memo, base units.
    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: DRAW_FEE },
      { type: "String", value: DRAW_MEMO },
    ]);
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH });

    // Step 2: draw(player) waiting for the ReadingDrawn event.
    const drawCall = callFor(invoke, "draw");
    expect(drawCall).toBeTruthy();
    expect(drawCall![1]).toEqual([{ type: "Hash160", value: PLAYER_HASH }]);
    expect(drawCall![2]).toMatchObject({ waitForEvent: "ReadingDrawn" });

    // The deposit must precede the draw.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("draw"));

    // The fee came from drawFee(), the credit gate from creditOf().
    expect(read.mock.calls.some((c) => c[0] === "drawFee")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "creditOf")).toBe(true);

    // The three cards are exactly the event's indices (NOT a client seed).
    const ids = tarot.drawn.get().map((card) => card.id);
    expect(ids).toEqual([5, 33, 70]);
    expect(new Set(ids).size).toBe(3);

    expect(tarot.hasDrawn.get()).toBe(true);
    expect(tarot.allFlipped.get()).toBe(false);
    expect(tarot.readingMode.get()).toBe("oracle");

    tarot.flipCard(0);
    tarot.flipCard(1);
    tarot.flipCard(2);
    expect(tarot.allFlipped.get()).toBe(true);
    expect(tarot.allRevealedDisplay.get()).toBe("Yes");

    tarot.reset();
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.readingMode.get()).toBe("idle");
  });

  it("skips the deposit when existing draw credit already covers the fee", async () => {
    const { tarot, invoke } = setup({ credit: DRAW_FEE, cards: [1, 2, 3] });

    await tarot.draw();

    // No deposit transfer — credit already covers the 0.1 GAS fee.
    expect(callFor(invoke, "transfer")).toBeUndefined();
    // The draw still runs and the event cards are mapped.
    expect(callFor(invoke, "draw")).toBeTruthy();
    expect(tarot.drawn.get().map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it("falls back to getReading when the ReadingDrawn event is unavailable", async () => {
    const { tarot, read } = setup({
      emitEvent: false,
      readingId: 4,
      getReadingCards: [10, 20, 30],
    });

    await tarot.draw();

    // The cards came from the authoritative getReading read, not the event.
    expect(read.mock.calls.some((c) => c[0] === "getReading")).toBe(true);
    expect(tarot.drawn.get().map((c) => c.id)).toEqual([10, 20, 30]);
    expect(tarot.readingMode.get()).toBe("oracle");
  });

  it("persists the typed question on-device keyed by readingId (not on-chain)", async () => {
    const { tarot, cacheMock, invoke } = setup({ readingId: 9, cards: [0, 1, 2] });

    tarot.question.set("Will the project ship?");
    await tarot.draw();

    // The question is stored via the cache, keyed by readingId — and never sent
    // to the contract (no invoke argument carries the question text).
    expect(cacheMock.persist).toHaveBeenCalledWith(
      "tarot:question:9",
      "Will the project ship?",
    );
    expect(tarot.restoreQuestion("9")).toBe("Will the project ship?");

    const drawCall = callFor(invoke, "draw");
    const drawArgsJson = JSON.stringify(drawCall![1]);
    expect(drawArgsJson).not.toContain("Will the project ship?");
  });

  it("surfaces a clean prepaid-credit message when draw reverts after the deposit", async () => {
    const { tarot, invoke } = setup({ drawThrows: true });

    await expect(tarot.draw()).rejects.toThrow("Draw fee prepaid but reading did not complete");

    // The deposit landed (credit persists on the contract); no reading rendered.
    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.hasDrawn.get()).toBe(false);
    expect(tarot.readingMode.get()).toBe("idle");
  });

  it("copies a complete reading via the clipboard service and reports failure when none is drawn", async () => {
    const { tarot, clipboardMock } = setup({ cards: [0, 21, 47] });

    // No reading yet: copyReading must not claim success or hit the clipboard.
    await expect(tarot.copyReading()).resolves.toBe(false);
    expect(clipboardMock.copy).not.toHaveBeenCalled();

    await tarot.draw();
    await expect(tarot.copyReading()).resolves.toBe(true);
    expect(clipboardMock.copy).toHaveBeenCalledTimes(1);
    expect(clipboardMock.copy).toHaveBeenCalledWith(
      expect.stringContaining("Past:"),
      "readingCopied",
    );
  });

  it("loads the readings counter from the player's authoritative on-chain count", async () => {
    const { tarot, read } = setup({ playerReadingCount: "5" });

    await tarot.loadAll();

    expect(read.mock.calls.some((c) => c[0] === "playerReadingCount")).toBe(true);
    expect(tarot.readingsCount.get()).toBe(5);
    expect(tarot.cardsDrawnCount.get()).toBe(15);
  });
});
