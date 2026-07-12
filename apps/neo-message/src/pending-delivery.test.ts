import { describe, expect, it } from "vitest";

import {
  PENDING_DELIVERY_KEY,
  clearPendingDelivery,
  inspectPendingReceipt,
  pendingDeliveryIsStale,
  readPendingDelivery,
  receiptMessageId,
  savePendingDelivery,
  type PendingDelivery,
} from "./pending-delivery";

class MemoryStore {
  values = new Map<string, unknown>();
  get<T>(key: string, fallback: T | null = null): T | null {
    return this.values.has(key) ? this.values.get(key) as T : fallback;
  }
  set(key: string, value: unknown) { this.values.set(key, value); }
  delete(key: string) { this.values.delete(key); }
}

const pending: PendingDelivery = {
  version: 1,
  txid: `0x${"ab".repeat(32)}`,
  sender: `0x${"11".repeat(20)}`,
  recipient: `0x${"22".repeat(20)}`,
  unlockTime: 0,
  createdAt: 1_700_000_000_000,
};
const contract = `0x${"33".repeat(20)}`;
const eventTopic = `0x${"cd".repeat(32)}`;
const idTopic = `0x${(42n).toString(16).padStart(64, "0")}`;

function receipt(overrides: Record<string, unknown> = {}) {
  return {
    status: "0x1",
    transactionHash: pending.txid,
    from: pending.sender,
    to: contract,
    logs: [{ address: contract, topics: [eventTopic, idTopic] }],
    ...overrides,
  };
}

describe("Neo Message pending delivery", () => {
  it("persists with readback and clears without losing validation", () => {
    const store = new MemoryStore();
    expect(savePendingDelivery(store, pending)).toBe(true);
    expect(readPendingDelivery(store)).toEqual(pending);
    expect(clearPendingDelivery(store)).toBe(true);
    expect(store.values.has(PENDING_DELIVERY_KEY)).toBe(false);
  });

  it("rejects malformed persisted recovery state", () => {
    const store = new MemoryStore();
    store.set(PENDING_DELIVERY_KEY, { ...pending, txid: "0x1234" });
    expect(readPendingDelivery(store)).toBeNull();
  });

  it("rejects zero-address and implausibly future recovery records", () => {
    const store = new MemoryStore();
    store.set(PENDING_DELIVERY_KEY, {
      ...pending,
      sender: "0x0000000000000000000000000000000000000000",
      createdAt: Date.now(),
    });
    expect(readPendingDelivery(store)).toBeNull();

    store.set(PENDING_DELIVERY_KEY, {
      ...pending,
      createdAt: Date.now() + 10 * 60 * 1000,
    });
    expect(readPendingDelivery(store)).toBeNull();
  });

  it("extracts the indexed message id only from the exact event topic", () => {
    expect(receiptMessageId(receipt(), eventTopic, contract)).toBe("42");
    expect(receiptMessageId(receipt({ logs: [{ address: contract, topics: [`0x${"ef".repeat(32)}`, idTopic] }] }), eventTopic, contract)).toBeNull();
    expect(receiptMessageId(receipt({ logs: [{ address: `0x${"44".repeat(20)}`, topics: [eventTopic, idTopic] }] }), eventTopic, contract)).toBeNull();
    expect(receiptMessageId(receipt({ logs: [
      { address: contract, topics: [eventTopic, idTopic] },
      { address: contract, topics: [eventTopic, idTopic] },
    ] }), eventTopic, contract)).toBeNull();
  });

  it("accepts recovery only when receipt, sender, contract and event all match", () => {
    expect(inspectPendingReceipt(receipt(), pending, eventTopic, contract)).toEqual({ ok: true, messageId: "42" });
    expect(inspectPendingReceipt(receipt({ from: `0x${"55".repeat(20)}` }), pending, eventTopic, contract)).toEqual({ ok: false, reason: "invalid" });
    expect(inspectPendingReceipt(receipt({ transactionHash: `0x${"66".repeat(32)}` }), pending, eventTopic, contract)).toEqual({ ok: false, reason: "invalid" });
    expect(inspectPendingReceipt(receipt({ status: "0x0" }), pending, eventTopic, contract)).toEqual({ ok: false, reason: "reverted" });
    expect(inspectPendingReceipt(receipt({ status: "0x2" }), pending, eventTopic, contract)).toEqual({ ok: false, reason: "invalid" });
    expect(inspectPendingReceipt(receipt({ logs: [] }), pending, eventTopic, contract)).toEqual({ ok: false, reason: "event-missing" });
  });

  it("requires full readback equality when persisting recovery", () => {
    const store = new MemoryStore();
    store.set = (_key, value) => {
      store.values.set(PENDING_DELIVERY_KEY, {
        ...(value as PendingDelivery),
        recipient: `0x${"77".repeat(20)}`,
      });
    };
    expect(savePendingDelivery(store, pending)).toBe(false);
  });

  it("allows explicit cleanup only after the recovery record is old", () => {
    expect(pendingDeliveryIsStale(pending, pending.createdAt + 1_000)).toBe(false);
    expect(pendingDeliveryIsStale(pending, pending.createdAt + 24 * 60 * 60 * 1000)).toBe(true);
  });
});
