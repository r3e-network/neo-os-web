import { describe, expect, it } from "vitest";

import {
  createPendingSelfLoanOperation,
  createSelfLoanOperationStore,
  selfLoanOperationStorageKey,
} from "./self-loan-operation-store";

const scope = {
  borrower: "0x1111111111111111111111111111111111111111",
  network: "testnet",
  contract: "0x87f94598c78cb954ca8200d3964ded9b584d7250",
};

function memoryStorage() {
  const values = new Map<string, unknown>();
  return {
    get<T>(key: string, fallback: T | null = null) {
      return values.has(key) ? values.get(key) as T : fallback;
    },
    set(key: string, value: unknown) {
      values.set(key, value);
    },
    delete(key: string) {
      values.delete(key);
    },
  };
}

describe("SelfLoan durable operation journal", () => {
  it("round-trips an exact broadcast txid under network/contract/borrower scope", () => {
    const storage = memoryStorage();
    const store = createSelfLoanOperationStore(storage);
    const operation = createPendingSelfLoanOperation({
      ...scope,
      phase: "borrow",
      eventName: "LoanTaken",
      eventAmountBase: "10",
      expectedCollateralBase: "10",
      expectedDebtBase: "1000000000",
      expectedLtvBps: "2000",
      expectedDisbursedBase: "995000000",
    }, `0x${"a".repeat(64)}`, 123);

    const saved = store.set(operation);
    expect(saved.durable).toBe(true);
    expect(store.get(scope)).toMatchObject({
      phase: "borrow",
      txid: `0x${"a".repeat(64)}`,
      createdAt: 123,
    });
    expect(selfLoanOperationStorageKey(scope)).toContain("testnet");
  });

  it("fails its preflight probe when persistence cannot round-trip", () => {
    const storage = {
      get: <T>(_key: string, fallback: T | null = null) => fallback,
      set: () => {},
      delete: () => {},
    };
    expect(createSelfLoanOperationStore(storage).canPersist(scope)).toBe(false);
  });

  it("never restores a record into a different wallet scope", () => {
    const storage = memoryStorage();
    const store = createSelfLoanOperationStore(storage);
    store.set(createPendingSelfLoanOperation({
      ...scope,
      phase: "reclaim-collateral",
      eventName: "CollateralWithdrawn",
      eventAmountBase: "3",
      expectedCreditBase: "0",
    }, `0x${"b".repeat(64)}`));
    expect(store.get({ ...scope, borrower: "0x2222222222222222222222222222222222222222" })).toBeNull();
  });
});
