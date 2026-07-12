import { beforeEach, describe, expect, it, vi } from "vitest";

import { BLOCKCHAIN_CONSTANTS } from "../constants";
import {
  CUSTOM_ANCHOR_BINDINGS,
  CUSTOM_ANCHOR_PENDING_KEY,
  assertAnchorStorage,
  formatAnchorFixed,
  isPendingAnchorOperation,
  parseAnchorInteger,
  pendingAnchorEventsMatch,
  persistPendingAnchorOperation,
  readAnchorTransactionOutcome,
  readPendingAnchorOperation,
  type AnchorStorage,
  type PendingAnchorOperation,
} from "../../custom-anchor/src/anchor-production";

const WALLET = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const ANCHOR = CUSTOM_ANCHOR_BINDINGS.testnet.contractHash;
const AA_CORE = "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2";
const TXID = `0x${"ab".repeat(32)}`;

class MemoryStorage implements AnchorStorage {
  values = new Map<string, unknown>();
  get<T>(key: string, fallback: T | null = null): T | null {
    return this.values.has(key) ? this.values.get(key) as T : fallback;
  }
  set(key: string, value: unknown) { this.values.set(key, structuredClone(value)); }
  delete(key: string) { this.values.delete(key); }
}

function stakePending(overrides: Partial<PendingAnchorOperation> = {}): PendingAnchorOperation {
  return {
    version: 2,
    kind: "stake",
    stage: "stake",
    phase: "broadcast",
    network: "testnet",
    contractHash: ANCHOR,
    aaCoreHash: "",
    walletHash: WALLET,
    txid: TXID,
    intent: {
      anchorAppId: "custom-anchor:team:nonce",
      amountBase: "5",
      beforeValue: "7",
      expectedValue: "12",
    },
    createdAt: 1,
    updatedAt: 2,
    ...overrides,
  };
}

function item(type: string, value: unknown) {
  return { type, value };
}

function notification(contract: string, eventName: string, values: unknown[]) {
  return { contract, eventName, values };
}

describe("custom-anchor production primitives", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("pins the two live PlatformAnchor deployments and update counters", () => {
    expect(CUSTOM_ANCHOR_BINDINGS.mainnet).toEqual({
      contractHash: "0x02beeef6f65c6989a121c0a0e6b23190333edb98",
      updateCounter: 2,
    });
    expect(CUSTOM_ANCHOR_BINDINGS.testnet).toEqual({
      contractHash: "0xab079b4f9a0a2471d136392e25eb8e99898dcad0",
      updateCounter: 0,
    });
  });

  it("rejects malformed integer reads instead of coercing them to zero", () => {
    expect(parseAnchorInteger({ type: "Integer", value: "0" })).toBe(0n);
    expect(parseAnchorInteger({ type: "Integer", value: "not-a-number" })).toBeNull();
    expect(parseAnchorInteger({ type: "ByteString", value: "MA==" })).toBeNull();
    expect(parseAnchorInteger({ nope: true })).toBeNull();
    expect(parseAnchorInteger(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(formatAnchorFixed(100000001n)).toBe("1.00000001");
  });

  it("round-trips a valid pending intent and reports corrupted storage without deleting it", () => {
    const storage = new MemoryStorage();
    assertAnchorStorage(storage);
    const pending = stakePending();
    expect(isPendingAnchorOperation(pending)).toBe(true);
    persistPendingAnchorOperation(storage, pending);
    expect(readPendingAnchorOperation(storage)).toEqual({ pending, corrupted: false });

    storage.set(CUSTOM_ANCHOR_PENDING_KEY, { version: 2, kind: "stake", txid: "bad" });
    expect(readPendingAnchorOperation(storage)).toEqual({ pending: null, corrupted: true });
    expect(storage.get(CUSTOM_ANCHOR_PENDING_KEY, null)).not.toBeNull();
  });

  it("fails the storage probe before any write workflow can begin", () => {
    const broken: AnchorStorage = {
      get: <T,>(_key: string, fallback: T | null = null) => fallback,
      set: () => { throw new Error("quota denied"); },
      delete: () => undefined,
    };
    expect(() => assertAnchorStorage(broken)).toThrow("anchorRecoveryStorageUnavailable");
  });

  it("requires phase and txid to agree and binds every pending intent to the pinned contract", () => {
    expect(isPendingAnchorOperation(stakePending({ phase: "prepared", txid: "" }))).toBe(true);
    expect(isPendingAnchorOperation(stakePending({ phase: "prepared" }))).toBe(false);
    expect(isPendingAnchorOperation(stakePending({ contractHash: CUSTOM_ANCHOR_BINDINGS.mainnet.contractHash }))).toBe(false);
    expect(isPendingAnchorOperation(stakePending({ walletHash: `0x${"0".repeat(40)}` }))).toBe(false);
  });

  it("requires both the exact NEO transfer and exact AnchorStakeChanged event", () => {
    const pending = stakePending();
    const outcome = {
      state: "halt" as const,
      notifications: [
        notification(BLOCKCHAIN_CONSTANTS.NEO_HASH, "Transfer", [
          item("Hash160", WALLET),
          item("Hash160", ANCHOR),
          item("Integer", "5"),
        ]),
        notification(ANCHOR, "AnchorStakeChanged", [
          item("String", pending.intent.anchorAppId),
          item("Hash160", WALLET),
          item("Integer", "12"),
          item("Integer", "42"),
        ]),
      ],
    };
    expect(pendingAnchorEventsMatch(pending, outcome)).toBe(true);
    const wrongAmount = structuredClone(outcome);
    wrongAmount.notifications[1]!.values[2] = item("Integer", "11");
    expect(pendingAnchorEventsMatch(pending, wrongAmount)).toBe(false);
    expect(pendingAnchorEventsMatch(pending, { state: "fault", notifications: outcome.notifications })).toBe(false);
  });

  it("requires all 21 exact AccountRegistered events for the AA stage", () => {
    const accounts = Array.from({ length: 21 }, (_, index) => `0x${(index + 1).toString(16).padStart(40, "0")}`);
    const candidates = Array.from({ length: 21 }, (_, index) => `02${(index + 1).toString(16).padStart(64, "0")}`);
    const pending: PendingAnchorOperation = {
      version: 2,
      kind: "register",
      stage: "register-accounts",
      phase: "broadcast",
      network: "testnet",
      contractHash: ANCHOR,
      aaCoreHash: AA_CORE,
      walletHash: WALLET,
      txid: TXID,
      intent: { anchorAppId: "custom-anchor:team:nonce", mode: 2, agentAccounts: accounts, candidateKeys: candidates },
      createdAt: 1,
      updatedAt: 2,
    };
    expect(isPendingAnchorOperation(pending)).toBe(true);
    expect(isPendingAnchorOperation({ ...pending, aaCoreHash: `0x${"fe".repeat(20)}` })).toBe(false);
    const events = accounts.map((account) => notification(AA_CORE, "AccountRegistered", [
      item("Hash160", account),
      item("Hash160", WALLET),
      item("Hash160", `0x${"0".repeat(40)}`),
      item("Hash160", `0x${"0".repeat(40)}`),
    ]));
    expect(pendingAnchorEventsMatch(pending, { state: "halt", notifications: events })).toBe(true);
    expect(pendingAnchorEventsMatch(pending, { state: "halt", notifications: events.slice(0, 20) })).toBe(false);
  });

  it("classifies VM FAULT, unavailable, and HALT outcomes without treating RPC errors as success", async () => {
    const response = (payload: unknown, ok = true) => ({ ok, json: async () => payload }) as Response;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(response({ result: { executions: [{ vmstate: "FAULT", notifications: [] }] } }))
      .mockResolvedValueOnce(response({ error: { code: -100, message: "Unknown transaction" } }))
      .mockResolvedValueOnce(response({ result: { executions: [{ vmstate: "HALT", notifications: [] }] } }));

    expect((await readAnchorTransactionOutcome("testnet", TXID, fetcher)).state).toBe("fault");
    expect((await readAnchorTransactionOutcome("testnet", TXID, fetcher)).state).toBe("unknown");
    expect((await readAnchorTransactionOutcome("testnet", TXID, fetcher)).state).toBe("halt");
    expect((await readAnchorTransactionOutcome("testnet", "bad", fetcher)).state).toBe("unknown");
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
});
