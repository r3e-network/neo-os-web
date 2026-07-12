import { afterEach, describe, expect, it, vi } from "vitest";

import { createObservable } from "../react/context";
import { createMiniAppFramework } from "../react";
import type { ContractArg, TxResult } from "../services";
import { GAS_HASH } from "../constants";
import { addressToScriptHash } from "../utils/neo";
import {
  createVaultSafety,
  isPendingVaultOperation,
  recoveryChecksumFor,
  type PendingVaultOperation,
} from "../../unbreakable-vault/src/composables/vaultSafety";

const ME = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ME_HASH = addressToScriptHash(ME);
const CONTRACT = "0x78fbd57ccfae14fff4b043a82eb491de542d8eb0";
const PAYMENT_TXID = `0x${"a".repeat(64)}`;
const ACTION_TXID = `0x${"b".repeat(64)}`;
const SECRET_HASH_BASE64 = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

interface VaultRecord {
  id: string;
  creator: string;
  bounty: number;
  attemptCount: number;
  difficulty: number;
  difficultyName: string;
  attemptFee: number;
  createdTime: number;
  expiryTime: number;
  hintsRevealed: number;
  broken: boolean;
  expired: boolean;
  winner: string;
  title: string;
  description: string;
  status: string;
}

function record(partial: Partial<VaultRecord> & { id: string }): VaultRecord {
  return {
    creator: ME_HASH,
    bounty: 100_000_000,
    attemptCount: 0,
    difficulty: 1,
    difficultyName: "Easy",
    attemptFee: 10_000_000,
    createdTime: Date.now(),
    expiryTime: Date.now() + 86_400_000,
    hintsRevealed: 0,
    broken: false,
    expired: false,
    winner: "",
    title: "Cipher",
    description: "Hint",
    status: "active",
    ...partial,
  };
}

function paymentLog(amount: string) {
  return {
    ok: true,
    json: async () => ({
      result: {
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: GAS_HASH,
            eventname: "Transfer",
            // Deployed GAS ABI is the standard three-slot Transfer event. No
            // memo is invented in slot 3.
            state: {
              type: "Array",
              value: [
                { type: "Hash160", value: ME_HASH },
                { type: "Hash160", value: CONTRACT },
                { type: "Integer", value: amount },
              ],
            },
          }],
        }],
      },
    }),
  } as Response;
}

function faultLog() {
  return {
    ok: true,
    json: async () => ({
      result: {
        executions: [{ vmstate: "FAULT", notifications: [] }],
      },
    }),
  } as Response;
}

function recomputeRecoveryChecksum(
  pending: PendingVaultOperation,
  changes: Partial<PendingVaultOperation>,
): PendingVaultOperation {
  const changed = { ...pending, ...changes };
  const {
    binding: _binding,
    stage: _stage,
    txid: _txid,
    paymentTxid: _paymentTxid,
    ...checksumFields
  } = changed;
  return { ...changed, binding: recoveryChecksumFor(checksumFields) };
}

function setup(initial: VaultRecord[] = []) {
  const vaults = new Map(initial.map((vault) => [vault.id, vault]));
  const address = createObservable<string | null>(ME);
  const directInvokes: Array<{ operation: string; args: ContractArg[] }> = [];
  const invokeWithPayment = vi.fn(async (): Promise<TxResult> => ({
    txid: ACTION_TXID,
    success: true,
    verified: false,
  }));
  const invoke = vi.fn(async (
    operation: string,
    args: ContractArg[],
    options?: { onTransactionSent?: (txid: string) => void },
  ): Promise<TxResult> => {
    directInvokes.push({ operation, args });
    options?.onTransactionSent?.(ACTION_TXID);
    if (operation === "createVault") {
      const created = record({
        id: "1",
        creator: ME_HASH,
        bounty: Number(args[2]?.value ?? 0),
        difficulty: Number(args[3]?.value ?? 0),
        title: String(args[4]?.value ?? ""),
        description: String(args[5]?.value ?? ""),
      });
      vaults.set("1", created);
      return {
        txid: ACTION_TXID,
        success: true,
        verified: true,
        event: { state: [
          { value: "1" },
          { value: ME_HASH },
          { value: String(created.bounty) },
          { value: String(created.difficulty) },
        ] },
      };
    }
    if (operation === "attemptBreak") {
      const id = String(args[0]?.value ?? "");
      const before = vaults.get(id)!;
      vaults.set(id, {
        ...before,
        bounty: before.bounty + before.attemptFee,
        attemptCount: before.attemptCount + 1,
      });
      return {
        txid: ACTION_TXID,
        success: true,
        verified: true,
        event: { state: [
          { value: id },
          { value: ME_HASH },
          { value: false },
          { value: String(before.attemptCount + 1) },
        ] },
      };
    }
    throw new Error(`unexpected operation ${operation}`);
  });
  const chain = {
    address,
    contractAddress: createObservable<string | null>(CONTRACT),
    ensureWallet: vi.fn(async () => ME),
    detectNetwork: vi.fn(async () => "testnet"),
    read: vi.fn(async (operation: string, args?: ContractArg[]) => {
      if (operation === "isPaused") return false;
      if (operation === "totalVaults") return vaults.size;
      if (operation === "getVaultDetails") return vaults.get(String(args?.[0]?.value ?? "")) ?? {};
      throw new Error(`unexpected read ${operation}`);
    }),
    readArray: vi.fn(),
    invoke,
    invokeWithPayment,
  };
  const t = (key: string) => key;
  const app = createMiniAppFramework(
    {
      services: { chain },
      t,
      launchContext: { appId: "miniapp-unbreakablevault", network: "testnet" },
    } as never,
    {
      appId: "miniapp-unbreakablevault",
      storagePrefix: `test:unbreakable:production:${Math.random()}:`,
    },
  );
  const safety = createVaultSafety(app, t);
  return { app, safety, chain, directInvokes, invokeWithPayment, vaults };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Unbreakable Vault prepaid recovery", () => {
  it("resumes a CREATE payment through a direct action without paying twice or persisting plaintext", async () => {
    const { safety, directInvokes, invokeWithPayment } = setup();
    const draft = await safety.prepare("create", ME, {
      amountFixed8: "100000000",
      difficulty: 1,
      title: "Cipher",
      description: "Hint",
      secretHashBase64: SECRET_HASH_BASE64,
      beforeTotalVaults: "0",
    });
    safety.persistPayment(draft, PAYMENT_TXID);
    const serialized = JSON.stringify(safety.pendingOperation.get());
    expect(serialized).not.toContain("open sesame");
    expect(serialized).not.toContain('"secret"');

    vi.stubGlobal("fetch", vi.fn(async () => paymentLog("100000000")));
    const result = await safety.recover();

    expect(result).toMatchObject({ status: "confirmed", finalization: { vaultId: "1" } });
    expect(directInvokes.map((call) => call.operation)).toEqual(["createVault"]);
    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(safety.pendingOperation.get()).toBeNull();
  });

  it("keeps an ATTEMPT payment pending until the user re-enters the unstored secret, then spends no second payment", async () => {
    const target = record({ id: "7", bounty: 500_000_000, attemptCount: 2 });
    const { safety, directInvokes, invokeWithPayment } = setup([target]);
    const draft = await safety.prepare("attempt", ME, {
      vaultId: "7",
      amountFixed8: "10000000",
      beforeAttempts: "2",
      beforeBounty: "500000000",
    });
    safety.persistPayment(draft, PAYMENT_TXID);
    expect(JSON.stringify(safety.pendingOperation.get())).not.toContain("guess");

    vi.stubGlobal("fetch", vi.fn(async () => paymentLog("10000000")));
    await expect(safety.recover()).resolves.toMatchObject({
      status: "pending",
      needsSecret: true,
    });
    expect(directInvokes).toHaveLength(0);

    const recovered = await safety.recover("guess");
    expect(recovered).toMatchObject({
      status: "confirmed",
      finalization: { vaultId: "7", broken: false },
    });
    expect(directInvokes.map((call) => call.operation)).toEqual(["attemptBreak"]);
    expect(invokeWithPayment).not.toHaveBeenCalled();
  });

  it.each([
    ["kind", (pending: PendingVaultOperation) => ({ ...pending, kind: "create" as const })],
    ["amount", (pending: PendingVaultOperation) => ({ ...pending, amountFixed8: "99999999" })],
  ])("uses the checksum to reject accidental %s corruption before any call", async (_label, corrupt) => {
    const target = record({ id: "7" });
    const { safety, directInvokes, invokeWithPayment } = setup([target]);
    const draft = await safety.prepare("attempt", ME, {
      vaultId: "7",
      amountFixed8: "10000000",
      beforeAttempts: "0",
      beforeBounty: "100000000",
    });
    safety.persistPayment(draft, PAYMENT_TXID);
    const corrupted = corrupt(safety.pendingOperation.get()!);
    expect(isPendingVaultOperation(corrupted)).toBe(false);
    safety.pendingOperation.set(corrupted as PendingVaultOperation);
    vi.stubGlobal("fetch", vi.fn(async () => paymentLog("10000000")));

    await expect(safety.recover("guess")).rejects.toThrow("pendingInvalid");
    expect(directInvokes).toHaveLength(0);
    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(safety.pendingOperation.get()).toBeNull();
  });

  it("does not trust a recomputed checksum when the transfer amount no longer matches", async () => {
    const target = record({ id: "7" });
    const { safety, directInvokes, invokeWithPayment } = setup([target]);
    const draft = await safety.prepare("attempt", ME, {
      vaultId: "7",
      amountFixed8: "10000000",
      beforeAttempts: "0",
      beforeBounty: "100000000",
    });
    safety.persistPayment(draft, PAYMENT_TXID);
    const changed = recomputeRecoveryChecksum(safety.pendingOperation.get()!, {
      amountFixed8: "99999999",
    });
    expect(isPendingVaultOperation(changed)).toBe(true);
    safety.pendingOperation.set(changed);
    vi.stubGlobal("fetch", vi.fn(async () => paymentLog("10000000")));

    await expect(safety.recover("guess")).resolves.toMatchObject({ status: "pending" });
    expect(directInvokes).toHaveLength(0);
    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(safety.pendingOperation.get()).toMatchObject({
      stage: "payment",
      amountFixed8: "99999999",
    });
  });

  it("never confirms a recomputed operation kind when the contract rejects its credit bucket", async () => {
    const target = record({ id: "7" });
    const { app, safety, chain, invokeWithPayment } = setup([target]);
    const draft = await safety.prepare("attempt", ME, {
      vaultId: "7",
      amountFixed8: "10000000",
      beforeAttempts: "0",
      beforeBounty: "100000000",
    });
    safety.persistPayment(draft, PAYMENT_TXID);
    const changed = recomputeRecoveryChecksum(safety.pendingOperation.get()!, {
      kind: "increase",
      eventName: "BountyIncreased",
      paymentMemo: "miniapp-unbreakablevault:create",
    });
    expect(isPendingVaultOperation(changed)).toBe(true);
    safety.pendingOperation.set(changed);
    vi.spyOn(app.events, "waitFor").mockResolvedValue(null);
    chain.invoke.mockImplementationOnce(async (_operation, _args, options) => {
      options?.onTransactionSent?.(ACTION_TXID);
      return { txid: ACTION_TXID, success: false, verified: false };
    });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(paymentLog("10000000"))
      .mockResolvedValueOnce(faultLog());
    vi.stubGlobal("fetch", fetchMock);

    await expect(safety.recover()).resolves.toMatchObject({ status: "pending" });
    expect(chain.invoke).toHaveBeenCalledWith(
      "increaseBounty",
      expect.any(Array),
      expect.objectContaining({ scriptHash: CONTRACT }),
    );
    await expect(safety.recover()).resolves.toMatchObject({ status: "fault" });
    expect(invokeWithPayment).not.toHaveBeenCalled();
    expect(safety.pendingOperation.get()).toBeNull();
  });

  it("requires durable recovery storage before any wallet transaction can start", async () => {
    const { app, safety, chain } = setup();
    vi.spyOn(app.storage.local, "set").mockImplementation(() => undefined);

    await expect(safety.prepare("create", ME, {
      amountFixed8: "100000000",
      difficulty: 1,
      title: "Cipher",
      description: "Hint",
      secretHashBase64: SECRET_HASH_BASE64,
      beforeTotalVaults: "0",
    })).rejects.toThrow("recoveryStorageUnavailable");
    expect(chain.ensureWallet).not.toHaveBeenCalled();
  });

  it("keeps an exact in-memory broadcast journal and restores it after storage returns", async () => {
    const { app, safety } = setup();
    const draft = await safety.prepare("create", ME, {
      amountFixed8: "100000000",
      difficulty: 1,
      title: "Cipher",
      description: "Hint",
      secretHashBase64: SECRET_HASH_BASE64,
      beforeTotalVaults: "0",
    });
    const realSet = app.storage.local.set.bind(app.storage.local);
    const setSpy = vi.spyOn(app.storage.local, "set").mockImplementation((key, value) => {
      if (key !== "state/pendingOperation") realSet(key, value);
    });

    expect(() => safety.persistPayment(draft, PAYMENT_TXID)).toThrow(
      "recoveryStorageUnavailable",
    );
    expect(safety.pendingOperation.get()).toMatchObject({
      stage: "payment",
      paymentTxid: PAYMENT_TXID,
    });
    expect(safety.recoveryStorageHealthy.get()).toBe(false);

    setSpy.mockRestore();
    expect(safety.refreshRecoveryStorage()).toEqual(safety.pendingOperation.get());
    expect(safety.recoveryStorageHealthy.get()).toBe(true);
    expect(app.storage.local.get("state/pendingOperation", null)).toEqual(
      safety.pendingOperation.get(),
    );
  });

  it("persists a returned recovery txid even when the wallet callback is omitted", async () => {
    const target = record({ id: "7", bounty: 500_000_000, attemptCount: 2 });
    const { app, safety, chain } = setup([target]);
    const draft = await safety.prepare("attempt", ME, {
      vaultId: "7",
      amountFixed8: "10000000",
      beforeAttempts: "2",
      beforeBounty: "500000000",
    });
    safety.persistPayment(draft, PAYMENT_TXID);
    chain.invoke.mockImplementationOnce(async () => ({
      txid: ACTION_TXID,
      success: true,
      verified: false,
    }));
    vi.spyOn(app.events, "waitFor").mockResolvedValue(null);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(paymentLog("10000000"))
      .mockResolvedValue({
        ok: true,
        json: async () => ({ result: { executions: [] } }),
      } as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(safety.recover("guess")).resolves.toMatchObject({
      status: "pending",
      pending: { stage: "action", txid: ACTION_TXID },
    });
    await expect(safety.recover("guess")).resolves.toMatchObject({
      status: "pending",
      pending: { stage: "action", txid: ACTION_TXID },
    });
    expect(chain.invoke).toHaveBeenCalledTimes(1);
  });

  it("serializes create, attempt, top-up, reclaim, and recovery behind one operation lock", () => {
    const { safety } = setup();
    const release = safety.beginOperation();
    expect(() => safety.beginOperation()).toThrow("operationInProgress");
    release();
    const nextRelease = safety.beginOperation();
    expect(nextRelease).toBeTypeOf("function");
    nextRelease();
  });

  it("rejects a wallet that changed after the reviewed player was captured", async () => {
    const { safety, chain } = setup();
    chain.address.set(`0x${"1".repeat(40)}`);

    await expect(safety.prepare("create", ME, {
      amountFixed8: "100000000",
      difficulty: 1,
      title: "Cipher",
      description: "Hint",
      secretHashBase64: SECRET_HASH_BASE64,
      beforeTotalVaults: "0",
    })).rejects.toThrow("operationContextChanged");
  });

  it("accepts the exact attempt event when other attempts land before this transaction", async () => {
    const target = record({ id: "7", bounty: 500_000_000, attemptCount: 2 });
    const { safety, vaults } = setup([target]);
    const draft = await safety.prepare("attempt", ME, {
      vaultId: "7",
      amountFixed8: "10000000",
      beforeAttempts: "2",
      beforeBounty: "500000000",
    });
    safety.persistAction(draft, ACTION_TXID);
    vaults.set("7", {
      ...target,
      attemptCount: 4,
      bounty: 520_000_000,
    });

    await expect(safety.finalize(safety.pendingOperation.get()!, {
      state: [
        { value: "7" },
        { value: ME_HASH },
        { value: false },
        { value: "4" },
      ],
    })).resolves.toMatchObject({ vaultId: "7", broken: false });
  });

  it("rejects shortened transaction ids instead of persisting an ambiguous recovery record", async () => {
    const { safety } = setup();
    const draft = await safety.prepare("create", ME, {
      amountFixed8: "100000000",
      difficulty: 1,
      title: "Cipher",
      description: "Hint",
      secretHashBase64: SECRET_HASH_BASE64,
      beforeTotalVaults: "0",
    });

    expect(() => safety.persistPayment(draft, "0x1234567890abcdef")).toThrow(
      "invalidTransactionId",
    );
    expect(safety.pendingOperation.get()).toBeNull();
  });

  it("surfaces a wallet-network mismatch during recovery instead of hiding it as pending", async () => {
    const { safety, chain } = setup();
    const draft = await safety.prepare("create", ME, {
      amountFixed8: "100000000",
      difficulty: 1,
      title: "Cipher",
      description: "Hint",
      secretHashBase64: SECRET_HASH_BASE64,
      beforeTotalVaults: "0",
    });
    safety.persistPayment(draft, PAYMENT_TXID);
    chain.detectNetwork.mockResolvedValue("mainnet");

    await expect(safety.recover()).rejects.toThrow("chainContextMismatch");
    expect(safety.pendingOperation.get()).not.toBeNull();
  });

  it("surfaces a contradictory confirmed event while retaining the recovery record", async () => {
    const { safety } = setup();
    const draft = await safety.prepare("create", ME, {
      amountFixed8: "100000000",
      difficulty: 1,
      title: "Cipher",
      description: "Hint",
      secretHashBase64: SECRET_HASH_BASE64,
      beforeTotalVaults: "0",
    });
    safety.persistAction(draft, ACTION_TXID);
    const pending = safety.pendingOperation.get()!;

    await expect(safety.finalize(pending, { state: [
      { value: "1" },
      { value: ME_HASH },
      { value: "99999999" },
      { value: "1" },
    ] })).rejects.toMatchObject({ name: "VaultVerificationError", code: "EVENT_MISMATCH" });
    expect(safety.pendingOperation.get()).toEqual(pending);
  });

  it("rejects a recomputed CREATE journal when its digest is not exactly SHA-256 sized", async () => {
    const { safety } = setup();
    const draft = await safety.prepare("create", ME, {
      amountFixed8: "100000000",
      difficulty: 1,
      title: "Cipher",
      description: "Hint",
      secretHashBase64: SECRET_HASH_BASE64,
      beforeTotalVaults: "0",
    });
    safety.persistPayment(draft, PAYMENT_TXID);
    const corrupted = recomputeRecoveryChecksum(safety.pendingOperation.get()!, {
      secretHashBase64: "c2hhMjU2LWRpZ2VzdA==",
    });

    expect(isPendingVaultOperation(corrupted)).toBe(false);
  });
});
