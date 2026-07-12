import { describe, expect, it } from "vitest";

import { addressToScriptHash } from "@shared/utils/neo";
import {
  createDevTippingOperationStore,
  isPendingDevTippingOperation,
  type DevTippingLocalStorage,
  type PendingTipOperation,
  type TipOperationScope,
} from "./dev-tipping-operation-store";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BOB = "NUuJw4C4XJFzxAvSZnFTfsNoWZytmQKXQP";
const CONTRACT = "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec";
const TXID = `0x${"a".repeat(64)}`;

class MemoryStore implements DevTippingLocalStorage {
  readonly values = new Map<string, unknown>();
  failWrites = false;
  failDeletes = false;

  get<T>(key: string, fallback: T | null = null): T | null {
    return (this.values.has(key) ? this.values.get(key) : fallback) as T | null;
  }

  set(key: string, value: unknown): void {
    if (this.failWrites && key.includes("pending-v2")) throw new Error("quota");
    this.values.set(key, structuredClone(value));
  }

  delete(key: string): void {
    if (this.failDeletes) return;
    this.values.delete(key);
  }
}

const scope: TipOperationScope = {
  network: "testnet",
  contract: CONTRACT,
  sender: ALICE,
};

function tip(overrides: Partial<PendingTipOperation> = {}): PendingTipOperation {
  return {
    version: 2,
    ...scope,
    kind: "tip",
    eventName: "Tipped",
    txid: TXID,
    devId: 2,
    recipientName: "Neo SDK Maintainer",
    recipientWallet: addressToScriptHash(BOB),
    amountBase: "10000000",
    anonymous: true,
    beforeTotalReceivedBase: "30000000",
    beforeTipCount: "1",
    beforeCreditBase: "2500000",
    depositAmountBase: "7500000",
    createdAt: 1_000,
    ...overrides,
  };
}

describe("Developer Tipping operation store", () => {
  it("accepts only complete, exact transaction journals", () => {
    expect(isPendingDevTippingOperation(tip())).toBe(true);
    expect(isPendingDevTippingOperation(tip({ txid: "a".repeat(64) }))).toBe(false);
    expect(isPendingDevTippingOperation(tip({ txid: `0x${"g".repeat(64)}` }))).toBe(false);
    expect(isPendingDevTippingOperation(tip({ depositAmountBase: "7.5" }))).toBe(false);
    expect(isPendingDevTippingOperation(tip({ recipientWallet: "not-an-account" }))).toBe(false);
  });

  it("isolates pending records by network, contract, and sender", () => {
    const storage = new MemoryStore();
    const store = createDevTippingOperationStore(storage);
    store.setPending(scope, tip());

    expect(store.getPending(scope)).toMatchObject({ txid: TXID, kind: "tip" });
    expect(store.getPending({ ...scope, network: "mainnet" })).toBeNull();
    expect(store.getPending({ ...scope, sender: BOB })).toBeNull();
    expect(store.getPending({ ...scope, contract: `0x${"1".repeat(40)}` })).toBeNull();
  });

  it("keeps the same-session receipt visible when durable storage fails after broadcast", () => {
    const storage = new MemoryStore();
    const store = createDevTippingOperationStore(storage);
    expect(store.canPersist(scope)).toBe(true);
    storage.failWrites = true;

    expect(() => store.setPending(scope, tip())).toThrow(/could not be persisted|quota/);
    expect(store.getPending(scope)).toMatchObject({ txid: TXID, kind: "tip" });
  });

  it("promotes a persisted blocking receipt when the primary pending key is unavailable", () => {
    const storage = new MemoryStore();
    const store = createDevTippingOperationStore(storage);
    const pending = tip();
    expect(store.setReceipt(scope, {
      ...pending,
      status: "readback",
      updatedAt: 2_000,
    })).toBe(true);

    expect(store.getPending(scope)).toEqual(pending);
  });

  it("verifies deletion and keeps the recovery lock when storage cleanup fails", () => {
    const storage = new MemoryStore();
    const store = createDevTippingOperationStore(storage);
    store.setPending(scope, tip());
    storage.failDeletes = true;

    expect(store.clearPending(scope)).toBe(false);
    expect(store.getPending(scope)).toMatchObject({ txid: TXID });
    expect(store.canPersist(scope)).toBe(false);
  });
});
