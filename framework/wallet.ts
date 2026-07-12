/**
 * S5 app.wallet — wallet identity + balance surface
 * (framework-extraction plan §2/S5).
 *
 * Retires the hand-rolled balance sites, the `isConnected` gap
 * (aa-permissions-lab's sole raw-chain reason) and the manual NEP-17
 * `balanceOf` reads that self-loan / soulbound / trustanchor-admin /
 * wallet-health re-implement today.
 *
 * Backed by the optional injected balance service
 * (apps/shared/services/BalanceService); when the host does not provide one
 * (OneGate / standalone embeds) every query degrades gracefully to a direct
 * `chain.read("balanceOf", …)` against the asset contract — the exact call the
 * retired hand-rolls perform. `balance(asset, address)` accepts an arbitrary
 * address for the profitanchor-admin / neo-treasury read-other-accounts lane.
 */

import { createObservable, type Observable } from "./reactive";
import { addressToScriptHash } from "./utils/neo";
import { parseBigInt } from "./utils/parsers";

/** Native contract hashes — protocol constants, identical on every Neo N3 network. */
const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const NEO_DECIMALS = 0;
const GAS_DECIMALS = 8;

/**
 * Well-known platform event channels (mirrors apps/shared/services/EventBus
 * statics byte-for-byte; the framework cannot import shared by boundary rule).
 */
const BALANCE_CHANGED_EVENT = "platform:balance:changed";
const TRANSACTION_CONFIRMED_EVENT = "platform:tx:confirmed";

export interface WalletContractArg {
  type: string;
  value: unknown;
}

/** Minimal chain adapter the wallet surface needs (subset of MiniAppFrameworkChain). */
export interface WalletSurfaceChain {
  address: Observable<string | null>;
  ensureWallet(): Promise<string>;
  read(operation: string, args?: WalletContractArg[], options?: unknown): Promise<unknown>;
}

/**
 * Structural shape of apps/shared/services/BalanceService — the injected
 * platform service. Optional: absent on OneGate/standalone hosts.
 */
export interface WalletSurfaceBalanceService {
  getBalance(asset: string, address?: string): Promise<number>;
  getRawBalance(asset: string, address?: string): Promise<bigint>;
  getAllBalances(address?: string, additionalAssets?: string[]): Promise<Record<string, number>>;
  useBalance(asset: string): {
    balance: Observable<number>;
    loading: Observable<boolean>;
    refresh: () => Promise<void>;
    cleanup: () => void;
  };
}

/** Structural shape of the platform EventBus subscription API. */
export interface WalletSurfaceEvents {
  on(event: string, handler: (payload: unknown) => void): () => void;
}

export interface WalletSurfaceDeps {
  chain: WalletSurfaceChain;
  balance?: WalletSurfaceBalanceService;
  events?: WalletSurfaceEvents;
}

/** One identity change delivered by {@link createWalletSurface}.onAccountChanged. */
export interface FrameworkAccountChange {
  /** Address before the change; `null` when nothing was connected. */
  previous: string | null;
  /** Address after the change; `null` on disconnect. */
  current: string | null;
}

export interface FrameworkWalletBalanceHandle {
  /** Display-string balance, updated by refresh() and BALANCE_CHANGED events. */
  balance: Observable<string>;
  refresh(): Promise<void>;
  /**
   * Release the event subscriptions. Register with `app.lifecycle.cleanup`
   * (the index.ts wiring does this) so it runs automatically on unmount.
   */
  cleanup(): void;
}

function resolveAssetHash(asset: string): string {
  if (asset === "NEO") return NEO_HASH;
  if (asset === "GAS") return GAS_HASH;
  return String(asset ?? "").trim();
}

function resolveAssetDecimals(asset: string): number {
  const hash = resolveAssetHash(asset).toLowerCase();
  if (hash === NEO_HASH) return NEO_DECIMALS;
  if (hash === GAS_HASH) return GAS_DECIMALS;
  // Parity with useWalletBalanceReader: unknown NEP-17 assets default to 8.
  return GAS_DECIMALS;
}

/** Address or 0x/40-hex account → 0x-prefixed script hash; "" when invalid. */
function accountHash160(account: string): string {
  const raw = String(account ?? "").trim();
  if (!raw) return "";
  if (/^(0x)?[0-9a-fA-F]{40}$/.test(raw)) {
    return raw.startsWith("0x") ? raw.toLowerCase() : `0x${raw.toLowerCase()}`;
  }
  return addressToScriptHash(raw);
}

/** Precise bigint → decimal display string (no float rounding). */
function unitsToDecimalString(raw: bigint, decimals: number): string {
  const negative = raw < 0n;
  const magnitude = negative ? -raw : raw;
  if (decimals <= 0) return `${negative ? "-" : ""}${magnitude.toString()}`;
  const base = 10n ** BigInt(decimals);
  const whole = magnitude / base;
  const fraction = (magnitude % base).toString().padStart(decimals, "0").replace(/0+$/, "");
  const text = fraction ? `${whole}.${fraction}` : whole.toString();
  return negative ? `-${text}` : text;
}

function unitsToNumber(raw: bigint, decimals: number): number {
  if (decimals <= 0) return Number(raw);
  return Number(raw) / 10 ** decimals;
}

/**
 * Build the `app.wallet` surface.
 *
 * @param deps.chain   host chain adapter (required)
 * @param deps.balance injected BalanceService when the platform host provides one
 * @param deps.events  platform EventBus for BALANCE_CHANGED wiring in the fallback lane
 */
export function createWalletSurface(deps: WalletSurfaceDeps) {
  const { chain, balance: balanceService, events } = deps;

  const currentAddress = (): string | null => {
    const value = chain.address.get();
    return value ? value : null;
  };

  /**
   * The retired hand-rolls' exact read: NEP-17 `balanceOf(owner)` against the
   * asset contract. Returns raw (unscaled) units; 0n when no owner resolves.
   */
  const readRawBalance = async (asset: string, address?: string): Promise<bigint> => {
    const owner = address ?? currentAddress() ?? "";
    if (!owner) return 0n;
    const hash = accountHash160(owner);
    if (!hash) return 0n;
    const raw = await chain.read(
      "balanceOf",
      [{ type: "Hash160", value: hash }],
      { scriptHash: resolveAssetHash(asset) },
    );
    return parseBigInt(raw);
  };

  const readBalance = async (asset: string, address?: string): Promise<number> => {
    if (balanceService) return balanceService.getBalance(asset, address);
    return unitsToNumber(await readRawBalance(asset, address), resolveAssetDecimals(asset));
  };

  return {
    /** Connected wallet address, or null when no wallet is connected. */
    address(): string | null {
      return currentAddress();
    },

    /** Connected wallet script hash (0x display hex), or null when disconnected. */
    scriptHash(): string | null {
      const address = currentAddress();
      if (!address) return null;
      const hash = addressToScriptHash(address);
      return hash ? hash : null;
    },

    /** Whether a wallet address is currently available (no prompt). */
    isConnected(): boolean {
      return Boolean(currentAddress());
    },

    /** Prompt for / wait for wallet connection. Alias of chain.ensureWallet. */
    async ensure(): Promise<string> {
      return chain.ensureWallet();
    },

    /**
     * Address-change observable — subsumes the hand-rolled
     * `chain.address.subscribe(() => reload())` wiring.
     */
    observe(): Observable<string | null> {
      return chain.address;
    },

    /**
     * Identity-diff account-change hook (RFC P0-5) — the blessed replacement
     * for the fleet's hand-rolled `chain.address.subscribe` + `lastIdentity`
     * bookkeeping blocks.
     *
     * Semantics:
     * - Fires ONLY when the normalized address actually differs (identity
     *   diff built in) — never for repeated emissions of the same address.
     * - Handler errors (sync throws AND async rejections) are caught and
     *   logged; they never propagate into the address subscription.
     * - `immediate: true` fires once synchronously at subscription time with
     *   `{ previous: null, current }` (default `false`).
     *
     * @returns unsubscribe function.
     *
     * @example
     * ```ts
     * const stop = app.wallet.onAccountChanged(({ current }) => {
     *   resetSession();
     *   if (current) void reloadAll();
     * });
     * // later: stop();
     * ```
     */
    onAccountChanged(
      handler: (change: FrameworkAccountChange) => void | Promise<void>,
      options?: { immediate?: boolean },
    ): () => void {
      const normalize = (value: string | null | undefined): string | null => {
        const trimmed = String(value ?? "").trim();
        return trimmed ? trimmed : null;
      };
      const emit = (previous: string | null, current: string | null): void => {
        try {
          const result = handler({ previous, current });
          if (result && typeof (result as Promise<void>).catch === "function") {
            (result as Promise<void>).catch((error) => {
              console.error("[framework] onAccountChanged handler rejected:", error);
            });
          }
        } catch (error) {
          console.error("[framework] onAccountChanged handler threw:", error);
        }
      };
      let last = normalize(chain.address.get());
      const unsubscribe = chain.address.subscribe(() => {
        const next = normalize(chain.address.get());
        if (next === last) return;
        const previous = last;
        last = next;
        emit(previous, next);
      });
      if (options?.immediate) emit(null, last);
      return unsubscribe;
    },

    /**
     * Formatted balance of `asset` ("NEO" | "GAS" | NEP-17 hash) for the
     * connected wallet, or an arbitrary `address` when given.
     */
    async balance(asset: string, address?: string): Promise<number> {
      return readBalance(asset, address);
    },

    /** Shorthand: GAS balance of the connected wallet. */
    async gas(): Promise<number> {
      return readBalance("GAS");
    },

    /** Shorthand: NEO balance of the connected wallet. */
    async neo(): Promise<number> {
      return readBalance("NEO");
    },

    /** Raw (unscaled) balance as bigint, for precise math before display. */
    async raw(asset: string, address?: string): Promise<bigint> {
      if (balanceService) return balanceService.getRawBalance(asset, address);
      return readRawBalance(asset, address);
    },

    /** NEO + GAS (+ any extra asset hashes) balances in one call. */
    async all(address?: string, extra?: string[]): Promise<Record<string, number>> {
      if (balanceService) return balanceService.getAllBalances(address, extra);
      const assets = ["NEO", "GAS", ...(extra ?? [])];
      const out: Record<string, number> = {};
      await Promise.all(
        assets.map(async (asset) => {
          out[asset] = unitsToNumber(await readRawBalance(asset, address), resolveAssetDecimals(asset));
        }),
      );
      return out;
    },

    /**
     * Auto-refreshing balance for the connected wallet. Refreshes on
     * BALANCE_CHANGED / TRANSACTION_CONFIRMED platform events (when an event
     * bus is available) and on manual `refresh()`.
     */
    observeBalance(asset: string): FrameworkWalletBalanceHandle {
      if (balanceService) {
        const handle = balanceService.useBalance(asset);
        const text = createObservable<string>(String(handle.balance.get()));
        const unsubscribe = handle.balance.subscribe(() => {
          text.set(String(handle.balance.get()));
        });
        return {
          balance: text,
          refresh: () => handle.refresh(),
          cleanup: () => {
            unsubscribe();
            handle.cleanup();
          },
        };
      }

      const balance = createObservable<string>("0");
      let disposed = false;
      const refresh = async (): Promise<void> => {
        try {
          const raw = await readRawBalance(asset);
          if (!disposed) balance.set(unitsToDecimalString(raw, resolveAssetDecimals(asset)));
        } catch {
          /* keep the last known balance on read errors */
        }
      };

      const unsubscribes: Array<() => void> = [];
      if (events) {
        unsubscribes.push(
          events.on(BALANCE_CHANGED_EVENT, (payload) => {
            const changed = payload as { asset?: string } | undefined;
            if (
              !changed?.asset ||
              changed.asset === asset ||
              resolveAssetHash(changed.asset).toLowerCase() === resolveAssetHash(asset).toLowerCase()
            ) {
              void refresh();
            }
          }),
        );
        unsubscribes.push(
          events.on(TRANSACTION_CONFIRMED_EVENT, () => {
            void refresh();
          }),
        );
      }

      void refresh();

      return {
        balance,
        refresh,
        cleanup: () => {
          disposed = true;
          while (unsubscribes.length > 0) unsubscribes.pop()?.();
        },
      };
    },
  };
}

export type FrameworkWalletSurface = ReturnType<typeof createWalletSurface>;
