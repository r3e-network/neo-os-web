import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  createMiniAppFramework,
  FrameworkCapabilityError,
  FrameworkPermissionError,
} from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { createObservable } from "../reactive";
import { addressToScriptHash } from "../utils/neo";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ACCOUNT = addressToScriptHash(ADDRESS);
const VM_ACCOUNT = ACCOUNT.slice(2).match(/../g)!.reverse().join("");
const SOCIAL_HASH = `0x${"ab".repeat(20)}`;
const GAS_HASH = `0x${"cd".repeat(20)}`;
const NEO_HASH = `0x${"ef".repeat(20)}`;
const APP_ID = "platform-social-test";
const controlMethods = new Set([
  "_deploy",
  "_initialize",
  "admin",
  "isPaused",
  "setAdmin",
  "setPaused",
  "update",
  "registerApp",
  "setAppPaused",
  "getAppType",
  "isAppPaused",
  "onNEP17Payment",
]);

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  launchContext: Record<string, unknown> = { appId: APP_ID },
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (operation: string, _args?: unknown[], _options?: unknown): Promise<unknown> => {
      if (operation === "getNotarization") return [VM_ACCOUNT, "1234", "9", true];
      return "1";
    }),
    invoke: vi.fn(async (_operation: string, _args: unknown[], _options?: unknown) => ({ txid: "0xtx", success: true })),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext,
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, {
    appId: APP_ID,
    platformSocial: { socialHash: SOCIAL_HASH },
    ...options,
  });
  return { app, chain };
}

describe("app.platformSocial", () => {
  it("fails closed without a valid config", async () => {
    const missing = makeApp({ platformSocial: undefined });
    expect(missing.app.platformSocial.available).toBe(false);
    await expect(missing.app.platformSocial.getEnvelope(1)).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkCapabilityError && error.capability === "platformSocial",
    );
    expect(missing.chain.read).not.toHaveBeenCalled();

    const invalid = makeApp({ platformSocial: { socialHash: "invalid" } });
    await expect(invalid.app.platformSocial.gasCreditOf()).rejects.toBeInstanceOf(FrameworkCapabilityError);
    expect(invalid.chain.read).not.toHaveBeenCalled();
  });

  it("auto-threads appId, wallet and the configured contract", async () => {
    const { app, chain } = makeApp();
    expect(app.platformSocial.available).toBe(true);

    await app.platformSocial.createEnvelope(5, 60_000);
    expect(chain.invoke).toHaveBeenCalledWith("createEnvelope", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
      { type: "Integer", value: "5" },
      { type: "Integer", value: "60000" },
    ], { scriptHash: SOCIAL_HASH });

    await expect(app.platformSocial.hasClaimed(7)).resolves.toBe(true);
    expect(chain.read).toHaveBeenLastCalledWith("hasClaimed", [
      { type: "String", value: APP_ID },
      { type: "Integer", value: "7" },
      { type: "Hash160", value: ACCOUNT },
    ], { scriptHash: SOCIAL_HASH });

    await expect(app.platformSocial.gasCreditOf()).resolves.toBe(1n);
    expect(chain.read).toHaveBeenLastCalledWith("getDirectGasCredit", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
    ], { scriptHash: SOCIAL_HASH });
  });

  it("routes native GAS and NEO credit prepayments with an exact tenant memo", async () => {
    const { app, chain } = makeApp({
      platformSocial: { socialHash: SOCIAL_HASH, gasHash: GAS_HASH, neoHash: NEO_HASH },
    });
    const onTransactionSent = vi.fn();

    await app.platformSocial.prepayGasCredit(5, undefined, { onTransactionSent });
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", [
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: SOCIAL_HASH },
      { type: "Integer", value: "5" },
      { type: "String", value: `${APP_ID}:credit` },
    ], { scriptHash: GAS_HASH, onTransactionSent });

    await app.platformSocial.prepayNeoCredit(2);
    expect(chain.invoke).toHaveBeenLastCalledWith("transfer", [
      { type: "Hash160", value: ACCOUNT },
      { type: "Hash160", value: SOCIAL_HASH },
      { type: "Integer", value: "2" },
      { type: "String", value: `${APP_ID}:credit` },
    ], { scriptHash: NEO_HASH });
  });

  it("covers envelope, pool, trust and vault ABI ordering", async () => {
    const { app, chain } = makeApp();
    const hash = "11".repeat(32);

    await app.platformSocial.createRangeGasPool({
      totalAmount: 100,
      minClaimAmount: 10,
      maxClaimAmount: 20,
      maxClaims: 5,
      expiryMs: 30_000,
    });
    await app.platformSocial.createTrust(`0x${"22".repeat(20)}`, 604_800_000);
    await app.platformSocial.createVault(hash, 2);
    await app.platformSocial.commitAttempt(3, hash);
    await app.platformSocial.revealAttempt(3, "abcd", "0102");

    expect(chain.invoke.mock.calls.map((call) => call[0])).toEqual([
      "createRangeGasPool",
      "createTrust",
      "createVault",
      "commitAttempt",
      "revealAttempt",
    ]);
    expect(chain.invoke.mock.calls[1]?.[1]?.[0]).toEqual({ type: "String", value: APP_ID });
    expect(chain.invoke.mock.calls[2]?.[1]?.[2]).toEqual({ type: "ByteArray", value: hash });
  });

  it("encodes and decodes tenant-scoped notarizations", async () => {
    const { app, chain } = makeApp();
    const digest = "33".repeat(32);
    const onTransactionSent = vi.fn();

    await app.platformSocial.notarize(digest, undefined, {
      waitForEvent: "Notarized",
      waitTimeoutMs: 15_000,
      onTransactionSent,
    });
    expect(chain.invoke).toHaveBeenLastCalledWith("notarize", [
      { type: "String", value: APP_ID },
      { type: "Hash160", value: ACCOUNT },
      { type: "ByteArray", value: digest },
    ], {
      scriptHash: SOCIAL_HASH,
      waitForEvent: "Notarized",
      waitTimeoutMs: 15_000,
      onTransactionSent,
    });

    await expect(app.platformSocial.getNotarization(digest)).resolves.toEqual({
      submitter: ACCOUNT,
      timestampMs: 1234n,
      blockIndex: 9n,
    });
    await expect(app.platformSocial.isNotarized(digest)).resolves.toBe(true);
    await expect(app.platformSocial.notarizationCount()).resolves.toBe(1n);
  });

  it("covers every user-facing PlatformSocial ABI method", async () => {
    const { app, chain } = makeApp();
    const hash = "11".repeat(32);
    const other = `0x${"22".repeat(20)}`;

    await app.platformSocial.gasCreditOf();
    await app.platformSocial.neoCreditOf();
    await app.platformSocial.withdrawGasCredit(1);
    await app.platformSocial.withdrawNeoCredit(1);
    await app.platformSocial.gasCreditLiability();
    await app.platformSocial.neoCreditLiability();
    await app.platformSocial.totalGasCreditLiability();
    await app.platformSocial.totalNeoCreditLiability();
    await app.platformSocial.createEnvelope(2, 1_000);
    await app.platformSocial.claimEnvelope(1);
    await app.platformSocial.refundExpiredEnvelope(1);
    await app.platformSocial.getEnvelope(1);
    await app.platformSocial.hasClaimed(1);
    await app.platformSocial.createRangeGasPool({
      totalAmount: 2,
      minClaimAmount: 1,
      maxClaimAmount: 1,
      maxClaims: 2,
      expiryMs: 1_000,
    });
    await app.platformSocial.claimRangeGasPool(1);
    await app.platformSocial.fundRangeGasPool(1, 1);
    await app.platformSocial.refundRangeGasPool(1);
    await app.platformSocial.getRangeGasPool(1);
    await app.platformSocial.hasClaimedRangeGasPool(1);
    await app.platformSocial.createTrust(other, 604_800_000);
    await app.platformSocial.heartbeat(1);
    await app.platformSocial.executeTrust(1);
    await app.platformSocial.cancelTrust(1);
    await app.platformSocial.addGuardian(1, other);
    await app.platformSocial.getTrust(1);
    await app.platformSocial.isGuardian(1);
    await app.platformSocial.createVault(hash, 1);
    await app.platformSocial.commitAttempt(1, hash);
    await app.platformSocial.revealAttempt(1, "abcd", "0102");
    await app.platformSocial.increaseBounty(1, 1);
    await app.platformSocial.refundExpiredVault(1);
    await app.platformSocial.getVault(1);
    await app.platformSocial.notarize(hash);
    await app.platformSocial.getNotarization(hash);
    await app.platformSocial.isNotarized(hash);
    await app.platformSocial.notarizationCount();

    const operations = [
      ...chain.read.mock.calls.map((call) => call[0]),
      ...chain.invoke.mock.calls.map((call) => call[0]),
    ].sort();
    const manifest = JSON.parse(fs.readFileSync(
      path.resolve(process.cwd(), "../contracts/build/PlatformSocial.manifest.json"),
      "utf8",
    ));
    const userFacingAbi = manifest.abi.methods
      .map((method: { name: string }) => method.name)
      .filter((name: string) => !controlMethods.has(name))
      .sort();
    expect(operations).toEqual(userFacingAbi);
  });

  it("runs guest then permission guards before every write", async () => {
    const guest = makeApp({}, { appId: APP_ID });
    guest.app.mode.set("guest");
    await expect(guest.app.platformSocial.claimEnvelope(1)).rejects.toThrow(/guest-mode/);
    expect(guest.chain.invoke).not.toHaveBeenCalled();

    const denied = makeApp({}, { appId: APP_ID, permissions: {} });
    await expect(denied.app.platformSocial.claimEnvelope(1)).rejects.toSatisfy(
      (error: unknown) => error instanceof FrameworkPermissionError && error.permission === "invoke:primary",
    );
    expect(denied.chain.invoke).not.toHaveBeenCalled();
  });

  it("rejects invalid ids and hashes before invoking", async () => {
    const { app, chain } = makeApp();
    await expect(app.platformSocial.getVault(0)).rejects.toThrow(/positive integer/);
    await expect(app.platformSocial.createVault("aa", 1)).rejects.toThrow(/32 bytes/);
    await expect(app.platformSocial.notarize("aa")).rejects.toThrow(/32 bytes/);
    await expect(app.platformSocial.prepayGasCredit(0)).rejects.toThrow(/positive integer/);
    await expect(app.platformSocial.revealAttempt(1, "abc", "00")).rejects.toThrow(/even-length hex/);
    expect(chain.invoke).not.toHaveBeenCalled();
  });
});
