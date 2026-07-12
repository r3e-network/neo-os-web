import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable } from "../react/context";
import type { MiniAppFramework } from "../react";
import { useAAPermissionsLab } from "../../aa-permissions-lab/src/composables/useAAPermissionsLab";
import {
  ZERO_HASH,
  buildPendingPermissionTransaction,
  readPermissionTransactionState,
} from "../../aa-permissions-lab/src/permissions";

const ACCOUNT = "0x1111111111111111111111111111111111111111";
const VERIFIER = "0x2222222222222222222222222222222222222222";
const HOOK = "0x3333333333333333333333333333333333333333";
const TARGET = "0x5555555555555555555555555555555555555555";
const OWNER_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const OWNER_HASH = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const WRONG_ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CORE = "0x0268a387913b250166ddec032b03332690a1ef78";
const TXID = `0x${"ab".repeat(32)}`;

afterEach(() => vi.unstubAllGlobals());

interface FakeSnapshot {
  verifier: string;
  hook: string;
  owner: string;
  pendingVerifier: boolean;
  pendingHook: boolean;
  verifierUnlockAt: number;
  hookUnlockAt: number;
  pendingVerifierTarget?: string;
  pendingHookTarget?: string;
}

function chainHash(displayHash: string) {
  const hex = displayHash.slice(2).match(/.{2}/g) ?? [];
  return `0x${hex.reverse().join("")}`;
}

function t(key: string) {
  return key;
}

function makeHarness(options: {
  connectedAddress?: string | null;
  network?: string;
  snapshot?: Partial<FakeSnapshot>;
  eventVerified?: boolean;
  recoveryEvent?: unknown;
  storage?: Map<string, unknown>;
  storageWritable?: boolean;
} = {}) {
  const snapshot: FakeSnapshot = {
    verifier: VERIFIER,
    hook: HOOK,
    owner: OWNER_HASH,
    pendingVerifier: false,
    pendingHook: false,
    verifierUnlockAt: 0,
    hookUnlockAt: 0,
    ...options.snapshot,
  };
  const address = createObservable<string | null>(options.connectedAddress ?? OWNER_ADDRESS);
  const storage = options.storage ?? new Map<string, unknown>();
  const storageWritable = options.storageWritable ?? true;
  const faultedReads = new Set<string>();
  const readRaw = vi.fn(async (operation: string) => {
    if (faultedReads.has(operation)) return { state: "FAULT", stack: [] };
    if (operation === "getVerifier") return chainHash(snapshot.verifier || ZERO_HASH);
    if (operation === "getHook") return chainHash(snapshot.hook || ZERO_HASH);
    if (operation === "getBackupOwner") return chainHash(snapshot.owner);
    if (operation === "hasPendingVerifierUpdate") return snapshot.pendingVerifier;
    if (operation === "hasPendingHookUpdate") return snapshot.pendingHook;
    if (operation === "getPendingVerifierUpdateTime") return snapshot.verifierUnlockAt;
    if (operation === "getPendingHookUpdateTime") return snapshot.hookUnlockAt;
    throw new Error(`unexpected read ${operation}`);
  });

  const invoke = vi.fn(async (
    operation: string,
    args: Array<{ type: string; value: string | number | boolean }>,
    invokeOptions: { onTransactionSent?: (txid: string) => void; waitForEvent?: string },
  ) => {
    invokeOptions.onTransactionSent?.(TXID);
    const target = String(args[1]?.value ?? "");
    if (operation === "updateVerifier") {
      if (!snapshot.verifier) snapshot.verifier = target;
      else {
        snapshot.pendingVerifier = true;
        snapshot.verifierUnlockAt = Date.now() + 86_400_000;
        snapshot.pendingVerifierTarget = target;
      }
    } else if (operation === "updateHook") {
      if (!snapshot.hook) snapshot.hook = target;
      else {
        snapshot.pendingHook = true;
        snapshot.hookUnlockAt = Date.now() + 86_400_000;
        snapshot.pendingHookTarget = target;
      }
    } else if (operation === "confirmVerifierUpdate") {
      snapshot.verifier = snapshot.pendingVerifierTarget ?? snapshot.verifier;
      snapshot.pendingVerifier = false;
      snapshot.verifierUnlockAt = 0;
    } else if (operation === "confirmHookUpdate") {
      snapshot.hook = snapshot.pendingHookTarget ?? snapshot.hook;
      snapshot.pendingHook = false;
      snapshot.hookUnlockAt = 0;
    } else if (operation === "cancelVerifierUpdate") {
      snapshot.pendingVerifier = false;
      snapshot.verifierUnlockAt = 0;
    } else if (operation === "cancelHookUpdate") {
      snapshot.pendingHook = false;
      snapshot.hookUnlockAt = 0;
    }
    const verified = options.eventVerified ?? true;
    return {
      txid: TXID,
      success: true,
      verified,
      event: verified ? { name: invokeOptions.waitForEvent } : undefined,
    };
  });

  const app = {
    chain: {
      address,
      arg: {
        hash160: (value: string) => ({ type: "Hash160", value }),
        byteArray: (value: string) => ({ type: "ByteArray", value }),
      },
      readRaw,
      invoke,
      ensureWallet: vi.fn(async () => {
        if (!address.get()) address.set(OWNER_ADDRESS);
        return address.get() ?? "";
      }),
      detectNetwork: vi.fn(async () => options.network ?? "mainnet"),
      waitForState: vi.fn(async (
        read: () => Promise<unknown>,
        predicate: (value: unknown) => boolean,
      ) => {
        const value = await read();
        return predicate(value) ? value : null;
      }),
    },
    events: {
      waitFor: vi.fn(async () => options.recoveryEvent ?? null),
    },
    storage: {
      local: {
        get: <T,>(key: string, fallback: T | null = null) =>
          (storage.has(key) ? storage.get(key) : fallback) as T | null,
        set: (key: string, value: unknown) => {
          if (!storageWritable) return;
          storage.set(key, value);
        },
        delete: (key: string) => {
          if (!storageWritable) return;
          storage.delete(key);
        },
      },
    },
  } as unknown as MiniAppFramework;

  return { app, address, faultedReads, invoke, readRaw, snapshot, storage };
}

describe("AA Permissions composable", () => {
  it("accepts a complete snapshot and clears it on any later read failure", async () => {
    const harness = makeHarness();
    const lab = useAAPermissionsLab({ app: harness.app, network: "mainnet", t });
    lab.form.accountIdHash = ACCOUNT;

    await lab.refreshState();
    expect(lab.permissionSnapshot.get()).toMatchObject({
      accountId: ACCOUNT,
      aaCore: CORE,
      verifier: VERIFIER,
      hook: HOOK,
      backupOwner: OWNER_HASH,
    });
    expect(harness.readRaw).toHaveBeenCalledTimes(7);

    harness.faultedReads.add("getHook");
    await expect(lab.refreshState()).rejects.toThrow("permissionReadInvalid:hook");
    expect(lab.permissionSnapshot.get()).toBeNull();
    expect(lab.currentVerifier.get()).toBe("");
    expect(lab.hasInspected.get()).toBe(false);
  });

  it("blocks writes for the wrong wallet or exact-network mismatch", async () => {
    const wrongOwner = makeHarness({ connectedAddress: WRONG_ADDRESS });
    const ownerLab = useAAPermissionsLab({ app: wrongOwner.app, network: "mainnet", t });
    ownerLab.form.accountIdHash = ACCOUNT;
    ownerLab.form.verifierHash = TARGET;
    await ownerLab.refreshState();
    await expect(ownerLab.submitVerifier()).rejects.toThrow("notBackupOwner");
    expect(wrongOwner.invoke).not.toHaveBeenCalled();

    const wrongNetwork = makeHarness({ network: "testnet" });
    const networkLab = useAAPermissionsLab({ app: wrongNetwork.app, network: "mainnet", t });
    networkLab.form.accountIdHash = ACCOUNT;
    networkLab.form.verifierHash = TARGET;
    await networkLab.refreshState();
    await expect(networkLab.submitVerifier()).rejects.toThrow("walletNetworkMismatch");
    expect(wrongNetwork.invoke).not.toHaveBeenCalled();
  });

  it("treats an empty verifier lane as an immediate install and confirms by exact state", async () => {
    const harness = makeHarness({ snapshot: { verifier: "" } });
    const lab = useAAPermissionsLab({ app: harness.app, network: "mainnet", t });
    lab.form.accountIdHash = ACCOUNT;
    lab.form.verifierHash = TARGET;
    lab.form.verifierParamsHex = "aabb";
    await lab.refreshState();

    const outcome = await lab.submitVerifier();

    expect(outcome).toMatchObject({
      operation: "install-verifier",
      immediateInstall: true,
      confirmed: true,
    });
    expect(harness.invoke).toHaveBeenCalledWith(
      "updateVerifier",
      [
        { type: "Hash160", value: ACCOUNT },
        { type: "Hash160", value: TARGET },
        { type: "ByteArray", value: "aabb" },
      ],
      expect.objectContaining({ waitForEvent: "VerifierUpdateConfirmed" }),
    );
    expect(lab.currentVerifier.get()).toBe(TARGET);
    expect(lab.pendingTransaction.get()).toBeNull();
  });

  it("creates a timelocked proposal for a non-empty lane", async () => {
    const harness = makeHarness();
    const lab = useAAPermissionsLab({ app: harness.app, network: "mainnet", t });
    lab.form.accountIdHash = ACCOUNT;
    lab.form.verifierHash = TARGET;
    await lab.refreshState();

    const outcome = await lab.submitVerifier();

    expect(outcome).toMatchObject({ operation: "propose-verifier", confirmed: true });
    expect(lab.hasPendingVerifier.get()).toBe(true);
    expect(lab.proposalVerifier.get()).toMatchObject({ targetHash: TARGET, previousHash: VERIFIER });
    expect(harness.invoke).toHaveBeenCalledWith(
      "updateVerifier",
      expect.any(Array),
      expect.objectContaining({ waitForEvent: "VerifierUpdateInitiated" }),
    );
  });

  it("keeps a txid-only proposal recoverable instead of claiming success", async () => {
    const harness = makeHarness({ eventVerified: false });
    const lab = useAAPermissionsLab({ app: harness.app, network: "mainnet", t });
    lab.form.accountIdHash = ACCOUNT;
    lab.form.verifierHash = TARGET;
    await lab.refreshState();

    const outcome = await lab.submitVerifier();

    expect(outcome.confirmed).toBe(false);
    expect(lab.pendingTransaction.get()).toMatchObject({
      txid: TXID,
      operation: "propose-verifier",
      accountId: ACCOUNT,
    });
    expect(lab.hasInspected.get()).toBe(false);
    expect(lab.lastWriteStatus.get()).toBe("transactionAwaitingConfirmation");
  });

  it("recovers a saved proposal without invoking it again", async () => {
    const storage = new Map<string, unknown>();
    storage.set("permissions/pending-transaction-v1", buildPendingPermissionTransaction({
      network: "mainnet",
      aaCore: CORE,
      accountId: ACCOUNT,
      walletHash: OWNER_HASH,
      operation: "propose-verifier",
      targetHash: TARGET,
      previousHash: VERIFIER,
      txid: TXID,
    }));
    const harness = makeHarness({
      storage,
      recoveryEvent: { name: "VerifierUpdateInitiated" },
      snapshot: {
        pendingVerifier: true,
        verifierUnlockAt: Date.now() + 86_400_000,
      },
    });
    const lab = useAAPermissionsLab({ app: harness.app, network: "mainnet", t });

    await lab.loadAll();

    expect(harness.invoke).not.toHaveBeenCalled();
    expect(lab.pendingTransaction.get()).toBeNull();
    expect(lab.proposalVerifier.get()).toMatchObject({ targetHash: TARGET });
    expect(lab.hasPendingVerifier.get()).toBe(true);
  });

  it("clears a saved permission transaction only after VM FAULT is proven", async () => {
    const storage = new Map<string, unknown>();
    storage.set("permissions/pending-transaction-v1", buildPendingPermissionTransaction({
      network: "mainnet",
      aaCore: CORE,
      accountId: ACCOUNT,
      walletHash: OWNER_HASH,
      operation: "propose-verifier",
      targetHash: TARGET,
      previousHash: VERIFIER,
      txid: TXID,
    }));
    const harness = makeHarness({ storage });
    const lab = useAAPermissionsLab({
      app: harness.app,
      network: "mainnet",
      t,
      transactionStateReader: async () => "fault",
    });

    await lab.loadAll();

    expect(harness.invoke).not.toHaveBeenCalled();
    expect(lab.pendingTransaction.get()).toBeNull();
    expect(lab.lastWriteStatus.get()).toBe("transactionFaulted");
  });

  it("parses HALT, FAULT, and unavailable application logs without guessing", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { executions: [{ vmstate: "HALT" }] } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ result: { executions: [{ vmstate: "FAULT, BREAK" }] } }), { status: 200 }))
      .mockRejectedValueOnce(new TypeError("offline"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(readPermissionTransactionState("mainnet", TXID)).resolves.toBe("halt");
    await expect(readPermissionTransactionState("mainnet", TXID)).resolves.toBe("fault");
    await expect(readPermissionTransactionState("mainnet", TXID)).resolves.toBe("unknown");
  });

  it("confirms an elapsed verifier proposal and cancels a hook proposal", async () => {
    const verifierHarness = makeHarness({ snapshot: {
      pendingVerifier: true,
      verifierUnlockAt: Date.now() - 1,
      pendingVerifierTarget: TARGET,
    } });
    const verifierLab = useAAPermissionsLab({ app: verifierHarness.app, network: "mainnet", t });
    verifierLab.form.accountIdHash = ACCOUNT;
    await verifierLab.refreshState();
    const confirmed = await verifierLab.confirmVerifier();
    expect(confirmed.operation).toBe("confirm-verifier");
    expect(verifierHarness.invoke).toHaveBeenCalledWith(
      "confirmVerifierUpdate",
      [{ type: "Hash160", value: ACCOUNT }],
      expect.objectContaining({ waitForEvent: "VerifierUpdateConfirmed" }),
    );

    const hookHarness = makeHarness({ snapshot: {
      pendingHook: true,
      hookUnlockAt: Date.now() + 86_400_000,
    } });
    const hookLab = useAAPermissionsLab({ app: hookHarness.app, network: "mainnet", t });
    hookLab.form.accountIdHash = ACCOUNT;
    await hookLab.refreshState();
    const cancelled = await hookLab.cancelHook();
    expect(cancelled.operation).toBe("cancel-hook");
    expect(hookHarness.snapshot.hook).toBe(HOOK);
    expect(hookHarness.snapshot.pendingHook).toBe(false);
  });

  it("fails closed before signing when recovery storage is not writable", async () => {
    const harness = makeHarness({ storageWritable: false });
    const lab = useAAPermissionsLab({ app: harness.app, network: "mainnet", t });
    lab.form.accountIdHash = ACCOUNT;
    lab.form.verifierHash = TARGET;
    await lab.refreshState();

    await expect(lab.submitVerifier()).rejects.toThrow("recoveryStorageUnavailable");
    expect(lab.storageHealthy.get()).toBe(false);
    expect(harness.invoke).not.toHaveBeenCalled();
  });
});
