import { describe, expect, it } from "vitest";
import {
  burnOperationStorageKey,
  createBurnOperationStore,
  createPendingBurnOperation,
  findBurnEventByExactTransaction,
} from "./burn-operation-store";

class MemoryStorage {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string, fallback: T | null = null): T | null {
    return (this.values.has(key) ? this.values.get(key) : fallback) as T | null;
  }

  set(key: string, value: unknown): void {
    this.values.set(key, value);
  }

  delete(key: string): void {
    this.values.delete(key);
  }
}

const SCOPE = {
  player: "0xABCDEF",
  network: "Neo-N3-Testnet",
  contract: "0x123456",
};

function operation(overrides: Partial<Parameters<typeof createPendingBurnOperation>[0]> = {}) {
  return createPendingBurnOperation({
    ...SCOPE,
    phase: "burn",
    txid: "0xDEADBEEF",
    amount: "5",
    amountBase: "500000000",
    transactionAmountBase: "500000000",
    now: 100,
    ...overrides,
  });
}

describe("Burn League durable operation store", () => {
  it("scopes records by normalized player/network/contract", () => {
    const storage = new MemoryStorage();
    const store = createBurnOperationStore(storage);
    store.set(operation());

    expect(store.get({
      player: "0xabcdef",
      network: "neo-n3-testnet",
      contract: "0x123456",
    })).toMatchObject({ txid: "0xdeadbeef", amountBase: "500000000" });
    expect(store.get({ ...SCOPE, player: "0xother" })).toBeNull();
    expect(burnOperationStorageKey(SCOPE)).toContain("neo-n3-testnet");
  });

  it("rejects zero/malformed financial amounts before persistence", () => {
    expect(() => operation({ amount: "0" })).toThrow("positive canonical amount");
    expect(() => operation({ amountBase: "0" })).toThrow("positive canonical amount");
    expect(() => operation({ transactionAmountBase: "-1" })).toThrow(
      "positive canonical amount",
    );
  });

  it("finds only the exact transaction while tolerating prefix/case differences", () => {
    const exact = { tx_hash: "DEADBEEF", state: [] };
    const other = { txid: "0xfeedface", state: [] };
    expect(findBurnEventByExactTransaction([other, exact], "0xdeadbeef")).toBe(exact);
    expect(findBurnEventByExactTransaction([other], "0xdeadbeef")).toBeNull();
  });

  it("clears only the selected operation scope", () => {
    const storage = new MemoryStorage();
    const store = createBurnOperationStore(storage);
    const first = operation();
    const second = operation({ player: "0x9999", txid: "0x2222" });
    store.set(first);
    store.set(second);

    store.clear(first);
    expect(store.get(first)).toBeNull();
    expect(store.get(second)).toMatchObject({ txid: "0x2222" });
  });
});
