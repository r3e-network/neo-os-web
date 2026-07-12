import { afterEach, describe, expect, it, vi } from "vitest";
import type { MiniAppFramework } from "@shared/react";
import { createObservable } from "../react/context";
import {
  WALLET_CONNECT_TIMEOUT_MS,
  WALLET_READ_TIMEOUT_MS,
  useWalletAnalysis,
} from "../../wallet-health/src/composables/useWalletAnalysis";
import { useWalletHealth } from "../../wallet-health/src/composables/useWalletHealth";

const ADDRESS_A = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ADDRESS_B = "NNFoBb1BdTKkvYfHC32XC3ygE2THnj96zB";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function makeApp(options: {
  initialAddress?: string | null;
  ensure?: () => Promise<string>;
  raw?: (asset: string, address?: string) => Promise<bigint>;
  detectNetwork?: () => Promise<string>;
} = {}) {
  const address = createObservable<string | null>(options.initialAddress ?? null);
  const raw = vi.fn(options.raw ?? (async (asset: string) => asset === "NEO" ? 7n : 150_000_000n));
  const ensure = vi.fn(options.ensure ?? (async () => {
    address.set(ADDRESS_A);
    return ADDRESS_A;
  }));
  const app = {
    wallet: {
      address: () => address.get(),
      isConnected: () => Boolean(address.get()),
      observe: () => address,
      raw,
      ensure,
    },
    chain: {
      detectNetwork: vi.fn(options.detectNetwork ?? (async () => "neo-n3-mainnet")),
    },
    storage: {
      local: {
        get: <T>(_key: string, fallback: T | null = null) => fallback,
        set: () => undefined,
      },
    },
  } as unknown as MiniAppFramework;
  return { app, address, raw, ensure };
}

const t = (key: string) => key;

afterEach(() => {
  vi.useRealTimers();
});

describe("wallet-health read-only balance analysis", () => {
  it("binds parallel NEO/GAS reads to the captured wallet identity", async () => {
    const { app, raw } = makeApp({ initialAddress: ADDRESS_A });
    const analysis = useWalletAnalysis({ app, targetNetwork: "mainnet", t });

    await analysis.refreshBalances();

    expect(raw).toHaveBeenCalledTimes(2);
    expect(raw).toHaveBeenCalledWith("NEO", ADDRESS_A);
    expect(raw).toHaveBeenCalledWith("GAS", ADDRESS_A);
    expect(analysis.neoDisplay.get()).toBe("7");
    expect(analysis.gasDisplay.get()).toBe("1.5");
    expect(analysis.dataStatus.get()).toBe("fresh");
    expect(analysis.lastUpdatedAt.get()).toBeGreaterThan(0);
    expect(analysis.neoReadStatus.get()).toBe("pass");
    expect(analysis.gasReadStatus.get()).toBe("pass");
    expect(analysis.networkReadStatus.get()).toBe("pass");
  });

  it("discards a stale response after account switching", async () => {
    const oldNeo = deferred<bigint>();
    const oldGas = deferred<bigint>();
    const { app, address } = makeApp({
      initialAddress: ADDRESS_A,
      raw: async (asset, owner) => {
        if (owner === ADDRESS_A) return asset === "NEO" ? oldNeo.promise : oldGas.promise;
        return asset === "NEO" ? 9n : 225_000_000n;
      },
    });
    const analysis = useWalletAnalysis({ app, targetNetwork: "mainnet", t });

    const staleRead = analysis.refreshBalances();
    address.set(ADDRESS_B);
    analysis.handleAddressChange(ADDRESS_B);
    await analysis.refreshBalances();
    oldNeo.reject(new Error("stale RPC failure"));
    oldGas.resolve(9_900_000_000n);
    await staleRead;

    expect(analysis.neoDisplay.get()).toBe("9");
    expect(analysis.gasDisplay.get()).toBe("2.25");
    expect(analysis.dataStatus.get()).toBe("fresh");
  });

  it("clears chain evidence immediately on disconnect", async () => {
    const { app, address } = makeApp({ initialAddress: ADDRESS_A });
    const analysis = useWalletAnalysis({ app, targetNetwork: "mainnet", t });
    await analysis.refreshBalances();

    address.set(null);
    analysis.handleAddressChange(null);

    expect(analysis.neoDisplay.get()).toBe("0");
    expect(analysis.gasDisplay.get()).toBe("0");
    expect(analysis.lastUpdatedAt.get()).toBe(0);
    expect(analysis.dataStatus.get()).toBe("disconnected");
    expect(analysis.isRefreshing.get()).toBe(false);
  });

  it("returns a hung wallet prompt to a safe retry state", async () => {
    vi.useFakeTimers();
    const { app } = makeApp({
      ensure: () => new Promise<string>(() => undefined),
    });
    const analysis = useWalletAnalysis({ app, targetNetwork: "mainnet", t });

    const connection = analysis.connectWallet();
    const rejected = expect(connection).rejects.toThrow("walletConnectTimeout");
    await vi.advanceTimersByTimeAsync(WALLET_CONNECT_TIMEOUT_MS);
    await rejected;

    expect(analysis.isConnecting.get()).toBe(false);
    expect(analysis.dataStatus.get()).toBe("error");
    expect(analysis.lastError.get()).toBe("walletConnectTimeout");
  });

  it("keeps a failed RPC read explicit instead of publishing fake zeros as fresh", async () => {
    const { app } = makeApp({
      initialAddress: ADDRESS_A,
      raw: async () => { throw new Error("RPC unavailable"); },
    });
    const analysis = useWalletAnalysis({ app, targetNetwork: "mainnet", t });

    await expect(analysis.refreshBalances()).rejects.toThrow("RPC unavailable");
    expect(analysis.dataStatus.get()).toBe("error");
    expect(analysis.lastError.get()).toBe("refreshFailed");
    expect(analysis.lastUpdatedAt.get()).toBe(0);
    expect(analysis.neoReadStatus.get()).toBe("failed");
    expect(analysis.gasReadStatus.get()).toBe("failed");
  });

  it("keeps balance and GAS evidence pending until a read actually succeeds", async () => {
    const { app } = makeApp({
      initialAddress: ADDRESS_A,
      raw: async () => { throw new Error("RPC unavailable"); },
    });
    const health = useWalletHealth({ app, targetNetwork: "mainnet", t });

    expect(health.neoDisplay.get()).toBe("—");
    expect(health.gasDisplay.get()).toBe("—");
    expect(health.checklistItems.get().find((item) => item.id === "gas")?.pending).toBe(true);

    await expect(health.refreshBalances()).rejects.toThrow("RPC unavailable");

    expect(health.neoDisplay.get()).toBe("—");
    expect(health.gasDisplay.get()).toBe("—");
    expect(health.checklistItems.get().find((item) => item.id === "gas")?.pending).toBe(true);
    expect(health.recommendations.get()).not.toContain("recommendationGasLow");
  });

  it("keeps partial NEO/GAS evidence independent", async () => {
    const { app } = makeApp({
      initialAddress: ADDRESS_A,
      raw: async (asset) => {
        if (asset === "NEO") return 0n;
        throw new Error("GAS RPC unavailable");
      },
    });
    const health = useWalletHealth({ app, targetNetwork: "mainnet", t });

    await health.refreshBalances();

    expect(health.dataStatus.get()).toBe("partial");
    expect(health.neoReadStatus.get()).toBe("zero");
    expect(health.gasReadStatus.get()).toBe("failed");
    expect(health.neoDisplay.get()).toBe("0");
    expect(health.gasDisplay.get()).toBe("—");
    expect(health.checklistItems.get().find((item) => item.id === "gas")?.pending).toBe(true);
    expect(health.recommendations.get()).not.toContain("recommendationGasLow");
  });

  it("times out a hung asset read without losing an independent result", async () => {
    vi.useFakeTimers();
    const { app } = makeApp({
      initialAddress: ADDRESS_A,
      raw: async (asset) => asset === "NEO" ? 3n : new Promise<bigint>(() => undefined),
    });
    const analysis = useWalletAnalysis({ app, targetNetwork: "mainnet", t });

    const refresh = analysis.refreshBalances();
    await vi.advanceTimersByTimeAsync(WALLET_READ_TIMEOUT_MS);
    await refresh;

    expect(analysis.dataStatus.get()).toBe("partial");
    expect(analysis.neoReadStatus.get()).toBe("pass");
    expect(analysis.gasReadStatus.get()).toBe("failed");
    expect(analysis.neoDisplay.get()).toBe("3");
  });

  it("reports a verified wallet-network mismatch without hiding balance reads", async () => {
    const { app } = makeApp({
      initialAddress: ADDRESS_A,
      detectNetwork: async () => "neo-n3-testnet",
    });
    const health = useWalletHealth({ app, targetNetwork: "mainnet", t });

    await health.refreshBalances();

    expect(health.dataStatus.get()).toBe("fresh");
    expect(health.networkReadStatus.get()).toBe("failed");
    expect(health.networkMismatch.get()).toBe(true);
    expect(health.walletNetworkLabel.get()).toBe("Neo N3 TestNet");
    expect(health.recommendations.get()[0]).toBe("recommendationNetworkMismatch");
  });

  it("rejects an invalid host wallet address instead of publishing zero balances", async () => {
    const { app, raw } = makeApp({ initialAddress: "NInvalidWalletAddress" });
    const analysis = useWalletAnalysis({ app, targetNetwork: "mainnet", t });

    await expect(analysis.refreshBalances()).rejects.toThrow("walletAddressInvalid");

    expect(raw).not.toHaveBeenCalled();
    expect(analysis.neoReadStatus.get()).toBe("failed");
    expect(analysis.gasReadStatus.get()).toBe("failed");
    expect(analysis.lastUpdatedAt.get()).toBe(0);
  });
});
