import { beforeEach, describe, expect, it, vi } from "vitest";

import { useGovMerc } from "./useGovMerc";
import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46";
const ALICE_HASH = addressToScriptHash(ALICE);
const BID_MEMO = "govmerc:bid";
const ACTION_TXID = `0x${"a".repeat(64)}`;
const PAYMENT_TXID = `0x${"b".repeat(64)}`;

const t = (key: string) => key;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));

/**
 * The host lane must persist the payment txid before consuming the credit, then
 * persist the action txid before waiting for BidPlaced. The mock mutates the
 * exact contract readbacks so completion requires both the event and state.
 */
function makeChain() {
  let credit = 0n;
  let bid = 0n;
  const invoke = vi.fn(
    async (
      _op: string,
      _args: ContractArg[],
      options?: { onTransactionSent?: (txid: string) => void },
    ): Promise<TxResult> => {
      options?.onTransactionSent?.(ACTION_TXID);
      return { txid: ACTION_TXID, success: true };
    },
  );

  const invokeWithPayment = vi.fn(
    async (
      amount: string,
      _memo: string,
      _op: string,
      args: ContractArg[],
      options?: {
        waitForEvent?: string;
        onPaymentSent?: (txid: string) => void;
        onTransactionSent?: (txid: string) => void;
      },
    ): Promise<TxResult> => {
      options?.onPaymentSent?.(PAYMENT_TXID);
      credit += BigInt(amount);
      const add = BigInt(String(args[1]?.value ?? "0"));
      bid += add;
      credit -= add;
      const event = { state: [
        { type: "Integer", value: "4" },
        { type: "Hash160", value: ALICE },
        { type: "Integer", value: bid.toString() },
      ] };
      options?.onTransactionSent?.(ACTION_TXID);
      return { txid: ACTION_TXID, success: true, verified: true, event };
    },
  );

  const read = vi.fn(async (op: string): Promise<unknown> => {
    switch (op) {
      case "currentEpoch": return "4";
      case "gasCreditOf": return credit.toString();
      case "bidOf": return bid.toString();
      case "epochDuration": return "300000";
      case "settlementWinner": return "0x0000000000000000000000000000000000000000";
      default: return "0";
    }
  });

  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet: vi.fn(async () => ALICE),
    detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
    invoke,
    invokeWithPayment,
    read,
    listEvents: vi.fn(async (): Promise<unknown[]> => []),
  } as unknown as ChainService;
  return { chain, invoke, invokeWithPayment };
}

describe("useGovMerc — bid deposit is confirmed before bid()", () => {
  it("persists payment and action boundaries on the confirmed-deposit lane", async () => {
    const { chain, invoke, invokeWithPayment } = makeChain();
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-gov-merc" },
    );
    const app = useGovMerc({ app: framework, t });
    app.setAddress(ALICE);
    await app.loadData();
    invoke.mockClear();

    app.bidAmount.set("2");
    await app.placeBid();

    expect(invokeWithPayment).toHaveBeenCalledTimes(1);
    expect(invokeWithPayment).toHaveBeenCalledWith(
      "200000000",
      BID_MEMO,
      "bid",
      [
        { type: "Hash160", value: ALICE_HASH },
        { type: "Integer", value: "200000000" },
      ],
      expect.objectContaining({
        waitForEvent: "BidPlaced",
        onPaymentSent: expect.any(Function),
        onTransactionSent: expect.any(Function),
      }),
    );
    expect(invoke.mock.calls.some((call) => call[0] === "transfer")).toBe(false);
    expect(invoke.mock.calls.some((call) => call[0] === "bid")).toBe(false);
    expect(app.pendingOperation.get()).toBeNull();
  });
});
