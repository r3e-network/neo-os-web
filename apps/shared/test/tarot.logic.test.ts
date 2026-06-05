import { describe, expect, it, vi } from "vitest";

import { useTarot } from "../../on-chain-tarot/src/composables/useTarot";
import type { UseTarotOptions } from "../../on-chain-tarot/src/composables/useTarot";
import type { ContractArg, TxResult } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0x8cd0342f2129c07b2d3de1dae51ba09e4045d331";
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const DRAW_MEMO = "miniapp-tarot:draw";
const DRAW_FEE = "10000000"; // 0.1 GAS base units

function t(key: string) {
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
}

/**
 * Build a `ReadingDrawn` event payload:
 *   ReadingDrawn(readingId, player, card0, card1, card2)
 * Cards live in state slots 2..4 (same shape the live MiniAppTarot emits).
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
 * Minimal ChainService stand-in resolving drawFee / creditOf /
 * playerReadingCount / getReading against fixtures, plus an in-memory cache
 * that models the on-device question store.
 */
function makeDeps(
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
      return { txid: "0xtransfer", success: true };
    },
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    if (op === "drawFee") return DRAW_FEE;
    if (op === "creditOf") return opts.credit ?? "0";
    if (op === "playerReadingCount") return opts.playerReadingCount ?? "1";
    if (op === "readingsCount") return "1";
    if (op === "getReading") {
      return { id: readingId, player: PLAYER_HASH, cards: opts.getReadingCards ?? cards, time: 0 };
    }
    return {};
  });

  const store = new Map<string, unknown>();
  const cache = {
    persist: vi.fn((key: string, data: unknown) => store.set(key, data)),
    restore: vi.fn((key: string) => (store.has(key) ? store.get(key) : null)),
  };

  const clipboard = { copy: vi.fn(async () => true) };

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    read,
    readArray: vi.fn(async (): Promise<unknown[]> => []),
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

function setup(opts: Parameters<typeof makeDeps>[0] = {}) {
  const deps = makeDeps(opts);
  const tarot = useTarot({ chain: deps.chain, cache: deps.cache, clipboard: deps.clipboard, t });
  tarot.setAddress(PLAYER);
  return { tarot, ...deps };
}

function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((c) => c[0] === op);
}

describe("useTarot (direct MiniAppTarot contract)", () => {
  it("deposits the draw fee then draws, mapping the three cards from the ReadingDrawn event", async () => {
    const { tarot, invoke, read } = setup({ cards: [5, 33, 70], readingId: 7 });

    tarot.question.set("What should I focus on?");
    await tarot.draw();

    const deposit = callFor(invoke, "transfer");
    expect(deposit).toBeTruthy();
    expect(deposit![1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: DRAW_FEE },
      { type: "String", value: DRAW_MEMO },
    ]);
    expect(deposit![2]).toMatchObject({ scriptHash: GAS_HASH });

    const drawCall = callFor(invoke, "draw");
    expect(drawCall![1]).toEqual([{ type: "Hash160", value: PLAYER_HASH }]);
    expect(drawCall![2]).toMatchObject({ waitForEvent: "ReadingDrawn" });

    // Deposit precedes draw; fee + credit gate are read from the contract.
    const order = invoke.mock.calls.map((c) => c[0]);
    expect(order.indexOf("transfer")).toBeLessThan(order.indexOf("draw"));
    expect(read.mock.calls.some((c) => c[0] === "drawFee")).toBe(true);
    expect(read.mock.calls.some((c) => c[0] === "creditOf")).toBe(true);

    // Cards are the event's exact indices — authoritative, no client seed.
    const ids = tarot.drawn.get().map((card) => card.id);
    expect(ids).toEqual([5, 33, 70]);
    expect(new Set(ids).size).toBe(3);
    expect(tarot.hasDrawn.get()).toBe(true);
    expect(tarot.readingMode.get()).toBe("oracle");
  });

  it("skips the deposit when existing draw credit already covers the fee", async () => {
    const { tarot, invoke } = setup({ credit: DRAW_FEE, cards: [1, 2, 3] });

    await tarot.draw();

    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "draw")).toBeTruthy();
    expect(tarot.drawn.get().map((c) => c.id)).toEqual([1, 2, 3]);
  });

  it("falls back to getReading when the ReadingDrawn event is unavailable", async () => {
    const { tarot, read } = setup({ emitEvent: false, readingId: 4, getReadingCards: [10, 20, 30] });

    await tarot.draw();

    expect(read.mock.calls.some((c) => c[0] === "getReading")).toBe(true);
    expect(tarot.drawn.get().map((c) => c.id)).toEqual([10, 20, 30]);
    expect(tarot.readingMode.get()).toBe("oracle");
  });

  it("persists the question on-device keyed by readingId and never sends it on-chain", async () => {
    const { tarot, cacheMock, invoke } = setup({ readingId: 9, cards: [0, 1, 2] });

    tarot.question.set("Will the project ship?");
    await tarot.draw();

    expect(cacheMock.persist).toHaveBeenCalledWith("tarot:question:9", "Will the project ship?");
    expect(tarot.restoreQuestion("9")).toBe("Will the project ship?");

    const drawCall = callFor(invoke, "draw");
    expect(JSON.stringify(drawCall![1])).not.toContain("Will the project ship?");
  });

  it("keeps the credit as reusable prepaid when draw reverts after the deposit", async () => {
    const { tarot, invoke } = setup({ drawThrows: true });

    await expect(tarot.draw()).rejects.toThrow("Draw fee prepaid but reading did not complete");

    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.readingMode.get()).toBe("idle");
  });

  it("loads the readings counter from the player's authoritative on-chain count", async () => {
    const { tarot, read } = setup({ playerReadingCount: "5" });

    await tarot.loadAll();

    expect(read.mock.calls.some((c) => c[0] === "playerReadingCount")).toBe(true);
    expect(tarot.readingsCount.get()).toBe(5);
    expect(tarot.cardsDrawnCount.get()).toBe(15);
  });
});
