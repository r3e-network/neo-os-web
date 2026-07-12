import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "@shared/react";
import { createObservable } from "@shared/react/context";
import { addressToScriptHash } from "@shared/utils/neo";
import type { ChainService, InvokeOptions, TxResult } from "@shared/services/ChainService";
import { useDevTippingWallet } from "./useDevTippingWallet";
import type { DevTippingAttestation, DevTippingExecutionState } from "../dev-tipping-rpc";

const ALICE = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const BOB = "NUuJw4C4XJFzxAvSZnFTfsNoWZytmQKXQP";
const ALICE_HASH = addressToScriptHash(ALICE);
const BOB_HASH = addressToScriptHash(BOB);
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

function setup(verified: boolean, creditFailure = false) {
  let developerReads = 0;
  const invokeWithPayment = vi.fn(async (
    _amount: string,
    _memo: string,
    _operation: string,
    _args: unknown[],
    options?: InvokeOptions,
  ): Promise<TxResult> => {
    options?.onPaymentSent?.(`0x${"b".repeat(64)}`);
    options?.onTransactionSent?.(TXID);
    return {
      txid: TXID,
      success: true,
      verified,
      event: verified ? { state: ["2", "2", ALICE_HASH, "10000000", true] } : undefined,
    };
  });
  const read = vi.fn(async (operation: string) => {
    if (operation === "minTip") return "100000";
    if (operation === "totalDevelopers") return "2";
    if (operation === "creditOf") {
      if (creditFailure) throw new Error("RPC unavailable");
      return "0";
    }
    if (operation === "balanceOf") return "500000000";
    if (operation === "getDeveloper") {
      developerReads += 1;
      return {
        id: 2,
        wallet: BOB_HASH,
        name: "Neo SDK Maintainer",
        role: "SDK",
        totalReceived: developerReads > 1 ? "40000000" : "30000000",
        tipCount: developerReads > 1 ? "2" : "1",
        balance: developerReads > 1 ? "10000000" : "0",
      };
    }
    return "0";
  });
  const address = createObservable<string | null>(ALICE);
  const contractAddress = createObservable<string | null>(CONTRACT);
  const chain = {
    address,
    contractAddress,
    ensureWallet: vi.fn(async () => ALICE),
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    read,
    invokeWithPayment,
    invoke: vi.fn(),
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
  return { wallet, invokeWithPayment };
}

describe("dev-tipping production receipt semantics", () => {
  it("confirms only after the exact Tipped event and recipient state readback", async () => {
    const { wallet, invokeWithPayment } = setup(true);

    await expect(wallet.sendTip(2, "0.1", "", "", true)).resolves.toBe("confirmed");
    expect(invokeWithPayment).toHaveBeenCalledWith(
      "10000000",
      "miniapp-devtipping:tip",
      "tip",
      expect.any(Array),
      expect.objectContaining({ waitForEvent: "Tipped" }),
    );
    expect(wallet.pendingTip.get()).toBeNull();
    expect(wallet.lastReceipt.get()).toMatchObject({ status: "confirmed", txid: TXID, devId: 2 });
  });

  it("keeps a broadcast tx pending when its exact event was not observed", async () => {
    const { wallet } = setup(false);

    await expect(wallet.sendTip(2, "0.1", "", "", true)).resolves.toBe("pending");
    expect(wallet.pendingTip.get()).toMatchObject({ txid: TXID, kind: "tip" });
    expect(wallet.lastReceipt.get()).toMatchObject({ status: "pending" });
  });

  it("fails closed when the credit RPC read is unavailable", async () => {
    const { wallet, invokeWithPayment } = setup(true, true);

    await expect(wallet.sendTip(2, "0.1", "", "", true)).rejects.toThrow("RPC unavailable");
    expect(invokeWithPayment).not.toHaveBeenCalled();
  });
});
