import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "../constants";
import {
  isQuadraticPendingOperation,
  matchesQuadraticPendingEvent,
  useQuadraticPending,
  type QuadraticPendingOperation,
} from "../../quadratic-funding/src/composables/quadraticPending";

const OWNER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0xe2fba2a73cf92874ecc41b7fff8d3d5da0354c43";
const TXID = `0x${"a".repeat(64)}`;

function contributionPending(overrides: Partial<QuadraticPendingOperation> = {}): QuadraticPendingOperation {
  return {
    version: 1,
    phase: "action",
    reservationId: "test-reservation",
    kind: "contribute",
    eventName: "ContributionMade",
    txid: TXID,
    network: "neo-n3-testnet",
    contract: CONTRACT,
    wallet: OWNER,
    roundId: "3",
    projectId: "7",
    asset: "GAS",
    assetHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
    amount: "50000000",
    expectedAfter: "150000000",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

function contributionEvent(txid = TXID) {
  return {
    event_name: "ContributionMade",
    tx_hash: txid,
    state: [
      { value: "3" },
      { value: "7" },
      { value: addressToScriptHash(OWNER) },
      { value: "50000000" },
    ],
  };
}

describe("quadratic-funding durable pending transaction recovery", () => {
  it("reserves the single write journal atomically and rejects stale writers", async () => {
    const stored = createObservable<QuadraticPendingOperation | null>(null);
    const app = {
      state: { persisted: () => stored },
      chain: {
        address: createObservable(OWNER),
        contractAddress: createObservable(CONTRACT),
        detectNetwork: vi.fn(async () => "neo-n3-testnet"),
      },
    };
    const tracker = useQuadraticPending(app as never);
    const first = tracker.reserve();
    expect(first).toBeTruthy();
    expect(tracker.reserve()).toBeNull();

    const draft = await tracker.prepare(first!, {
      kind: "contribute",
      eventName: "ContributionMade",
      wallet: OWNER,
      roundId: "3",
      projectId: "7",
      asset: "GAS",
      assetHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
      amount: "50000000",
      expectedAfter: "150000000",
    });
    expect(tracker.persistBroadcast("stale", draft, TXID)).toBe(false);
    expect(stored.get()?.phase).toBe("prepared");
    const depositTxid = `0x${"d".repeat(64)}`;
    expect(tracker.persistDeposit(first!, draft, depositTxid)).toBe(true);
    expect(stored.get()).toEqual(expect.objectContaining({
      phase: "deposit",
      txid: depositTxid,
      depositTxid,
    }));
    expect(tracker.persistBroadcast(first!, draft, TXID)).toBe(true);
    expect(stored.get()).toEqual(expect.objectContaining({
      phase: "action",
      txid: TXID,
      depositTxid,
    }));

    tracker.release(first!);
    const oldTxid = TXID;
    tracker.clear();
    const second = tracker.reserve();
    expect(second).toBeTruthy();
    const secondDraft = await tracker.prepare(second!, {
      kind: "cancel-round",
      eventName: "RoundCancelled",
      wallet: OWNER,
      roundId: "3",
    });
    const secondTxid = `0x${"b".repeat(64)}`;
    tracker.persistBroadcast(second!, secondDraft, secondTxid);
    expect(tracker.clear(oldTxid)).toBe(false);
    expect(stored.get()?.txid).toBe(secondTxid);
  });

  it("rejects malformed, cross-purpose persisted records", () => {
    expect(isQuadraticPendingOperation(contributionPending())).toBe(true);
    expect(isQuadraticPendingOperation(contributionPending({ eventName: "RoundFinalized" }))).toBe(false);
    expect(isQuadraticPendingOperation(contributionPending({ txid: "0xcontribute" }))).toBe(false);
    expect(isQuadraticPendingOperation(contributionPending({ expectedAfter: undefined }))).toBe(false);
    expect(isQuadraticPendingOperation(contributionPending({ assetHash: "GAS" }))).toBe(false);
  });

  it("keeps interrupted deposit and pre-broadcast phases locked for explicit review", async () => {
    for (const record of [
      contributionPending({ phase: "prepared", txid: "", depositTxid: undefined }),
      contributionPending({ phase: "deposit", depositTxid: TXID }),
    ]) {
      const stored = createObservable<QuadraticPendingOperation | null>(record);
      const app = {
        state: { persisted: () => stored },
        chain: {
          address: createObservable(OWNER),
          contractAddress: createObservable(CONTRACT),
          detectNetwork: vi.fn(async () => "neo-n3-testnet"),
        },
      };
      const tracker = useQuadraticPending(app as never);
      await expect(tracker.recover()).resolves.toBe(
        record.phase === "prepared" ? "uncertain" : "deposit-only",
      );
      expect(stored.get()).toEqual(record);
    }
  });

  it("binds recovery to the exact transaction, event payload, wallet and amount", () => {
    const pending = contributionPending();
    expect(matchesQuadraticPendingEvent(pending, contributionEvent())).toBe(true);
    expect(matchesQuadraticPendingEvent(pending, contributionEvent(`0x${"b".repeat(64)}`))).toBe(false);
    expect(matchesQuadraticPendingEvent(pending, {
      ...contributionEvent(),
      state: [{ value: "3" }, { value: "7" }, { value: addressToScriptHash(OWNER) }, { value: "1" }],
    })).toBe(false);
  });

  it("clears the retry lock only after the exact event and matching chain readback", async () => {
    const stored = createObservable<QuadraticPendingOperation | null>(contributionPending());
    const waitFor = vi.fn(async () => contributionEvent());
    const readRaw = vi.fn(async () => "150000000");
    const app = {
      state: { persisted: () => stored },
      events: { waitFor },
      chain: {
        address: createObservable(OWNER),
        contractAddress: createObservable(CONTRACT),
        detectNetwork: vi.fn(async () => "neo-n3-testnet"),
        readRaw,
        arg: {
          hash160: (value: string) => ({ type: "Hash160", value }),
          integer: (value: string) => ({ type: "Integer", value }),
        },
      },
    };

    const tracker = useQuadraticPending(app as never);
    await expect(tracker.recover()).resolves.toBe("recovered");
    expect(stored.get()).toBeNull();
    expect(waitFor).toHaveBeenCalledWith(TXID, "ContributionMade", 1);
    expect(readRaw).toHaveBeenCalledWith("getContribution", [
      { type: "Hash160", value: OWNER },
      { type: "Integer", value: "3" },
      { type: "Integer", value: "7" },
    ]);
  });

  it("retains the lock when the event exists but the resulting state differs", async () => {
    const record = contributionPending();
    const stored = createObservable<QuadraticPendingOperation | null>(record);
    const app = {
      state: { persisted: () => stored },
      events: { waitFor: vi.fn(async () => contributionEvent()) },
      chain: {
        address: createObservable(OWNER),
        contractAddress: createObservable(CONTRACT),
        detectNetwork: vi.fn(async () => "neo-n3-testnet"),
        readRaw: vi.fn(async () => "100000000"),
        arg: {
          hash160: (value: string) => ({ type: "Hash160", value }),
          integer: (value: string) => ({ type: "Integer", value }),
        },
      },
    };

    const tracker = useQuadraticPending(app as never);
    await expect(tracker.recover()).resolves.toBe("readback-mismatch");
    expect(stored.get()).toEqual(record);
  });
});
