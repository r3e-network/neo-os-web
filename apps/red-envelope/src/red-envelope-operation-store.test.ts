import { describe, expect, it } from "vitest";

import {
  createPendingRedEnvelopeOperation,
  createRedEnvelopeOperationStore,
  redEnvelopeOperationStorageKey,
} from "./red-envelope-operation-store";

const scope = {
  account: `0x${"11".repeat(20)}`,
  contract: `0x${"22".repeat(20)}`,
  network: "testnet",
};

function storage() {
  const values = new Map<string, unknown>();
  return {
    values,
    get<T>(key: string, fallback: T | null = null): T | null {
      return (values.has(key) ? values.get(key) : fallback) as T | null;
    },
    set(key: string, value: unknown) { values.set(key, value); },
    delete(key: string) { values.delete(key); },
  };
}

describe("red-envelope operation store", () => {
  it("persists exact tx recovery metadata inside an account/network/contract scope", () => {
    const backing = storage();
    const store = createRedEnvelopeOperationStore(backing);
    const operation = createPendingRedEnvelopeOperation({
      ...scope,
      phase: "create",
      txid: "0xABC",
      amountBase: "100000000",
      packetCount: 8,
      durationSeconds: 86_400,
      creatorCountBefore: 4,
      now: 123,
    });

    store.set(operation);

    const refreshedStore = createRedEnvelopeOperationStore(backing);
    expect(refreshedStore.get(scope)).toMatchObject({
      phase: "create",
      txid: "0xabc",
      creatorCountBefore: 4,
      packetCount: 8,
    });
    expect(backing.values.has(redEnvelopeOperationStorageKey(scope))).toBe(true);
  });

  it("does not expose one account's pending operation to another account", () => {
    const backing = storage();
    const store = createRedEnvelopeOperationStore(backing);
    store.set(createPendingRedEnvelopeOperation({
      ...scope,
      phase: "claim",
      txid: "0xclaim",
      amountBase: "0",
      envelopeId: "9",
    }));

    expect(store.get({ ...scope, account: `0x${"33".repeat(20)}` })).toBeNull();
  });

  it("requires a scoped durable write/read/delete round trip before a wallet prompt", () => {
    const backing = storage();
    const store = createRedEnvelopeOperationStore(backing);
    expect(store.canPersist(scope)).toBe(true);
    expect([...backing.values.keys()].some((key) => key.endsWith("/__probe"))).toBe(false);

    const unavailable = createRedEnvelopeOperationStore({
      get: <T,>(_key: string, fallback: T | null = null) => fallback,
      set: () => {},
      delete: () => {},
    });
    expect(unavailable.canPersist(scope)).toBe(false);
  });

  it("rejects incomplete create and deposit recovery records", () => {
    expect(() => createPendingRedEnvelopeOperation({
      ...scope,
      phase: "create",
      txid: "0xcreate",
      amountBase: "100000000",
    })).toThrow("create recovery metadata");

    expect(() => createPendingRedEnvelopeOperation({
      ...scope,
      phase: "deposit",
      txid: "0xdeposit",
      amountBase: "100000000",
    })).toThrow("deposit recovery metadata");

    expect(() => createPendingRedEnvelopeOperation({
      ...scope,
      phase: "reclaim",
      txid: "0xreclaim",
      amountBase: "100000000",
      envelopeId: "7",
    })).toThrow("reclaim recovery metadata");
  });
});
