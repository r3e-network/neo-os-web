/**
 * app.registry regression contract (Platform Contract Library v2 phase 2 —
 * the reads-only PlatformRegistry directory surface).
 *
 * Locks the invariants of the one uniform lane apps consume for directory
 * reads (design doc §3.1 + the §6 item 4 config-injection grammar):
 * - every read auto-threads the framework appId and targets the injected
 *   registryHash — apps never hardcode either;
 * - getApp decodes the positional [engineId, engineHash, appAdmin,
 *   accountHash, materialized, active] row, normalizing UInt160 chain byte
 *   order to display 0x and the zero hash (unset slot) to null;
 * - an unregistered appId resolves null (the contract's getApp asserts,
 *   which hosts surface as a null read);
 * - deriveAccountHash is the config-free advisory wrap of
 *   deriveAppAccountHash — never a reimplementation;
 * - absent/invalid config throws typed FrameworkCapabilityError, never
 *   silently no-ops, and fires NO chain read.
 */
import { describe, expect, it, vi } from "vitest";
import {
  createMiniAppFramework,
  deriveAppAccountHash,
  FrameworkCapabilityError,
} from "../index";
import type { MiniAppFrameworkContext, MiniAppFrameworkOptions } from "../index";
import { addressToScriptHash } from "../utils/neo";
import { createObservable } from "../reactive";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const REGISTRY_HASH = `0x${"cd".repeat(20)}`;
const ENGINE_HASH = "0x0123456789abcdef0123456789abcdef01234567";
const ADMIN_HASH = "0x89abcdef0123456789abcdef0123456789abcdef";
const ACCOUNT_HASH = "0xfedcba9876543210fedcba9876543210fedcba98";
const ZERO_HASH = `0x${"00".repeat(20)}`;

/**
 * What a real host's parseByteLike emits for a UInt160 stack value: 0x +
 * the CHAIN (reversed) byte order hex. Feeding reads this shape pins the
 * surface's byte-order normalization, not just its happy path.
 */
const chainHex = (display: string): string =>
  `0x${display
    .slice(2)
    .match(/../g)!
    .reverse()
    .join("")}`;

function makeApp(
  options: Omit<MiniAppFrameworkOptions, "appId"> = {},
  ctxOverrides: Partial<MiniAppFrameworkContext> = {},
) {
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>("0xabc"),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (): Promise<unknown> => null),
    invoke: vi.fn(async () => ({ txid: "0x1", success: true })),
    invokeWithPayment: vi.fn(async () => ({ txid: "0x2", success: true })),
  };
  const ctx = {
    services: { chain },
    t: (key: string) => key,
    launchContext: { appId: "registry-test" },
    ...ctxOverrides,
  } as unknown as MiniAppFrameworkContext;
  const app = createMiniAppFramework(ctx, {
    appId: "registry-test",
    registry: { registryHash: REGISTRY_HASH },
    ...options,
  });
  return { app, chain };
}

describe("registry config validation", () => {
  it("throws a typed capability error when no registry config is injected", async () => {
    const { app, chain } = makeApp({ registry: undefined });

    expect(app.registry.available).toBe(false);
    for (const read of [
      () => app.registry.getApp(),
      () => app.registry.appAccountOf(),
      () => app.registry.appIdOfAccount(ACCOUNT_HASH),
      () => app.registry.engineOf(),
      () => app.registry.isPaused(),
      () => app.registry.getGlobalPause(),
    ]) {
      await expect(read()).rejects.toSatisfy(
        (error: unknown) =>
          error instanceof FrameworkCapabilityError && error.capability === "registry",
      );
    }
    // Denials happen before any chain read.
    expect(chain.read).not.toHaveBeenCalled();
  });

  it("rejects an invalid registry hash with a clear message", async () => {
    const { app } = makeApp({ registry: { registryHash: "not-a-hash" } });

    expect(app.registry.available).toBe(false);
    await expect(app.registry.getApp()).rejects.toThrow(/registryHash/);
  });

  it("reports available when the host injects a valid registry hash", () => {
    const { app } = makeApp();
    expect(app.registry.available).toBe(true);
    // The lazy module caches: repeated access returns the same instance.
    expect(app.registry).toBe(app.registry);
  });
});

describe("app.registry.getApp", () => {
  it("decodes the positional directory row with display-order hashes", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue([
      "platformgame",
      chainHex(ENGINE_HASH),
      chainHex(ADMIN_HASH),
      chainHex(ACCOUNT_HASH),
      true,
      false,
    ]);

    await expect(app.registry.getApp()).resolves.toEqual({
      engineId: "platformgame",
      engineHash: ENGINE_HASH,
      appAdmin: ADMIN_HASH,
      accountHash: ACCOUNT_HASH,
      materialized: true,
      active: false,
    });
    // Auto-threading (§6 item 4): the framework appId is the default read
    // target, and the read aims at the injected registryHash.
    expect(chain.read).toHaveBeenCalledWith(
      "getApp",
      [{ type: "String", value: "registry-test" }],
      { scriptHash: REGISTRY_HASH },
    );
  });

  it("decodes a lite row: unset hashes become null", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue(["", ZERO_HASH, chainHex(ADMIN_HASH), ZERO_HASH, false, true]);

    await expect(app.registry.getApp()).resolves.toEqual({
      engineId: "",
      engineHash: null,
      appAdmin: ADMIN_HASH,
      accountHash: null,
      materialized: false,
      active: true,
    });
  });

  it("resolves null when the appId is not registered (FAULT read)", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue(null);

    await expect(app.registry.getApp("unknown-app")).resolves.toBeNull();
    expect(chain.read).toHaveBeenCalledWith(
      "getApp",
      [{ type: "String", value: "unknown-app" }],
      { scriptHash: REGISTRY_HASH },
    );
  });
});

describe("app.registry directory reads", () => {
  it("reads appAccountOf as a display hash, null while unminted", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValueOnce(chainHex(ACCOUNT_HASH));
    await expect(app.registry.appAccountOf()).resolves.toBe(ACCOUNT_HASH);
    expect(chain.read).toHaveBeenCalledWith(
      "appAccountOf",
      [{ type: "String", value: "registry-test" }],
      { scriptHash: REGISTRY_HASH },
    );

    chain.read.mockResolvedValueOnce(ZERO_HASH);
    await expect(app.registry.appAccountOf()).resolves.toBeNull();
  });

  it("reads the account→appId reverse index with a normalized Hash160 arg", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValue("registry-test");

    await expect(app.registry.appIdOfAccount(ACCOUNT_HASH.toUpperCase())).resolves.toBe(
      "registry-test",
    );
    expect(chain.read).toHaveBeenCalledWith(
      "appIdOfAccount",
      [{ type: "Hash160", value: ACCOUNT_HASH }],
      { scriptHash: REGISTRY_HASH },
    );

    // A Neo address input converts to the same display-order Hash160 arg.
    await app.registry.appIdOfAccount(ADDRESS);
    expect(chain.read).toHaveBeenLastCalledWith(
      "appIdOfAccount",
      [{ type: "Hash160", value: addressToScriptHash(ADDRESS) }],
      { scriptHash: REGISTRY_HASH },
    );

    // Unknown accounts read back as "".
    chain.read.mockResolvedValue("");
    await expect(app.registry.appIdOfAccount(ACCOUNT_HASH)).resolves.toBe("");
  });

  it("reads engineOf and isPaused", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValueOnce("platformgame");
    await expect(app.registry.engineOf()).resolves.toBe("platformgame");

    chain.read.mockResolvedValueOnce(true);
    await expect(app.registry.isPaused()).resolves.toBe(true);
    expect(chain.read).toHaveBeenLastCalledWith(
      "isPaused",
      [{ type: "String", value: "registry-test" }],
      { scriptHash: REGISTRY_HASH },
    );
  });

  it("reads the global pause state, defaulting unpaused on a null read", async () => {
    const { app, chain } = makeApp();
    chain.read.mockResolvedValueOnce([true, 1_752_700_000_000]);
    await expect(app.registry.getGlobalPause()).resolves.toEqual({
      paused: true,
      pausedAt: 1_752_700_000_000,
    });
    expect(chain.read).toHaveBeenCalledWith("getGlobalPause", [], {
      scriptHash: REGISTRY_HASH,
    });

    chain.read.mockResolvedValueOnce([false, 0]);
    await expect(app.registry.getGlobalPause()).resolves.toEqual({ paused: false, pausedAt: 0 });

    chain.read.mockResolvedValueOnce(null);
    await expect(app.registry.getGlobalPause()).resolves.toEqual({ paused: false, pausedAt: 0 });
  });
});

describe("app.registry.deriveAccountHash (advisory)", () => {
  it("wraps deriveAppAccountHash exactly, even without registry config", () => {
    const { app } = makeApp({ registry: undefined });
    const input = {
      deployerSender: ADDRESS,
      nefChecksum: 1_234_567,
      manifestName: "registry-test",
    };

    expect(app.registry.available).toBe(false);
    // The wrap lane: identical output to the shared derivation, no logic
    // fork (the derivation itself is pinned by the shared vector fixture in
    // aa-account-hash.test.ts).
    expect(app.registry.deriveAccountHash(input)).toBe(deriveAppAccountHash(input));
  });
});
