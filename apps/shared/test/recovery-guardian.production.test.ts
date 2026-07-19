import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "../react";
import { createObservable } from "../react/context";
import type { MiniAppFrameworkChain } from "../../../framework";
import {
  FIRST_TIME_RECOVERY_SETUP_AVAILABLE,
  MIN_RECOVERY_DELAY_MS,
  parseRecoveryProfileId,
  type RecoveryProfile,
} from "../../recovery-guardian/src/recovery-guardian";
import { useRecoveryGuardian } from "../../recovery-guardian/src/useRecoveryGuardian";

const PROFILE_A = `0x${"11".repeat(20)}`;
const PROFILE_B = `0x${"12".repeat(20)}`;
const OWNER = "0x0102030405060708090a0b0c0d0e0f1011121314";
const ACCOUNT = "0x15161718191a1b1c1d1e1f202122232425262728";
const AA_CORE = "0xdbf38e7b2117186bf7a5e17ead702322c0c5b6f2";
const ORACLE = "0xf54d8584ef82315c1800373272ab08ae0db2d5ef";
const CONTRACT = "0x198b3a9cec9bccc2110d19bd929b10374a9d034d";
const VERIFIER = `02${"66".repeat(32)}`;
const COMMITMENT = `0x${"77".repeat(32)}`;

function t(key: string) {
  return key;
}

function bytes(hex: string): Uint8Array {
  const value = hex.replace(/^0x/, "");
  return Uint8Array.from(value.match(/../g) ?? [], (part) => Number.parseInt(part, 16));
}

function base64(value: Uint8Array): string {
  return Buffer.from(value).toString("base64");
}

function hashStack(displayHash: string) {
  return { type: "ByteString", value: base64(bytes(displayHash).reverse()) };
}

function byteStack(hex: string) {
  return { type: "ByteString", value: base64(bytes(hex)) };
}

function integer(value: number | string) {
  return { type: "Integer", value: String(value) };
}

function batchResponse(overrides: Record<string, unknown> = {}) {
  const values: Record<string, unknown> = {
    getOwner: hashStack(OWNER),
    getAAContract: hashStack(AA_CORE),
    getAccountAddress: hashStack(ACCOUNT),
    getMorpheusOracle: hashStack(ORACLE),
    getNetwork: { type: "ByteString", value: base64(Buffer.from("neo_n3")) },
    getAccountIdText: { type: "ByteString", value: base64(Buffer.from("family-wallet")) },
    getThreshold: integer(1),
    getTimelock: integer(MIN_RECOVERY_DELAY_MS),
    getRecoveryNonce: integer(0),
    getMorpheusVerifier: byteStack(`0x${VERIFIER}`),
    getMasterNullifiers: { type: "Array", value: [byteStack(COMMITMENT)] },
    getPendingRecovery: {
      type: "Struct",
      value: [
        hashStack(`0x${"00".repeat(20)}`),
        integer(-1),
        integer(0),
        integer(0),
        integer(0),
        { type: "Boolean", value: false },
      ],
    },
    aaVerifier: hashStack(CONTRACT),
    aaBackupOwner: hashStack(OWNER),
    ...overrides,
  };
  return Object.entries(values).map(([id, value]) => ({
    jsonrpc: "2.0",
    id,
    result: { state: "HALT", stack: [value] },
  }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function profile(sourceNetwork: "mainnet" | "testnet" = "mainnet"): RecoveryProfile {
  return {
    sourceNetwork,
    configured: true,
    aaBindingVerified: true,
    aaVerifierHash: CONTRACT,
    aaBackupOwner: OWNER,
    profileId: parseRecoveryProfileId(PROFILE_A)!,
    owner: OWNER,
    aaContract: AA_CORE,
    accountAddress: ACCOUNT,
    morpheusOracle: ORACLE,
    networkLabel: "neo_n3",
    accountIdText: "family-wallet",
    threshold: 1,
    timelockMs: MIN_RECOVERY_DELAY_MS,
    recoveryNonce: "0",
    morpheusVerifier: VERIFIER,
    masterNullifiers: [COMMITMENT],
    pending: {
      active: false,
      newOwner: "",
      recoveryNonce: "-1",
      approvedCount: 0,
      initiatedAt: 0,
      executableAt: 0,
    },
    checkedAt: "2026-07-11T00:00:00.000Z",
  };
}

function harness(detectedNetwork: "mainnet" | "testnet" = "testnet") {
  const chain = {
    address: createObservable<string | null>(ACCOUNT),
    contractAddress: createObservable<string | null>(CONTRACT),
    ensureWallet: vi.fn(async () => ACCOUNT),
    detectNetwork: vi.fn(async () => detectedNetwork),
    read: vi.fn(),
    invoke: vi.fn(),
    invokeWithPayment: vi.fn(),
    listEvents: vi.fn(async () => []),
  } as unknown as MiniAppFrameworkChain;
  const app = createMiniAppFramework(
    {
      services: { chain },
      t,
      launchContext: { appId: "miniapp-recovery-guardian", params: {} },
    } as never,
    {
      appId: "miniapp-recovery-guardian",
      storagePrefix: `test:recovery-guardian:${Math.random()}:`,
    },
  );
  return { guardian: useRecoveryGuardian({ app, t }), app, chain };
}

beforeEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Recovery Guardian production state", () => {
  it("prevents a slower previous profile read from overwriting the latest account", async () => {
    const firstResponse = deferred<Response>();
    const secondResponse = deferred<Response>();
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => firstResponse.promise)
      .mockImplementationOnce(() => secondResponse.promise);
    vi.stubGlobal("fetch", fetchMock);
    const { guardian } = harness();

    guardian.setField("profileInput", PROFILE_A);
    const first = guardian.loadProfile();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    guardian.setField("profileInput", PROFILE_B);
    const second = guardian.loadProfile();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    secondResponse.resolve(new Response(JSON.stringify(batchResponse()), { status: 200 }));
    await second;
    firstResponse.resolve(new Response(JSON.stringify(batchResponse()), { status: 200 }));
    await first;

    expect(guardian.profile.get()?.profileId.hex).toBe(PROFILE_B);
    expect(guardian.profile.get()?.sourceNetwork).toBe("testnet");
    expect(guardian.lastError.get()).toBe("");
  });

  it("refuses to continue a mainnet profile after the connected wallet resolves to testnet", async () => {
    const { guardian } = harness("testnet");
    const loaded = profile("mainnet");
    guardian.profileInput.set(loaded.profileId.hex);
    guardian.profile.set(loaded);
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    await expect(guardian.continueRecovery()).resolves.toBe("");

    expect(open).not.toHaveBeenCalled();
    expect(guardian.lastError.get()).toBe("recoveryChainContextMismatch");
  });

  it("labels an AA profile with no owner review delay as needing policy review", () => {
    const { guardian } = harness("mainnet");
    guardian.profile.set({ ...profile("mainnet"), timelockMs: 0 });
    expect(guardian.journeyState.get()).toBe("legacy-policy");
  });

  it("blocks first-time setup before wallet or invoke while the deployed verifier lacks AA owner binding", async () => {
    const { guardian, chain } = harness("testnet");
    expect(FIRST_TIME_RECOVERY_SETUP_AVAILABLE).toBe(false);
    expect(guardian.setupWriteAvailable.get()).toBe(false);

    await expect(guardian.reviewSetupPackage()).resolves.toBeNull();
    await expect(guardian.submitSetup()).resolves.toBeNull();

    expect(guardian.lastError.get()).toBe("setupContractUpgradeRequired");
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();
  });

  it("blocks the wallet before signing when recovery storage cannot round-trip", async () => {
    const { guardian, app, chain } = harness("testnet");
    const ready = profile("testnet");
    ready.pending = {
      active: true,
      newOwner: ACCOUNT,
      recoveryNonce: "0",
      approvedCount: 1,
      initiatedAt: Date.now() - 90_000,
      executableAt: Date.now() - 1_000,
    };
    guardian.profileInput.set(ready.profileId.hex);
    guardian.profile.set(ready);

    await expect(guardian.submitFinalize()).resolves.toMatchObject({ status: "confirmation-required" });
    const storageSet = vi.spyOn(app.storage.local, "set").mockImplementation(() => undefined);

    await expect(guardian.submitFinalize()).resolves.toBeNull();

    expect(guardian.storageHealthy.get()).toBe(false);
    expect(guardian.lastError.get()).toBe("recoveryStorageUnavailable");
    expect(chain.ensureWallet).not.toHaveBeenCalled();
    expect(chain.invoke).not.toHaveBeenCalled();

    storageSet.mockRestore();
    expect(guardian.refreshRecoveryStorage()).toBe(true);
    expect(guardian.storageHealthy.get()).toBe(true);
    expect(guardian.lastSuccess.get()).toBe("recoveryStorageRestored");
  });

  it("rereads the pending target before finalization and refuses a stale new-owner wallet", async () => {
    const { guardian, chain } = harness("testnet");
    const ready = profile("testnet");
    ready.pending = {
      active: true,
      newOwner: ACCOUNT,
      recoveryNonce: "0",
      approvedCount: 1,
      initiatedAt: Date.now() - 90_000,
      executableAt: Date.now() - 1_000,
    };
    guardian.profileInput.set(ready.profileId.hex);
    guardian.profile.set(ready);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      getPendingRecovery: {
        type: "Struct",
        value: [
          hashStack(OWNER),
          integer(0),
          integer(1),
          integer(Date.now() - 90_000),
          integer(Date.now() - 1_000),
          { type: "Boolean", value: true },
        ],
      },
    })), { status: 200 })));

    await guardian.submitFinalize();
    await expect(guardian.submitFinalize()).resolves.toBeNull();

    expect(guardian.lastError.get()).toBe("newOwnerWalletRequired");
    expect(chain.ensureWallet).toHaveBeenCalledTimes(1);
    expect(chain.invoke).not.toHaveBeenCalled();
    expect(guardian.profile.get()?.pending.newOwner).toBe(OWNER);
  });

  it("keeps the exact broadcast in memory and refuses a replacement signature when journal persistence is lost", async () => {
    const { guardian, app, chain } = harness("testnet");
    const ready = profile("testnet");
    ready.pending = {
      active: true,
      newOwner: ACCOUNT,
      recoveryNonce: "0",
      approvedCount: 1,
      initiatedAt: Date.now() - 90_000,
      executableAt: Date.now() - 1_000,
    };
    guardian.profileInput.set(ready.profileId.hex);
    guardian.profile.set(ready);
    const txid = `0x${"ab".repeat(32)}`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      getPendingRecovery: {
        type: "Struct",
        value: [
          hashStack(ACCOUNT),
          integer(0),
          integer(1),
          integer(Date.now() - 90_000),
          integer(Date.now() - 1_000),
          { type: "Boolean", value: true },
        ],
      },
    })), { status: 200 })));

    await guardian.submitFinalize();
    const realSet = app.storage.local.set.bind(app.storage.local);
    const storageSet = vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      if (key !== "state/pendingRecoveryWrite") realSet(key, value);
    });
    vi.mocked(chain.invoke).mockImplementation(async (_operation, _args, options) => {
      options?.onTransactionSent?.(txid);
      return { txid };
    });

    await expect(guardian.submitFinalize()).resolves.toBeNull();

    expect(guardian.pendingWrite.get()).toMatchObject({ kind: "finalize", txid });
    expect(guardian.storageHealthy.get()).toBe(false);
    expect(guardian.lastError.get()).toBe("recoveryStorageUnavailableAfterBroadcast");
    expect(chain.invoke).toHaveBeenCalledTimes(1);

    await guardian.submitFinalize();
    expect(chain.invoke).toHaveBeenCalledTimes(1);
    expect(guardian.pendingWrite.get()?.txid).toBe(txid);

    storageSet.mockRestore();
    expect(guardian.refreshRecoveryStorage()).toBe(true);
    expect(guardian.storageHealthy.get()).toBe(true);
    expect(guardian.pendingWrite.get()?.txid).toBe(txid);
    expect(app.storage.local.get("state/pendingRecoveryWrite", null)).toEqual(guardian.pendingWrite.get());
  });

  it("restores a durable journal after the initial storage read path recovers", () => {
    const { guardian, app } = harness("testnet");
    const txid = `0x${"cd".repeat(32)}`;
    const pending = {
      version: 1 as const,
      kind: "finalize" as const,
      txid,
      createdAt: Date.now(),
      network: "testnet" as const,
      verifierHash: CONTRACT,
      profileHex: PROFILE_A,
      actorHash: ACCOUNT,
      beforeOwner: OWNER,
      beforeNonce: "0",
      expectedNewOwner: ACCOUNT,
    };
    app.storage.local.set("state/pendingRecoveryWrite", pending);
    guardian.pendingWrite.set(null);
    guardian.storageHealthy.set(false);

    expect(guardian.refreshRecoveryStorage()).toBe(true);

    expect(guardian.storageHealthy.get()).toBe(true);
    expect(guardian.pendingWrite.get()).toEqual(pending);
    expect(guardian.profileInput.get()).toBe(PROFILE_A);
    expect(guardian.network.get()).toBe("testnet");
    expect(guardian.transactionNotice.get()).toBe("recoveryTransactionPending");
  });
});
