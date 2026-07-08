/**
 * S5 app.wallet spec (framework-extraction plan §2/S5).
 *
 * Verifies the wallet identity accessors (address/scriptHash/isConnected/
 * ensure/observe), the balance-service delegation lane, the chain.read
 * balanceOf fallback lane (what self-loan/soulbound/trustanchor-admin/
 * wallet-health hand-roll today), and the BALANCE_CHANGED-wired
 * observeBalance handle in both lanes.
 */

import { describe, expect, it, vi } from "vitest";
import { createWalletSurface } from "../wallet";
import type { WalletSurfaceBalanceService, WalletSurfaceChain } from "../wallet";
import { createObservable } from "../reactive";
import { addressToScriptHash } from "../utils/neo";

const ADDRESS = "NNLi44dJNXtDNSBkofB48aTVYtb1zZrNEs";
const ADDRESS_HASH = addressToScriptHash(ADDRESS);
const OTHER_ADDRESS_HASH = "0x6d0656f6dd91469db1c90cc1e574380613f43738";

const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const TOKEN_HASH = "0x1234567890123456789012345678901234567890";

const BALANCE_CHANGED = "platform:balance:changed";
const TRANSACTION_CONFIRMED = "platform:tx:confirmed";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

interface ReadCall {
  operation: string;
  args?: Array<{ type: string; value: unknown }>;
  options?: unknown;
}

function makeChain(
  address: string | null = ADDRESS,
  balances: Record<string, string> = { [GAS_HASH]: "150000000", [NEO_HASH]: "7" },
) {
  const reads: ReadCall[] = [];
  const chain = {
    address: createObservable<string | null>(address),
    ensureWallet: vi.fn(async () => ADDRESS),
    read: vi.fn(async (operation: string, args?: ReadCall["args"], options?: unknown) => {
      reads.push({ operation, args, options });
      const scriptHash = (options as { scriptHash?: string } | undefined)?.scriptHash ?? "";
      return balances[scriptHash] ?? "42";
    }),
  } satisfies WalletSurfaceChain;
  return { chain, reads };
}

function makeEventBus() {
  const handlers = new Map<string, Set<(payload: unknown) => void>>();
  return {
    on(event: string, handler: (payload: unknown) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => {
        handlers.get(event)?.delete(handler);
      };
    },
    emit(event: string, payload?: unknown) {
      handlers.get(event)?.forEach((handler) => handler(payload));
    },
    count(event: string) {
      return handlers.get(event)?.size ?? 0;
    },
  };
}

describe("app.wallet identity", () => {
  it("exposes address, scriptHash and isConnected for a connected wallet", () => {
    const { chain } = makeChain();
    const wallet = createWalletSurface({ chain });

    expect(wallet.address()).toBe(ADDRESS);
    expect(wallet.scriptHash()).toBe(ADDRESS_HASH);
    expect(ADDRESS_HASH).toMatch(/^0x[0-9a-f]{40}$/);
    expect(wallet.isConnected()).toBe(true);
  });

  it("returns null address/scriptHash and isConnected=false when disconnected", () => {
    const { chain } = makeChain(null);
    const wallet = createWalletSurface({ chain });

    expect(wallet.address()).toBeNull();
    expect(wallet.scriptHash()).toBeNull();
    expect(wallet.isConnected()).toBe(false);
  });

  it("treats an empty-string address as disconnected", () => {
    const { chain } = makeChain("");
    const wallet = createWalletSurface({ chain });

    expect(wallet.address()).toBeNull();
    expect(wallet.isConnected()).toBe(false);
  });

  it("ensure() aliases chain.ensureWallet", async () => {
    const { chain } = makeChain(null);
    const wallet = createWalletSurface({ chain });

    await expect(wallet.ensure()).resolves.toBe(ADDRESS);
    expect(chain.ensureWallet).toHaveBeenCalledTimes(1);
  });

  it("observe() surfaces address changes through the chain observable", () => {
    const { chain } = makeChain(null);
    const wallet = createWalletSurface({ chain });

    const seen: Array<string | null> = [];
    const unsubscribe = wallet.observe().subscribe(() => {
      seen.push(wallet.address());
    });
    chain.address.set(ADDRESS);
    expect(seen).toEqual([ADDRESS]);
    expect(wallet.isConnected()).toBe(true);
    unsubscribe();
  });
});

describe("app.wallet balance fallback (no balance service)", () => {
  it("reads NEP-17 balanceOf against the asset contract and scales GAS by 1e8", async () => {
    const { chain, reads } = makeChain();
    const wallet = createWalletSurface({ chain });

    await expect(wallet.balance("GAS")).resolves.toBe(1.5);
    expect(reads).toEqual([
      {
        operation: "balanceOf",
        args: [{ type: "Hash160", value: ADDRESS_HASH }],
        options: { scriptHash: GAS_HASH },
      },
    ]);
  });

  it("keeps NEO whole (NEP-17 balanceOf, never / 1e8)", async () => {
    const { chain, reads } = makeChain();
    const wallet = createWalletSurface({ chain });

    await expect(wallet.neo()).resolves.toBe(7);
    expect((reads[0]?.options as { scriptHash?: string }).scriptHash).toBe(NEO_HASH);
  });

  it("gas() shorthand resolves the GAS contract", async () => {
    const { chain, reads } = makeChain();
    const wallet = createWalletSurface({ chain });

    await expect(wallet.gas()).resolves.toBe(1.5);
    expect((reads[0]?.options as { scriptHash?: string }).scriptHash).toBe(GAS_HASH);
  });

  it("supports arbitrary-address reads (profitanchor-admin/neo-treasury lane)", async () => {
    const { chain, reads } = makeChain();
    const wallet = createWalletSurface({ chain });

    await wallet.balance("GAS", OTHER_ADDRESS_HASH);
    expect(reads[0]?.args).toEqual([{ type: "Hash160", value: OTHER_ADDRESS_HASH }]);
  });

  it("raw() returns unscaled bigint units", async () => {
    const { chain } = makeChain();
    const wallet = createWalletSurface({ chain });

    await expect(wallet.raw("GAS")).resolves.toBe(150000000n);
  });

  it("all() fans out NEO + GAS + extra assets", async () => {
    const { chain } = makeChain(ADDRESS, {
      [GAS_HASH]: "150000000",
      [NEO_HASH]: "7",
      [TOKEN_HASH]: "300000000",
    });
    const wallet = createWalletSurface({ chain });

    await expect(wallet.all(undefined, [TOKEN_HASH])).resolves.toEqual({
      NEO: 7,
      GAS: 1.5,
      [TOKEN_HASH]: 3,
    });
  });

  it("returns 0 without touching the chain when no wallet is connected", async () => {
    const { chain } = makeChain(null);
    const wallet = createWalletSurface({ chain });

    await expect(wallet.balance("GAS")).resolves.toBe(0);
    await expect(wallet.raw("GAS")).resolves.toBe(0n);
    expect(chain.read).not.toHaveBeenCalled();
  });
});

describe("app.wallet balance service delegation", () => {
  function makeBalanceService() {
    const reactiveBalance = createObservable(1.5);
    const handle = {
      balance: reactiveBalance,
      loading: createObservable(false),
      refresh: vi.fn(async () => {}),
      cleanup: vi.fn(),
    };
    const service = {
      getBalance: vi.fn(async () => 1.5),
      getRawBalance: vi.fn(async () => 150000000n),
      getAllBalances: vi.fn(async () => ({ NEO: 7, GAS: 1.5 })),
      useBalance: vi.fn(() => handle),
    } satisfies WalletSurfaceBalanceService;
    return { service, handle, reactiveBalance };
  }

  it("routes balance/gas/neo/raw/all through the injected service", async () => {
    const { chain } = makeChain();
    const { service } = makeBalanceService();
    const wallet = createWalletSurface({ chain, balance: service });

    await expect(wallet.balance("GAS", OTHER_ADDRESS_HASH)).resolves.toBe(1.5);
    expect(service.getBalance).toHaveBeenCalledWith("GAS", OTHER_ADDRESS_HASH);

    await wallet.gas();
    expect(service.getBalance).toHaveBeenCalledWith("GAS", undefined);
    await wallet.neo();
    expect(service.getBalance).toHaveBeenCalledWith("NEO", undefined);

    await expect(wallet.raw("GAS")).resolves.toBe(150000000n);
    expect(service.getRawBalance).toHaveBeenCalledWith("GAS", undefined);

    await expect(wallet.all(OTHER_ADDRESS_HASH, [TOKEN_HASH])).resolves.toEqual({ NEO: 7, GAS: 1.5 });
    expect(service.getAllBalances).toHaveBeenCalledWith(OTHER_ADDRESS_HASH, [TOKEN_HASH]);

    expect(chain.read).not.toHaveBeenCalled();
  });

  it("observeBalance mirrors the service handle as a display string", async () => {
    const { chain } = makeChain();
    const { service, handle, reactiveBalance } = makeBalanceService();
    const wallet = createWalletSurface({ chain, balance: service });

    const observed = wallet.observeBalance("GAS");
    expect(service.useBalance).toHaveBeenCalledWith("GAS");
    expect(observed.balance.get()).toBe("1.5");

    reactiveBalance.set(2.25);
    expect(observed.balance.get()).toBe("2.25");

    await observed.refresh();
    expect(handle.refresh).toHaveBeenCalledTimes(1);

    observed.cleanup();
    expect(handle.cleanup).toHaveBeenCalledTimes(1);
    reactiveBalance.set(9);
    expect(observed.balance.get()).toBe("2.25");
  });
});

describe("app.wallet observeBalance fallback (BALANCE_CHANGED wiring)", () => {
  it("fetches immediately and refreshes on manual refresh()", async () => {
    const balances: Record<string, string> = { [GAS_HASH]: "150000000", [NEO_HASH]: "7" };
    const { chain } = makeChain(ADDRESS, balances);
    const wallet = createWalletSurface({ chain });

    const observed = wallet.observeBalance("GAS");
    await flush();
    expect(observed.balance.get()).toBe("1.5");

    balances[GAS_HASH] = "225000000";
    await observed.refresh();
    expect(observed.balance.get()).toBe("2.25");
    observed.cleanup();
  });

  it("refreshes on matching BALANCE_CHANGED and any TRANSACTION_CONFIRMED", async () => {
    const { chain } = makeChain();
    const events = makeEventBus();
    const wallet = createWalletSurface({ chain, events });

    const observed = wallet.observeBalance("GAS");
    await flush();
    expect(chain.read).toHaveBeenCalledTimes(1);

    // Different asset — must not refresh.
    events.emit(BALANCE_CHANGED, { asset: "NEO" });
    await flush();
    expect(chain.read).toHaveBeenCalledTimes(1);

    // Symbol match.
    events.emit(BALANCE_CHANGED, { asset: "GAS" });
    await flush();
    expect(chain.read).toHaveBeenCalledTimes(2);

    // Hash-vs-symbol match (payload carries the contract hash).
    events.emit(BALANCE_CHANGED, { asset: GAS_HASH });
    await flush();
    expect(chain.read).toHaveBeenCalledTimes(3);

    // No asset in the payload — refresh everything.
    events.emit(BALANCE_CHANGED, {});
    await flush();
    expect(chain.read).toHaveBeenCalledTimes(4);

    // Confirmed transaction — balances likely changed.
    events.emit(TRANSACTION_CONFIRMED, { txid: "0xabc" });
    await flush();
    expect(chain.read).toHaveBeenCalledTimes(5);

    observed.cleanup();
  });

  it("cleanup() unsubscribes from the event bus and freezes the value", async () => {
    const { chain } = makeChain();
    const events = makeEventBus();
    const wallet = createWalletSurface({ chain, events });

    const observed = wallet.observeBalance("GAS");
    await flush();
    expect(events.count(BALANCE_CHANGED)).toBe(1);
    expect(events.count(TRANSACTION_CONFIRMED)).toBe(1);

    observed.cleanup();
    expect(events.count(BALANCE_CHANGED)).toBe(0);
    expect(events.count(TRANSACTION_CONFIRMED)).toBe(0);

    events.emit(BALANCE_CHANGED, {});
    await flush();
    expect(chain.read).toHaveBeenCalledTimes(1);
    expect(observed.balance.get()).toBe("1.5");
  });

  it("keeps the last known balance when a refresh read fails", async () => {
    const balances: Record<string, string> = { [GAS_HASH]: "150000000" };
    const { chain } = makeChain(ADDRESS, balances);
    const wallet = createWalletSurface({ chain });

    const observed = wallet.observeBalance("GAS");
    await flush();
    expect(observed.balance.get()).toBe("1.5");

    chain.read.mockRejectedValueOnce(new Error("rpc down"));
    await observed.refresh();
    expect(observed.balance.get()).toBe("1.5");
    observed.cleanup();
  });

  it("works without an event bus (manual refresh only)", async () => {
    const { chain } = makeChain();
    const wallet = createWalletSurface({ chain });

    const observed = wallet.observeBalance("GAS");
    await flush();
    expect(observed.balance.get()).toBe("1.5");
    observed.cleanup();
  });
});
