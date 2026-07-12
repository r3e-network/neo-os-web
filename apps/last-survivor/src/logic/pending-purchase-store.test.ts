import { describe, expect, it } from "vitest";
import {
  createPendingPurchaseStore,
  pendingPurchaseKey,
  type PendingPurchaseScope,
} from "./pending-purchase-store";

function memoryStorage() {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T | null = null): T | null {
      return (values.has(key) ? values.get(key) : fallback) as T | null;
    },
    set(key: string, value: unknown) { values.set(key, value); },
    delete(key: string) { values.delete(key); },
    values,
  };
}

const scope: PendingPurchaseScope = {
  network: "TestNet",
  contract: `0x${"ab".repeat(20)}`,
  player: `0x${"cd".repeat(20)}`,
};
const TXID = `0x${"a1".repeat(32)}`;

describe("Last Survivor pending purchase store", () => {
  it("persists one exact tx under normalized network/contract/player scope", () => {
    const storage = memoryStorage();
    const store = createPendingPurchaseStore(storage);
    const saved = store.save(scope, {
      txid: TXID.slice(2).toUpperCase(),
      roundId: "7",
      count: "2",
      cost: "20010000",
    });

    expect(store.load({
      network: "testnet",
      contract: scope.contract.toUpperCase().replace("0X", "0x"),
      player: scope.player.toUpperCase().replace("0X", "0x"),
    }))
      .toMatchObject({ txid: TXID, roundId: "7", count: "2", cost: "20010000" });
    expect(storage.values.has(pendingPurchaseKey(scope))).toBe(true);
    expect(store.isDurable(scope, saved)).toBe(true);
  });

  it("rejects corrupt records and never crosses account scope", () => {
    const storage = memoryStorage();
    const store = createPendingPurchaseStore(storage);
    store.save(scope, { txid: TXID, roundId: "1", count: "1", cost: "1" });

    expect(store.load({ ...scope, player: `0x${"ef".repeat(20)}` })).toBeNull();
    storage.set(pendingPurchaseKey(scope), { version: 1, txid: "latest" });
    // A fresh session has no in-memory record and rejects the corrupt payload.
    expect(() => createPendingPurchaseStore(storage).load(scope))
      .toThrow("Invalid Last Survivor pending operation");
  });

  it("clears only the exact scope", () => {
    const storage = memoryStorage();
    const store = createPendingPurchaseStore(storage);
    store.save(scope, { txid: TXID, roundId: "1", count: "1", cost: "1" });
    store.clear(scope);
    expect(store.load(scope)).toBeNull();
  });

  it("keeps the exact post-broadcast journal in memory when durable storage becomes unavailable", () => {
    const storage = memoryStorage();
    storage.set = () => { throw new Error("denied"); };
    const store = createPendingPurchaseStore(storage);

    expect(() => store.save(scope, {
      txid: TXID,
      roundId: "1",
      count: "1",
      cost: "10000000",
    })).toThrow("recovery storage is unavailable");
    expect(() => store.assertAvailable()).toThrow("recovery storage is unavailable");
    const recovered = store.load(scope);
    expect(recovered).toMatchObject({
      kind: "purchase",
      txid: TXID,
      roundId: "1",
      count: "1",
      cost: "10000000",
    });
    expect(recovered && store.isDurable(scope, recovered)).toBe(false);
  });
});
