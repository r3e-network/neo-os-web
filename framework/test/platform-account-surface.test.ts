import { describe, expect, it, vi } from "vitest";

import {
  createMiniAppFramework,
  deriveVirtualAAAccount,
  FrameworkCapabilityError,
} from "../index";
import type { MiniAppFrameworkContext } from "../index";
import { createObservable } from "../reactive";

const APP_ID = "miniapp-platform-account-test";
const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const REGISTRY_HASH = `0x${"cd".repeat(20)}`;
const ENGINE_HASH = `0x${"12".repeat(20)}`;
const ADMIN_HASH = `0x${"34".repeat(20)}`;
const TREASURY_HASH = `0x${"56".repeat(20)}`;
const AA_CORE_HASH = `0x${"78".repeat(20)}`;
const AA_ACCOUNT_ID = `0x${"9a".repeat(20)}`;
const ZERO_HASH = `0x${"00".repeat(20)}`;

const chainHex = (display: string): string =>
  `0x${display.slice(2).match(/../g)!.reverse().join("")}`;

function makeHarness(configured = true) {
  const read = vi.fn(async (operation: string): Promise<unknown> => {
    if (operation === "getApp") {
      return [
        "platform-game",
        chainHex(ENGINE_HASH),
        chainHex(ADMIN_HASH),
        chainHex(TREASURY_HASH),
        true,
        true,
      ];
    }
    if (operation === "getAppAbstractAccount") {
      return [chainHex(AA_CORE_HASH), chainHex(AA_ACCOUNT_ID), true];
    }
    return null;
  });
  const invoke = vi.fn(async () => ({ txid: "0xmaterialize", success: true }));
  const chain = {
    address: createObservable<string | null>(ADDRESS),
    contractAddress: createObservable<string | null>(null),
    ensureWallet: vi.fn(async () => ADDRESS),
    read,
    invoke,
  };
  const app = createMiniAppFramework(
    {
      services: { chain },
      t: (key: string) => key,
      launchContext: { appId: APP_ID },
    } as unknown as MiniAppFrameworkContext,
    {
      appId: APP_ID,
      ...(configured ? { registry: { registryHash: REGISTRY_HASH } } : {}),
    },
  );
  return { app, read, invoke };
}

describe("app.platformAccount", () => {
  it("returns one snapshot without conflating shared identity and treasury custody", async () => {
    const { app, read } = makeHarness();

    await expect(app.platformAccount.get()).resolves.toEqual({
      appId: APP_ID,
      registered: true,
      appAdmin: ADMIN_HASH,
      engineId: "platform-game",
      engineHash: ENGINE_HASH,
      active: true,
      sharedIdentity: {
        ...deriveVirtualAAAccount(AA_CORE_HASH, AA_ACCOUNT_ID),
        materialized: true,
      },
      treasuryAccountHash: TREASURY_HASH,
    });
    expect(read).toHaveBeenNthCalledWith(1, "getApp", [
      { type: "String", value: APP_ID },
    ], { scriptHash: REGISTRY_HASH });
    expect(read).toHaveBeenNthCalledWith(2, "getAppAbstractAccount", [
      { type: "String", value: APP_ID },
    ], { scriptHash: REGISTRY_HASH });
  });

  it("materializes only the shared identity through the guarded registry lane", async () => {
    const { app, invoke } = makeHarness();
    const onTransactionSent = vi.fn();

    await expect(app.platformAccount.materializeSharedIdentity(undefined, {
      waitForEvent: "AppAbstractAccountCreated",
      onTransactionSent,
    })).resolves.toEqual({ txid: "0xmaterialize", success: true });
    expect(invoke).toHaveBeenCalledWith("materializeAbstractAccount", [
      { type: "String", value: APP_ID },
    ], {
      scriptHash: REGISTRY_HASH,
      waitForEvent: "AppAbstractAccountCreated",
      onTransactionSent,
    });
  });

  it("returns null for an unknown directory row without probing account state", async () => {
    const { app, read } = makeHarness();
    read.mockResolvedValueOnce(null);

    await expect(app.platformAccount.get()).resolves.toBeNull();
    expect(read).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledWith("getApp", [
      { type: "String", value: APP_ID },
    ], { scriptHash: REGISTRY_HASH });
  });

  it("keeps a registered but not-yet-materialized shared identity explicit", async () => {
    const { app, read } = makeHarness();
    read.mockImplementation(async (operation: string): Promise<unknown> => {
      if (operation === "getApp") {
        return ["", chainHex(ZERO_HASH), chainHex(ADMIN_HASH), chainHex(ZERO_HASH), false, true];
      }
      if (operation === "getAppAbstractAccount") {
        return [chainHex(ZERO_HASH), chainHex(ZERO_HASH), false];
      }
      return null;
    });

    await expect(app.platformAccount.get()).resolves.toMatchObject({
      registered: true,
      sharedIdentity: null,
      treasuryAccountHash: null,
    });
  });

  it("inherits Registry capability failures without issuing chain reads", async () => {
    const { app, read } = makeHarness(false);

    expect(app.platformAccount.available).toBe(false);
    await expect(app.platformAccount.get()).rejects.toSatisfy(
      (error: unknown) =>
        error instanceof FrameworkCapabilityError && error.capability === "registry",
    );
    expect(read).not.toHaveBeenCalled();
  });
});
