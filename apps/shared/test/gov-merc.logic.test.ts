import { describe, expect, it, vi } from "vitest";

import { useGovMercPool } from "../../gov-merc/src/hooks/useGovMercPool";
import type { PaymentProxy } from "../services/os/PaymentProxy";
import type { StorageProxy } from "../services/os/StorageProxy";

const ALICE = "NAliceaddressxxxxxxxxxxxxxxxxxxxxxx";
const BOB = "NBobaddressyyyyyyyyyyyyyyyyyyyyyyyyy";

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    enterAmount: "Enter an amount",
    withdrawExceeds: "Amount exceeds your deposits",
    walletStatusIdle: "Wallet not connected",
    settleNoBids: "No bids to settle for this epoch",
    bidRefunded: "Bid failed — your GAS was refunded",
    bidRecoverable: "Bid failed and the automatic refund did not complete.",
  };
  let out = messages[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) out = out.replace(`{${k}}`, String(v));
  }
  return out;
}

/**
 * In-memory StorageProxy stand-in. Models the app's SHARED namespace: every
 * write lands in one map and `list(prefix)` returns ALL matching entries
 * regardless of which wallet wrote them. This is the property that makes Total
 * Pool a real aggregate across depositors.
 */
function makeStorage(initial: Record<string, unknown> = {}) {
  const store = new Map<string, unknown>(Object.entries(initial));
  const get = vi.fn(async (key: string) => store.get(key));
  const set = vi.fn(async (key: string, value: unknown) => {
    store.set(key, value);
  });
  const del = vi.fn(async (key: string) => {
    store.delete(key);
  });
  const list = vi.fn(async (prefix: string) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of store.entries()) {
      if (k.startsWith(prefix)) out[k] = v;
    }
    return out;
  });
  const storage = { get, set, delete: del, list } as unknown as StorageProxy & {
    get: typeof get;
    set: typeof set;
    delete: typeof del;
    list: typeof list;
  };
  return { storage, store };
}

function makePayment(overrides: Partial<PaymentProxy> = {}) {
  return {
    deposit: vi.fn(async () => ({ invocation: {} })),
    withdraw: vi.fn(async () => undefined),
    ...overrides,
  } as unknown as PaymentProxy & {
    deposit: ReturnType<typeof vi.fn>;
    withdraw: ReturnType<typeof vi.fn>;
  };
}

function setup(opts: { initial?: Record<string, unknown>; payment?: Partial<PaymentProxy> } = {}) {
  const { storage, store } = makeStorage(opts.initial);
  const payment = makePayment(opts.payment);
  const app = useGovMercPool({ paymentService: payment, storageService: storage, t });
  app.setAddress(ALICE);
  return { app, storage, store, payment };
}

describe("useGovMercPool — shared-pool aggregate", () => {
  it("computes Total Pool as the sum of EVERY depositor record, not just the current wallet", async () => {
    // Two distinct depositors already in the shared namespace.
    const { app } = setup({
      initial: {
        "deposit:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx": { address: ALICE, amount: 30 },
        "deposit:NBobaddressyyyyyyyyyyyyyyyyyyyyyyyyy": { address: BOB, amount: 70 },
      },
    });

    await app.loadData();

    // Aggregate across all depositors (30 + 70), not just Alice's 30.
    expect(app.totalPool.get()).toBe(100);
    // The current wallet (Alice) only sees her own position.
    expect(app.userDeposits.get()).toBe(30);
  });

  it("deposit writes a per-address record and grows the aggregate; a second wallet adds on top", async () => {
    const { app, store } = setup();

    app.depositAmount.set("40");
    await app.depositNeo();

    expect(store.get("deposit:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx")).toEqual({
      address: ALICE,
      amount: 40,
    });
    expect(app.totalPool.get()).toBe(40);
    expect(app.userDeposits.get()).toBe(40);

    // Bob deposits — the aggregate must reflect both depositors.
    app.setAddress(BOB);
    app.depositAmount.set("60");
    await app.depositNeo();

    await app.loadData();
    expect(app.totalPool.get()).toBe(100);
    // Bob's view is his own position only.
    expect(app.userDeposits.get()).toBe(60);
  });
});

describe("useGovMercPool — withdraw validation", () => {
  it("rejects an over-withdrawal with a clear error and leaves the deposit untouched", async () => {
    const { app, store, storage } = setup({
      initial: {
        "deposit:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx": { address: ALICE, amount: 10 },
      },
    });
    await app.loadData();
    expect(app.userDeposits.get()).toBe(10);

    app.withdrawAmount.set("25");
    await expect(app.withdrawNeo()).rejects.toThrow("Amount exceeds your deposits");

    // No write/delete happened — the deposit is intact (no silent clamp-to-zero).
    expect(store.get("deposit:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx")).toEqual({
      address: ALICE,
      amount: 10,
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it("allows a valid partial withdrawal and reduces the position", async () => {
    const { app, store } = setup({
      initial: {
        "deposit:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx": { address: ALICE, amount: 10 },
      },
    });
    await app.loadData();

    app.withdrawAmount.set("4");
    await app.withdrawNeo();

    expect(store.get("deposit:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx")).toEqual({
      address: ALICE,
      amount: 6,
    });
    expect(app.userDeposits.get()).toBe(6);
  });

  it("drops the depositor record on a full withdrawal so it stops counting in the aggregate", async () => {
    const { app, store } = setup({
      initial: {
        "deposit:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx": { address: ALICE, amount: 10 },
        "deposit:NBobaddressyyyyyyyyyyyyyyyyyyyyyyyyy": { address: BOB, amount: 5 },
      },
    });
    await app.loadData();

    app.withdrawAmount.set("10");
    await app.withdrawNeo();

    expect(store.has("deposit:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx")).toBe(false);
    // Only Bob's record remains in the aggregate.
    expect(app.totalPool.get()).toBe(5);
    expect(app.userDeposits.get()).toBe(0);
  });
});

describe("useGovMercPool — epoch-filtered leaderboard", () => {
  it("only shows bids for the live epoch, never stale prior-epoch bids", async () => {
    const { app } = setup({
      initial: {
        "epoch-state": { currentEpoch: 2 },
        // Prior-epoch bids that must NOT leak into the live leaderboard.
        "bid:1:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx": { address: ALICE, amount: "9", epoch: 1 },
        // Live-epoch bids.
        "bid:2:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx": { address: ALICE, amount: "3", epoch: 2 },
        "bid:2:NBobaddressyyyyyyyyyyyyyyyyyyyyyyyyy": { address: BOB, amount: "5", epoch: 2 },
      },
    });

    await app.loadData();

    const bids = app.bids.get();
    expect(bids).toHaveLength(2);
    // Sorted by amount desc — Bob (5) leads Alice (3); the epoch-1 bid (9) is excluded.
    expect(bids[0]).toEqual({ address: BOB, amount: 5 });
    expect(bids[1]).toEqual({ address: ALICE, amount: 3 });
    expect(bids.some((b) => b.amount === 9)).toBe(false);
  });

  it("placeBid records the bid under the live epoch and moves GAS first", async () => {
    const { app, store, payment } = setup({ initial: { "epoch-state": { currentEpoch: 3 } } });
    await app.loadData();

    app.bidAmount.set("2.5");
    await app.placeBid();

    // GAS moved into the vault with the epoch-scoped memo.
    expect(payment.deposit).toHaveBeenCalledWith("2.5", "govmerc:bid:3");
    // Bid recorded under the live epoch key.
    expect(store.get("bid:3:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx")).toEqual({
      address: ALICE,
      amount: "2.5",
      epoch: 3,
    });
  });

  it("refunds the GAS when the bid record write fails", async () => {
    const { storage } = makeStorage({ "epoch-state": { currentEpoch: 0 } });
    storage.set = vi.fn(async (key: string) => {
      if (key.startsWith("bid:")) throw new Error("write failed");
    }) as unknown as StorageProxy["set"];
    const payment = makePayment();
    const app = useGovMercPool({ paymentService: payment, storageService: storage, t });
    app.setAddress(ALICE);
    await app.loadData();

    app.bidAmount.set("1");
    await expect(app.placeBid()).rejects.toThrow("Bid failed — your GAS was refunded");
    expect((payment as unknown as { withdraw: ReturnType<typeof vi.fn> }).withdraw).toHaveBeenCalledWith("1");
  });
});

describe("useGovMercPool — epoch settlement", () => {
  it("resolves the winning bid, records the outcome, and advances the epoch", async () => {
    const { app, store } = setup({
      initial: {
        "epoch-state": { currentEpoch: 5 },
        "bid:5:NAliceaddressxxxxxxxxxxxxxxxxxxxxxx": { address: ALICE, amount: "3", epoch: 5 },
        "bid:5:NBobaddressyyyyyyyyyyyyyyyyyyyyyyyyy": { address: BOB, amount: "8", epoch: 5 },
      },
    });
    await app.loadData();
    expect(app.currentEpoch.get()).toBe(5);

    await app.settleEpoch();

    // Bob (8) is the winner; the settlement is recorded for epoch 5.
    expect(store.get("settlement:5")).toEqual({ epoch: 5, winner: BOB, amount: 8 });
    // Epoch advanced to 6 in shared state and observable.
    expect(store.get("epoch-state")).toEqual({ currentEpoch: 6 });
    expect(app.currentEpoch.get()).toBe(6);
    // The new epoch has no live bids yet.
    expect(app.bids.get()).toHaveLength(0);
    // The just-settled epoch (5 = newEpoch-1) surfaces as the last settlement.
    expect(app.lastSettlement.get()).toEqual({ epoch: 5, winner: BOB, amount: 8 });
  });

  it("refuses to settle an epoch with no bids", async () => {
    const { app, store } = setup({ initial: { "epoch-state": { currentEpoch: 1 } } });
    await app.loadData();

    await expect(app.settleEpoch()).rejects.toThrow("No bids to settle for this epoch");
    // Epoch is unchanged.
    expect(app.currentEpoch.get()).toBe(1);
    expect(store.has("settlement:1")).toBe(false);
  });
});
