import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  GOV_MERC_PENDING_KEY,
  assertGovMercRecoveryStorage,
  buildPendingGovMercOperation,
  govMercEventMatches,
  govMercReadbackSatisfied,
  readGovMercTransactionOutcome,
  readPendingGovMercOperation,
  writePendingGovMercOperation,
  type PendingGovMercDraft,
} from "./gov-merc-production";

const CONTRACT = "0x140f5faf5692d21421a79278b0e45b9b9bd4bb46";
const ACTOR = "0xa5de523ae9d99be784a536e9412b7a3cbe049e1a";
const TXID = `0x${"a".repeat(64)}`;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, String(value)); }
}

const draft = (kind: PendingGovMercDraft["kind"] = "deposit"): PendingGovMercDraft => ({
  kind,
  network: "mainnet",
  contractHash: CONTRACT,
  actorHash: ACTOR,
  epoch: 7,
  amountRaw: kind === "deposit" ? "3" : "200000000",
  ...(kind === "bid" ? { fundingAmountRaw: "100000000" } : {}),
  beforeStakeRaw: "10",
  beforeBidRaw: "100000000",
  beforeEpoch: 7,
  beforeRewardsRaw: "500000000",
  beforeCreditRaw: "100000000",
});

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

describe("Gov Merc durable operation journal", () => {
  it("round-trips an exact binding-scoped transaction record", () => {
    const record = buildPendingGovMercOperation(draft(), TXID);
    writePendingGovMercOperation(record);
    expect(readPendingGovMercOperation()).toEqual(record);
    expect(localStorage.getItem(GOV_MERC_PENDING_KEY)).toContain(TXID);
    writePendingGovMercOperation(null);
    expect(readPendingGovMercOperation()).toBeNull();
  });

  it("fails storage preflight when durable readback cannot be proven", () => {
    const broken = new MemoryStorage();
    vi.spyOn(broken, "getItem").mockReturnValue(null);
    expect(() => assertGovMercRecoveryStorage(broken)).toThrow("recoveryStorageUnavailable");
  });

  it("rejects malformed transaction ids and zero-value operations", () => {
    expect(() => buildPendingGovMercOperation(draft(), "0x1234")).toThrow("invalidGovMercPendingOperation");
    expect(() => buildPendingGovMercOperation({ ...draft(), amountRaw: "0" }, TXID)).toThrow(
      "invalidGovMercPendingOperation",
    );
    expect(() => buildPendingGovMercOperation({ ...draft(), actorHash: "not-an-address" }, TXID)).toThrow(
      "invalidGovMercPendingOperation",
    );
  });
});

describe("Gov Merc exact event and readback matching", () => {
  it("requires the contract, event parameters and resulting stake to match", () => {
    const record = buildPendingGovMercOperation(draft(), TXID);
    const exact = {
      state: "halt" as const,
      notifications: [{
        contract: CONTRACT,
        eventName: "Staked",
        values: [ACTOR, "3", "13"],
      }],
    };
    expect(govMercEventMatches(record, exact)).toBe(true);
    expect(govMercReadbackSatisfied(record, { stakeRaw: "13" })).toBe(true);
    expect(govMercEventMatches(record, {
      ...exact,
      notifications: [{ ...exact.notifications[0]!, contract: `0x${"1".repeat(40)}` }],
    })).toBe(false);
    expect(govMercReadbackSatisfied(record, { stakeRaw: "10" })).toBe(false);
  });

  it("distinguishes bid payment credit from the consuming bid action", () => {
    const record = buildPendingGovMercOperation(draft("bid"), TXID, {
      stage: "payment",
      paymentTxid: TXID,
    });
    expect(govMercEventMatches(record, {
      state: "halt",
      notifications: [{
        contract: CONTRACT,
        eventName: "Credited",
        values: [ACTOR, "100000000", "200000000"],
      }],
    })).toBe(true);
    expect(govMercReadbackSatisfied(record, {
      bidRaw: "100000000",
      creditRaw: "200000000",
    })).toBe(true);
  });
});

describe("Gov Merc VM outcome reader", () => {
  it.each([
    ["FAULT, BREAK", "fault"],
    ["HALT", "halt"],
  ] as const)("classifies %s without conflating relay and completion", async (vmstate, expected) => {
    const record = buildPendingGovMercOperation(draft(), TXID);
    const response = {
      ok: true,
      json: async () => ({
        result: {
          executions: [{
            vmstate,
            notifications: vmstate === "HALT" ? [{
              contract: CONTRACT,
              eventname: "Staked",
              state: { type: "Array", value: [
                { type: "ByteString", value: "Gl4EvrOgK5TpNkqEeZuZ6TpS3qU=" },
                { type: "Integer", value: "3" },
                { type: "Integer", value: "13" },
              ] },
            }] : [],
          }],
        },
      }),
    };
    vi.stubGlobal("fetch", vi.fn(async () => response));
    const outcome = await readGovMercTransactionOutcome(record);
    expect(outcome.state).toBe(expected);
  });

  it("keeps missing application logs unknown", async () => {
    const record = buildPendingGovMercOperation(draft(), TXID);
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ error: { code: -100 } }) })));
    await expect(readGovMercTransactionOutcome(record)).resolves.toEqual({ state: "unknown", notifications: [] });
  });
});
