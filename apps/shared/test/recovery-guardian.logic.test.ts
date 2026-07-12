import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MIN_RECOVERY_DELAY_MS,
  buildRecoveryWorkspaceUrl,
  isPendingRecoveryWrite,
  parseGuardianSetupPackage,
  parseRecoveryProfileId,
  readRecoveryProfile,
  verifyRecoveryWrite,
  type RecoveryContext,
  type RecoveryProfile,
} from "../../recovery-guardian/src/recovery-guardian";

const PROFILE = "0x1111111111111111111111111111111111111111";
const OWNER = "0x0102030405060708090a0b0c0d0e0f1011121314";
const ACCOUNT = "0x15161718191a1b1c1d1e1f202122232425262728";
const AA_CORE = "0x292a2b2c2d2e2f303132333435363738393a3b3c";
const ORACLE = "0x3d3e3f404142434445464748494a4b4c4d4e4f50";
const VERIFIER = `02${"66".repeat(32)}`;
const COMMITMENT = `0x${"77".repeat(32)}`;
const CONTRACT = "0x198b3a9cec9bccc2110d19bd929b10374a9d034d";

const context: RecoveryContext = {
  network: "testnet",
  verifierHash: CONTRACT,
  aaCoreHash: AA_CORE,
  morpheusOracleHash: ORACLE,
};

function bytes(hex: string): Uint8Array {
  const clean = hex.replace(/^0x/, "");
  return Uint8Array.from(clean.match(/../g) ?? [], (part) => Number.parseInt(part, 16));
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
    getAccountIdText: { type: "ByteString", value: base64(Buffer.from(PROFILE)) },
    getThreshold: integer(1),
    getTimelock: integer(MIN_RECOVERY_DELAY_MS),
    getRecoveryNonce: integer(0),
    getMorpheusVerifier: byteStack(`0x${VERIFIER}`),
    getMasterNullifiers: { type: "Array", value: [byteStack(COMMITMENT)] },
    getPendingRecovery: {
      type: "Struct",
      value: [hashStack(`0x${"00".repeat(20)}`), integer(-1), integer(0), integer(0), integer(0), { type: "Boolean", value: false }],
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

afterEach(() => vi.unstubAllGlobals());

describe("Recovery Guardian production logic", () => {
  it("treats a 20-byte AA account ID as canonical without deriving it from an address", () => {
    const parsed = parseRecoveryProfileId(PROFILE);
    expect(parsed).toMatchObject({ hex: PROFILE, byteLength: 20, isAAAccountId: true });
    expect(parseRecoveryProfileId("legacy-recovery-profile")).toMatchObject({
      byteLength: 23,
      isAAAccountId: false,
    });
    expect(parseRecoveryProfileId("0x123")).toBeNull();
    expect(parseRecoveryProfileId("x".repeat(65))).toBeNull();
  });

  it("parses a public setup package and derives milliseconds from the owner-review hours", () => {
    const setup = parseGuardianSetupPackage({
      profileId: PROFILE,
      accountIdText: "family-wallet",
      accountAddress: ACCOUNT,
      guardianCommitments: [COMMITMENT],
      threshold: 1,
      timelockHours: 24,
      morpheusVerifier: VERIFIER,
    });
    expect(setup.profileId.hex).toBe(PROFILE);
    expect(setup.guardianCommitments).toEqual([COMMITMENT]);
    expect(setup.timelockMs).toBe(86_400_000);
  });

  it("builds the live identity workspace query contract instead of legacy link parameters", () => {
    const configured: RecoveryProfile = {
      sourceNetwork: "testnet",
      configured: true,
      aaBindingVerified: true,
      aaVerifierHash: CONTRACT,
      aaBackupOwner: OWNER,
      profileId: parseRecoveryProfileId(PROFILE)!,
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
      pending: { active: false, newOwner: "", recoveryNonce: "-1", approvedCount: 0, initiatedAt: 0, executableAt: 0 },
      checkedAt: "2026-07-11T00:00:00.000Z",
    };
    const url = new URL(buildRecoveryWorkspaceUrl({
      baseUrl: "https://neo-abstract-account.vercel.app/identity?network=testnet",
      profile: configured,
      verifierHash: CONTRACT,
      newOwner: ACCOUNT,
      expiryMinutes: 30,
    }));
    expect(url.pathname).toBe("/identity");
    expect(url.searchParams.get("accountId")).toBe(PROFILE);
    expect(url.searchParams.get("recoveryVerifier")).toBe(CONTRACT);
    expect(url.searchParams.get("recoveryNewOwner")).toBe(ACCOUNT);
    expect(url.searchParams.get("recoveryExpiryMinutes")).toBe("30");
    expect(url.searchParams.get("autoPreviewRecovery")).toBe("1");
    expect(url.searchParams.has("view")).toBe(false);
    expect(url.searchParams.has("newOwner")).toBe(false);
  });

  it("rejects secret-bearing, weak-delay, duplicate, or impossible setup packages", () => {
    const base = {
      profileId: PROFILE,
      accountIdText: "family-wallet",
      accountAddress: ACCOUNT,
      guardianCommitments: [COMMITMENT],
      threshold: 1,
      timelockMs: MIN_RECOVERY_DELAY_MS,
      morpheusVerifier: VERIFIER,
    };
    expect(() => parseGuardianSetupPackage({ ...base, privateKey: "nope" })).toThrow("setupPackageContainsSecret");
    expect(() => parseGuardianSetupPackage({ ...base, metadata: { idToken: "nope" } })).toThrow("setupPackageContainsSecret");
    expect(() => parseGuardianSetupPackage({ ...base, timelockMs: 1 })).toThrow("setupDelayInvalid");
    expect(() => parseGuardianSetupPackage({ ...base, guardianCommitments: [COMMITMENT, COMMITMENT] })).toThrow("setupGuardiansInvalid");
    expect(() => parseGuardianSetupPackage({ ...base, threshold: 2 })).toThrow("setupThresholdInvalid");
  });

  it("strictly reads SocialRecoveryVerifier guardian policy and keeps a zero delay visible", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({ getTimelock: integer(0) })), { status: 200 })));
    const profile = await readRecoveryProfile(context, parseRecoveryProfileId(PROFILE)!);
    expect(profile.configured).toBe(true);
    expect(profile.sourceNetwork).toBe("testnet");
    expect(profile.owner).toBe(OWNER);
    expect(profile.aaBackupOwner).toBe(OWNER);
    expect(profile.threshold).toBe(1);
    expect(profile.timelockMs).toBe(0);
    expect(profile.masterNullifiers).toEqual([COMMITMENT]);
    expect(profile.pending.active).toBe(false);
  });

  it("fails the whole profile read when any mandatory contract getter FAULTs", async () => {
    const payload = batchResponse().map((entry) =>
      entry.id === "getThreshold"
        ? { ...entry, result: { state: "FAULT", stack: [integer(0)] } }
        : entry,
    );
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 })));
    await expect(readRecoveryProfile(context, parseRecoveryProfileId(PROFILE)!)).rejects.toThrow("recoveryReadFailed");
  });

  it("never coerces malformed VM integers or booleans into an empty zero profile", async () => {
    const zero = `0x${"00".repeat(20)}`;
    const empty = {
      getOwner: hashStack(zero),
      getAAContract: hashStack(zero),
      getAccountAddress: hashStack(zero),
      getMorpheusOracle: hashStack(zero),
      getNetwork: { type: "ByteString", value: "" },
      getAccountIdText: { type: "ByteString", value: "" },
      getThreshold: integer(0),
      getTimelock: integer(0),
      getRecoveryNonce: integer(0),
      getMorpheusVerifier: { type: "ByteString", value: "" },
      getMasterNullifiers: { type: "Array", value: [] },
      aaVerifier: hashStack(zero),
      aaBackupOwner: hashStack(zero),
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      ...empty,
      getThreshold: { type: "Integer", value: "not-a-number" },
    })), { status: 200 })));
    await expect(readRecoveryProfile(context, parseRecoveryProfileId(PROFILE)!))
      .rejects.toThrow("recoveryReadMalformed");

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      ...empty,
      getPendingRecovery: {
        type: "Struct",
        value: [
          hashStack(zero), integer(-1), integer(0), integer(0), integer(0),
          { type: "Boolean", value: "not-a-boolean" },
        ],
      },
    })), { status: 200 })));
    await expect(readRecoveryProfile(context, parseRecoveryProfileId(PROFILE)!))
      .rejects.toThrow("recoveryReadMalformed");
  });

  it("surfaces an AA module mismatch as a non-protected profile instead of claiming success", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      aaVerifier: hashStack(OWNER),
    })), { status: 200 })));
    const result = await readRecoveryProfile(context, parseRecoveryProfileId(PROFILE)!);
    expect(result.configured).toBe(true);
    expect(result.aaBindingVerified).toBe(false);
    expect(result.aaVerifierHash).toBe(OWNER);
  });

  it("does not call a configured profile protected when its owner differs from AA Core", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      aaBackupOwner: hashStack(ACCOUNT),
    })), { status: 200 })));

    const result = await readRecoveryProfile(context, parseRecoveryProfileId(PROFILE)!);

    expect(result.configured).toBe(true);
    expect(result.owner).toBe(OWNER);
    expect(result.aaBackupOwner).toBe(ACCOUNT);
    expect(result.aaBindingVerified).toBe(false);
  });

  it("does not accept a mixed empty profile as a valid unconfigured state", async () => {
    const zero = `0x${"00".repeat(20)}`;
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      getOwner: hashStack(zero),
      getAAContract: hashStack(zero),
      getAccountAddress: hashStack(zero),
      getMorpheusOracle: hashStack(zero),
      getThreshold: integer(1),
      getTimelock: integer(0),
      getRecoveryNonce: integer(0),
      getNetwork: { type: "ByteString", value: "" },
      getAccountIdText: { type: "ByteString", value: "" },
      getMorpheusVerifier: { type: "ByteString", value: "" },
      getMasterNullifiers: { type: "Array", value: [] },
    })), { status: 200 })));
    await expect(readRecoveryProfile(context, parseRecoveryProfileId(PROFILE)!)).rejects.toThrow("recoveryReadInconsistent");
  });

  it("validates the durable write envelope before recovery is resumed", () => {
    const validFinalize = {
      version: 1,
      kind: "finalize",
      txid: `0x${"88".repeat(32)}`,
      createdAt: Date.now(),
      network: "testnet",
      verifierHash: CONTRACT,
      profileHex: PROFILE,
      actorHash: ACCOUNT,
      beforeOwner: OWNER,
      beforeNonce: "4",
      expectedNewOwner: ACCOUNT,
      aaCoreHash: AA_CORE,
      morpheusOracleHash: ORACLE,
    } as const;
    expect(isPendingRecoveryWrite(validFinalize)).toBe(true);
    expect(isPendingRecoveryWrite({ ...validFinalize, actorHash: OWNER })).toBe(false);
    expect(isPendingRecoveryWrite({ ...validFinalize, beforeNonce: "-1" })).toBe(false);
    expect(isPendingRecoveryWrite({
      version: 1,
      kind: "finalize",
      txid: "not-a-txid",
    })).toBe(false);
  });

  it("rejects a tampered setup recovery envelope before any confirmation read", () => {
    const setup = {
      version: 1 as const,
      kind: "setup" as const,
      txid: `0x${"99".repeat(32)}`,
      createdAt: Date.now(),
      network: "testnet" as const,
      verifierHash: CONTRACT,
      profileHex: PROFILE,
      actorHash: OWNER,
      beforeOwner: OWNER,
      beforeNonce: "0",
      accountIdText: "family-wallet",
      accountAddress: ACCOUNT,
      aaCoreHash: AA_CORE,
      morpheusOracleHash: ORACLE,
      threshold: 1,
      timelockMs: MIN_RECOVERY_DELAY_MS,
      guardianCommitments: [COMMITMENT],
      morpheusVerifier: VERIFIER,
    };
    expect(isPendingRecoveryWrite(setup)).toBe(true);
    expect(isPendingRecoveryWrite({ ...setup, timelockMs: 0 })).toBe(false);
    expect(isPendingRecoveryWrite({ ...setup, threshold: 2 })).toBe(false);
    expect(isPendingRecoveryWrite({ ...setup, guardianCommitments: [COMMITMENT, COMMITMENT] })).toBe(false);
  });

  it("rejects an impossible approval count instead of presenting it as recovery progress", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      getThreshold: integer(1),
      getMasterNullifiers: { type: "Array", value: [byteStack(COMMITMENT), byteStack(`0x${"88".repeat(32)}`)] },
      getPendingRecovery: {
        type: "Struct",
        value: [hashStack(ACCOUNT), integer(0), integer(2), integer(1_000), integer(2_000), { type: "Boolean", value: true }],
      },
    })), { status: 200 })));
    await expect(readRecoveryProfile(context, parseRecoveryProfileId(PROFILE)!))
      .rejects.toThrow("recoveryReadInconsistent");
  });

  it("confirms finalization only when the exact event and reread owner agree", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      getOwner: hashStack(ACCOUNT),
      getRecoveryNonce: integer(5),
    })), { status: 200 })));
    const pending = {
      version: 1 as const,
      kind: "finalize" as const,
      txid: `0x${"88".repeat(32)}`,
      createdAt: Date.now(),
      network: "testnet" as const,
      verifierHash: CONTRACT,
      profileHex: PROFILE,
      actorHash: ACCOUNT,
      beforeOwner: OWNER,
      beforeNonce: "4",
      expectedNewOwner: ACCOUNT,
      aaCoreHash: AA_CORE,
      morpheusOracleHash: ORACLE,
    };
    const confirmed = await verifyRecoveryWrite(pending, {
      state: "halt",
      notifications: [{
        contract: CONTRACT,
        eventName: "RecoveryFinalized",
        values: [PROFILE, OWNER, ACCOUNT, 5],
      }],
    });
    expect(confirmed.owner).toBe(ACCOUNT);
    expect(confirmed.recoveryNonce).toBe("5");
    expect(confirmed.pending.active).toBe(false);
  });

  it("keeps a HALT write unconfirmed when the recovery event does not match", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(batchResponse({
      getOwner: hashStack(ACCOUNT),
      getRecoveryNonce: integer(5),
    })), { status: 200 })));
    const pending = {
      version: 1 as const,
      kind: "finalize" as const,
      txid: `0x${"88".repeat(32)}`,
      createdAt: Date.now(),
      network: "testnet" as const,
      verifierHash: CONTRACT,
      profileHex: PROFILE,
      actorHash: ACCOUNT,
      beforeOwner: OWNER,
      beforeNonce: "4",
      expectedNewOwner: ACCOUNT,
      aaCoreHash: AA_CORE,
      morpheusOracleHash: ORACLE,
    };
    await expect(verifyRecoveryWrite(pending, {
      state: "halt",
      notifications: [{ contract: CONTRACT, eventName: "RecoveryFinalized", values: [PROFILE, OWNER, ACCOUNT, 99] }],
    })).rejects.toThrow("recoveryEventMismatch");
  });
});
