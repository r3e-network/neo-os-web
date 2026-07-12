import { describe, expect, it, vi } from "vitest";

import {
  MEMORIAL_SHRINE_CONTRACTS,
  assertMemorialRecoveryStorage,
  createdMemorialIdFromOutcome,
  isPendingMemorialWrite,
  memorialReadbackMatches,
  normalizeMemorialWallet,
  parseMemorialInteger,
  persistPendingMemorialWrite,
  readMemorialTransactionOutcome,
  readPendingMemorialWrite,
  tributeEventMatches,
  tributeReadbackMatches,
  type MemorialRecoveryStorage,
  type PendingMemorialWrite,
} from "../../memorial-shrine/src/logic/memorial-production";

const WALLET = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";
const WALLET_HASH = normalizeMemorialWallet(WALLET)!.hash;
const TXID = `0x${"ab".repeat(32)}`;

function createPending(): PendingMemorialWrite {
  return {
    version: 1,
    network: "testnet",
    contractHash: MEMORIAL_SHRINE_CONTRACTS.testnet,
    wallet: WALLET,
    walletHash: WALLET_HASH,
    txid: TXID,
    intent: {
      kind: "create",
      beforeMemorialCount: "36",
      name: "Loved one",
      photoHash: "",
      relationship: "Family",
      birthYear: 1940,
      deathYear: 2020,
      biography: "Remembered with warmth.",
      obituary: "Always remembered.",
    },
    createdAt: 1_800_000_000_000,
  };
}

function mapStorage(setFails = false): {
  storage: MemorialRecoveryStorage;
  data: Map<string, unknown>;
} {
  const data = new Map<string, unknown>();
  return {
    data,
    storage: {
      get: <T,>(key: string, fallback?: T | null) =>
        (data.has(key) ? data.get(key) : fallback ?? null) as T | null,
      set: (key: string, value: unknown) => {
        if (setFails) throw new Error("storage denied");
        data.set(key, value);
      },
      delete: (key: string) => { data.delete(key); },
    },
  };
}

function hashStack(displayHash: string) {
  const chainHex = displayHash
    .replace(/^0x/, "")
    .match(/.{2}/g)!
    .reverse()
    .join("");
  return { type: "ByteString", value: Buffer.from(chainHex, "hex").toString("base64") };
}

function textStack(value: string) {
  return { type: "ByteString", value: Buffer.from(value, "utf8").toString("base64") };
}

describe("Memorial Shrine production transaction evidence", () => {
  it("requires a durable storage round trip before writes and preserves an exact broadcast record", () => {
    const { storage } = mapStorage();
    const pending = createPending();

    expect(() => assertMemorialRecoveryStorage(storage)).not.toThrow();
    persistPendingMemorialWrite(storage, "testnet", pending);
    expect(readPendingMemorialWrite(storage, "testnet")).toEqual({
      pending,
      corrupted: false,
    });

    const blocked = mapStorage(true);
    expect(() => assertMemorialRecoveryStorage(blocked.storage)).toThrow(
      "recoveryStorageUnavailable",
    );
  });

  it("rejects a recovery record whose network, contract, wallet, txid, or intent is not exact", () => {
    const pending = createPending();
    expect(isPendingMemorialWrite(pending)).toBe(true);
    expect(isPendingMemorialWrite({ ...pending, contractHash: MEMORIAL_SHRINE_CONTRACTS.mainnet })).toBe(false);
    expect(isPendingMemorialWrite({ ...pending, walletHash: `0x${"11".repeat(20)}` })).toBe(false);
    expect(isPendingMemorialWrite({ ...pending, txid: "0xshort" })).toBe(false);
    expect(isPendingMemorialWrite({
      ...pending,
      intent: { ...pending.intent, beforeMemorialCount: "not-an-integer" },
    })).toBe(false);
    expect(isPendingMemorialWrite({
      ...pending,
      intent: { ...pending.intent, photoHash: "local portrait" },
    })).toBe(false);
    expect(isPendingMemorialWrite({
      ...pending,
      intent: { ...pending.intent, birthYear: 2021, deathYear: 2020 },
    })).toBe(false);
  });

  it("parses the live getapplicationlog shape and keeps FAULT and unavailable distinct", async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: {
          executions: [{
            vmstate: "HALT",
            notifications: [{
              contract: MEMORIAL_SHRINE_CONTRACTS.testnet,
              eventname: "MemorialCreated",
              state: {
                type: "Array",
                value: [
                  { type: "Integer", value: "37" },
                  hashStack(WALLET_HASH),
                  textStack("Loved one"),
                  { type: "Integer", value: "2020" },
                ],
              },
            }],
          }],
        },
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        result: { executions: [{ vmstate: "FAULT, BREAK", notifications: [] }] },
      }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("offline"));

    const halted = await readMemorialTransactionOutcome("testnet", TXID, fetcher);
    expect(halted.state).toBe("halt");
    expect(createdMemorialIdFromOutcome(createPending(), halted)).toBe(37);
    await expect(readMemorialTransactionOutcome("testnet", TXID, fetcher)).resolves.toEqual({
      state: "fault",
      notifications: [],
    });
    await expect(readMemorialTransactionOutcome("testnet", TXID, fetcher)).resolves.toEqual({
      state: "unknown",
      notifications: [],
    });
  });

  it("requires the exact event and every authoritative create readback field", () => {
    const pending = createPending();
    const outcome = {
      state: "halt" as const,
      notifications: [{
        contract: pending.contractHash,
        eventName: "MemorialCreated",
        values: [37, pending.walletHash, "Loved one", 2020],
      }],
    };
    expect(createdMemorialIdFromOutcome(pending, outcome)).toBe(37);
    expect(createdMemorialIdFromOutcome(pending, {
      ...outcome,
      notifications: [{ ...outcome.notifications[0], values: [37, pending.walletHash, "Someone else", 2020] }],
    })).toBeNull();

    const readback = {
      id: 37,
      creator: pending.walletHash,
      deceasedName: "Loved one",
      photoHash: "",
      relationship: "Family",
      birthYear: 1940,
      deathYear: 2020,
      biography: "Remembered with warmth.",
      obituary: "Always remembered.",
    };
    expect(memorialReadbackMatches(readback, pending, 37)).toBe(true);
    expect(memorialReadbackMatches({ ...readback, obituary: "different" }, pending, 37)).toBe(false);
  });

  it("binds tribute confirmation to memorial, wallet, offering, message, and a new readback record", () => {
    const pending: PendingMemorialWrite = {
      ...createPending(),
      intent: {
        kind: "tribute",
        memorialId: 9,
        offeringType: 3,
        message: "Always remembered",
        amountFixed8: "3000000",
        receiptId: "",
        beforeTributeCount: "4",
      },
    };
    const outcome = {
      state: "halt" as const,
      notifications: [{
        contract: pending.contractHash,
        eventName: "TributePaid",
        values: [9, pending.walletHash, 3],
      }],
    };
    expect(tributeEventMatches(pending, outcome)).toBe(true);
    expect(tributeEventMatches(pending, {
      ...outcome,
      notifications: [{ ...outcome.notifications[0], values: [9, pending.walletHash, 4] }],
    })).toBe(false);
    expect(tributeReadbackMatches({
      id: 51,
      memorialId: 9,
      visitor: pending.walletHash,
      offeringType: 3,
      message: "Always remembered",
    }, pending)).toBe(true);
    expect(tributeReadbackMatches({
      id: 51,
      memorialId: 9,
      visitor: pending.walletHash,
      offeringType: 3,
      message: "different",
    }, pending)).toBe(false);
  });

  it("never parses malformed or unsafe integer reads as zero", () => {
    expect(parseMemorialInteger(undefined)).toBeNull();
    expect(parseMemorialInteger("not-a-number")).toBeNull();
    expect(parseMemorialInteger(Number.MAX_SAFE_INTEGER + 1)).toBeNull();
    expect(parseMemorialInteger("0")).toBe(0n);
  });
});
