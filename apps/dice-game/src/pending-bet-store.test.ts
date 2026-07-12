import { describe, expect, it } from "vitest";
import {
  createDicePendingBet,
  createDicePendingBetStore,
  dicePendingStorageKey,
  findEventByExactTransaction,
} from "./pending-bet-store";
import type { DicePendingStorage } from "./pending-bet-store";

function memoryStorage(): DicePendingStorage & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    get<T>(key: string, fallback: T | null = null): T | null {
      return (values.has(key) ? values.get(key) : fallback) as T | null;
    },
    set(key: string, value: unknown) {
      values.set(key, structuredClone(value));
    },
    delete(key: string) {
      values.delete(key);
    },
  };
}

const scope = {
  player: "0xAABB",
  network: "neo-n3-testnet",
  contract: "0xCCDD",
};

describe("dice pending bet persistence", () => {
  it("round-trips every recovery identity and isolates player/network/contract", () => {
    const storage = memoryStorage();
    const store = createDicePendingBetStore(storage);
    const record = createDicePendingBet({
      ...scope,
      lane: "n3",
      txid: "0xCommitA",
      betId: "42",
      amount: "0.1",
      amountFixed8: "10000000",
      selection: "4",
      now: 100,
    });

    store.upsert(record);
    expect(store.list(scope)).toEqual([record]);
    expect(store.list({ ...scope, player: "0xEEFF" })).toEqual([]);
    expect(store.list({ ...scope, network: "neo-n3-mainnet" })).toEqual([]);
    expect(store.list({ ...scope, contract: "0x9999" })).toEqual([]);
    expect(storage.values.has(dicePendingStorageKey(scope))).toBe(true);
  });

  it("retains broadcast/unknown records and clears only on an explicit terminal outcome", () => {
    const storage = memoryStorage();
    const store = createDicePendingBetStore(storage);
    const record = createDicePendingBet({
      ...scope,
      lane: "n3",
      txid: "0xCommitPending",
      amount: "0.5",
      amountFixed8: "50000000",
      selection: "2",
      phase: "broadcast",
      now: 200,
    });

    store.upsert(record);
    const unknown = store.markUnknown(record);
    expect(store.list(scope)).toMatchObject([
      {
        localId: record.localId,
        txid: "0xcommitpending",
        betId: "",
        phase: "unknown",
      },
    ]);

    store.clear(unknown, "confirmed");
    expect(store.list(scope)).toEqual([]);
    expect(storage.values.has(dicePendingStorageKey(scope))).toBe(false);
  });

  it("keeps concurrent tx identities separate and never substitutes the newest player event", () => {
    const events = [
      { tx_hash: "0xLATEST", state: ["99", scope.player, "6", "10000000"] },
      { tx_hash: "0xTX-B", state: ["12", scope.player, "5", "20000000"] },
      { tx_hash: "0xTX-A", state: ["11", scope.player, "2", "10000000"] },
    ];

    expect(findEventByExactTransaction(events, "0xtx-a")).toBe(events[2]);
    expect(findEventByExactTransaction(events, "0xTX-B")).toBe(events[1]);
    expect(findEventByExactTransaction(events, "")).toBeNull();
    expect(findEventByExactTransaction(events, "0xmissing")).toBeNull();
  });

  it("filters malformed or cross-scope injected records on reload", () => {
    const storage = memoryStorage();
    storage.set(dicePendingStorageKey(scope), [
      { version: 1, lane: "n3", ...scope, txid: "", selection: "4" },
      {
        version: 1,
        lane: "n3",
        ...scope,
        player: "0xSomeoneElse",
        txid: "0xevil",
        betId: "7",
        requestId: "",
        amount: "1",
        amountFixed8: "100000000",
        selection: "4",
        phase: "pending",
        createdAt: 1,
        updatedAt: 1,
      },
    ]);

    expect(createDicePendingBetStore(storage).list(scope)).toEqual([]);
  });
});
