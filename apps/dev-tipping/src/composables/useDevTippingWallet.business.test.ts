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
const DEPOSIT_TXID = `0x${"b".repeat(64)}`;
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
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const developerBefore = {
  id: 2,
  wallet: BOB_HASH,
  name: "Neo SDK Maintainer",
  role: "SDK",
  totalReceived: "30000000",
  tipCount: "1",
  balance: "0",
};

const developerAfter = {
  ...developerBefore,
  totalReceived: "40000000",
  tipCount: "2",
  balance: "10000000",
};

type HarnessOptions = {
  creditReads?: string[];
  developerReads?: Array<Record<string, unknown>>;
  developerIdReads?: string[];
  execution?: DevTippingExecutionState;
  tipVerified?: boolean;
  tipTxid?: string;
  waitEvent?: unknown;
  onRead?: (operation: string) => void;
  invokeWithPayment?: (
    amount: string,
    memo: string,
    operation: string,
    args: unknown[],
    options?: InvokeOptions,
  ) => Promise<TxResult>;
  invoke?: (
    operation: string,
    args: unknown[],
    options?: InvokeOptions,
  ) => Promise<TxResult>;
};

function makeHarness(options: HarnessOptions = {}) {
  const address = createObservable<string | null>(ALICE);
  const contractAddress = createObservable<string | null>(CONTRACT);
  const creditReads = [...(options.creditReads ?? ["0", "0"])];
  const developerReads = [...(options.developerReads ?? [developerBefore, developerAfter])];
  const developerIdReads = [...(options.developerIdReads ?? ["0", "3"])];
  let waitEvent: unknown = options.waitEvent ?? null;

  const read = vi.fn(async (operation: string) => {
    options.onRead?.(operation);
    if (operation === "minTip") return "100000";
    if (operation === "totalDevelopers") return "2";
    if (operation === "creditOf") return creditReads.shift() ?? "0";
    if (operation === "balanceOf") return "500000000";
    if (operation === "developerIdOf") return developerIdReads.shift() ?? "0";
    if (operation === "getDeveloper") return developerReads.shift() ?? developerAfter;
    return "0";
  });

  const defaultPayment = async (
    _amount: string,
    _memo: string,
    _operation: string,
    _args: unknown[],
    invokeOptions?: InvokeOptions,
  ): Promise<TxResult> => {
    invokeOptions?.onPaymentSent?.(DEPOSIT_TXID);
    invokeOptions?.onTransactionSent?.(options.tipTxid ?? TXID);
    return {
      txid: options.tipTxid ?? TXID,
      success: true,
      verified: options.tipVerified ?? true,
      event: (options.tipVerified ?? true)
        ? { state: ["2", "2", ALICE_HASH, "10000000", true] }
        : undefined,
    };
  };

  const invokeWithPayment = vi.fn(options.invokeWithPayment ?? defaultPayment);
  const invoke = vi.fn(options.invoke ?? (async (
    _operation: string,
    _args: unknown[],
    invokeOptions?: InvokeOptions,
  ): Promise<TxResult> => {
    invokeOptions?.onTransactionSent?.(TXID);
    return { txid: TXID, success: true, verified: false };
  }));
  const waitForEvent = vi.fn(async () => waitEvent);
  const chain = {
    address,
    contractAddress,
    ensureWallet: vi.fn(async () => address.get() ?? ""),
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    read,
    invokeWithPayment,
    invoke,
    waitForEvent,
  } as unknown as ChainService;
  const app = createMiniAppFramework(
    { services: { chain }, t: (key: string) => key } as never,
    { appId: "miniapp-dev-tipping" },
  );
  const readExecutionState = vi.fn(async (): Promise<DevTippingExecutionState> =>
    options.execution ?? "pending");
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
    readExecutionState,
  });
  return {
    address,
    invoke,
    invokeWithPayment,
    read,
    readExecutionState,
    setWaitEvent: (event: unknown) => { waitEvent = event; },
    wallet,
  };
}

describe("Developer Tipping production business flows", () => {
  it("deposits only the exact shortfall when reusable credit already exists", async () => {
    const h = makeHarness({ creditReads: ["2500000", "0"] });

    await expect(h.wallet.sendTip(2, "0.1", "", "", true)).resolves.toBe("confirmed");
    expect(h.invokeWithPayment).toHaveBeenCalledWith(
      "7500000",
      "miniapp-devtipping:tip",
      "tip",
      expect.any(Array),
      expect.objectContaining({ waitForEvent: "Tipped" }),
    );
  });

  it("blocks every other wallet write while a tip wallet prompt is active", async () => {
    let finish: ((result: TxResult) => void) | undefined;
    const pendingPayment = new Promise<TxResult>((resolve) => { finish = resolve; });
    const h = makeHarness({
      invokeWithPayment: async (_amount, _memo, _operation, _args, invokeOptions) => {
        invokeOptions?.onPaymentSent?.(DEPOSIT_TXID);
        return pendingPayment;
      },
    });

    const tip = h.wallet.sendTip(2, "0.1", "", "", true);
    await vi.waitFor(() => expect(h.invokeWithPayment).toHaveBeenCalledTimes(1));
    await expect(h.wallet.registerDeveloper("Builder", "SDK")).rejects.toThrow("operationBusy");
    expect(h.invoke).not.toHaveBeenCalled();

    finish?.({ txid: TXID, success: true, verified: false });
    await expect(tip).resolves.toBe("pending");
  });

  it("cancels before broadcast when the connected wallet changes during verification reads", async () => {
    let h: ReturnType<typeof makeHarness>;
    h = makeHarness({
      onRead: (operation) => {
        if (operation === "balanceOf") h.address.set(BOB);
      },
    });

    await expect(h.wallet.sendTip(2, "0.1", "", "", true)).rejects.toThrow(
      "walletChangedDuringAction",
    );
    expect(h.invokeWithPayment).not.toHaveBeenCalled();
  });

  it("persists and recovers a developer registration with event plus registry readback", async () => {
    const h = makeHarness({
      developerReads: [{
        id: 3,
        wallet: ALICE_HASH,
        name: "Builder",
        role: "SDK",
        totalReceived: "0",
        tipCount: "0",
        balance: "0",
      }],
      developerIdReads: ["0", "3"],
      invoke: async (_operation, _args, invokeOptions) => {
        invokeOptions?.onTransactionSent?.(TXID);
        return { txid: TXID, success: true, verified: false };
      },
    });

    await expect(h.wallet.registerDeveloper("Builder", "SDK")).resolves.toBe("pending");
    expect(h.wallet.pendingOperation.get()).toMatchObject({ kind: "register", txid: TXID });

    h.setWaitEvent({ state: ["3", ALICE_HASH, "Builder"] });
    await expect(h.wallet.recoverPendingOperation()).resolves.toBe("confirmed");
    expect(h.wallet.pendingOperation.get()).toBeNull();
    expect(h.wallet.lastReceipt.get()).toMatchObject({ kind: "register", status: "confirmed" });
  });

  it("recovers developer and unused-credit withdrawals from exact saved receipts", async () => {
    const withdrawTips = makeHarness({
      developerReads: [
        {
          id: 2,
          wallet: ALICE_HASH,
          name: "Builder",
          role: "SDK",
          totalReceived: "100000000",
          tipCount: "4",
          balance: "50000000",
        },
        {
          id: 2,
          wallet: ALICE_HASH,
          name: "Builder",
          role: "SDK",
          totalReceived: "100000000",
          tipCount: "4",
          balance: "0",
        },
      ],
      invoke: async (_operation, _args, invokeOptions) => {
        invokeOptions?.onTransactionSent?.(TXID);
        return { txid: TXID, success: true, verified: false };
      },
    });
    await expect(withdrawTips.wallet.withdrawTips(2)).resolves.toBe("pending");
    withdrawTips.setWaitEvent({ state: ["2", ALICE_HASH, "50000000"] });
    await expect(withdrawTips.wallet.recoverPendingOperation()).resolves.toBe("confirmed");
    expect(withdrawTips.wallet.lastReceipt.get()).toMatchObject({
      kind: "withdrawTips",
      status: "confirmed",
    });

    vi.stubGlobal("localStorage", new MemoryStorage());
    const withdrawCredit = makeHarness({
      creditReads: ["150000000", "0"],
      invoke: async (_operation, _args, invokeOptions) => {
        invokeOptions?.onTransactionSent?.(TXID);
        return { txid: TXID, success: true, verified: false };
      },
    });
    await expect(withdrawCredit.wallet.withdrawCredit()).resolves.toBe("pending");
    withdrawCredit.setWaitEvent({ state: [ALICE_HASH, "150000000"] });
    await expect(withdrawCredit.wallet.recoverPendingOperation()).resolves.toBe("confirmed");
    expect(withdrawCredit.wallet.lastReceipt.get()).toMatchObject({
      kind: "withdrawCredit",
      status: "confirmed",
    });
  });

  it("clears an exact FAULT but keeps HALT-without-event locked for another check", async () => {
    const fault = makeHarness({ tipVerified: false, execution: "fault" });
    await expect(fault.wallet.sendTip(2, "0.1", "", "", true)).resolves.toBe("pending");
    await expect(fault.wallet.recoverPendingOperation()).resolves.toBe("fault");
    expect(fault.wallet.pendingOperation.get()).toBeNull();
    expect(fault.wallet.lastReceipt.get()).toMatchObject({ status: "fault" });

    vi.stubGlobal("localStorage", new MemoryStorage());
    const halt = makeHarness({ tipVerified: false, execution: "halt" });
    await expect(halt.wallet.sendTip(2, "0.1", "", "", true)).resolves.toBe("pending");
    await expect(halt.wallet.recoverPendingOperation()).resolves.toBe("readback");
    expect(halt.wallet.pendingOperation.get()).toMatchObject({ kind: "tip", txid: TXID });
    await expect(halt.wallet.withdrawCredit()).rejects.toThrow("pendingActionBlocksAction");
  });

  it("keeps a stale receipt locked instead of enabling a duplicate payment", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    const h = makeHarness({ tipVerified: false });
    await expect(h.wallet.sendTip(2, "0.1", "", "", true)).resolves.toBe("pending");

    vi.setSystemTime(new Date("2026-07-02T00:00:01Z"));
    await expect(h.wallet.recoverPendingOperation()).resolves.toBe("expired");
    expect(h.wallet.pendingOperation.get()).toMatchObject({ txid: TXID });
    expect(h.wallet.lastReceipt.get()).toMatchObject({ status: "expired" });
  });

  it("still resolves an old receipt when its exact event becomes available", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-01T00:00:00Z"));
    const h = makeHarness({ tipVerified: false });
    await expect(h.wallet.sendTip(2, "0.1", "", "", true)).resolves.toBe("pending");

    vi.setSystemTime(new Date("2026-07-02T00:00:01Z"));
    h.setWaitEvent({ state: ["2", "2", ALICE_HASH, "10000000", true] });
    await expect(h.wallet.recoverPendingOperation()).resolves.toBe("confirmed");
    expect(h.wallet.pendingOperation.get()).toBeNull();
    expect(h.wallet.lastReceipt.get()).toMatchObject({ status: "confirmed" });
  });

  it("rejects a wallet result that has no exact transaction id", async () => {
    const h = makeHarness({
      tipTxid: "0x1234",
      tipVerified: false,
    });

    await expect(h.wallet.sendTip(2, "0.1", "", "", true)).rejects.toThrow(
      "transactionIdInvalid",
    );
    expect(h.wallet.pendingOperation.get()).toMatchObject({
      kind: "deposit",
      txid: DEPOSIT_TXID,
    });
  });
});
