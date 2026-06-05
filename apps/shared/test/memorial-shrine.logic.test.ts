import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { useMemorialShrine } from "../../memorial-shrine/src/composables/useMemorialShrine";

import { addressToScriptHash } from "../utils/neo";

const OWNER = "NhMYxG5ATmRjSy6ocnPxrA2DiYba6xhFqu";
// Little-endian 0x script hash for OWNER — matches addressToScriptHash and the
// on-chain visitor / creator field the contract stores for this wallet.
const OWNER_SCRIPT_HASH = addressToScriptHash(OWNER);

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
} = {}) {
  // In-memory contract state.
  const memorialsById = new Map<number, Record<string, unknown>>();
  const tributesById = new Map<number, Record<string, unknown>>();
  // memorialId -> tributeId[]
  const tributesByMemorial = new Map<number, number[]>();
  // visitorHash (lowercased) -> Set<memorialId>
  const visitorMemorials = new Map<string, Set<number>>();
  let nextTributeId = 0;

  const read = vi.fn(async (operation: string, args?: Array<{ value: unknown }>) => {
    switch (operation) {
      case "getMemorialCount":
        return memorialsById.size;
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
        return [...(tributesByMemorial.get(memorialId) ?? [])];
      }
      case "getTributeDetails": {
        const tributeId = Number(args?.[0]?.value);
        return tributesById.get(tributeId) ?? {};
      }
      default:
        return null;
    }
  });

  const invoke = vi.fn(async (operation: string, callArgs: Array<{ value: unknown }>) => {
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
      return { txid: "0xinvoke", success: true, event: { state: [{ value: String(id) }, { value: OWNER }] } };
    }
    // Mainnet payTribute path.
    if (operation === "payTribute") {
      return recordTribute(callArgs);
    }
    return { txid: "0xinvoke", success: true, event: { state: [{ value: "42" }, { value: OWNER }] } };
  });

  const invokeWithPayment = vi.fn(
    async (_amount: string, _memo: string, _operation: string, callArgs: Array<{ value: unknown }>) =>
      recordTribute(callArgs),
  );

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
    return {
      txid: "0xpaid",
      success: true,
      event: { state: [{ value: String(tributeId) }, { value: OWNER }, { value: String(offeringType) }] },
    };
  }

  const chain = {
    address: createObservable<string | null>(
      options.connectedAddress === undefined ? OWNER : options.connectedAddress,
    ),
    ensureWallet: vi.fn().mockResolvedValue(OWNER),
    read,
    invoke,
    invokeWithPayment,
  };

  const events = {
    emit: vi.fn(),
  };
  const shrine = useMemorialShrine({
    chainService: chain as never,
    launchNetwork: options.launchNetwork ?? "testnet",
    eventBus: events,
    t,
  });
  return { shrine, chain, events, memorialsById, tributesById };
}

describe("Memorial Shrine logic", () => {
  it("creates memorials with the deployed createMemorial ABI", async () => {
    const { shrine, chain, events } = createShrine();

    await shrine.createMemorial({
      name: "Loved one",
      photoHash: "ipfs://portrait",
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
        { type: "String", value: "ipfs://portrait" },
        { type: "String", value: "mentor" },
        { type: "Integer", value: "1950" },
        { type: "Integer", value: "2024" },
        { type: "String", value: "A generous builder" },
        { type: "String", value: "Always remembered" },
      ],
      { waitForEvent: "MemorialCreated", waitTimeoutMs: 30_000 },
    );
    expect(events.emit).toHaveBeenCalledWith(
      "memorial:created",
      expect.objectContaining({ memorialId: "1", txid: "0xinvoke" }),
    );
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

  it("pays testnet tributes through direct prepaid GAS", async () => {
    const { shrine, chain, events } = createShrine({ launchNetwork: "testnet" });
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
      { waitForEvent: "TributePaid", waitTimeoutMs: 30_000 },
    );
    expect(events.emit).toHaveBeenCalledWith(
      "tribute:paid",
      expect.objectContaining({
        memorialId: 1,
        offeringType: 3,
        amountGas: "0.03",
        txid: "0xpaid",
      }),
    );
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
    const { shrine, chain } = createShrine({ launchNetwork: "mainnet" });

    await shrine.payTribute(42, 1, "Mainnet remembrance", "77");

    expect(chain.invokeWithPayment).not.toHaveBeenCalled();
    expect(chain.invoke).toHaveBeenCalledWith(
      "payTribute",
      [
        { type: "Hash160", value: OWNER },
        { type: "Integer", value: "42" },
        { type: "Integer", value: "1" },
        { type: "String", value: "Mainnet remembrance" },
        { type: "Integer", value: "77" },
      ],
      { waitForEvent: "TributePaid", waitTimeoutMs: 30_000 },
    );
  });
});
