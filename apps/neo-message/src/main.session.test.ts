// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMiniAppFramework } from "@shared/react";
import type { Eip1193Provider } from "@shared/utils/evm-chain";
import type { PendingDelivery } from "./pending-delivery";

const captured = vi.hoisted(() => ({
  definition: null as null | {
    setup?: (ctx: Record<string, unknown>) => unknown;
  },
}));

vi.mock("@shared/react", async () => {
  const actual = await vi.importActual<typeof import("@shared/react")>("@shared/react");
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      captured.definition = definition as typeof captured.definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("./PlayArea", () => ({ default: () => null }));

const FIRST = "0x1111111111111111111111111111111111111111";
const SECOND = "0x2222222222222222222222222222222222222222";
const emptyIds = `0x${(32n).toString(16).padStart(64, "0")}${(0n).toString(16).padStart(64, "0")}`;

type ProviderEvent = "accountsChanged" | "chainChanged";

class ProviderHarness implements Eip1193Provider {
  accounts = [FIRST];
  chainId = "0xba93";
  transactionKnown = false;
  readonly listeners = new Map<ProviderEvent, Set<(value: unknown) => void>>();
  readonly request = vi.fn(async ({ method }: { method: string; params?: unknown[] | object }) => {
    if (method === "eth_chainId") return this.chainId;
    if (method === "eth_accounts") return [...this.accounts];
    if (method === "eth_call") return emptyIds;
    if (method === "eth_getTransactionReceipt" || method === "eth_getTransactionByHash") {
      return this.transactionKnown ? { hash: `0x${"ab".repeat(32)}` } : null;
    }
    return null;
  });

  on(event: ProviderEvent, listener: (value: unknown) => void) {
    const listeners = this.listeners.get(event) ?? new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }

  removeListener(event: ProviderEvent, listener: (value: unknown) => void) {
    this.listeners.get(event)?.delete(listener);
  }

  emit(event: ProviderEvent, value: unknown) {
    this.listeners.get(event)?.forEach((listener) => listener(value));
  }
}

type Action = (...args: unknown[]) => Promise<unknown>;

async function setupApp(provider: ProviderHarness, pending?: PendingDelivery) {
  const actions = new Map<string, Action>();
  const setStatus = vi.fn();
  const chain = {
    detectNetwork: vi.fn(async () => "neo-x-mainnet"),
    ensureEvmWallet: vi.fn(async () => provider.accounts[0] ?? ""),
    invokeEvmWithValue: vi.fn(),
  };
  const ctx: Record<string, unknown> = {
    services: { chain },
    launchContext: { params: {}, network: "neo-x-mainnet" },
    t: (key: string) => key,
    setStatus,
    registerAction: (key: string, action: Action) => actions.set(key, action),
  };
  const framework = createMiniAppFramework(ctx as never, {
    appId: "miniapp-neo-message",
    storagePrefix: "0xd1906192c2308ae416acdA96238ca846ebb83f15:".toLowerCase(),
  });
  if (pending) framework.storage.local.set("pending-delivery:v1", pending);
  ctx.framework = framework;

  const setup = captured.definition?.setup;
  expect(setup).toBeTypeOf("function");
  const result = await setup?.(ctx) as {
    state: Record<string, { get(): unknown; set(value: unknown): void }>;
    loadData(): Promise<void>;
    cleanup(): void;
  };
  return { actions, chain, result, setStatus };
}

describe("Neo Message wallet session and recovery", () => {
  let provider: ProviderHarness;

  beforeEach(async () => {
    vi.resetModules();
    captured.definition = null;
    localStorage.clear();
    provider = new ProviderHarness();
    vi.stubGlobal("ethereum", provider);
    await import("./main");
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("clears private mailbox rows immediately on account and chain events", async () => {
    const app = await setupApp(provider);
    await app.result.loadData();
    expect(app.result.state.address?.get()).toBe(FIRST);

    app.result.state.inbox?.set([{ id: "private-row" }]);
    provider.accounts = [SECOND];
    provider.emit("accountsChanged", [SECOND]);
    expect(app.result.state.address?.get()).toBe(SECOND);
    expect(app.result.state.inbox?.get()).toEqual([]);
    await vi.waitFor(() => expect(provider.request).toHaveBeenCalledWith({ method: "eth_chainId" }));

    app.result.state.inbox?.set([{ id: "wrong-chain-row" }]);
    provider.chainId = "0x1";
    provider.emit("chainChanged", "0x1");
    expect(app.result.state.networkSupported?.get()).toBe(false);
    expect(app.result.state.inbox?.get()).toEqual([]);

    app.result.cleanup();
    expect(provider.listeners.get("accountsChanged")?.size ?? 0).toBe(0);
    expect(provider.listeners.get("chainChanged")?.size ?? 0).toBe(0);
  });

  it("keeps a stale recovery record while Neo X still knows the transaction", async () => {
    const pending: PendingDelivery = {
      version: 1,
      txid: `0x${"ab".repeat(32)}`,
      sender: FIRST,
      recipient: SECOND,
      unlockTime: 0,
      createdAt: Date.now() - 25 * 60 * 60 * 1000,
    };
    provider.transactionKnown = true;
    const app = await setupApp(provider, pending);

    await app.actions.get("clearStalePendingDelivery")?.();
    expect(app.result.state.pendingDelivery?.get()).toEqual(pending);
    expect(app.setStatus).toHaveBeenLastCalledWith("pendingTransactionStillKnown", "error");

    provider.transactionKnown = false;
    await app.actions.get("clearStalePendingDelivery")?.();
    expect(app.result.state.pendingDelivery?.get()).toBeNull();
    expect(app.setStatus).toHaveBeenLastCalledWith("pendingCleared", "info");
    app.result.cleanup();
  });
});
