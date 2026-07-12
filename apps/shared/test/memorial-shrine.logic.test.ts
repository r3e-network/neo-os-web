import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";
import { useMemorialShrine } from "../../memorial-shrine/src/composables/useMemorialShrine";
import {
  MEMORIAL_OFFERING_COSTS_FIXED8,
  MEMORIAL_SHRINE_CONTRACTS,
  type MemorialTransactionOutcome,
} from "../../memorial-shrine/src/logic/memorial-production";

import { addressToScriptHash } from "../utils/neo";

beforeEach(() => {
  window.localStorage.clear();
});

const OWNER = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";
// Little-endian 0x script hash for OWNER — matches addressToScriptHash and the
// on-chain visitor / creator field the contract stores for this wallet.
const OWNER_SCRIPT_HASH = addressToScriptHash(OWNER);
const CREATE_TXID = `0x${"a1".repeat(32)}`;
const TRIBUTE_TXID = `0x${"b2".repeat(32)}`;
const PAYMENT_TXID = `0x${"c3".repeat(32)}`;

function t(key: string) {
  const messages: Record<string, string> = {
    receiptIdRequired: "Mainnet tribute requires a payment receipt ID.",
  };
  return messages[key] ?? key;
}

/**
 * Build a chain mock backed by an in-memory on-chain store. Reads are answered
 * by the contract getters the composable actually calls; writes record the
 * call and append to the store so the subsequent reconcile read sees them.
 */
function createShrine(options: {
  launchNetwork?: "mainnet" | "testnet" | null;
  connectedAddress?: string | null;
  paymentHub?: unknown;
  transactionState?: "halt" | "unknown" | "fault" | "mismatch";
} = {}) {
  // In-memory contract state.
  const memorialsById = new Map<number, Record<string, unknown>>();
  const tributesById = new Map<number, Record<string, unknown>>();
  // memorialId -> tributeId[]
  const tributesByMemorial = new Map<number, number[]>();
  // visitorHash (lowercased) -> Set<memorialId>
  const visitorMemorials = new Map<string, Set<number>>();
  let nextTributeId = 0;
  let lastWrite: {
    kind: "create" | "tribute";
    memorialId: number;
    offeringType?: number;
    name?: string;
    deathYear?: number;
  } | null = null;

  const read = vi.fn(async (operation: string, args?: Array<{ value: unknown }>) => {
    switch (operation) {
      case "getMemorialCount":
        return memorialsById.size;
      case "isPaused":
        return false;
      case "paymentHub":
        return Object.prototype.hasOwnProperty.call(options, "paymentHub")
          ? options.paymentHub
          : `0x${"22".repeat(20)}`;
      case "getOfferingCost":
        return MEMORIAL_OFFERING_COSTS_FIXED8[
          Number(args?.[0]?.value) as keyof typeof MEMORIAL_OFFERING_COSTS_FIXED8
        ] ?? null;
      case "getMemorialTributeCount": {
        const memorialId = Number(args?.[0]?.value);
        return (tributesByMemorial.get(memorialId) ?? []).length;
      }
      case "getMemorialTributeAt": {
        const memorialId = Number(args?.[0]?.value);
        const index = Number(args?.[1]?.value);
        return (tributesByMemorial.get(memorialId) ?? [])[index] ?? 0;
      }
      case "getMemorialDetails": {
        const id = Number(args?.[0]?.value);
        return memorialsById.get(id) ?? {};
      }
      case "getRecentObituaries":
        return [...memorialsById.keys()].sort((a, b) => b - a);
      case "getVisitorMemorials": {
        const hash = String(args?.[0]?.value ?? "").toLowerCase();
        return [...(visitorMemorials.get(hash) ?? [])];
      }
      case "getMemorialTributes": {
        const memorialId = Number(args?.[0]?.value);
        const offset = Number(args?.[1]?.value ?? 0);
        const limit = Number(args?.[2]?.value ?? Number.MAX_SAFE_INTEGER);
        return [...(tributesByMemorial.get(memorialId) ?? [])].slice(offset, offset + limit);
      }
      case "getTributeDetails": {
        const tributeId = Number(args?.[0]?.value);
        return tributesById.get(tributeId) ?? {};
      }
      default:
        return null;
    }
  });

  const invoke = vi.fn(async (
    operation: string,
    callArgs: Array<{ value: unknown }>,
    invokeOptions?: { onTransactionSent?: (txid: string) => void },
  ) => {
    if (operation === "createMemorial") {
      const id = memorialsById.size + 1;
      memorialsById.set(id, {
        id,
        creator: OWNER_SCRIPT_HASH,
        deceasedName: String(callArgs[1]?.value ?? ""),
        photoHash: String(callArgs[2]?.value ?? ""),
        relationship: String(callArgs[3]?.value ?? ""),
        birthYear: Number(callArgs[4]?.value ?? 0),
        deathYear: Number(callArgs[5]?.value ?? 0),
        biography: String(callArgs[6]?.value ?? ""),
        obituary: String(callArgs[7]?.value ?? ""),
        lastTributeTime: 0,
        incenseCount: 0, candleCount: 0, flowerCount: 0,
        fruitCount: 0, wineCount: 0, feastCount: 0,
      });
      lastWrite = {
        kind: "create",
        memorialId: id,
        name: String(callArgs[1]?.value ?? ""),
        deathYear: Number(callArgs[5]?.value ?? 0),
      };
      invokeOptions?.onTransactionSent?.(CREATE_TXID);
      return { txid: CREATE_TXID, success: true, verified: true };
    }
    // Mainnet payTribute path.
    if (operation === "payTribute") {
      const result = recordTribute(callArgs);
      invokeOptions?.onTransactionSent?.(TRIBUTE_TXID);
      return result;
    }
    return { txid: CREATE_TXID, success: true, verified: true };
  });

  const invokeWithPayment = vi.fn(
    async (
      _amount: string,
      _memo: string,
      _operation: string,
      callArgs: Array<{ value: unknown }>,
      invokeOptions?: {
        onPaymentSent?: (txid: string) => void;
        onTransactionSent?: (txid: string) => void;
      },
    ) => {
      invokeOptions?.onPaymentSent?.(PAYMENT_TXID);
      const result = recordTribute(callArgs);
      invokeOptions?.onTransactionSent?.(TRIBUTE_TXID);
      return result;
    },
  );

  function seedMemorial(over: Partial<Record<string, unknown>> = {}) {
    const id = memorialsById.size + 1;
    memorialsById.set(id, {
      id,
      creator: OWNER_SCRIPT_HASH,
      deceasedName: `Memorial ${id}`,
      photoHash: "",
      relationship: "friend",
      birthYear: 1950,
      deathYear: 2024,
      biography: "",
      obituary: "",
      lastTributeTime: 0,
      incenseCount: 0, candleCount: 0, flowerCount: 0,
      fruitCount: 0, wineCount: 0, feastCount: 0,
      ...over,
    });
    return id;
  }

  function recordTribute(callArgs: Array<{ value: unknown }>) {
    const visitorHash = OWNER_SCRIPT_HASH.toLowerCase();
    const memorialId = Number(callArgs[1]?.value);
    const offeringType = Number(callArgs[2]?.value);
    const tributeId = ++nextTributeId;
    tributesById.set(tributeId, {
      id: tributeId,
      memorialId,
      visitor: OWNER_SCRIPT_HASH,
      offeringType,
      offeringName: "",
      message: String(callArgs[3]?.value ?? ""),
      timestamp: 1_700_000_000_000 + tributeId,
    });
    const list = tributesByMemorial.get(memorialId) ?? [];
    list.push(tributeId);
    tributesByMemorial.set(memorialId, list);
    const set = visitorMemorials.get(visitorHash) ?? new Set<number>();
    set.add(memorialId);
    visitorMemorials.set(visitorHash, set);
    lastWrite = { kind: "tribute", memorialId, offeringType };
    return {
      txid: TRIBUTE_TXID,
      success: true,
      verified: true,
    };
  }

  const transactionReader = vi.fn(async (): Promise<MemorialTransactionOutcome> => {
    if (options.transactionState === "unknown") return { state: "unknown", notifications: [] };
    if (options.transactionState === "fault") return { state: "fault", notifications: [] };
    if (!lastWrite) return { state: "unknown", notifications: [] };
    const contract = MEMORIAL_SHRINE_CONTRACTS[options.launchNetwork ?? "testnet"];
    return lastWrite.kind === "create"
      ? {
          state: "halt",
          notifications: [{
            contract,
            eventName: "MemorialCreated",
            values: [
              lastWrite.memorialId,
              OWNER_SCRIPT_HASH,
              options.transactionState === "mismatch" ? "Different memorial" : lastWrite.name,
              lastWrite.deathYear,
            ],
          }],
        }
      : {
          state: "halt",
          notifications: [{
            contract,
            eventName: "TributePaid",
            values: [lastWrite.memorialId, OWNER_SCRIPT_HASH, lastWrite.offeringType],
          }],
        };
  });

  const chain = {
    address: createObservable<string | null>(
      options.connectedAddress === undefined ? OWNER : options.connectedAddress,
    ),
    ensureWallet: vi.fn().mockResolvedValue(OWNER),
    detectNetwork: vi.fn().mockResolvedValue(`neo-n3-${options.launchNetwork ?? "testnet"}`),
    contractAddress: createObservable<string | null>(
      MEMORIAL_SHRINE_CONTRACTS[options.launchNetwork ?? "testnet"],
    ),
    read,
    invoke,
    invokeWithPayment,
  };

  // The composable now consumes the MiniApp framework; its arg builders and raw
  // passthroughs are behavior-preserving, so every recorded chain call matches.
  // storagePrefix pins app.storage.local to the legacy runtime-cache namespace
  // (defineMiniApp does the same), so the visited store still lives at the
  // exact pre-framework "memorial-shrine-visited" localStorage key.
  const framework = createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-memorial-shrine", storagePrefix: "memorial-shrine-" },
  );
  const shrine = useMemorialShrine({
    app: framework,
    launchNetwork: options.launchNetwork ?? "testnet",
    t,
    transactionReader,
  });
  return { shrine, chain, memorialsById, tributesById, seedMemorial, transactionReader };
}

describe("Memorial Shrine logic", () => {
  it("creates memorials with the deployed createMemorial ABI", async () => {
    const { shrine, chain } = createShrine();

    await shrine.createMemorial({
      name: "Loved one",
      photoHash: "ipfs://bafybeigdyrztfixture234567abcdefghijklmnop",
      relationship: "mentor",
      birthYear: 1950,
      deathYear: 2024,
      biography: "A generous builder",
      obituary: "Always remembered",
    });

    expect(chain.invoke).toHaveBeenCalledWith(
      "createMemorial",
      [
        { type: "Hash160", value: OWNER },
        { type: "String", value: "Loved one" },
        { type: "String", value: "ipfs://bafybeigdyrztfixture234567abcdefghijklmnop" },
        { type: "String", value: "mentor" },
        { type: "Integer", value: "1950" },
        { type: "Integer", value: "2024" },
        { type: "String", value: "A generous builder" },
        { type: "String", value: "Always remembered" },
      ],
      expect.objectContaining({
        scriptHash: MEMORIAL_SHRINE_CONTRACTS.testnet,
        waitForEvent: "MemorialCreated",
        waitTimeoutMs: 45_000,
        onTransactionSent: expect.any(Function),
      }),
    );
    // The result of the confirmed write is surfaced through lastTx.
    expect(shrine.lastTx.get()).toMatchObject({ txid: CREATE_TXID });
    // The created memorial is reloaded straight from the contract.
    expect(shrine.memorials.get()).toHaveLength(1);
    expect(shrine.memorials.get()[0]).toMatchObject({ id: 1, name: "Loved one" });
  });

  it("loads the memorial + obituary catalog from contract getters", async () => {
    const { shrine, chain } = createShrine();

    await shrine.createMemorial({
      name: "First", photoHash: "", relationship: "friend",
      birthYear: 1940, deathYear: 2020, biography: "bio one", obituary: "rest one",
    });
    await shrine.loadMemorials();

    // Reads go to the contract getters, never to any OS storage proxy.
    const reads = chain.read.mock.calls.map((call) => call[0]);
    expect(reads).toContain("getMemorialCount");
    expect(reads).toContain("getMemorialDetails");
    expect(reads).toContain("getRecentObituaries");
    expect(shrine.obituaryCount.get()).toBe(1);
    expect(shrine.recentObituaries.get()[0]).toMatchObject({ id: 1, name: "First", text: "rest one" });
  });

  it("preserves the verified catalog when a refresh RPC fails", async () => {
    const { shrine, chain, seedMemorial } = createShrine();
    seedMemorial({ deceasedName: "Verified memorial" });
    await shrine.loadMemorials();
    expect(shrine.memorials.get()).toHaveLength(1);

    chain.read.mockRejectedValueOnce(new Error("rpc offline"));
    await expect(shrine.loadMemorials()).resolves.toBe(false);

    expect(shrine.catalogStatus.get()).toBe("error");
    expect(shrine.memorials.get()[0]?.name).toBe("Verified memorial");
  });

  it("treats malformed memorial integers as unavailable instead of synthetic zeroes", async () => {
    const { shrine, seedMemorial } = createShrine();
    seedMemorial({ incenseCount: "not-an-integer" });

    await expect(shrine.loadMemorials()).resolves.toBe(false);

    expect(shrine.catalogStatus.get()).toBe("error");
    expect(shrine.memorials.get()).toEqual([]);
  });

  it("loads the newest capped memorial window when the chain count grows past the UI cap", async () => {
    const { shrine, seedMemorial } = createShrine();
    for (let index = 0; index < 61; index += 1) seedMemorial();

    await expect(shrine.loadMemorials()).resolves.toBe(true);

    expect(shrine.memorials.get()).toHaveLength(60);
    expect(shrine.memorials.get()[0]?.id).toBe(61);
    expect(shrine.memorials.get().at(-1)?.id).toBe(2);
  });

  it("rejects invalid memorial drafts before requesting the wallet", async () => {
    const { shrine, chain } = createShrine();
    await expect(shrine.createMemorial({
      name: "Loved one",
      photoHash: "not a usable photo reference",
      relationship: "family",
      birthYear: 1950,
      deathYear: 2024,
      biography: "",
      obituary: "",
    })).rejects.toThrow("photoInvalid");
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("rejects unknown offerings before requesting the wallet", async () => {
    const { shrine, chain } = createShrine();
    await expect(shrine.payTribute(1, 99, "Unknown offering")).rejects.toThrow(
      "invalidOffering",
    );
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("persists the exact intent, network, contract, wallet, and txid at broadcast", async () => {
    const { shrine } = createShrine({ transactionState: "unknown" });
    const result = await shrine.createMemorial({
      name: "Saved intent",
      photoHash: "",
      relationship: "Family",
      birthYear: 1940,
      deathYear: 2020,
      biography: "Remembered with warmth.",
      obituary: "Always remembered.",
    });

    expect(result).toEqual({ txid: CREATE_TXID, confirmed: false });
    expect(shrine.pendingWrite.get()).toMatchObject({
      network: "testnet",
      contractHash: MEMORIAL_SHRINE_CONTRACTS.testnet,
      wallet: OWNER,
      walletHash: OWNER_SCRIPT_HASH,
      txid: CREATE_TXID,
      intent: {
        kind: "create",
        beforeMemorialCount: "0",
        name: "Saved intent",
      },
    });
    expect(JSON.parse(
      window.localStorage.getItem("memorial-shrine-pending-write/v1/testnet") ?? "null",
    )).toMatchObject({ txid: CREATE_TXID, walletHash: OWNER_SCRIPT_HASH });
    expect(shrine.writePhase.get()).toBe("broadcast");
  });

  it("restores and checks a saved transaction on refresh without replaying the write", async () => {
    const pending = {
      version: 1,
      network: "testnet",
      contractHash: MEMORIAL_SHRINE_CONTRACTS.testnet,
      wallet: OWNER,
      walletHash: OWNER_SCRIPT_HASH,
      txid: CREATE_TXID,
      intent: {
        kind: "create",
        beforeMemorialCount: "0",
        name: "Saved intent",
        photoHash: "",
        relationship: "Family",
        birthYear: 1940,
        deathYear: 2020,
        biography: "Remembered with warmth.",
        obituary: "Always remembered.",
      },
      createdAt: Date.now(),
    };
    window.localStorage.setItem(
      "memorial-shrine-pending-write/v1/testnet",
      JSON.stringify(pending),
    );
    const { shrine, chain, transactionReader } = createShrine({ transactionState: "unknown" });

    await shrine.loadAll();

    expect(transactionReader).toHaveBeenCalledWith("testnet", CREATE_TXID);
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
    expect(shrine.pendingWrite.get()?.txid).toBe(CREATE_TXID);
  });

  it("separates VM FAULT and exact-event mismatch from a confirmed write", async () => {
    const faulted = createShrine({ transactionState: "fault" });
    await expect(faulted.shrine.createMemorial({
      name: "Faulted",
      photoHash: "",
      relationship: "",
      birthYear: "",
      deathYear: "",
      biography: "",
      obituary: "",
    })).resolves.toEqual({ txid: CREATE_TXID, confirmed: false });
    expect(faulted.shrine.pendingWrite.get()).toBeNull();
    expect(faulted.shrine.writePhase.get()).toBe("fault");

    window.localStorage.clear();
    const mismatched = createShrine({ transactionState: "mismatch" });
    await expect(mismatched.shrine.createMemorial({
      name: "Exact name",
      photoHash: "",
      relationship: "",
      birthYear: "",
      deathYear: "",
      biography: "",
      obituary: "",
    })).resolves.toEqual({ txid: CREATE_TXID, confirmed: false });
    expect(mismatched.shrine.pendingWrite.get()).toBeNull();
    expect(mismatched.shrine.writePhase.get()).toBe("event-mismatch");
  });

  it("blocks the currently unconfigured mainnet tribute lane before opening the wallet", async () => {
    const { shrine, chain } = createShrine({ launchNetwork: "mainnet", paymentHub: null });
    await expect(shrine.payTribute(1, 1, "Mainnet remembrance", "77")).rejects.toThrow(
      "mainnetTributeUnavailable",
    );
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("pays testnet tributes through direct prepaid GAS", async () => {
    const { shrine, chain } = createShrine({ launchNetwork: "testnet" });
    await shrine.createMemorial({
      name: "Departed", photoHash: "", relationship: "friend",
      birthYear: 1950, deathYear: 2024, biography: "", obituary: "",
    });

    await shrine.payTribute(1, 3, "Always remembered");

    expect(chain.invokeWithPayment).toHaveBeenCalledWith(
      "3000000",
      "miniapp-memorial-shrine:tribute:1:3",
      "payTribute",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "1" },
        { type: "Integer", value: "3" },
        { type: "String", value: "Always remembered" },
      ],
      expect.objectContaining({
        scriptHash: MEMORIAL_SHRINE_CONTRACTS.testnet,
        waitForEvent: "TributePaid",
        waitTimeoutMs: 45_000,
        onPaymentSent: expect.any(Function),
        onTransactionSent: expect.any(Function),
      }),
    );
    // The paid tribute is reflected immediately (optimistic + reconcile) and
    // the confirmed write is surfaced through lastTx.
    expect(shrine.lastTx.get()).toMatchObject({ txid: TRIBUTE_TXID });
    expect(shrine.myTributes.get()[0]).toMatchObject({
      memorialId: 1,
      offeringType: 3,
      amountGas: "0.03",
    });
  });

  it("reads My Tributes from the contract so it is not aliased to Visited", async () => {
    const { shrine, chain } = createShrine({ launchNetwork: "testnet" });
    await shrine.createMemorial({
      name: "Departed", photoHash: "", relationship: "friend",
      birthYear: 1950, deathYear: 2024, biography: "", obituary: "",
    });

    expect(shrine.tributeCount.get()).toBe(0);

    await shrine.payTribute(1, 3, "Always remembered");

    // "My Tributes" is sourced from the visitor's on-chain tributes, not storage.
    const reads = chain.read.mock.calls.map((call) => call[0]);
    expect(reads).toContain("getVisitorMemorials");
    expect(reads).toContain("getMemorialTributes");
    expect(reads).toContain("getTributeDetails");
    expect(shrine.myTributes.get()).toHaveLength(1);
    expect(shrine.myTributes.get()[0]).toMatchObject({
      memorialId: 1,
      offeringType: 3,
      amountGas: "0.03",
    });
    expect(shrine.tributeCount.get()).toBe(1);
  });

  it("keeps My Tributes at zero when no wallet is connected", async () => {
    const { shrine, chain } = createShrine({ connectedAddress: null });

    await shrine.loadMyTributes();

    // With no wallet connected the visitor lookup is never issued.
    const reads = chain.read.mock.calls.map((call) => call[0]);
    expect(reads).not.toContain("getVisitorMemorials");
    expect(shrine.tributeCount.get()).toBe(0);
  });

  it("uses the mainnet receipt ABI for tributes", async () => {
    const { shrine, chain, seedMemorial } = createShrine({ launchNetwork: "mainnet" });
    seedMemorial();

    await shrine.payTribute(1, 1, "Mainnet remembrance", "77");

    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
    expect(chain.invoke).toHaveBeenCalledWith(
      "payTribute",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "1" },
        { type: "Integer", value: "1" },
        { type: "String", value: "Mainnet remembrance" },
        { type: "Integer", value: "77" },
      ],
      expect.objectContaining({
        scriptHash: MEMORIAL_SHRINE_CONTRACTS.mainnet,
        waitForEvent: "TributePaid",
        waitTimeoutMs: 45_000,
        onTransactionSent: expect.any(Function),
      }),
    );
  });

  it("starts Visited empty (no fabricated seeds) and only records real opens", async () => {
    const { shrine, seedMemorial } = createShrine({ launchNetwork: "testnet" });
    seedMemorial();
    seedMemorial();
    seedMemorial();

    await shrine.loadAll();
    // A fresh visitor has opened nothing — the stat must be 0, not 2.
    expect(shrine.visitedMemorials.get()).toHaveLength(0);

    shrine.openMemorial(2);
    expect(shrine.visitedMemorials.get().map((m) => m.id)).toEqual([2]);
    // Storage-prefix compatibility: the visited store still lives at the exact
    // pre-framework runtime-cache key, so existing user history keeps resolving.
    expect(window.localStorage.getItem("memorial-shrine-visited")).toBe("[2]");

    // The open is persisted and rehydrated on the next session (new composable).
    const next = createShrine({ launchNetwork: "testnet" });
    next.seedMemorial();
    next.seedMemorial();
    next.seedMemorial();
    await next.shrine.loadAll();
    expect(next.shrine.visitedMemorials.get().map((m) => m.id)).toEqual([2]);
  });

  it("copies the share link to the clipboard when Web Share is unavailable", async () => {
    const { shrine, seedMemorial } = createShrine({ launchNetwork: "testnet" });
    seedMemorial();
    await shrine.loadAll();

    const writeText = vi.fn().mockResolvedValue(undefined);
    const originalShare = (navigator as Navigator & { share?: unknown }).share;
    Object.defineProperty(navigator, "share", { value: undefined, configurable: true });
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await shrine.shareMemorial(shrine.memorials.get()[0]);

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(String(writeText.mock.calls[0][0])).toContain("?id=1");
    // The status surfaces (no longer a silent no-op).
    expect(shrine.shareStatus.get()).toBeTruthy();

    if (originalShare === undefined) {
      delete (navigator as Navigator & { share?: unknown }).share;
    } else {
      Object.defineProperty(navigator, "share", { value: originalShare, configurable: true });
    }
  });
});
