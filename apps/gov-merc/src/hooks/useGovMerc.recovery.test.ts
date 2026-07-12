import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "@shared/react";
import type { ChainService, ContractArg, TxResult } from "@shared/services/ChainService";
import { addressToScriptHash } from "@shared/utils/neo";
import {
  buildPendingGovMercOperation,
  writePendingGovMercOperation,
  type PendingGovMercDraft,
} from "../gov-merc-production";
import { useGovMerc } from "./useGovMerc";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ACTOR = addressToScriptHash(ALICE);
const CONTRACT = "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46";
const TXID = `0x${"d".repeat(64)}`;

class MemoryStorage implements Storage {
  protected readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

class BrokenStorage extends MemoryStorage {
  override setItem(): void { throw new Error("blocked"); }
}

const t = (key: string) => key;

function pendingDraft(): PendingGovMercDraft {
  return {
    kind: "bid",
    network: "mainnet",
    contractHash: CONTRACT,
    actorHash: ACTOR,
    epoch: 4,
    amountRaw: "200000000",
    fundingAmountRaw: "200000000",
    beforeStakeRaw: "0",
    beforeBidRaw: "0",
    beforeEpoch: 4,
    beforeRewardsRaw: "0",
    beforeCreditRaw: "0",
  };
}

function makeChain() {
  const invoke = vi.fn(async (): Promise<TxResult> => ({ txid: TXID, success: true }));
  const invokeWithPayment = vi.fn(async (): Promise<TxResult> => ({ txid: TXID, success: true }));
  const read = vi.fn(async (operation: string, args?: ContractArg[]) => {
    if (operation === "currentEpoch") return "4";
    if (operation === "epochDuration") return "300000";
    if (operation === "settlementWinner") return "0x0000000000000000000000000000000000000000";
    if (operation === "bidOf") {
      const epoch = Number(args?.[0]?.value ?? 0);
      return epoch === 4 ? "0" : "0";
    }
    return "0";
  });
  const ensureWallet = vi.fn(async () => ALICE);
  const chain = {
    contractAddress: { get: () => CONTRACT },
    address: { get: () => ALICE },
    ensureWallet,
    detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
    invoke,
    invokeWithPayment,
    read,
    listEvents: vi.fn(async () => []),
  } as unknown as ChainService;
  return { chain, invoke, invokeWithPayment, ensureWallet };
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("useGovMerc durable refresh recovery", () => {
  it("checks a restored unknown txid without signing, paying, or resubmitting", async () => {
    const stored = buildPendingGovMercOperation(pendingDraft(), TXID);
    writePendingGovMercOperation(stored);
    const { chain, invoke, invokeWithPayment, ensureWallet } = makeChain();
    const transactionReader = vi.fn(async () => ({ state: "unknown" as const, notifications: [] }));
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-gov-merc" },
    );
    const app = useGovMerc({ app: framework, t, transactionReader });
    app.setAddress(ALICE);

    await app.loadData();
    expect(app.pendingOperation.get()?.txid).toBe(TXID);
    expect(transactionReader).toHaveBeenCalledWith(stored);
    expect(invoke).not.toHaveBeenCalled();
    expect(invokeWithPayment).not.toHaveBeenCalled();

    app.bidAmount.set("2");
    await expect(app.placeBid()).rejects.toThrow("transactionAlreadyPending");
    expect(ensureWallet).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(invokeWithPayment).not.toHaveBeenCalled();

    await app.recoverPendingOperation();
    expect(transactionReader).toHaveBeenCalledTimes(2);
    expect(invoke).not.toHaveBeenCalled();
    expect(invokeWithPayment).not.toHaveBeenCalled();
  });

  it("blocks a new wallet write when recovery storage cannot pass readback", async () => {
    vi.stubGlobal("localStorage", new BrokenStorage());
    const { chain, invoke, invokeWithPayment, ensureWallet } = makeChain();
    const framework = createMiniAppFramework(
      { services: { chain }, t } as never,
      { appId: "miniapp-gov-merc" },
    );
    const app = useGovMerc({ app: framework, t });
    app.setAddress(ALICE);
    app.bidAmount.set("2");

    await expect(app.placeBid()).rejects.toThrow("recoveryStorageUnavailable");
    expect(app.storageHealthy.get()).toBe(false);
    expect(ensureWallet).not.toHaveBeenCalled();
    expect(invoke).not.toHaveBeenCalled();
    expect(invokeWithPayment).not.toHaveBeenCalled();
  });
});
