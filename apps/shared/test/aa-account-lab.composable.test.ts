import { describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import type { ChainService } from "../services";
import type { StorageProxy } from "../services/os/StorageProxy";
import { createMiniAppFramework } from "../react";
import { getExternalIntegrationConfig } from "../constants/rpc";
import { useAAAccountLab } from "../../aa-account-lab/src/composables/useAAAccountLab";
import { deriveRegistrationAccountIdHash } from "../utils/aa-account";
import type {
  AARegistrationOutcome,
  PendingAARegistration,
} from "../../aa-account-lab/src/registration-recovery";

const WALLET_ADDRESS = "NR3E4D8NUXh3zhbf5ZkAp3rTxWbQqNih32";
const WALLET_HASH = "0x6d0656f6dd91469db1c90cc1e574380613f43738";
const VERIFIER_HASH = getExternalIntegrationConfig("mainnet").contracts.aaWeb3AuthVerifier.toLowerCase();
const VERIFIER_PARAMS = `04${"11".repeat(64)}`;
const ZERO_HASH = "0x0000000000000000000000000000000000000000";
const TXID = `0x${"ab".repeat(32)}`;
const CORE = getExternalIntegrationConfig("mainnet").contracts.aaCore.toLowerCase();

function t(key: string, params?: Record<string, string | number>) {
  const messages: Record<string, string> = {
    notAvailable: "Not available",
    backupOwnerMustSign: "The backup owner must sign this transaction.",
    invalidTimelock: "Invalid timelock",
    invalidBackupOwner: "Invalid backup owner",
    timelockDays: "{days} days",
    escapeActive: "Escape active",
    escapeInactive: "Inactive",
    registrationConfirmed: "Registration confirmed",
    registrationPending: "Registration pending",
    registrationFaulted: "Registration faulted",
  };
  let value = messages[key] ?? key;
  for (const [name, replacement] of Object.entries(params ?? {})) {
    value = value.replace(`{${name}}`, String(replacement));
  }
  return value;
}

function hashStack(displayHash: string) {
  return {
    type: "ByteString",
    value: Buffer.from(displayHash.replace(/^0x/, ""), "hex").reverse().toString("base64"),
  };
}

function matchingOutcome(pending: PendingAARegistration): AARegistrationOutcome {
  return {
    state: "halt",
    notifications: [{
      contract: pending.coreHash,
      eventName: "AccountRegistered",
      values: [
        hashStack(pending.accountId),
        hashStack(pending.backupOwner),
        hashStack(pending.verifier),
        hashStack(pending.hook),
      ],
    }],
  };
}

function makeStorage(initial?: unknown) {
  const values = new Map<string, unknown>();
  if (initial !== undefined) values.set("aa-account-registration:v1", initial);
  return {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: unknown) => { values.set(key, value); }),
    delete: vi.fn(async (key: string) => { values.delete(key); }),
  } as unknown as StorageProxy & {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
}

function makeChain(address: string | null) {
  let registered = false;
  const read = vi.fn(async (operation: string) => {
    if (operation === "getVerifier") return hashStack(registered ? VERIFIER_HASH : ZERO_HASH);
    if (operation === "getHook") return hashStack(ZERO_HASH);
    if (operation === "getBackupOwner") return hashStack(registered ? WALLET_HASH : ZERO_HASH);
    if (operation === "getEscapeTimelock") return { type: "Integer", value: registered ? "2592000" : "0" };
    if (operation === "isEscapeActive") return { type: "Boolean", value: false };
    throw new Error(`unexpected read ${operation}`);
  });
  const invoke = vi.fn(async (
    _operation: string,
    _args: unknown[],
    options?: { onTransactionSent?: (txid: string) => void },
  ) => {
    registered = true;
    options?.onTransactionSent?.(TXID);
    return { txid: TXID };
  });
  return {
    address: createObservable<string | null>(address),
    contractAddress: createObservable<string | null>(CORE),
    ensureWallet: vi.fn(async () => address ?? ""),
    detectNetwork: vi.fn(async () => "neo-n3-mainnet"),
    read,
    invoke,
  } as unknown as ChainService & {
    invoke: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
  };
}

function makeApp(chain: ChainService) {
  return createMiniAppFramework(
    { services: { chain }, t } as never,
    { appId: "miniapp-aa-account-lab" },
  );
}

function makeLab(chain: ChainService, storage = makeStorage()) {
  return useAAAccountLab({
    app: makeApp(chain),
    storageService: storage,
    t,
    outcomeReader: async (pending) => matchingOutcome(pending),
    sleep: async () => undefined,
  });
}

function baseForm(lab: ReturnType<typeof useAAAccountLab>) {
  lab.registerForm.verifierHash = VERIFIER_HASH;
  lab.registerForm.verifierParamsHex = VERIFIER_PARAMS;
  lab.registerForm.hookHash = "";
  lab.registerForm.backupOwner = WALLET_ADDRESS;
  lab.registerForm.escapeTimelock = "2592000";
}

describe("AA Account Lab production registration flow", () => {
  it("derives the contract AccountId, persists the broadcast, and confirms event plus full readback", async () => {
    const chain = makeChain(WALLET_ADDRESS);
    const storage = makeStorage();
    const lab = makeLab(chain, storage);
    baseForm(lab);

    await expect(lab.submitRegister()).resolves.toMatchObject({ status: "confirmed", txid: TXID });

    const expectedId = deriveRegistrationAccountIdHash({
      verifierContractHash: VERIFIER_HASH,
      verifierParamsHex: VERIFIER_PARAMS,
      hookContractHash: "",
      backupOwnerAddress: WALLET_ADDRESS,
      escapeTimelock: 2_592_000,
    });
    const call = chain.invoke.mock.calls[0];
    expect(call[0]).toBe("registerAccount");
    expect(call[1][0]).toEqual({ type: "Hash160", value: `0x${expectedId}` });
    expect(storage.set).toHaveBeenCalledWith(
      "aa-account-registration:v1",
      expect.objectContaining({ txid: TXID, accountId: `0x${expectedId}`, network: "mainnet" }),
    );
    expect(storage.delete).toHaveBeenCalledWith("aa-account-registration:v1");
    expect(lab.pendingRegistration.get()).toBeNull();
    expect(lab.currentVerifier.get()).toBe(VERIFIER_HASH);
    expect(lab.currentBackupOwner.get()).toBe(WALLET_HASH);
    expect(lab.currentEscapeTimelock.get()).toBe("30 days");
  });

  it("keeps a broadcast transaction durable and pending when the application log is unavailable", async () => {
    const chain = makeChain(WALLET_ADDRESS);
    const storage = makeStorage();
    const lab = useAAAccountLab({
      app: makeApp(chain),
      storageService: storage,
      t,
      outcomeReader: async () => ({ state: "unknown", notifications: [] }),
      sleep: async () => undefined,
    });
    baseForm(lab);

    await expect(lab.submitRegister()).resolves.toMatchObject({ status: "pending", txid: TXID });
    expect(lab.pendingRegistration.get()?.txid).toBe(TXID);
    expect(storage.delete).not.toHaveBeenCalled();
    await expect(lab.submitRegister()).rejects.toThrow("pendingBlocksRegistration");
  });

  it("requires a complete uncompressed identity key for the canonical Web3Auth verifier", async () => {
    const chain = makeChain(WALLET_ADDRESS);
    const lab = makeLab(chain);
    baseForm(lab);
    lab.registerForm.verifierParamsHex = "";

    await expect(lab.submitRegister()).rejects.toThrow("invalidWeb3AuthPublicKey");
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("clears a durable pending record only after an explicit VM FAULT", async () => {
    const chain = makeChain(WALLET_ADDRESS);
    const storage = makeStorage();
    const lab = useAAAccountLab({
      app: makeApp(chain),
      storageService: storage,
      t,
      outcomeReader: async () => ({ state: "fault", notifications: [] }),
      sleep: async () => undefined,
    });
    baseForm(lab);

    await expect(lab.submitRegister()).resolves.toMatchObject({ status: "fault", txid: TXID });
    expect(storage.delete).toHaveBeenCalledWith("aa-account-registration:v1");
    expect(lab.pendingRegistration.get()).toBeNull();
  });

  it("keeps a halted transaction pending when AccountRegistered evidence does not match", async () => {
    const chain = makeChain(WALLET_ADDRESS);
    const storage = makeStorage();
    const lab = useAAAccountLab({
      app: makeApp(chain),
      storageService: storage,
      t,
      outcomeReader: async () => ({ state: "halt", notifications: [] }),
      sleep: async () => undefined,
    });
    baseForm(lab);

    await expect(lab.submitRegister()).resolves.toMatchObject({ status: "pending", txid: TXID });
    expect(storage.delete).not.toHaveBeenCalled();
    expect(lab.lastError.get()).toBe("registrationEvidenceMismatch");
  });

  it("restores the exact pending transaction after restart without rebroadcasting", async () => {
    const pending: PendingAARegistration = {
      version: 1,
      txid: TXID,
      network: "mainnet",
      coreHash: CORE,
      accountId: `0x${"11".repeat(20)}`,
      verifier: VERIFIER_HASH,
      hook: ZERO_HASH,
      backupOwner: WALLET_HASH,
      escapeTimelock: 2_592_000,
      createdAt: Date.now(),
    };
    const chain = makeChain(WALLET_ADDRESS);
    const lab = makeLab(chain, makeStorage(pending));

    await lab.loadAll();

    expect(lab.pendingRegistration.get()).toEqual(pending);
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("blocks registration when the backup owner is not the connected wallet", async () => {
    const chain = makeChain("NgaiKFjurmNmiRzDRQGs44yzByXuSkdGPF");
    const lab = makeLab(chain);
    baseForm(lab);

    await expect(lab.submitRegister()).rejects.toThrow(
      "The backup owner must sign this transaction.",
    );
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("preserves canonical Hash160 display order during a complete inspect", async () => {
    const chain = makeChain(WALLET_ADDRESS);
    chain.read = vi.fn()
      .mockResolvedValueOnce(hashStack(WALLET_HASH))
      .mockResolvedValueOnce(hashStack(ZERO_HASH))
      .mockResolvedValueOnce(hashStack(WALLET_HASH))
      .mockResolvedValueOnce({ type: "Integer", value: "2592000" })
      .mockResolvedValueOnce({ type: "Boolean", value: false });
    const lab = makeLab(chain);
    lab.inspectForm.accountIdInput = WALLET_HASH;

    await lab.inspectAccount();

    expect(lab.currentVerifier.get()).toBe(WALLET_HASH);
    expect(lab.currentBackupOwner.get()).toBe(WALLET_HASH);
    expect(lab.currentHook.get()).toBe("Not available");
    expect(lab.currentEscapeTimelock.get()).toBe("30 days");
    expect(lab.hasInspected.get()).toBe(true);
  });

  it("does not replace an incomplete read with zero/empty account state", async () => {
    const chain = makeChain(WALLET_ADDRESS);
    chain.read = vi.fn().mockRejectedValue(new Error("rpc unavailable"));
    const lab = makeLab(chain);
    lab.inspectForm.accountIdInput = WALLET_HASH;

    await expect(lab.inspectAccount()).rejects.toThrow("rpc unavailable");
    expect(lab.hasInspected.get()).toBe(false);
    expect(lab.currentVerifier.get()).toBe("Not available");
  });
});
