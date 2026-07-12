import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTarot } from "../../on-chain-tarot/src/composables/useTarot";
import type { UseTarotOptions } from "../../on-chain-tarot/src/composables/useTarot";
import { createMiniAppFramework } from "../react";
import type { ChainService, ContractArg, TxResult } from "../services/ChainService";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0x8cd0342f2129c07b2d3de1dae51ba09e4045d331";
const READING_FEE = "10000000";
const ORACLE_FEE = "1000000";
const EXPIRES_AT = Date.now() + 7_200_000;

const t: UseTarotOptions["t"] = (key) => ({
  defaultQuestion: "tarot",
  depositPrepaidNoReading: "Credit remains reusable",
  localeCode: "en",
  no: "No",
  noCredit: "No credit",
  noPendingReading: "No pending reading",
  past: "Past",
  present: "Present",
  future: "Future",
  readingCopied: "Copied",
  readingNotExpired: "Not expired",
  readingRequestUnconfirmed: "Request unconfirmed",
  readingText: "Reading",
  readingUnavailable: "Unavailable",
  walletNotConnected: "Connect wallet",
  yes: "Yes",
}[key] ?? key);

function makeDeps(opts: { contract?: string | null; expiresAt?: number } = {}) {
  const fixture = {
    active: "0",
    status: 1,
    credit: "0",
    expiresAt: opts.expiresAt ?? EXPIRES_AT,
  };
  const requested = {
    state: [
      { type: "Integer", value: "7" },
      { type: "Integer", value: "81" },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: READING_FEE },
      { type: "Integer", value: ORACLE_FEE },
      { type: "Integer", value: String(fixture.expiresAt) },
    ],
  };
  const refunded = {
    state: [
      { type: "Integer", value: "7" },
      { type: "Integer", value: "81" },
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Integer", value: READING_FEE },
      { type: "Integer", value: "4" },
      { type: "String", value: "oracle timeout" },
    ],
  };

  const invoke = vi.fn(async (
    op: string,
    _args: ContractArg[],
    options?: { waitForEvent?: string },
  ): Promise<TxResult> => {
    if (op === "requestReading") {
      fixture.active = "7";
      fixture.status = 1;
      return { txid: "0xrequest", event: requested, success: true };
    }
    if (op === "refundExpiredReading") {
      fixture.active = "0";
      fixture.status = 4;
      fixture.credit = READING_FEE;
      return {
        txid: "0xrefund",
        event: options?.waitForEvent === "ReadingRefunded" ? refunded : undefined,
        success: true,
      };
    }
    return { txid: "0xtransfer", success: true };
  });

  const read = vi.fn(async (op: string): Promise<unknown> => {
    if (op === "readingFee") return READING_FEE;
    if (op === "currentOracleFee") return ORACLE_FEE;
    if (op === "activeReadingOf") return fixture.active;
    if (op === "creditOf") return fixture.credit;
    if (op === "playerCompletedReadingCount" || op === "completedReadingsCount") return "0";
    if (op === "getReading") {
      return {
        id: "7",
        requestId: "81",
        status: String(fixture.status),
        cards: fixture.status === 2 ? [0, 21, 47] : [-1, -1, -1],
        expiresAt: String(fixture.expiresAt),
      };
    }
    return "0";
  });

  const chain = {
    contractAddress: { get: () => ("contract" in opts ? opts.contract : CONTRACT) },
    address: { get: () => PLAYER },
    ensureWallet: vi.fn(async () => PLAYER),
    invoke,
    read,
    readArray: vi.fn(async () => []),
  } as unknown as ChainService;

  return {
    chain,
    fixture,
    invoke,
    read,
    clipboard: { copy: vi.fn(async () => true) } as unknown as UseTarotOptions["clipboard"],
  };
}

function setup(opts: Parameters<typeof makeDeps>[0] = {}) {
  const deps = makeDeps(opts);
  const app = createMiniAppFramework(
    { services: { chain: deps.chain }, t } as never,
    { appId: "miniapp-onchaintarot" },
  );
  const tarot = useTarot({ app, clipboard: deps.clipboard, t });
  tarot.setAddress(PLAYER);
  return { tarot, app, ...deps };
}

beforeEach(() => localStorage.clear());

describe("tarot VRF framework integration", () => {
  it("uses the exact VRF credit memo and leaves ReadingRequested visibly pending", async () => {
    const { tarot, invoke } = setup();
    await tarot.draw();

    expect(invoke.mock.calls[0]?.[0]).toBe("transfer");
    expect(invoke.mock.calls[0]?.[1]).toEqual([
      { type: "Hash160", value: PLAYER_HASH },
      { type: "Hash160", value: CONTRACT },
      { type: "Integer", value: READING_FEE },
      { type: "String", value: "miniapp-tarot-vrf:credit" },
    ]);
    expect(invoke.mock.calls[0]?.[2]).toMatchObject({
      scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      waitForEvent: "Credited",
    });
    expect(invoke.mock.calls[1]?.[0]).toBe("requestReading");
    expect(invoke.mock.calls[1]?.[1]?.[1]).toEqual({ type: "Integer", value: ORACLE_FEE });
    expect(tarot.readingMode.get()).toBe("pending");
    expect(tarot.drawn.get()).toEqual([]);
  });

  it("maps the spread only after a status-2 readback", async () => {
    const { tarot, fixture } = setup();
    await tarot.draw();
    fixture.status = 2;
    fixture.active = "0";
    await tarot.reconcilePendingReading();
    expect(tarot.drawn.get().map((card) => card.id)).toEqual([0, 21, 47]);
    expect(tarot.readingMode.get()).toBe("oracle");
  });

  it("exposes timeout recovery as a credit restoration, never as a drawn spread", async () => {
    const { tarot, invoke } = setup({ expiresAt: Date.now() - 1 });
    await tarot.draw();
    await tarot.refundExpiredReading();
    expect(invoke.mock.calls.some((call) => call[0] === "refundExpiredReading")).toBe(true);
    expect(tarot.readingMode.get()).toBe("refunded");
    expect(tarot.drawn.get()).toEqual([]);
    expect(tarot.prepaidCredit.get()).toBeCloseTo(0.1, 8);
  });

  it("does not touch chain reads when the host has no verified contract binding", async () => {
    const { tarot, read } = setup({ contract: null });
    await tarot.loadAll();
    expect(read).not.toHaveBeenCalled();
  });
});
