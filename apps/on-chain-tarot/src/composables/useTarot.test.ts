import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTarot } from "./useTarot";
import type { UseTarotOptions } from "./useTarot";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const localStorageBacking = new Map<string, string>();
if (typeof globalThis.localStorage === "undefined") {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => localStorageBacking.get(key) ?? null,
      setItem: (key: string, value: string) => localStorageBacking.set(key, String(value)),
      removeItem: (key: string) => localStorageBacking.delete(key),
      clear: () => localStorageBacking.clear(),
      key: (index: number) => Array.from(localStorageBacking.keys())[index] ?? null,
      get length() {
        return localStorageBacking.size;
      },
    } satisfies Storage,
  });
}

beforeEach(() => localStorage.clear());

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0x8cd0342f2129c07b2d3de1dae51ba09e4045d331";
const READING_FEE = "10000000";
const ORACLE_FEE = "1000000";
const CREDIT_MEMO = "miniapp-tarot-vrf:credit";
const EXPIRES_AT = Date.now() + 7_200_000;

const t: UseTarotOptions["t"] = (key) => ({
  defaultQuestion: "tarot",
  depositPrepaidNoReading: "Reading credit deposited but request failed",
  localeCode: "en",
  noCredit: "No prepaid credit to withdraw",
  noPendingReading: "No pending reading",
  past: "Past",
  present: "Present",
  future: "Future",
  readingCopied: "Reading copied",
  readingNotExpired: "Reading not expired",
  readingRequestUnconfirmed: "Request unconfirmed",
  readingText: "Reading text",
  readingUnavailable: "Reading unavailable",
  walletNotConnected: "Connect wallet",
  yes: "Yes",
  no: "No",
}[key] ?? key);

function requestedEvent(
  readingId: number,
  requestId: number,
  expiresAt = EXPIRES_AT,
) {
  return {
    state: [
      { type: "Integer", value: String(readingId) },
      { type: "Integer", value: String(requestId) },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: READING_FEE },
      { type: "Integer", value: ORACLE_FEE },
      { type: "Integer", value: String(expiresAt) },
    ],
  };
}

function refundedEvent(readingId: number, requestId: number) {
  return {
    state: [
      { type: "Integer", value: String(readingId) },
      { type: "Integer", value: String(requestId) },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: READING_FEE },
      { type: "Integer", value: "4" },
      { type: "String", value: "oracle timeout" },
    ],
  };
}

function withdrawnEvent(amount: string) {
  return {
    state: [
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: amount },
      { type: "Integer", value: "0" },
    ],
  };
}

type Fixture = {
  status: number;
  activeId: string;
  credit: string;
  cards: [number, number, number];
  expiresAt: number;
};

function makeChain(opts: {
  contract?: string | null;
  readingId?: number;
  requestId?: number;
  credit?: string;
  status?: number;
  activeId?: string;
  cards?: [number, number, number];
  expiresAt?: number;
  completedCount?: string;
  emitRequestedEvent?: boolean;
  requestThrows?: boolean;
  feeReadThrows?: boolean;
} = {}) {
  const readingId = opts.readingId ?? 7;
  const requestId = opts.requestId ?? 81;
  const state: Fixture = {
    status: opts.status ?? 1,
    activeId: opts.activeId ?? "0",
    credit: opts.credit ?? "0",
    cards: opts.cards ?? [5, 33, 70],
    expiresAt: opts.expiresAt ?? EXPIRES_AT,
  };

  const invoke = vi.fn(async (
    op: string,
    _args: ContractArg[],
    options?: { waitForEvent?: string },
  ): Promise<TxResult> => {
    if (op === "requestReading") {
      if (opts.requestThrows) throw new Error("request reverted");
      state.status = 1;
      state.activeId = String(readingId);
      return {
        txid: "0xrequest",
        event: opts.emitRequestedEvent === false
          ? undefined
          : requestedEvent(readingId, requestId, state.expiresAt),
        success: true,
      };
    }
    if (op === "refundExpiredReading") {
      state.status = 4;
      state.activeId = "0";
      state.credit = READING_FEE;
      return {
        txid: "0xrefund",
        event: options?.waitForEvent === "ReadingRefunded"
          ? refundedEvent(readingId, requestId)
          : undefined,
        success: true,
      };
    }
    if (op === "withdrawAllCredit") {
      const amount = state.credit;
      state.credit = "0";
      return {
        txid: "0xwithdraw",
        event: options?.waitForEvent === "CreditWithdrawn"
          ? withdrawnEvent(amount)
          : undefined,
        success: true,
      };
    }
    return { txid: "0xtransfer", success: true };
  });

  const read = vi.fn(async (op: string): Promise<unknown> => {
    if (opts.feeReadThrows && (op === "readingFee" || op === "currentOracleFee")) {
      throw new Error("rpc unavailable");
    }
    if (op === "readingFee") return READING_FEE;
    if (op === "currentOracleFee") return ORACLE_FEE;
    if (op === "creditOf") return state.credit;
    if (op === "activeReadingOf") return state.activeId;
    if (op === "playerCompletedReadingCount") return opts.completedCount ?? "0";
    if (op === "completedReadingsCount") return opts.completedCount ?? "0";
    if (op === "getReading") {
      return {
        id: String(readingId),
        requestId: String(requestId),
        status: String(state.status),
        cards: state.status === 2 ? state.cards : [-1, -1, -1],
        expiresAt: String(state.expiresAt),
      };
    }
    return "0";
  });

  const clipboard = { copy: vi.fn(async () => true) };
  const chain = {
    contractAddress: { get: () => ("contract" in opts ? opts.contract : CONTRACT) },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    read,
    readArray: vi.fn(async (): Promise<unknown[]> => []),
  } as unknown as ChainService;

  return {
    chain,
    state,
    invoke,
    read,
    clipboard: clipboard as unknown as UseTarotOptions["clipboard"],
    clipboardMock: clipboard,
  };
}

function setup(opts: Parameters<typeof makeChain>[0] = {}, translate = t) {
  const deps = makeChain(opts);
  const app = createMiniAppFramework(
    { services: { chain: deps.chain }, t: translate } as never,
    { appId: "miniapp-onchaintarot" },
  );
  const tarot = useTarot({ app, clipboard: deps.clipboard, t: translate });
  tarot.setAddress(PLAYER);
  return { tarot, app, ...deps };
}

function callFor(invoke: ReturnType<typeof vi.fn>, op: string) {
  return invoke.mock.calls.find((call) => call[0] === op);
}

describe("useTarot (asynchronous MiniAppTarotVrf contract)", () => {
  it("deposits exact reusable credit and submits the live oracle-fe cap without rendering cards", async () => {
    const { tarot, app, invoke, read } = setup();
    tarot.question.set("What should I focus on?");

    await expect(tarot.draw()).resolves.toEqual({ status: "pending", readingId: "7" });

    expect(callFor(invoke, "transfer")?.[1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: READING_FEE },
      { type: "String", value: CREDIT_MEMO },
    ]);
    expect(callFor(invoke, "transfer")?.[2]).toMatchObject({
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      waitForEvent: "Credited",
    });
    expect(callFor(invoke, "requestReading")?.[1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: ORACLE_FEE },
    ]);
    expect(callFor(invoke, "requestReading")?.[2]).toMatchObject({
      waitForEvent: "ReadingRequested",
    });
    expect(read.mock.calls.some((call) => call[0] === "currentOracleFee")).toBe(true);
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.readingMode.get()).toBe("pending");
    expect(tarot.pendingReadingId.get()).toBe("7");
    expect(app.storage.local.get<string>("tarot:question:7")).toBe("What should I focus on?");
    expect(app.storage.local.get<string>(`tarot:pending:${PLAYER.toLowerCase()}`)).toBe("7");
  });

  it("reuses existing credit instead of asking for another deposit", async () => {
    const { tarot, invoke } = setup({ credit: READING_FEE });
    await tarot.draw();
    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "requestReading")).toBeTruthy();
  });

  it("does not submit a duplicate request when the player already has an active reading", async () => {
    const { tarot, invoke } = setup({ activeId: "7", status: 1 });
    await expect(tarot.draw()).resolves.toEqual({ status: "pending", readingId: "7" });
    expect(callFor(invoke, "transfer")).toBeUndefined();
    expect(callFor(invoke, "requestReading")).toBeUndefined();
    expect(tarot.hasPending.get()).toBe(true);
  });

  it("renders cards only after a terminal drawn record is read back", async () => {
    const { tarot, state } = setup();
    await tarot.draw();
    expect(tarot.hasDrawn.get()).toBe(false);

    state.status = 2;
    state.activeId = "0";
    await expect(tarot.reconcilePendingReading()).resolves.toBe("drawn");
    expect(tarot.drawn.get().map((card) => card.id)).toEqual([5, 33, 70]);
    expect(tarot.readingMode.get()).toBe("oracle");
    expect(tarot.hasPending.get()).toBe(false);
  });

  it("keeps a refunded oracle failure card-free and restores the recovery state", async () => {
    const { tarot, state } = setup();
    await tarot.draw();
    state.status = 3;
    state.activeId = "0";

    await expect(tarot.reconcilePendingReading()).resolves.toBe("refunded");
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.readingMode.get()).toBe("refunded");
    expect(tarot.refundReason.get()).toBe("oracle");
  });

  it("recovers an expired reading fee through the permissionless timeout path", async () => {
    const expired = Date.now() - 1_000;
    const { tarot, invoke } = setup({ expiresAt: expired });
    await tarot.draw();
    expect(tarot.pendingExpired.get()).toBe(true);

    await expect(tarot.refundExpiredReading()).resolves.toEqual({ amount: 0.1 });
    expect(callFor(invoke, "refundExpiredReading")?.[1]).toEqual([
      { type: "Integer", value: "7" },
    ]);
    expect(tarot.readingMode.get()).toBe("refunded");
    expect(tarot.prepaidCredit.get()).toBeCloseTo(0.1, 8);
  });

  it("does not prompt a timeout refund before the contract expiry", async () => {
    const { tarot, invoke } = setup();
    await tarot.draw();
    await expect(tarot.refundExpiredReading()).rejects.toThrow("Reading not expired");
    expect(callFor(invoke, "refundExpiredReading")).toBeUndefined();
  });

  it("leaves a confirmed deposit reusable when requestReading faults", async () => {
    const { tarot, invoke } = setup({ requestThrows: true });
    await expect(tarot.draw()).rejects.toThrow("Reading credit deposited but request failed");
    expect(callFor(invoke, "transfer")).toBeTruthy();
    expect(tarot.drawn.get()).toEqual([]);
  });

  it("fails closed when live fee reads are unavailable", async () => {
    const { tarot, invoke } = setup({ feeReadThrows: true });
    await expect(tarot.draw()).rejects.toThrow("rpc unavailable");
    expect(invoke).not.toHaveBeenCalled();
  });

  it("uses successful-reading counters rather than counting pending/refunded requests", async () => {
    const { tarot, read } = setup({ completedCount: "5" });
    await tarot.loadAll();
    expect(read.mock.calls.some((call) => call[0] === "playerCompletedReadingCount")).toBe(true);
    expect(tarot.readingsCount.get()).toBe(5);
    expect(tarot.cardsDrawnCount.get()).toBe(15);
  });

  it("withdraws all unused credit through withdrawAllCredit", async () => {
    const { tarot, invoke } = setup({ credit: READING_FEE });
    await expect(tarot.withdrawCredit()).resolves.toEqual({ amount: 0.1 });
    expect(callFor(invoke, "withdrawAllCredit")?.[1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
    ]);
  });

  it("keeps local preview quiet when no contract is configured", async () => {
    const { tarot, read } = setup({ contract: null });
    await tarot.loadAll();
    expect(read).not.toHaveBeenCalled();
    expect(tarot.readingsCount.get()).toBe(0);
    expect(tarot.prepaidCredit.get()).toBe(0);
  });

  it("copies only a complete reconciled spread", async () => {
    const { tarot, state, clipboardMock } = setup();
    await expect(tarot.copyReading()).resolves.toBe(false);
    await tarot.draw();
    state.status = 2;
    state.activeId = "0";
    await tarot.reconcilePendingReading();
    await expect(tarot.copyReading()).resolves.toBe(true);
    expect(clipboardMock.copy).toHaveBeenCalledWith(
      "Past（The Hierophant）：Seek guidance from trusted tradition; it gives you a steady root. · Present（Knight of Wands）：Charged with passion, you ride — speed breaks through, but watch the road. · Future（Seven of Pentacles）：Sown long ago, not yet ripe; trust the pace, don't pull it early.",
      "readingCopied",
    );
  });

  it("rejects duplicate or malformed terminal cards instead of rendering a partial spread", async () => {
    const { tarot, state } = setup({ cards: [3, 3, 7] });
    await tarot.draw();
    state.status = 2;
    state.activeId = "0";
    await expect(tarot.reconcilePendingReading()).rejects.toThrow("invalid reading cards");
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.readingMode.get()).toBe("pending");
  });
});
