/**
 * dev-tipping registerDeveloper text limits — contract-unit pins.
 *
 * MiniAppTipJar.cs asserts name.Length <= 64 and role.Length <= 64 over the
 * UTF-8 ByteString (the devpack compiles C# string.Length to the SIZE
 * opcode), while the app used to validate `trimmed.length` — UTF-16 code
 * units. A 30-CJK-char name is 30 chars but 90 bytes: it passed the app's
 * validation AND the PlayArea's maxLength={64}, then deterministically
 * reverted "invalid name" on-chain after the user already paid the
 * transaction fee. These tests drive the REAL useDevTippingWallet composable
 * and pin that over-byte names/roles are rejected BEFORE any broadcast, and
 * that anything actually sent fits the contract's byte budget.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "@shared/react";
import { createObservable } from "@shared/react/context";
import type { ChainService, InvokeOptions, TxResult } from "@shared/services/ChainService";
import { useDevTippingWallet } from "../../dev-tipping/src/composables/useDevTippingWallet";
import type { DevTippingAttestation, DevTippingExecutionState } from "../../dev-tipping/src/dev-tipping-rpc";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const CONTRACT = "0x6fdcf2ff29bde658cdcd9fddd082fe1813dd21ec";
const TXID = `0x${"a".repeat(64)}`;

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

beforeEach(() => vi.stubGlobal("localStorage", new MemoryStorage()));
afterEach(() => vi.unstubAllGlobals());

function makeHarness() {
  const address = createObservable<string | null>(ALICE);
  const contractAddress = createObservable<string | null>(CONTRACT);
  const read = vi.fn(async (operation: string) => {
    if (operation === "minTip") return "100000";
    if (operation === "totalDevelopers") return "2";
    if (operation === "developerIdOf") return "0";
    return "0";
  });
  const invoke = vi.fn(async (
    _operation: string,
    _args: unknown[],
    invokeOptions?: InvokeOptions,
  ): Promise<TxResult> => {
    invokeOptions?.onTransactionSent?.(TXID);
    return { txid: TXID, success: true, verified: false };
  });
  const chain = {
    address,
    contractAddress,
    ensureWallet: vi.fn(async () => address.get() ?? ""),
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    read,
    invoke,
    invokeWithPayment: vi.fn(),
    waitForEvent: vi.fn(async () => null),
  } as unknown as ChainService;
  const app = createMiniAppFramework(
    { services: { chain }, t: (key: string) => key } as never,
    { appId: "miniapp-dev-tipping" },
  );
  const wallet = useDevTippingWallet({
    app,
    t: (key) => key,
    launchNetwork: "testnet",
    attestContract: vi.fn(async (): Promise<DevTippingAttestation> => ({
      compatible: true,
      network: "testnet",
      contract: CONTRACT,
      checksum: 2_483_335_541,
      updateCounter: 0,
      reason: "ok",
    })),
    readExecutionState: vi.fn(async (): Promise<DevTippingExecutionState> => "pending"),
  });
  return { invoke, wallet };
}

describe("dev-tipping registerDeveloper contract text limits", () => {
  const utf8 = new TextEncoder();

  it("rejects a name over the 64-BYTE budget before any broadcast", async () => {
    const h = makeHarness();

    // 30 CJK chars = 90 UTF-8 bytes: over the byte budget, under it by chars.
    const cjkName = "开发者".repeat(10);
    expect(cjkName.length).toBe(30);
    expect(utf8.encode(cjkName).length).toBe(90);

    await expect(h.wallet.registerDeveloper(cjkName, "SDK")).rejects.toThrow("invalidDevName");
    // The doomed transaction must never be broadcast — the contract would
    // revert "invalid name" and still charge the fee.
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it("rejects a role over the 64-BYTE budget before any broadcast", async () => {
    const h = makeHarness();

    const cjkRole = "协议维护者".repeat(5); // 25 chars / 75 bytes
    expect(cjkRole.length).toBeLessThanOrEqual(64);
    expect(utf8.encode(cjkRole).length).toBeGreaterThan(64);

    await expect(h.wallet.registerDeveloper("Builder", cjkRole)).rejects.toThrow("invalidDevRole");
    expect(h.invoke).not.toHaveBeenCalled();
  });

  it("sends a CJK name at exactly the byte budget through untouched", async () => {
    const h = makeHarness();

    // 21 CJK chars = 63 UTF-8 bytes: inside the contract's budget.
    const okName = "开发者".repeat(7);
    expect(utf8.encode(okName).length).toBe(63);

    await expect(h.wallet.registerDeveloper(okName, "SDK")).resolves.toBe("pending");
    const call = h.invoke.mock.calls.find(([operation]) => operation === "registerDeveloper");
    expect(call).toBeTruthy();
    const args = call![1] as Array<{ value?: unknown }>;
    const sentName = String(args[1]?.value);
    const sentRole = String(args[2]?.value);
    expect(sentName).toBe(okName);
    expect(sentRole).toBe("SDK");
    // The contract's unit: never more bytes than MiniAppTipJar accepts.
    expect(utf8.encode(sentName).length).toBeLessThanOrEqual(64);
    expect(utf8.encode(sentRole).length).toBeLessThanOrEqual(64);
  });
});
