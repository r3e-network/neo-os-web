import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "@shared/react";

const harness = vi.hoisted(() => ({
  definition: null as null | { setup?: (ctx: Record<string, unknown>) => unknown },
}));

vi.mock("@shared/react/defineMiniApp", async () => {
  const actual = await vi.importActual<typeof import("@shared/react/defineMiniApp")>(
    "@shared/react/defineMiniApp",
  );
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.definition = definition as typeof harness.definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("./PhaserPlayArea", () => ({ default: () => null }));

function observable<T>(initial: T) {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: T) => {
      value = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

type Action = (...args: unknown[]) => Promise<unknown>;

async function setupDisconnectedApp() {
  const actions = new Map<string, Action>();
  const address = observable<string | null>(null);
  const contractAddress = observable<string | null>(
    "0x68ef0ead081d2263acc51ce82f5c70c46440cca4",
  );
  const ensureWallet = vi.fn(async () => {
    const connected = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
    address.set(connected);
    return connected;
  });
  const invoke = vi.fn();
  const read = vi.fn(async (operation: string) => {
    if (operation === "getOwner") return "0x1111111111111111111111111111111111111111";
    if (operation === "lastEnvelopeId") return "0";
    if (operation === "creditOf") return "0";
    return "0";
  });
  const chain = {
    address,
    contractAddress,
    ensureWallet,
    detectNetwork: vi.fn(async () => "testnet"),
    invoke,
    read,
    readArray: vi.fn(async () => []),
    waitForEvent: vi.fn(async () => null),
  };
  const setStatus = vi.fn();
  const ctx: Record<string, unknown> = {
    services: {
      chain,
      clipboard: { copy: vi.fn(async () => undefined) },
    },
    launchContext: { params: {}, network: "testnet" },
    t: (key: string) => key,
    setStatus,
    registerAction: (key: string, action: Action) => actions.set(key, action),
  };
  ctx.framework = createMiniAppFramework(ctx as never, {
    appId: "miniapp-redenvelope-main-safety",
  });
  const result = harness.definition?.setup?.(ctx) as {
    state: Record<string, { get: () => unknown }>;
    cleanup: () => void;
  };
  return { actions, ensureWallet, invoke, result, setStatus };
}

describe("Red Envelope irreversible-action wiring", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.definition = null;
    await import("./main");
  });

  it("uses a disconnected create/claim press only as guidance, never connect-and-spend", async () => {
    const app = await setupDisconnectedApp();

    await app.actions.get("createEnvelope")?.({
      amount: "1",
      count: "4",
      expiryHours: "24",
    });
    await app.actions.get("claimEnvelope")?.({ envelopeId: "2" });

    expect(app.ensureWallet).not.toHaveBeenCalled();
    expect(app.invoke).not.toHaveBeenCalled();
    expect(app.result.state.walletConnected!.get()).toBe(false);

    await app.actions.get("connectWallet")?.();

    expect(app.ensureWallet).toHaveBeenCalledTimes(1);
    expect(app.invoke).not.toHaveBeenCalled();
    expect(app.result.state.walletConnected!.get()).toBe(true);
    app.result.cleanup();
  });

  it("blocks new paid create and claim actions in stale hosts when the manifest gate is closed", async () => {
    const { manifest } = await import("./manifest");
    const original = manifest.supportsGameFi;
    manifest.supportsGameFi = false;
    try {
      const app = await setupDisconnectedApp();

      await app.actions.get("createEnvelope")?.({
        amount: "1",
        count: "4",
        expiryHours: "24",
      });
      await app.actions.get("claimEnvelope")?.({ envelopeId: "2" });

      expect(app.ensureWallet).not.toHaveBeenCalled();
      expect(app.invoke).not.toHaveBeenCalled();
      expect(app.result.state.paidActionsAvailable!.get()).toBe(false);
      app.result.cleanup();
    } finally {
      manifest.supportsGameFi = original;
    }
  });
});
