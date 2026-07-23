import { afterEach, describe, expect, it, vi } from "vitest";
import { createObservable } from "../react/context";
import {
  createAnchorRuntime,
  readAnchorTransactionOutcome,
  type AnchorRuntimeConfig,
  type PendingAnchorTransaction,
} from "../../trustanchor/src/anchor-runtime";

const APP_ID = "miniapp-trustanchor";
const CONTRACT = "0xab079b4f9a0a2471d136392e25eb8e99898dcad0";
const WALLET = `0x${"11".repeat(20)}`;
const TXID = `0x${"ab".repeat(32)}`;
const CONFIG: AnchorRuntimeConfig = {
  appId: APP_ID,
  expectedMode: 1,
  launchNetwork: "testnet",
  contracts: { mainnet: "0x02beeef6f65c6989a121c0a0e6b23190333edb98", testnet: CONTRACT },
};

type HarnessOptions = {
  mode?: string;
  paused?: boolean;
  stakeReads?: unknown[];
  pendingRewardsReads?: unknown[];
  creditReads?: unknown[];
  malformedStats?: boolean;
  detectNetwork?: string;
  storageSetFails?: boolean;
  initialStorage?: Map<string, unknown>;
};

function harness(options: HarnessOptions = {}) {
  const store = options.initialStorage ?? new Map<string, unknown>();
  const address = createObservable<string | null>(WALLET);
  const stakeReads = [...(options.stakeReads ?? ["2", "5"])];
  const rewardsReads = [...(options.pendingRewardsReads ?? ["100000000", "100000000"])];
  const creditReads = [...(options.creditReads ?? ["0", "0"])];
  const invoke = vi.fn(async (_operation: string, _args: unknown[], invokeOptions?: { onTransactionSent?: (txid: string) => void }) => {
    invokeOptions?.onTransactionSent?.(TXID);
    return { txid: TXID, success: true, verified: false };
  });
  const readRaw = vi.fn(async (operation: string) => {
    if (operation === "getAppMode") return options.mode ?? "1";
    if (operation === "isAppPaused") return options.paused ?? false;
    if (operation === "getAnchorStats") {
      if (options.malformedStats) return { mode: options.mode ?? "1", totalStaked: "12" };
      return {
        mode: options.mode ?? "1",
        totalStaked: "12",
        totalStakers: "2",
        rewardPerNeo: "0",
        rewardReserve: "300000000",
        agentCount: "21",
        selectedAgentId: "2",
        paused: options.paused ?? false,
      };
    }
    if (operation === "getUserStake") return stakeReads.length > 1 ? stakeReads.shift() : stakeReads[0];
    if (operation === "getPendingRewards") return rewardsReads.length > 1 ? rewardsReads.shift() : rewardsReads[0];
    if (operation === "getCredit") return creditReads.length > 1 ? creditReads.shift() : creditReads[0];
    throw new Error(`unexpected read ${operation}`);
  });
  const storage = {
    get: vi.fn((key: string, fallback?: unknown) => store.has(key) ? store.get(key) : fallback),
    set: vi.fn((key: string, value: unknown) => {
      if (options.storageSetFails) throw new Error("storage blocked");
      store.set(key, value);
    }),
    delete: vi.fn((key: string) => store.delete(key)),
  };
  const arg = {
    string: (value: unknown) => ({ type: "String", value: String(value) }),
    hash160: (value: unknown) => ({ type: "Hash160", value: String(value) }),
    integer: (value: unknown) => ({ type: "Integer", value: String(value) }),
  };
  const app = {
    storage: { local: storage },
    chain: {
      address,
      arg,
      readRaw,
      invoke,
      ensureWallet: vi.fn(async () => WALLET),
      detectNetwork: vi.fn(async () => options.detectNetwork ?? "neo-n3-testnet"),
    },
    platformAnchor: {
      appMode: () => readRaw("getAppMode"),
      appPaused: () => readRaw("isAppPaused"),
      stats: () => readRaw("getAnchorStats"),
      userStake: () => readRaw("getUserStake"),
      pendingRewards: () => readRaw("getPendingRewards"),
      credit: () => readRaw("getCredit"),
      stakeNeo: (amount: unknown, user: unknown, invokeOptions?: { onTransactionSent?: (txid: string) => void }) =>
        invoke("transfer", [
          arg.hash160(user),
          arg.hash160(CONTRACT),
          arg.integer(amount),
          arg.string(`stake:${APP_ID}`),
        ], invokeOptions),
      withdraw: (amount: unknown, user: unknown, invokeOptions?: { onTransactionSent?: (txid: string) => void }) =>
        invoke("withdraw", [arg.string(APP_ID), arg.hash160(user), arg.integer(amount)], {
          ...invokeOptions,
          scriptHash: CONTRACT,
        }),
      claimRewards: (user: unknown, invokeOptions?: { onTransactionSent?: (txid: string) => void }) =>
        invoke("claimRewards", [arg.string(APP_ID), arg.hash160(user)], {
          ...invokeOptions,
          scriptHash: CONTRACT,
        }),
      withdrawCredit: (asset: unknown, amount: unknown, user: unknown, invokeOptions?: { onTransactionSent?: (txid: string) => void }) =>
        invoke("withdrawCredit", [arg.hash160(user), arg.string(asset), arg.integer(amount)], {
          ...invokeOptions,
          scriptHash: CONTRACT,
        }),
    },
    // Harness mirror of the framework surfaces the runtime adopted in the RFC
    // migration (wallet.onAccountChanged identity diff over chain.address +
    // errors.messageOf Error-message extraction). Assertions are unchanged —
    // these follow the framework-documented semantics.
    wallet: {
      onAccountChanged: (
        handler: (change: { previous: string | null; current: string | null }) => void,
      ) => {
        let last = address.get() || null;
        return address.subscribe(() => {
          const next = address.get() || null;
          if (next === last) return;
          const previous = last;
          last = next;
          handler({ previous, current: next });
        });
      },
    },
    errors: {
      messageOf: (error: unknown, fallback?: string) =>
        error instanceof Error && error.message
          ? error.message
          : typeof error === "string" && error
            ? error
            : fallback ?? "error",
    },
  };
  return { app: app as never, store, storage, invoke, readRaw };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TrustAnchor production runtime", () => {
  it("fails closed when a stats read is malformed instead of rendering zero", async () => {
    const h = harness({ malformedStats: true });
    const runtime = createAnchorRuntime(h.app, (key) => key, CONFIG, vi.fn());
    await runtime.loadAll();
    expect(runtime.state.stats.get()).toBeNull();
    expect(runtime.state.user.get()).toBeNull();
    expect(runtime.state.readStatus.get()).toBe("read-unavailable");
    expect(runtime.state.readError.get()).toBe("anchorReadUnavailable");
    runtime.cleanup();
  });

  it("blocks a mode mismatch before opening the wallet or invoking a contract", async () => {
    const h = harness({ mode: "2" });
    const runtime = createAnchorRuntime(h.app, (key) => key, CONFIG, vi.fn());
    await expect(runtime.stake("1")).rejects.toThrow("anchorModeMismatch");
    expect(h.app.chain.ensureWallet).not.toHaveBeenCalled();
    expect(h.invoke).not.toHaveBeenCalled();
    runtime.cleanup();
  });

  it("gates every write on a verified local-storage round trip", async () => {
    const h = harness({ storageSetFails: true });
    const runtime = createAnchorRuntime(h.app, (key) => key, CONFIG, vi.fn());
    await expect(runtime.stake("1")).rejects.toThrow("recoveryStorageUnavailable");
    expect(h.app.chain.ensureWallet).not.toHaveBeenCalled();
    expect(h.invoke).not.toHaveBeenCalled();
    runtime.cleanup();
  });

  it("persists the exact binding at broadcast and leaves unknown outcomes pending", async () => {
    const h = harness({ stakeReads: ["2"] });
    const reader = vi.fn(async () => ({ state: "unknown" as const, notifications: [] }));
    const runtime = createAnchorRuntime(h.app, (key) => key, CONFIG, reader);
    const result = await runtime.stake("3");
    const pending = runtime.state.pendingTransaction.get();
    expect(result).toEqual({ txid: TXID, confirmed: false });
    expect(pending).toMatchObject({
      network: "testnet",
      contract: CONTRACT,
      appId: APP_ID,
      expectedMode: 1,
      walletHash: WALLET,
      action: "stake",
      amount: "3",
      beforeStake: "2",
      expectedStake: "5",
      txid: TXID,
    });
    expect(h.store.get("pending-transaction-v2/testnet")).toMatchObject({ txid: TXID });
    expect(runtime.state.actionStatus.get()).toBe("transactionPending");
    runtime.cleanup();
  });

  it("confirms stake only after HALT, the exact Anchor event, and matching readback", async () => {
    const h = harness({ stakeReads: ["2", "5"] });
    const reader = vi.fn(async () => ({
      state: "halt" as const,
      notifications: [{
        contract: CONTRACT,
        eventName: "AnchorStakeChanged",
        state: [APP_ID, WALLET, "5", "15"],
      }],
    }));
    const runtime = createAnchorRuntime(h.app, (key) => key, CONFIG, reader);
    await expect(runtime.stake("3")).resolves.toEqual({ txid: TXID, confirmed: true });
    expect(runtime.state.pendingTransaction.get()).toBeNull();
    expect(runtime.state.user.get()?.stake).toBe("5");
    expect(runtime.state.actionStatus.get()).toBe("transactionConfirmed");
    expect(runtime.state.history.get()[0]).toMatchObject({ action: "stake", status: "confirmed", txid: TXID });
    runtime.cleanup();
  });

  it("ends a VM FAULT explicitly and never labels it confirmed", async () => {
    const h = harness({ stakeReads: ["2"] });
    const runtime = createAnchorRuntime(
      h.app,
      (key) => key,
      CONFIG,
      vi.fn(async () => ({ state: "fault" as const, notifications: [] })),
    );
    await expect(runtime.stake("1")).resolves.toEqual({ txid: TXID, confirmed: false });
    expect(runtime.state.pendingTransaction.get()).toBeNull();
    expect(runtime.state.actionStatus.get()).toBe("transactionFaulted");
    expect(runtime.state.history.get()[0]?.status).toBe("fault");
    runtime.cleanup();
  });

  it("restores a saved transaction and checks it without replaying the write", async () => {
    const pending: PendingAnchorTransaction = {
      version: 2,
      network: "testnet",
      contract: CONTRACT,
      appId: APP_ID,
      expectedMode: 1,
      walletHash: WALLET,
      action: "stake",
      amount: "1",
      beforeStake: "2",
      beforeRewards: "0",
      beforeCredit: "0",
      expectedStake: "3",
      txid: TXID,
      createdAt: Date.now(),
    };
    const store = new Map<string, unknown>([["pending-transaction-v2/testnet", pending]]);
    const h = harness({ initialStorage: store });
    const reader = vi.fn(async () => ({ state: "unknown" as const, notifications: [] }));
    const runtime = createAnchorRuntime(h.app, (key) => key, CONFIG, reader);
    await vi.waitFor(() => expect(reader).toHaveBeenCalled());
    await runtime.confirmPending();
    expect(h.invoke).not.toHaveBeenCalled();
    expect(runtime.state.pendingTransaction.get()?.txid).toBe(TXID);
    runtime.cleanup();
  });

  it("parses the live getapplicationlog shape and preserves exact event binding", async () => {
    const appId = btoa(APP_ID);
    const walletChainBytes = btoa(String.fromCharCode(...new Uint8Array(20).fill(0x11)));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: {
        executions: [{
          vmstate: "HALT",
          notifications: [{
            contract: CONTRACT,
            eventname: "AnchorStakeChanged",
            state: {
              type: "Array",
              value: [
                { type: "ByteString", value: appId },
                { type: "ByteString", value: walletChainBytes },
                { type: "Integer", value: "5" },
                { type: "Integer", value: "15" },
              ],
            },
          }],
        }],
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    await expect(readAnchorTransactionOutcome("testnet", TXID)).resolves.toEqual({
      state: "halt",
      notifications: [{
        contract: CONTRACT,
        eventName: "AnchorStakeChanged",
        state: [APP_ID, WALLET, "5", "15"],
      }],
    });
  });
});
