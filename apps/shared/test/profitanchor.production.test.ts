import { describe, expect, it, vi } from "vitest";
import { createObservable } from "../react/context";
import { createAnchorRuntime, type AnchorRuntimeConfig } from "../../profitanchor/src/anchor-runtime";

const APP_ID = "miniapp-profitanchor";
const CONTRACT = "0xab079b4f9a0a2471d136392e25eb8e99898dcad0";
const WALLET = `0x${"22".repeat(20)}`;
const TXID = `0x${"cd".repeat(32)}`;
const CONFIG: AnchorRuntimeConfig = {
  appId: APP_ID,
  expectedMode: 2,
  launchNetwork: "testnet",
  contracts: { mainnet: "0x02beeef6f65c6989a121c0a0e6b23190333edb98", testnet: CONTRACT },
};

function harness(mode = "2") {
  const store = new Map<string, unknown>();
  const address = createObservable<string | null>(WALLET);
  let rewardsRead = 0;
  const invoke = vi.fn(async (_operation: string, _args: unknown[], options?: { onTransactionSent?: (txid: string) => void }) => {
    options?.onTransactionSent?.(TXID);
    return { txid: TXID, success: true, verified: false };
  });
  const readRaw = vi.fn(async (operation: string) => {
    if (operation === "getAppMode") return mode;
    if (operation === "isAppPaused") return false;
    if (operation === "getAnchorStats") return {
      mode,
      totalStaked: "50",
      totalStakers: "4",
      rewardPerNeo: "0",
      rewardReserve: "500000000",
      agentCount: "21",
      selectedAgentId: "1",
      paused: false,
    };
    if (operation === "getUserStake") return "9";
    if (operation === "getPendingRewards") return rewardsRead++ === 0 ? "100000000" : "0";
    if (operation === "getCredit") return "0";
    throw new Error(operation);
  });
  const app = {
    storage: { local: {
      get: (key: string, fallback?: unknown) => store.has(key) ? store.get(key) : fallback,
      set: (key: string, value: unknown) => store.set(key, value),
      delete: (key: string) => store.delete(key),
    } },
    chain: {
      address,
      arg: {
        string: (value: unknown) => ({ type: "String", value: String(value) }),
        hash160: (value: unknown) => ({ type: "Hash160", value: String(value) }),
        integer: (value: unknown) => ({ type: "Integer", value: String(value) }),
      },
      readRaw,
      invoke,
      ensureWallet: vi.fn(async () => WALLET),
      detectNetwork: vi.fn(async () => "neo-n3-testnet"),
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
  return { app: app as never, invoke };
}

describe("ProfitAnchor production runtime", () => {
  it("binds claim to mode 2, the exact reward event, and zero live claimable readback", async () => {
    const h = harness();
    const runtime = createAnchorRuntime(
      h.app,
      (key) => key,
      CONFIG,
      vi.fn(async () => ({
        state: "halt" as const,
        notifications: [{
          contract: CONTRACT,
          eventName: "AnchorRewardsClaimed",
          state: [APP_ID, WALLET, "100000000"],
        }],
      })),
    );
    await expect(runtime.claim()).resolves.toEqual({ txid: TXID, confirmed: true });
    expect(h.invoke).toHaveBeenCalledWith(
      "claimRewards",
      [
        { type: "String", value: APP_ID },
        { type: "Hash160", value: WALLET },
      ],
      expect.objectContaining({ scriptHash: CONTRACT, waitForEvent: "AnchorRewardsClaimed", onTransactionSent: expect.any(Function) }),
    );
    expect(runtime.state.pendingTransaction.get()).toBeNull();
    expect(runtime.state.user.get()?.pendingRewards).toBe("0");
    runtime.cleanup();
  });

  it("never opens a mode-2 write when the live registration reports another mode", async () => {
    const h = harness("1");
    const runtime = createAnchorRuntime(h.app, (key) => key, CONFIG, vi.fn());
    await expect(runtime.stake("1")).rejects.toThrow("anchorModeMismatch");
    expect(h.app.chain.ensureWallet).not.toHaveBeenCalled();
    expect(h.invoke).not.toHaveBeenCalled();
    runtime.cleanup();
  });

  it("writes the exact ProfitAnchor memo and network-bound contract", async () => {
    const h = harness();
    const runtime = createAnchorRuntime(
      h.app,
      (key) => key,
      CONFIG,
      vi.fn(async () => ({ state: "unknown" as const, notifications: [] })),
    );
    await runtime.stake("4");
    expect(h.invoke).toHaveBeenCalledWith(
      "transfer",
      expect.arrayContaining([
        { type: "Hash160", value: CONTRACT },
        { type: "Integer", value: "4" },
        { type: "String", value: "stake:miniapp-profitanchor" },
      ]),
      expect.objectContaining({ waitForEvent: "AnchorStakeChanged", onTransactionSent: expect.any(Function) }),
    );
    expect(runtime.state.pendingTransaction.get()).toMatchObject({
      network: "testnet",
      contract: CONTRACT,
      appId: APP_ID,
      expectedMode: 2,
      action: "stake",
    });
    runtime.cleanup();
  });
});
