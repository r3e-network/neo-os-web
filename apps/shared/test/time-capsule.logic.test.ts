import { beforeEach, describe, expect, it, vi } from "vitest";

import { useTimeCapsule } from "../../time-capsule/src/composables/useTimeCapsule";
import type { ChainService, ContractArg, TxResult } from "../services";
import { NotificationService } from "../services";
import type { EventBus } from "../services/EventBus";
import { DepositConfirmedActionFailedError } from "../composables/useContractInteraction";
import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import { addressToScriptHash } from "../utils/neo";

/**
 * These tests drive the migrated useTimeCapsule against a FAKE ChainService that
 * mirrors the standalone MiniAppTimeCapsule vault contract. The composable
 * talks to the chain through the framework SDK (deposit-then-bury via
 * app.funds.prepayAndCall, reveal, fish via memo'd GAS transfers +
 * getCapsule/getOwnerCapsules/lastCapsuleId reads) — no OS proxies.
 *
 * The fake stores capsules exactly as getCapsule returns them: owner as a
 * "0x<hex>" script hash, contentHash as a "0x<hex>" ByteString, unlockTime in
 * milliseconds, amount in base units. invoke() records every call so we can
 * assert the deposit memo + bury/reveal/fish wiring. The fake prepayAndInvoke
 * mirrors the host ChainService lane (transfer with memo → settle → consuming
 * call, wrapping post-deposit failures in DepositConfirmedActionFailedError so
 * the framework surfaces the identity-stable FrameworkPrepaidActionError the
 * composable's stranded-credit recovery copy branches on). Toasts flow through
 * a REAL NotificationService bound to the recorded event bus, so every
 * user-visible message is asserted end-to-end (t-key + params interpolation).
 */

const ME = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const OTHER = "NfgHwwTi3wHAS8aFAN243C5vGbkYDpqLHP";
const CONTRACT = "0x3e88058ef32c4d8d17eb1a2188d6d5e329c94f8a";
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
    message: "Message: {content}",
    contentUnavailable: "No local message found. {hash}",
    creditWithdrawn: "Withdrew {amount} GAS deposit credit",
    noCreditToWithdraw: "No reusable deposit credit to withdraw.",
    tipsCollected: "Collected {amount} GAS in fishing tips",
    noTipsToCollect: "No fishing tips to collect yet.",
    pendingBlocksWrites: "Check the pending transaction before starting another action.",
    transactionEventMismatch: "The confirming event does not match this capsule action.",
    transactionReadbackMismatch: "The chain readback does not match the confirmed event.",
    recoveryStorageUnavailable: "Reliable transaction recovery is unavailable.",
    recoveryStorageUnavailableAfterBroadcast: "Transaction {txid} was broadcast, but recovery storage failed.",
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
  options?: { scriptHash?: string; waitForEvent?: string; onPaymentSent?: (txid: string) => void; onTransactionSent?: (txid: string) => void };
}

function setup(
  capsules: ChainCapsule[],
  opts?: {
    wallet?: string | null;
    failBury?: boolean;
    unverifiedBury?: boolean;
    wrongBuryEvent?: boolean;
    wrongBuryReadback?: boolean;
    credit?: Record<string, string>;
    readError?: string;
    detectedNetwork?: "mainnet" | "testnet";
    /**
     * Settlement state the host lane observed for the bury deposit
     * ("confirmed" when omitted). The host wraps a failing bury on ANY
     * post-broadcast settlement — "timeout"/"unreachable" only mean the
     * deposit is unproven by the indexer, not absent.
     */
    settlement?: "confirmed" | "timeout" | "unreachable";
  },
) {
  // Authoritative on-chain store keyed by capsule id.
  const store = new Map<string, ChainCapsule>();
  for (const c of capsules) store.set(c.id, c);
  let lastId = capsules.reduce((m, c) => Math.max(m, Number(c.id)), 0);

  // Prepaid deposit credit keyed by owner script hash (base units), mirroring
  // creditOf(owner). withdraw(account) pays the whole balance and zeroes it.
  const credits = new Map<string, bigint>();
  for (const [hash, base] of Object.entries(opts?.credit ?? {})) {
    credits.set(hash.toLowerCase(), BigInt(base));
  }

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
    if (opts?.readError) throw new Error(opts.readError);
    if (operation === "lastCapsuleId") return lastId;
    if (operation === "ownerCapsuleCount") {
      const ownerHash = String(args?.[0]?.value ?? "");
      return ownerCapsuleIds(ownerHash).length;
    }
    if (operation === "creditOf") {
      const ownerHash = String(args?.[0]?.value ?? "").toLowerCase();
      return (credits.get(ownerHash) ?? 0n).toString();
    }
    if (operation === "getCapsule") {
      const id = String(args?.[0]?.value ?? "");
      const c = store.get(id);
      if (!c) return {};
      return { ...c };
    }
    throw new Error(`unexpected read: ${operation}`);
  });

  const readArray = vi.fn(async (operation: string, args?: ContractArg[]) => {
    if (opts?.readError) throw new Error(opts.readError);
    if (operation === "getOwnerCapsules") {
      const ownerHash = String(args?.[0]?.value ?? "");
      const offset = Number(args?.[1]?.value ?? 0);
      const limit = Number(args?.[2]?.value ?? 100);
      return ownerCapsuleIds(ownerHash).slice(offset, offset + limit);
    }
    throw new Error(`unexpected readArray: ${operation}`);
  });

  const invoke = vi.fn(
    async (
      operation: string,
      args: ContractArg[],
      options?: { scriptHash?: string; waitForEvent?: string; onPaymentSent?: (txid: string) => void; onTransactionSent?: (txid: string) => void },
    ): Promise<TxResult> => {
      invokes.push({ operation, args, options });

      if (operation === "transfer") {
        const memo = String(args[3]?.value ?? "");
        // Simulate the fish discovery fee marking the capsule fished on-chain.
        const fishMatch = memo.match(/^miniapp-timecapsule:fish:(\d+)$/);
        if (fishMatch) {
          const c = store.get(fishMatch[1]);
          if (c) {
            options?.onTransactionSent?.(`0x${"2".repeat(64)}`);
            store.set(c.id, { ...c, fished: true });
            return {
              txid: `0x${"2".repeat(64)}`,
              success: true,
              verified: true,
              event: { state: [
                { value: c.id },
                { value: ME_HASH },
                { value: c.owner },
                { value: String(args[2]?.value ?? "0") },
              ] },
            };
          }
        }
        options?.onTransactionSent?.(`0x${"3".repeat(64)}`);
        return { txid: `0x${"3".repeat(64)}`, success: true, verified: true };
      }

      if (operation === "bury") {
        if (opts?.failBury) throw new Error("bury reverted");
        options?.onTransactionSent?.(`0x${"4".repeat(64)}`);
        // Mint a fresh capsule from the bury args (mirrors the contract):
        // the stored contentHash IS the buried ByteArray (base64 → hex),
        // exactly as getCapsule echoes it back as a "0x<hex>" ByteString.
        lastId += 1;
        const id = String(lastId);
        const ownerHash = String(args[0]?.value ?? "");
        const contentHashHex = Buffer.from(
          String(args[1]?.value ?? ""),
          "base64",
        ).toString("hex");
        const durationSeconds = Number(args[2]?.value ?? 0);
        const isPublic = Boolean(args[3]?.value);
        const category = Number(args[4]?.value ?? 1);
        const amount = String(args[5]?.value ?? "0");
        const unlockTime = Date.now() + durationSeconds * 1000;
        store.set(id, {
          id,
          owner: ownerHash,
          contentHash: opts?.wrongBuryReadback
            ? `0x${"ff".repeat(32)}`
            : `0x${contentHashHex || "cd".repeat(32)}`,
          unlockTime,
          isPublic,
          category,
          revealed: false,
          amount,
          fished: false,
        });
        // Buried(id, owner, amount, unlockTime, isPublic) — id is state[0].
        return {
          txid: `0x${"4".repeat(64)}`,
          success: true,
          verified: !opts?.unverifiedBury,
          event: opts?.unverifiedBury ? undefined : { state: [
            { value: id },
            { value: opts?.wrongBuryEvent ? OTHER_HASH : ownerHash },
            { value: amount },
            { value: unlockTime },
            { value: isPublic },
          ] },
        };
      }

      if (operation === "reveal") {
        options?.onTransactionSent?.(`0x${"5".repeat(64)}`);
        const id = String(args[1]?.value ?? "");
        const c = store.get(id);
        if (c) store.set(id, { ...c, revealed: true });
        return {
          txid: `0x${"5".repeat(64)}`,
          success: true,
          verified: true,
          event: { state: [
            { value: id },
            { value: c?.owner ?? ME_HASH },
            { value: c?.amount ?? "0" },
          ] },
        };
      }

      if (operation === "withdraw") {
        options?.onTransactionSent?.(`0x${"6".repeat(64)}`);
        const ownerHash = String(args[0]?.value ?? "").toLowerCase();
        const amount = credits.get(ownerHash) ?? 0n;
        credits.set(ownerHash, 0n);
        // CreditWithdrawn(account, amount) — amount is state index 1.
        return {
          txid: `0x${"6".repeat(64)}`,
          success: true,
          verified: true,
          event: { state: [{ value: ownerHash }, { value: amount.toString() }] },
        };
      }

      throw new Error(`unexpected invoke: ${operation}`);
    },
  );

  /**
   * Host prepay lane (mirrors ChainService.prepayAndInvoke): transfer the GAS
   * deposit to the contract with the memo, settle, then run the consuming
   * call. A consuming failure after the (test-synchronous) confirmed deposit
   * surfaces the host DepositConfirmedActionFailedError — the framework wraps
   * it into the identity-stable FrameworkPrepaidActionError.
   */
  const prepayAndInvoke = vi.fn(
    async (
      gasAmount: string,
      memo: string,
      operation: string,
      args: ContractArg[],
      options?: { scriptHash?: string; waitForEvent?: string; onPaymentSent?: (txid: string) => void; onTransactionSent?: (txid: string) => void },
    ): Promise<TxResult> => {
      const transfer = await invoke(
        "transfer",
        [
          { type: "Hash160", value: address.get()! },
          { type: "Hash160", value: CONTRACT },
          { type: "Integer", value: gasAmount },
          { type: "String", value: memo },
        ],
        { scriptHash: GAS_HASH },
      );
      options?.onPaymentSent?.(transfer.txid);
      try {
        return await invoke(operation, args, options);
      } catch (error) {
        throw new DepositConfirmedActionFailedError(
          operation,
          transfer.txid,
          error,
          opts?.settlement ?? "confirmed",
        );
      }
    },
  );

  const chain = {
    address,
    contractAddress,
    ensureWallet: vi.fn(async () => address.get() ?? ME),
    read,
    readArray,
    invoke,
    prepayAndInvoke,
    detectNetwork: vi.fn(async () => opts?.detectedNetwork ?? "testnet"),
  } as unknown as ChainService;

  const events: Array<{ event: string; payload?: unknown }> = [];
  const eventBus = {
    emit: (event: string, payload?: unknown) => {
      events.push({ event, payload });
    },
  };

  // Real NotificationService over the recorded bus: app.notify.* renders
  // t(key, params) onto the same platform:notification channel the
  // pre-migration composable emitted on — the toast assertions below pin the
  // user-visible copy byte-for-byte through the new surface.
  const notify = new NotificationService(eventBus as unknown as EventBus, t);

  const app = createMiniAppFramework(
    { services: { chain, notify }, t, launchContext: { network: "neo-n3-testnet" } } as never,
    // storagePrefix mirrors main.tsx: the on-device content/meta stores keep
    // their legacy "time-capsule-*" localStorage keys.
    { appId: "miniapp-time-capsule", storagePrefix: "time-capsule-" },
  );
  const composable = useTimeCapsule({ app, t });

  /**
   * A fresh composable over the SAME framework/storage — the "reopen the
   * app" lane: the on-device content store is re-read at init, proving the
   * storage round-trip through the legacy localStorage keys.
   */
  const remount = () => useTimeCapsule({ app, t });

  return { app, composable, chain, invokes, events, store, readArray, remount };
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

  it("paginates the complete owner index instead of silently truncating after 100 capsules", async () => {
    const records = Array.from({ length: 105 }, (_, index) => capsule({
      id: String(index + 1),
      owner: ME_HASH,
    }));
    const { composable, readArray } = setup(records);

    await composable.loadAll();

    expect(composable.capsules.get()).toHaveLength(105);
    expect(readArray.mock.calls.filter(([operation]) => operation === "getOwnerCapsules")).toHaveLength(2);
  });

  it("does not attach a local title from a colliding capsule id with a different hash", async () => {
    window.localStorage.setItem("time-capsule-meta", JSON.stringify({
      "1": { title: "Wrong network title", category: 1, contentHash: "ff".repeat(32) },
    }));
    const { composable } = setup([
      capsule({ id: "1", owner: ME_HASH, contentHash: `0x${"ab".repeat(32)}` }),
    ]);

    await composable.loadAll();

    expect(composable.capsules.get()[0]?.title).toBe("Untitled capsule");
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

    // Migration hazard (plan §3 Wave 4): the on-device stores must keep their
    // legacy pre-framework localStorage keys byte-for-byte so existing users
    // keep their sealed messages.
    expect(window.localStorage.getItem("time-capsule-content")).toContain("the secret");
    expect(window.localStorage.getItem("time-capsule-meta")).toContain("Note to future me");
  });

  it("surfaces a prepaid-but-not-buried message and does not lose the deposit when bury reverts", async () => {
    // The bury step faults AFTER the confirmed deposit (failBury): the host
    // lane throws DepositConfirmedActionFailedError, the framework wraps it
    // into the identity-stable FrameworkPrepaidActionError, and the composable
    // remaps THAT branch onto the app's exact stranded-credit recovery copy —
    // the prepaid credit stays on the contract.
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
    // reusable prepaid credit — withdrawable, no lost funds). createCapsule
    // rethrows so registerActions surfaces the error toast; the composable does
    // not double-emit on the notification channel.
    const deposit = invokes.find(
      (c) => c.operation === "transfer" && String(c.args[3]?.value) === "miniapp-timecapsule:bury",
    );
    expect(deposit).toBeTruthy();
    expect(events.some((e) => e.event === "platform:notification")).toBe(false);
  });

  it("keeps a broadcast bury pending and never reports success without its exact event", async () => {
    const { composable, events } = setup([], { wallet: ME, unverifiedBury: true });
    composable.newCapsule.set({
      title: "Pending letter",
      content: "wait for proof",
      days: "30",
      isPublic: false,
      category: 1,
    });

    await expect(composable.createCapsule()).resolves.toEqual({ status: "pending" });

    expect(composable.pendingOperation.get()).toMatchObject({
      kind: "create",
      stage: "action",
      eventName: "Buried",
    });
    expect(composable.newCapsule.get().title).toBe("Pending letter");
    expect(
      events.some(
        (entry) =>
          entry.event === "platform:notification" &&
          (entry.payload as { type?: string }).type === "success",
      ),
    ).toBe(false);
  });

  it("persists the exact broadcast intent and blocks replay after remount", async () => {
    const { composable, invokes, remount } = setup([], { wallet: ME, unverifiedBury: true });
    composable.newCapsule.set({
      title: "One future",
      content: "one submission only",
      days: "365",
      isPublic: true,
      category: 2,
    });

    await expect(composable.createCapsule()).resolves.toEqual({ status: "pending" });

    const stored = JSON.parse(window.localStorage.getItem("time-capsule-state/pendingOperation") ?? "null") as {
      kind?: string;
      stage?: string;
      txid?: string;
      contentHash?: string;
      durationSeconds?: number;
      isPublic?: boolean;
      category?: number;
      amountFixed8?: string;
    };
    expect(stored).toMatchObject({
      kind: "create",
      stage: "action",
      txid: `0x${"4".repeat(64)}`,
      durationSeconds: 365 * 86_400,
      isPublic: true,
      category: 2,
      amountFixed8: "20000000",
    });
    expect(stored.contentHash).toMatch(/^[0-9a-f]{64}$/);

    const buryCount = invokes.filter((call) => call.operation === "bury").length;
    const reopened = remount();
    reopened.newCapsule.set({ title: "Duplicate", content: "do not send", days: "30", isPublic: false, category: 1 });
    await expect(reopened.createCapsule()).rejects.toThrow("Check the pending transaction");
    expect(invokes.filter((call) => call.operation === "bury")).toHaveLength(buryCount);
  });

  it("keeps the recovery record when the event or authoritative readback does not match", async () => {
    const wrongEvent = setup([], { wallet: ME, wrongBuryEvent: true });
    wrongEvent.composable.newCapsule.set({ title: "Event check", content: "exact owner", days: "30", isPublic: false, category: 1 });
    await expect(wrongEvent.composable.createCapsule()).rejects.toThrow("confirming event does not match");
    expect(wrongEvent.composable.pendingOperation.get()).toMatchObject({ kind: "create", stage: "action" });

    window.localStorage.clear();
    const wrongReadback = setup([], { wallet: ME, wrongBuryReadback: true });
    wrongReadback.composable.newCapsule.set({ title: "Readback check", content: "exact hash", days: "30", isPublic: false, category: 1 });
    await expect(wrongReadback.composable.createCapsule()).rejects.toThrow("chain readback does not match");
    expect(wrongReadback.composable.pendingOperation.get()).toMatchObject({ kind: "create", stage: "action" });
  });

  it("blocks wallet writes when durable recovery storage fails its preflight", async () => {
    const { app, composable, invokes } = setup([], { wallet: ME });
    const storageSet = vi.spyOn(app.storage.local, "set").mockImplementation(() => undefined);
    try {
      composable.newCapsule.set({ title: "No storage", content: "do not sign", days: "30", isPublic: false, category: 1 });
      await expect(composable.createCapsule()).rejects.toThrow("Reliable transaction recovery is unavailable");
      expect(composable.storageHealthy.get()).toBe(false);
      expect(invokes).toHaveLength(0);
    } finally {
      storageSet.mockRestore();
    }
  });

  it("keeps the broadcast txid in memory and warns against replay if durable readback fails afterward", async () => {
    const { app, composable, invokes } = setup([], { wallet: ME });
    const realSet = app.storage.local.set.bind(app.storage.local);
    const storageSet = vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      if (key !== "state/pendingOperation") realSet(key, value);
    });
    try {
      composable.newCapsule.set({ title: "Broadcast edge", content: "keep txid", days: "30", isPublic: false, category: 1 });
      await expect(composable.createCapsule()).rejects.toThrow(`Transaction 0x${"3".repeat(64)} was broadcast`);
      expect(composable.storageHealthy.get()).toBe(false);
      expect(composable.pendingOperation.get()).toMatchObject({
        kind: "create",
        stage: "payment",
        paymentTxid: `0x${"3".repeat(64)}`,
      });
      expect(composable.transactionNotice.get()).toContain(`0x${"3".repeat(64)}`);
      expect(invokes.filter((call) => call.operation === "bury")).toHaveLength(0);
    } finally {
      storageSet.mockRestore();
    }
  });

  it("restores the valid pending record in memory when confirmed-record cleanup cannot persist", async () => {
    const { app, composable, events } = setup([], { wallet: ME });
    const realSet = app.storage.local.set.bind(app.storage.local);
    const storageSet = vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      if (key === "state/pendingOperation" && value === null) throw new Error("quota");
      realSet(key, value);
    });
    try {
      composable.newCapsule.set({ title: "Cleanup edge", content: "keep recovery", days: "30", isPublic: false, category: 1 });
      await expect(composable.createCapsule()).rejects.toThrow("Reliable transaction recovery is unavailable");
      expect(composable.storageHealthy.get()).toBe(false);
      expect(composable.pendingOperation.get()).toMatchObject({
        kind: "create",
        stage: "action",
        txid: `0x${"4".repeat(64)}`,
      });
      expect(events.some((entry) =>
        entry.event === "platform:notification" &&
        (entry.payload as { type?: string }).type === "success"
      )).toBe(false);
    } finally {
      storageSet.mockRestore();
    }
  });

  it("rejects a non-canonical configured contract before any wallet write", async () => {
    const { chain, composable, invokes } = setup([], { wallet: ME });
    chain.contractAddress?.set(`0x${"9".repeat(40)}`);
    composable.newCapsule.set({ title: "Wrong contract", content: "do not sign", days: "30", isPublic: false, category: 1 });

    await expect(composable.createCapsule()).rejects.toThrow("chainContextMismatch");
    expect(invokes).toHaveLength(0);
  });

  it("rejects a wallet network that conflicts with the launch boundary", async () => {
    const { composable, invokes } = setup([], { wallet: ME, detectedNetwork: "mainnet" });
    composable.newCapsule.set({ title: "Wrong network", content: "do not sign", days: "30", isPublic: false, category: 1 });

    await expect(composable.createCapsule()).rejects.toThrow("chainContextMismatch");
    expect(invokes).toHaveLength(0);
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

  it("confirms the reveal (deposit return) on the live notification channel", async () => {
    const { composable, events } = setup([
      capsule({ id: "9", owner: ME_HASH, unlockTime: Date.now() - 60_000 }),
    ]);

    await composable.loadAll();
    const cap = composable.capsules.get().find((c) => c.id === "9")!;
    await composable.openCapsule(cap);

    // The dead capsule:opened eventBus channel is replaced by a real
    // platform:notification success toast confirming the deposit came back.
    const note = events.find(
      (e) =>
        e.event === "platform:notification" &&
        (e.payload as { type?: string }).type === "success",
    );
    expect(note?.payload).toMatchObject({
      message: "Capsule revealed",
      type: "success",
    });

    // No on-device message for this foreign contentHash → the hash-fallback
    // info toast interpolates the hash through t("contentUnavailable", {hash}).
    const fallback = events.find(
      (e) =>
        e.event === "platform:notification" &&
        (e.payload as { type?: string }).type === "info",
    );
    expect(fallback?.payload).toMatchObject({
      message: `No local message found. ${"ab".repeat(32)}`,
      type: "info",
    });
  });

  it("surfaces the on-device message through the parametrized message toast on open", async () => {
    const { composable, events, store, remount } = setup([], { wallet: ME });

    composable.newCapsule.set({
      title: "T",
      content: "the secret",
      days: "30",
      isPublic: false,
      category: 1,
    });
    await composable.createCapsule();
    const id = composable.capsules.get()[0]!.id;

    // Time passes: the capsule was revealed on-chain (deposit returned) and
    // the user reopens the app — the fresh composable re-reads the on-device
    // content store from the legacy localStorage keys.
    store.set(id, { ...store.get(id)!, revealed: true });
    const reopened = remount();
    await reopened.loadAll();
    const cap = reopened.capsules.get().find((c) => c.id === id)!;

    await reopened.openCapsule(cap);

    // The full message came back from the on-device content store (keyed by
    // the on-chain contentHash) and rides t("message", {content}).
    const note = events.find(
      (e) =>
        e.event === "platform:notification" &&
        (e.payload as { type?: string }).type === "info",
    );
    expect(note?.payload).toMatchObject({
      message: "Message: the secret",
      type: "info",
    });
  });

  it("blocks reveal and emits notUnlocked for a still-locked capsule", async () => {
    const { composable, invokes, events } = setup([
      capsule({ id: "6", owner: ME_HASH, unlockTime: Date.now() + 86_400_000 }),
    ]);

    await composable.loadAll();
    const cap = composable.capsules.get().find((c) => c.id === "6")!;
    await composable.openCapsule(cap);

    expect(invokes.some((c) => c.operation === "reveal")).toBe(false);
    const note = events.find((e) => e.event === "platform:notification");
    expect(note?.payload).toMatchObject({
      message: "Capsule is still locked",
      type: "error",
    });
  });
});

describe("useTimeCapsule.fishCapsule (discovery fee tips the owner)", () => {
  it("fishes another user's public, unrevealed capsule via the fish memo transfer", async () => {
    const { composable, invokes, events, store } = setup([
      capsule({ id: "1", owner: ME_HASH }), // own — skipped as a candidate
      capsule({ id: "2", owner: OTHER_HASH }), // other user's — the real target
    ]);

    await composable.loadAll();
    await composable.fishCapsule();

    // Fee paid against the OTHER user's capsule via the fish memo transfer.
    const fish = invokes.find(
      (c) => c.operation === "transfer" && String(c.args[3]?.value).startsWith("miniapp-timecapsule:fish:"),
    );
    expect(fish).toBeTruthy();
    expect(fish?.args[3]?.value).toBe("miniapp-timecapsule:fish:2");
    expect(fish?.args[1]?.value).toBe(CONTRACT); // to the vault contract
    expect(fish?.args[2]?.value).toBe("5000000"); // 0.05 GAS fee base units
    expect(fish?.options?.scriptHash).toBe(GAS_HASH);

    // The contract marks the capsule fished (and tips the owner) in the same tx.
    expect(store.get("2")?.fished).toBe(true);

    // Dynamic fish feedback rides the live platform notification channel (the
    // dead capsule:fished eventBus channel had no listener).
    const fished = events.find((e) => e.event === "platform:notification");
    expect(fished?.payload).toMatchObject({
      message: "Fished capsule 2",
      type: "success",
    });
  });

  it("reports fishNone and charges no fee when nothing is fishable", async () => {
    const { composable, invokes, events } = setup([
      capsule({ id: "1", owner: ME_HASH, isPublic: false }), // private own
      capsule({ id: "2", owner: OTHER_HASH, revealed: true }), // already revealed
      capsule({ id: "3", owner: OTHER_HASH, fished: true }), // already fished
      capsule({ id: "4", owner: ME_HASH, isPublic: true }), // own public — not a fish target
    ]);

    await composable.loadAll();
    await composable.fishCapsule();

    // No fish transfer is sent (the user cannot fish their own capsule).
    expect(
      invokes.some(
        (c) => c.operation === "transfer" && String(c.args[3]?.value).startsWith("miniapp-timecapsule:fish:"),
      ),
    ).toBe(false);
    const fished = events.find((e) => e.event === "platform:notification");
    expect(fished?.payload).toMatchObject({
      message: "No public capsule found",
      type: "info",
    });
  });

  it("fishes a foreign capsule that has no local title (it maps cleanly with a placeholder)", async () => {
    const { composable, invokes } = setup([
      capsule({ id: "1", owner: OTHER_HASH }),
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
    expect(fish?.args[3]?.value).toBe("miniapp-timecapsule:fish:1");
  });

  it("loadFishCandidates exposes a browsable list of other users' public capsules (newest-first, own excluded)", async () => {
    const { composable } = setup([
      capsule({ id: "1", owner: ME_HASH }), // own — excluded
      capsule({ id: "2", owner: OTHER_HASH }), // tippable
      capsule({ id: "3", owner: OTHER_HASH }), // tippable (newer)
      capsule({ id: "4", owner: OTHER_HASH, revealed: true }), // revealed — excluded
    ]);

    await composable.loadFishCandidates();
    const ids = composable.fishCandidates.get().map((c) => c.id);
    // Newest-first, own + revealed excluded.
    expect(ids).toEqual(["3", "2"]);
  });

  it("marks the public list failed instead of presenting an RPC failure as an empty pool", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { composable } = setup([], { readError: "Contract address not configured" });

      await composable.loadFishCandidates();

      expect(composable.fishCandidates.get()).toEqual([]);
      expect(composable.candidatesSource.get()).toBe("failed");
      expect(warn).toHaveBeenCalled();
    } finally {
      warn.mockRestore();
    }
  });

  it("fishCapsule(targetId) tips the chosen capsule, not just the newest", async () => {
    const { composable, invokes, store } = setup([
      capsule({ id: "1", owner: ME_HASH, isPublic: false }),
      capsule({ id: "2", owner: OTHER_HASH }),
      capsule({ id: "3", owner: OTHER_HASH }), // newest — the blind default
    ]);

    await composable.loadAll();
    // User picked the OLDER capsule (2) from the browsable list.
    await composable.fishCapsule("2");

    const fish = invokes.find(
      (c) => c.operation === "transfer" && String(c.args[3]?.value).startsWith("miniapp-timecapsule:fish:"),
    );
    // The chosen target is tipped, not the newest (3).
    expect(fish?.args[3]?.value).toBe("miniapp-timecapsule:fish:2");
    expect(store.get("2")?.fished).toBe(true);
    expect(store.get("3")?.fished).toBe(false);
  });
});

describe("useTimeCapsule prepaid-deposit credit (money-out path)", () => {
  it("marks credit failed instead of presenting an unreadable balance as zero", async () => {
    const { composable } = setup([], { wallet: ME, readError: "RPC unavailable" });

    await composable.loadAll();

    expect(composable.creditSource.get()).toBe("failed");
    expect(composable.hasCredit.get()).toBe(false);
  });

  it("reads creditOf on load and exposes a withdrawable credit + hasCredit", async () => {
    const { composable } = setup([], {
      wallet: ME,
      credit: { [ME_HASH]: "20000000" }, // 0.2 GAS stranded deposit credit
    });

    await composable.loadAll();

    expect(composable.reusableCredit.get()).toBe("0.2");
    expect(composable.hasCredit.get()).toBe(true);
  });

  it("withdraw() pays the whole credit back, zeroes it, and toasts the amount", async () => {
    const { composable, invokes, events } = setup([], {
      wallet: ME,
      credit: { [ME_HASH]: "20000000" },
    });

    await composable.loadAll();
    const { amount } = await composable.withdrawCredit();

    // withdraw(account) is invoked with the owner hash, waiting CreditWithdrawn.
    const withdraw = invokes.find((c) => c.operation === "withdraw");
    expect(withdraw).toBeTruthy();
    expect(withdraw?.args[0]?.value).toBe(ME_HASH);
    expect(withdraw?.options?.waitForEvent).toBe("CreditWithdrawn");

    expect(amount).toBe("0.2");
    // Credit is drained on-chain → banner hides.
    expect(composable.reusableCredit.get()).toBe("0");
    expect(composable.hasCredit.get()).toBe(false);

    const note = events.find(
      (e) =>
        e.event === "platform:notification" &&
        (e.payload as { type?: string }).type === "success",
    );
    expect(note?.payload).toMatchObject({
      message: "Withdrew 0.2 GAS deposit credit",
      type: "success",
    });
  });

  it("surfaces a clean no-credit message without prompting the wallet when nothing is owed", async () => {
    const { composable, invokes, events } = setup([], { wallet: ME });

    await composable.loadAll();
    const { amount } = await composable.withdrawCredit();

    expect(amount).toBe("0");
    // No on-chain withdraw is attempted on an empty balance (avoids a VM revert).
    expect(invokes.some((c) => c.operation === "withdraw")).toBe(false);
    const note = events.find((e) => e.event === "platform:notification");
    expect(note?.payload).toMatchObject({
      message: "No reusable deposit credit to withdraw.",
      type: "info",
    });
  });

  it("keeps the stranded-credit copy and refreshes the banner when the deposit only timed out (indexer lag)", async () => {
    // Regression pin (Wave 4 audit): the deposit transfer was BROADCAST but
    // the indexer never proved it before bury() faulted — settlement reads
    // "timeout". The host lane still wraps the failure, so the composable
    // must reach the SAME recovery branch: the exact stranded-credit copy
    // plus the loadCredit() refresh that surfaces the withdraw banner. A raw
    // FAULT toast here would read as a lost 0.2 GAS deposit.
    const { composable } = setup([], {
      wallet: ME,
      failBury: true,
      settlement: "timeout",
      credit: { [ME_HASH]: "20000000" },
    });

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

    expect(composable.hasCredit.get()).toBe(true);
    expect(composable.reusableCredit.get()).toBe("0.2");
  });

  it("keeps the stranded-credit copy when the indexer was unreachable during the deposit", async () => {
    const { composable } = setup([], {
      wallet: ME,
      failBury: true,
      settlement: "unreachable",
    });

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
  });

  it("refreshes the credit banner after a deposit lands but bury reverts", async () => {
    // failBury reverts AFTER the deposit transfer; the contract credits the
    // owner. loadCredit (now run in the bury-fail path) should surface it.
    const { composable } = setup([], {
      wallet: ME,
      failBury: true,
      credit: { [ME_HASH]: "20000000" },
    });

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

    expect(composable.hasCredit.get()).toBe(true);
    expect(composable.reusableCredit.get()).toBe("0.2");
  });
});
