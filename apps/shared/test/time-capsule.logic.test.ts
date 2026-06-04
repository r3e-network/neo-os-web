import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTimeCapsule } from "../../time-capsule/src/composables/useTimeCapsule";
import type { ChainService, ContractArg, TxResult } from "../services";
import { createObservable } from "../react/context";
import { addressToScriptHash } from "../utils/neo";

/**
 * These tests drive the migrated useTimeCapsule against a FAKE ChainService that
 * mirrors the standalone MiniAppTimeCapsule vault contract. The composable now
 * talks directly to the chain (deposit-then-bury, reveal, fish via memo'd GAS
 * transfers + getCapsule/getOwnerCapsules/lastCapsuleId reads) — no OS proxies.
 *
 * The fake stores capsules exactly as getCapsule returns them: owner as a
 * "0x<hex>" script hash, contentHash as a "0x<hex>" ByteString, unlockTime in
 * milliseconds, amount in base units. invoke() records every call so we can
 * assert the deposit memo + bury/reveal/fish wiring.
 */

const ME = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OTHER = "NfgHwwTi3wHAS8aFAN243C5vGbkYDpqLHP";
const CONTRACT = "0x5cc0269c37023e09e996b0fdd3edd3f48cb213cf";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";

const ME_HASH = addressToScriptHash(ME);
const OTHER_HASH = addressToScriptHash(OTHER);

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    fishNone: "No public capsule found",
    fishResult: "Fished capsule {id}",
    error: "Something went wrong",
    notAvailable: "N/A",
    notUnlocked: "Capsule is still locked",
    walletRequired: "Connect your Neo wallet",
    contractNotReady: "Contract not ready",
    depositPrepaidNoCapsule: "Deposit prepaid, capsule not buried",
    untitledCapsule: "Untitled capsule",
    invalidLockDuration: "Lock duration must be between 1 and 3650 days.",
    capsuleCreated: "Capsule sealed on-chain!",
    capsuleRevealed: "Capsule revealed",
    message: "Message:",
    contentUnavailable: "No local message found.",
  };
  const base = messages[key] ?? key;
  if (!params) return base;
  return base.replace(/\{(\w+)\}/g, (_m, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}

/** A capsule shaped exactly like getCapsule's returned Map. */
interface ChainCapsule {
  id: string;
  owner: string; // "0x<hex>" script hash
  contentHash: string; // "0x<hex>" ByteString
  unlockTime: number; // ms
  isPublic: boolean;
  category: number;
  revealed: boolean;
  amount: string; // base units
  fished: boolean;
}

function capsule(partial: Partial<ChainCapsule> & { id: string }): ChainCapsule {
  return {
    owner: OTHER_HASH,
    contentHash: `0x${"ab".repeat(32)}`,
    unlockTime: Date.now() - 1_000,
    isPublic: true,
    category: 1,
    revealed: false,
    amount: "20000000", // 0.2 GAS base units
    fished: false,
    ...partial,
  };
}

interface InvokeCall {
  operation: string;
  args: ContractArg[];
  options?: { scriptHash?: string; waitForEvent?: string };
}

function setup(
  capsules: ChainCapsule[],
  opts?: { wallet?: string | null; failBury?: boolean },
) {
  // Authoritative on-chain store keyed by capsule id.
  const store = new Map<string, ChainCapsule>();
  for (const c of capsules) store.set(c.id, c);
  let lastId = capsules.reduce((m, c) => Math.max(m, Number(c.id)), 0);

  const invokes: InvokeCall[] = [];

  const address = createObservable<string | null>(
    opts && "wallet" in opts ? opts.wallet ?? null : ME,
  );
  const contractAddress = createObservable<string | null>(CONTRACT);

  const ownerCapsuleIds = (ownerHash: string): string[] =>
    [...store.values()]
      .filter((c) => c.owner.toLowerCase() === ownerHash.toLowerCase())
      .map((c) => c.id);

  const read = vi.fn(async (operation: string, args?: ContractArg[]) => {
    if (operation === "lastCapsuleId") return lastId;
    if (operation === "getCapsule") {
      const id = String(args?.[0]?.value ?? "");
      const c = store.get(id);
      if (!c) return {};
      return { ...c };
    }
    throw new Error(`unexpected read: ${operation}`);
  });

  const readArray = vi.fn(async (operation: string, args?: ContractArg[]) => {
    if (operation === "getOwnerCapsules") {
      const ownerHash = String(args?.[0]?.value ?? "");
      return ownerCapsuleIds(ownerHash);
    }
    throw new Error(`unexpected readArray: ${operation}`);
  });

  const invoke = vi.fn(
    async (
      operation: string,
      args: ContractArg[],
      options?: { scriptHash?: string; waitForEvent?: string },
    ): Promise<TxResult> => {
      invokes.push({ operation, args, options });

      if (operation === "transfer") {
        const memo = String(args[3]?.value ?? "");
        // Simulate the fish discovery fee marking the capsule fished on-chain.
        const fishMatch = memo.match(/^miniapp-timecapsule:fish:(\d+)$/);
        if (fishMatch) {
          const c = store.get(fishMatch[1]);
          if (c) store.set(c.id, { ...c, fished: true });
        }
        return { txid: "0xtransfer", success: true };
      }

      if (operation === "bury") {
        if (opts?.failBury) throw new Error("bury reverted");
        // Mint a fresh capsule from the bury args (mirrors the contract).
        lastId += 1;
        const id = String(lastId);
        const ownerHash = String(args[0]?.value ?? "");
        const durationSeconds = Number(args[2]?.value ?? 0);
        const isPublic = Boolean(args[3]?.value);
        const category = Number(args[4]?.value ?? 1);
        const amount = String(args[5]?.value ?? "0");
        store.set(id, {
          id,
          owner: ownerHash,
          contentHash: `0x${"cd".repeat(32)}`,
          unlockTime: Date.now() + durationSeconds * 1000,
          isPublic,
          category,
          revealed: false,
          amount,
          fished: false,
        });
        // Buried(id, owner, amount, unlockTime, isPublic) — id is state[0].
        return {
          txid: "0xbury",
          success: true,
          event: { state: [{ value: id }] },
        };
      }

      if (operation === "reveal") {
        const id = String(args[1]?.value ?? "");
        const c = store.get(id);
        if (c) store.set(id, { ...c, revealed: true });
        return { txid: "0xreveal", success: true };
      }

      throw new Error(`unexpected invoke: ${operation}`);
    },
  );

  const chain = {
    address,
    contractAddress,
    ensureWallet: vi.fn(async () => address.get() ?? ME),
    read,
    readArray,
    invoke,
  } as unknown as ChainService;

  const events: Array<{ event: string; payload?: unknown }> = [];
  const eventBus = {
    emit: (event: string, payload?: unknown) => {
      events.push({ event, payload });
    },
  };

  const composable = useTimeCapsule({ chainService: chain, eventBus, t });

  return { composable, chain, invokes, events, store };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("useTimeCapsule.loadCapsules (owner-scoped chain reads)", () => {
  it("loads only the connected wallet's capsules via getOwnerCapsules", async () => {
    const { composable } = setup([
      capsule({ id: "1", owner: ME_HASH }),
      capsule({ id: "2", owner: OTHER_HASH }),
      capsule({ id: "3", owner: ME_HASH }),
    ]);

    await composable.loadAll();

    const ids = composable.capsules.get().map((c) => c.id).sort();
    expect(ids).toEqual(["1", "3"]);
  });

  it("derives locked/revealed counts from the live unlock time and revealed flag", async () => {
    const { composable } = setup([
      capsule({ id: "1", owner: ME_HASH, unlockTime: Date.now() + 86_400_000 }), // locked
      capsule({ id: "2", owner: ME_HASH, unlockTime: Date.now() - 1_000, revealed: true }), // revealed
      capsule({ id: "3", owner: ME_HASH, unlockTime: Date.now() - 1_000 }), // unlocked, not revealed
    ]);

    await composable.loadAll();

    expect(composable.totalCapsules.get()).toBe(3);
    expect(composable.lockedCount.get()).toBe(1);
    expect(composable.revealedCount.get()).toBe(1);
  });
});

describe("useTimeCapsule.createCapsule (deposit + bury vault flow)", () => {
  it("prepays the 0.2 GAS deposit then buries with the right args and persists the title locally", async () => {
    const { composable, invokes } = setup([], { wallet: ME });

    composable.newCapsule.set({
      title: "Note to future me",
      content: "the secret",
      days: "30",
      isPublic: true,
      category: 2,
    });

    await composable.createCapsule();

    // Step 1: deposit — GAS transfer to the contract with the bury memo.
    const deposit = invokes.find(
      (c) => c.operation === "transfer" && String(c.args[3]?.value) === "miniapp-timecapsule:bury",
    );
    expect(deposit).toBeTruthy();
    expect(deposit?.options?.scriptHash).toBe(GAS_HASH);
    expect(deposit?.args[1]?.value).toBe(CONTRACT); // to contract
    expect(deposit?.args[2]?.value).toBe("20000000"); // 0.2 GAS base units

    // Step 2: bury — owner, contentHash (ByteArray base64), durationSeconds,
    // isPublic, category, amount (base units).
    const bury = invokes.find((c) => c.operation === "bury");
    expect(bury).toBeTruthy();
    expect(bury?.args[0]?.value).toBe(ME_HASH);
    expect(bury?.args[0]?.type).toBe("Hash160");
    expect(bury?.args[1]?.type).toBe("ByteArray");
    // 32-byte sha256 → 44-char base64 (43 + padding).
    expect(String(bury?.args[1]?.value)).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(bury?.args[2]?.value).toBe(String(30 * 86_400)); // days → seconds
    expect(bury?.args[3]?.value).toBe(true); // isPublic
    expect(bury?.args[4]?.value).toBe("2"); // category
    expect(bury?.args[5]?.value).toBe("20000000"); // locked amount

    // The new capsule shows up scoped to the owner, with the locally-kept title
    // (only the hash is on-chain) and the refundable deposit as its amount.
    const created = composable.capsules.get();
    expect(created).toHaveLength(1);
    expect(created[0].title).toBe("Note to future me");
    expect(created[0].amount).toBe("0.2");
    expect(created[0].isPublic).toBe(true);
  });

  it("surfaces a prepaid-but-not-buried message and does not lose the deposit when bury reverts", async () => {
    // The bury step faults AFTER the deposit lands (failBury), mirroring a
    // post-deposit revert where the prepaid credit stays on the contract.
    const { composable, invokes, events } = setup([], { wallet: ME, failBury: true });

    composable.newCapsule.set({
      title: "x",
      content: "y",
      days: "10",
      isPublic: false,
      category: 1,
    });

    await expect(composable.createCapsule()).rejects.toThrow(
      "Deposit prepaid, capsule not buried",
    );

    // The deposit transfer was still attempted (credit persists on-chain as
    // reusable prepaid credit — no refund call, no lost funds).
    const deposit = invokes.find(
      (c) => c.operation === "transfer" && String(c.args[3]?.value) === "miniapp-timecapsule:bury",
    );
    expect(deposit).toBeTruthy();
    const err = events.find((e) => e.event === "capsule:error");
    expect(err?.payload).toEqual({ message: "Deposit prepaid, capsule not buried" });
  });
});

describe("useTimeCapsule.openCapsule (reveal returns the deposit)", () => {
  it("calls reveal(owner, id) for an unlocked capsule", async () => {
    const { composable, invokes, store } = setup([
      capsule({ id: "5", owner: ME_HASH, unlockTime: Date.now() - 60_000 }),
    ]);

    await composable.loadAll();
    const cap = composable.capsules.get().find((c) => c.id === "5")!;
    await composable.openCapsule(cap);

    const reveal = invokes.find((c) => c.operation === "reveal");
    expect(reveal).toBeTruthy();
    expect(reveal?.args[0]?.value).toBe(ME_HASH);
    expect(reveal?.args[1]?.value).toBe("5");
    // The deposit return is reflected on reload.
    expect(store.get("5")?.revealed).toBe(true);
  });

  it("blocks reveal and emits notUnlocked for a still-locked capsule", async () => {
    const { composable, invokes, events } = setup([
      capsule({ id: "6", owner: ME_HASH, unlockTime: Date.now() + 86_400_000 }),
    ]);

    await composable.loadAll();
    const cap = composable.capsules.get().find((c) => c.id === "6")!;
    await composable.openCapsule(cap);

    expect(invokes.some((c) => c.operation === "reveal")).toBe(false);
    const err = events.find((e) => e.event === "capsule:error");
    expect(err?.payload).toEqual({ message: "Capsule is still locked" });
  });
});

describe("useTimeCapsule.fishCapsule (discovery fee tips the owner)", () => {
  it("fishes another user's public, unrevealed capsule via the fish memo transfer", async () => {
    const { composable, invokes, events, store } = setup([
      capsule({ id: "100", owner: ME_HASH }), // own — skipped as a candidate
      capsule({ id: "200", owner: OTHER_HASH }), // other user's — the real target
    ]);

    await composable.loadAll();
    await composable.fishCapsule();

    // Fee paid against the OTHER user's capsule via the fish memo transfer.
    const fish = invokes.find(
      (c) => c.operation === "transfer" && String(c.args[3]?.value).startsWith("miniapp-timecapsule:fish:"),
    );
    expect(fish).toBeTruthy();
    expect(fish?.args[3]?.value).toBe("miniapp-timecapsule:fish:200");
    expect(fish?.args[1]?.value).toBe(CONTRACT); // to the vault contract
    expect(fish?.args[2]?.value).toBe("5000000"); // 0.05 GAS fee base units
    expect(fish?.options?.scriptHash).toBe(GAS_HASH);

    // The contract marks the capsule fished (and tips the owner) in the same tx.
    expect(store.get("200")?.fished).toBe(true);

    const fished = events.find((e) => e.event === "capsule:fished");
    expect(fished?.payload).toEqual({ message: "Fished capsule 200" });
  });

  it("reports fishNone and charges no fee when nothing is fishable", async () => {
    const { composable, invokes, events } = setup([
      capsule({ id: "300", owner: ME_HASH, isPublic: false }), // private own
      capsule({ id: "400", owner: OTHER_HASH, revealed: true }), // already revealed
      capsule({ id: "500", owner: OTHER_HASH, fished: true }), // already fished
      capsule({ id: "600", owner: ME_HASH, isPublic: true }), // own public — not a fish target
    ]);

    await composable.loadAll();
    await composable.fishCapsule();

    // No fish transfer is sent (the user cannot fish their own capsule).
    expect(
      invokes.some(
        (c) => c.operation === "transfer" && String(c.args[3]?.value).startsWith("miniapp-timecapsule:fish:"),
      ),
    ).toBe(false);
    const fished = events.find((e) => e.event === "capsule:fished");
    expect(fished?.payload).toEqual({ message: "No public capsule found" });
  });

  it("fishes a foreign capsule that has no local title (it maps cleanly with a placeholder)", async () => {
    const { composable, invokes } = setup([
      capsule({ id: "700", owner: OTHER_HASH }),
    ]);

    // No ME capsules → the owner-scoped list is empty, but loadPublicCandidates
    // must rebuild OTHER's capsule from chain alone (no local title on-device)
    // and surface it as fishable without throwing.
    await composable.loadAll();
    expect(composable.capsules.get()).toHaveLength(0);

    await composable.fishCapsule();

    const fish = invokes.find(
      (c) => c.operation === "transfer" && String(c.args[3]?.value).startsWith("miniapp-timecapsule:fish:"),
    );
    expect(fish?.args[3]?.value).toBe("miniapp-timecapsule:fish:700");
  });
});
