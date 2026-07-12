import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMiniAppFramework } from "@shared/react";
import { addressToScriptHash } from "@shared/utils/neo";

const harness = vi.hoisted(() => ({
  definition: null as null | {
    setup?: (ctx: Record<string, unknown>) => unknown;
  },
}));

vi.mock("@shared/react", async () => {
  const actual = await vi.importActual<typeof import("@shared/react")>("@shared/react");
  return {
    ...actual,
    defineMiniApp: vi.fn((definition: unknown) => {
      harness.definition = definition as typeof harness.definition;
      return { render: vi.fn(), unmount: vi.fn() };
    }),
  };
});

vi.mock("./PhaserPlayArea", () => ({ default: () => null }));

class MemoryLocalStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

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

const PLAYER = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const PLAYER_HASH = addressToScriptHash(PLAYER);
const CONTRACT = "0x21a527b50b839efeb73721a886c9b5994a206316";

type Action = (...args: unknown[]) => Promise<unknown>;

async function setupApp(
  connected: boolean,
  script: { depositVerified?: boolean; burnVerified?: boolean } = {},
) {
  const actions = new Map<string, Action>();
  const address = observable<string | null>(connected ? PLAYER : null);
  const contractAddress = observable<string | null>(CONTRACT);
  let liveCredit = 0n;
  let liveUserBurned = 0n;
  const ensureWallet = vi.fn(async () => {
    address.set(PLAYER);
    return PLAYER;
  });
  const read = vi.fn(async (operation: string) => {
    if (operation === "balanceOf") return "100000000000";
    if (operation === "creditOf") return liveCredit.toString();
    if (operation === "currentSeason") return "1";
    if (operation === "seasonEnd") return String(Date.now() + 60_000);
    if (operation === "rewardPool") return "0";
    if (operation === "burnCount") return "0";
    if (operation === "topBurner") return "0x0000000000000000000000000000000000000000";
    if (operation === "userBurned") return liveUserBurned.toString();
    if (operation === "topBurned") return "0";
    if (operation === "seasonDuration") return "86400000";
    if (operation === "minBurn") return "100000000";
    if (operation === "maxBurn") return "100000000000";
    return "0";
  });
  const invoke = vi.fn(async (
    operation: string,
    args: Array<{ value?: unknown }>,
    options?: { onTransactionSent?: (txid: string) => void },
  ) => {
    const txid = operation === "transfer" ? "0xdeposit" : "0xburn";
    options?.onTransactionSent?.(txid);
    const verified = operation === "transfer"
      ? script.depositVerified !== false
      : script.burnVerified !== false;
    if (operation === "transfer") {
      liveCredit += BigInt(String(args[2]?.value ?? "0"));
    } else {
      const burned = BigInt(String(args[1]?.value ?? "0"));
      liveCredit -= burned;
      liveUserBurned += burned;
    }
    return {
      txid,
      success: true,
      verified,
      event: !verified
        ? undefined
        : operation === "transfer"
        ? { tx_hash: txid, state: [PLAYER_HASH, args[2]?.value, args[2]?.value] }
        : { tx_hash: txid, state: ["1", PLAYER_HASH, args[1]?.value, args[1]?.value] },
    };
  });
  const chain = {
    address,
    contractAddress,
    ensureWallet,
    detectNetwork: vi.fn(async () => "neo-n3-testnet"),
    read,
    invoke,
    listEvents: vi.fn(async () => []),
    listAllEvents: vi.fn(async () => []),
  };
  const setStatus = vi.fn();
  const ctx: Record<string, unknown> = {
    services: { chain },
    launchContext: { params: {}, network: "neo-n3-testnet" },
    t: (key: string) => key,
    setStatus,
    registerAction: (key: string, action: Action) => actions.set(key, action),
  };
  ctx.framework = createMiniAppFramework(ctx as never, { appId: "miniapp-burn-league" });
  const result = (await harness.definition?.setup?.(ctx)) as {
    state: Record<string, { get: () => unknown }>;
    loadData: () => Promise<void>;
    cleanup: () => void;
  };
  await result.loadData();
  return { actions, address, ensureWallet, invoke, result, setStatus };
}

describe("Burn League irreversible-action wiring", () => {
  beforeEach(async () => {
    vi.resetModules();
    harness.definition = null;
    vi.useFakeTimers();
    vi.stubGlobal("localStorage", new MemoryLocalStorage());
    await import("./main");
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("uses the first burn press only to arm confirmation", async () => {
    const app = await setupApp(true);
    await app.actions.get("burn")?.("5");

    expect(app.invoke).not.toHaveBeenCalled();
    expect(app.result.state.burnConfirmArmed?.get()).toBe(true);
    expect(app.result.state.burnConfirmAmount?.get()).toBe("5");

    await app.actions.get("burn")?.("5");
    expect(app.invoke.mock.calls.map((call) => call[0])).toEqual(["transfer", "burn"]);
    expect(app.result.state.burnConfirmArmed?.get()).toBe(false);
    app.result.cleanup();
  });

  it("does not connect or spend from a disconnected burn press", async () => {
    const app = await setupApp(false);
    await app.actions.get("burn")?.("5");

    expect(app.ensureWallet).not.toHaveBeenCalled();
    expect(app.invoke).not.toHaveBeenCalled();
    expect(app.result.state.walletConnected?.get()).toBe(false);

    await app.actions.get("connectWallet")?.();
    expect(app.ensureWallet).toHaveBeenCalledTimes(1);
    expect(app.invoke).not.toHaveBeenCalled();
    expect(app.result.state.walletConnected?.get()).toBe(true);
    app.result.cleanup();
  });

  it("expires an armed burn without submitting it", async () => {
    const app = await setupApp(true);
    await app.actions.get("burn")?.("5");
    await vi.advanceTimersByTimeAsync(12_001);

    expect(app.result.state.burnConfirmArmed?.get()).toBe(false);
    expect(app.invoke).not.toHaveBeenCalled();
    app.result.cleanup();
  });

  it("never reports success or submits burn after an unverified deposit", async () => {
    const app = await setupApp(true, { depositVerified: false });
    await app.actions.get("burn")?.("5");
    await app.actions.get("burn")?.("5");

    expect(app.invoke.mock.calls.map((call) => call[0])).toEqual(["transfer"]);
    expect(app.result.state.hasUnknownBurn?.get()).toBe(true);
    expect(app.result.state.burnTransactionState?.get()).toBe("unknown");
    expect(app.setStatus).not.toHaveBeenCalledWith("burnSuccess", "success");
    app.result.cleanup();
  });
});
