import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createMiniAppFramework } from "../react";
import manifest from "../../sheep-solitaire/src/manifest";

const harness = vi.hoisted(() => ({
  definition: null as null | { setup?: (ctx: Record<string, unknown>) => unknown },
}));

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");

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

vi.mock("../../sheep-solitaire/src/PhaserPlayArea", () => ({ default: () => null }));

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

function setupGameFiHarness() {
  const actions = new Map<string, Action>();
  const address = observable<string | null>("NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs");
  const contractAddress = observable<string | null>(
    "0x7541e13629eb35ec54181be2772bff34e39d3c35",
  );
  const ensureWallet = vi.fn(async () => address.get()!);
  const invoke = vi.fn(async () => ({ event: null }));
  const invokeWithPayment = vi.fn(async () => ({ event: null }));
  const chain = {
    address,
    contractAddress,
    ensureWallet,
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    invoke,
    invokeWithPayment,
    read: vi.fn(async () => "0"),
    readArray: vi.fn(async () => []),
    waitForEvent: vi.fn(async () => null),
  };
  const setStatus = vi.fn();
  const ctx: Record<string, unknown> = {
    services: {
      chain,
      clipboard: { copy: vi.fn(async () => undefined) },
    },
    launchContext: { params: { appMode: "gamefi" }, network: "neo-n3-testnet" },
    t: (key: string) => key,
    setStatus,
    registerAction: (key: string, action: Action) => actions.set(key, action),
  };
  ctx.framework = createMiniAppFramework(ctx as never, {
    appId: "miniapp-sheep-solitaire-safety",
  });
  const framework = ctx.framework as ReturnType<typeof createMiniAppFramework>;
  framework.mode.set("gamefi");
  const result = harness.definition?.setup?.(ctx) as {
    state: Record<string, { get: () => unknown }>;
    cleanup: () => void;
  };
  return { actions, ensureWallet, invoke, invokeWithPayment, result, setStatus };
}

describe("sheep-solitaire production safety gates", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.definition = null;
    await import("../../sheep-solitaire/src/main");
  });

  it("blocks a forced paid start before wallet or transaction work", async () => {
    const app = setupGameFiHarness();

    await app.actions.get("startGame")?.({ difficulty: 2 });

    expect(app.ensureWallet).not.toHaveBeenCalled();
    expect(app.invoke).not.toHaveBeenCalled();
    expect(app.invokeWithPayment).not.toHaveBeenCalled();
    expect(app.result.state.newPaidRunsEnabled?.get()).toBe(false);
    expect(app.setStatus).toHaveBeenCalledWith("paidRunsUnavailable", "info");
    app.result.cleanup();
  });

  it("keeps the catalog manifest free of generic paid operation forms", () => {
    expect(manifest.supportsGuest).toBe(true);
    expect(manifest.supportsGameFi).toBe(false);
    expect(manifest.gamePage?.modes).toEqual({ guest: true, gamefi: false });
    expect(manifest.operations).toEqual([]);
    expect(manifest.features?.walletRequired).toBe(false);
    expect(manifest.features?.chainWarning).toBe(false);
    expect(manifest.permissions).toEqual({
      payments: false,
      randomness: false,
      compute: false,
      oracle: false,
    });

    const published = JSON.parse(
      readFileSync(resolve(repoRoot, "apps/sheep-solitaire/neo-manifest.json"), "utf8"),
    ) as {
      operation_panel: { operations: unknown[] };
      permissions: unknown[];
      platform: { transactions: boolean };
      technologies: { oracle: { enabled: boolean }; tee: { enabled: boolean } };
    };

    expect(published.operation_panel.operations).toEqual([]);
    expect(published.permissions).toEqual([]);
    expect(published.platform.transactions).toBe(false);
    expect(published.technologies.oracle.enabled).toBe(false);
    expect(published.technologies.tee.enabled).toBe(false);
  });
});
