import { describe, expect, it } from "vitest";
import {
  ZERO_HASH,
  buildPendingPermissionTransaction,
  explicitPermissionNetwork,
  isPermissionBindingCurrent,
  isPermissionUnlockReady,
  parsePermissionBoolean,
  parsePermissionHash,
  parsePermissionTimestamp,
  permissionContractOperation,
  permissionOperationEvent,
  permissionTransactionSatisfied,
  restorePendingPermissionTransaction,
  validatePendingTimes,
  type PermissionSnapshot,
} from "../../aa-permissions-lab/src/permissions";

const CORE = "0x1111111111111111111111111111111111111111";
const ACCOUNT = "0x2222222222222222222222222222222222222222";
const OWNER = "0x3333333333333333333333333333333333333333";
const TARGET = "0x4444444444444444444444444444444444444444";
const TXID = `0x${"ab".repeat(32)}`;

function snapshot(overrides: Partial<PermissionSnapshot> = {}): PermissionSnapshot {
  return {
    network: "mainnet",
    aaCore: CORE,
    accountId: ACCOUNT,
    verifier: "",
    hook: "",
    backupOwner: OWNER,
    hasPendingVerifier: false,
    hasPendingHook: false,
    pendingVerifierUnlockAt: 0,
    pendingHookUnlockAt: 0,
    inspectedAt: Date.now(),
    ...overrides,
  };
}

describe("AA Permissions domain rules", () => {
  it("accepts only explicit supported launch networks", () => {
    expect(explicitPermissionNetwork("neo-n3-mainnet")).toBe("mainnet");
    expect(explicitPermissionNetwork("testnet")).toBe("testnet");
    expect(explicitPermissionNetwork("private-net")).toBeNull();
  });

  it("decodes chain values strictly and rejects FAULT/null data", () => {
    expect(parsePermissionBoolean({ type: "Boolean", value: "false" }, "pending")).toBe(false);
    expect(parsePermissionBoolean({ type: "Boolean", value: "true" }, "pending")).toBe(true);
    expect(parsePermissionBoolean(false, "pending")).toBe(false);
    expect(parsePermissionTimestamp(0, "time")).toBe(0);
    expect(parsePermissionTimestamp({ type: "Integer", value: "1900000000000" }, "time"))
      .toBe(1_900_000_000_000);
    expect(parsePermissionHash(`0x${"00".repeat(20)}`, "verifier")).toBe("");
    expect(() => parsePermissionHash({ state: "FAULT", stack: [] }, "verifier"))
      .toThrow("permissionReadInvalid:verifier");
    expect(() => parsePermissionTimestamp(null, "time"))
      .toThrow("permissionReadInvalid:time");
  });

  it("requires pending flags and millisecond unlock timestamps to agree", () => {
    expect(validatePendingTimes(snapshot({
      hasPendingVerifier: true,
      pendingVerifierUnlockAt: Date.now() + 86_400_000,
    }))).toBeTruthy();
    expect(() => validatePendingTimes(snapshot({ hasPendingVerifier: true })))
      .toThrow("permissionReadInvalid:pendingVerifier");
    expect(isPermissionUnlockReady(1_900_000_000_000, 1_900_000_000_001)).toBe(true);
  });

  it("maps every lifecycle operation to the deployed ABI and exact event", () => {
    expect(permissionContractOperation("install-verifier")).toBe("updateVerifier");
    expect(permissionContractOperation("propose-hook")).toBe("updateHook");
    expect(permissionContractOperation("confirm-verifier")).toBe("confirmVerifierUpdate");
    expect(permissionContractOperation("cancel-hook")).toBe("cancelHookUpdate");
    expect(permissionOperationEvent("propose-verifier")).toBe("VerifierUpdateInitiated");
    expect(permissionOperationEvent("install-hook")).toBe("HookUpdateConfirmed");
  });

  it("binds snapshots and recovery records to exact network/core/account", () => {
    expect(isPermissionBindingCurrent(snapshot(), "mainnet", CORE, ACCOUNT)).toBe(true);
    expect(isPermissionBindingCurrent(snapshot(), "testnet", CORE, ACCOUNT)).toBe(false);

    const record = buildPendingPermissionTransaction({
      network: "mainnet",
      aaCore: CORE,
      accountId: ACCOUNT,
      walletHash: OWNER,
      operation: "propose-verifier",
      targetHash: TARGET,
      previousHash: ZERO_HASH,
      txid: TXID,
      submittedAt: 1_900_000_000_000,
    });
    expect(restorePendingPermissionTransaction(record, "mainnet", CORE, 1_900_000_001_000))
      .toEqual(record);
    expect(restorePendingPermissionTransaction(record, "testnet", CORE, 1_900_000_001_000))
      .toBeNull();
    expect(restorePendingPermissionTransaction(record, "mainnet", TARGET, 1_900_000_001_000))
      .toBeNull();
    expect(() => buildPendingPermissionTransaction({
      ...record,
      operation: "unknown" as never,
    })).toThrow("invalidPendingTransaction");
  });

  it("does not treat proposal state alone as confirmation, but can prove an immediate install by state", () => {
    const proposal = buildPendingPermissionTransaction({
      network: "mainnet",
      aaCore: CORE,
      accountId: ACCOUNT,
      walletHash: OWNER,
      operation: "propose-verifier",
      targetHash: TARGET,
      previousHash: ZERO_HASH,
      txid: TXID,
    });
    const pending = snapshot({
      hasPendingVerifier: true,
      pendingVerifierUnlockAt: Date.now() + 86_400_000,
    });
    expect(permissionTransactionSatisfied(proposal, pending, false)).toBe(false);
    expect(permissionTransactionSatisfied(proposal, pending, true)).toBe(true);

    const install = buildPendingPermissionTransaction({
      ...proposal,
      operation: "install-verifier",
    });
    expect(permissionTransactionSatisfied(install, snapshot({ verifier: TARGET }), false)).toBe(true);
  });
});
