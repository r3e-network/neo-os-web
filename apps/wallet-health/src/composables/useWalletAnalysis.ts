/**
 * useWalletAnalysis — Chain data and balance analysis for Wallet Health
 *
 * Receives ChainService + BalanceService + EventBus from PlatformServices
 * instead of wiring useContractInteraction + useStatusMessage + useWallet directly.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, BalanceService, EventBus } from "@shared/services";
import { formatFixed8 } from "@shared/utils/format";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const GAS_LOW_THRESHOLD = 10000000n;

export interface UseWalletAnalysisOptions {
  chain: ChainService;
  balance: BalanceService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useWalletAnalysis({ chain, balance, eventBus, t }: UseWalletAnalysisOptions) {
  // `balance` (BalanceService) is intentionally part of the OS-services injection
  // contract; balance reads route through chain.read against the native NEO/GAS
  // contracts, so it is not referenced directly here.
  void balance;

  const isRefreshing = createObservable(false);
  const isConnecting = createObservable(false);
  const balanceRevision = createObservable(0);

  const balances = {
    neo: 0n,
    gas: 0n,
  };

  const gasOk = createDerived(() => balances.gas >= GAS_LOW_THRESHOLD, [balanceRevision]);
  const neoDisplay = createDerived(() => balances.neo.toString(), [balanceRevision]);
  const gasDisplay = createDerived(() => formatFixed8(balances.gas, 4), [balanceRevision]);

  const refreshBalances = async () => {
    const address = chain.address.get();
    if (!address) return;
    if (isRefreshing.get()) return;

    try {
      isRefreshing.set(true);
      // NEO and GAS reads are independent (same address, different scriptHash);
      // run them concurrently to roughly halve refresh latency on slow RPC.
      const [neoRaw, gasRaw] = await Promise.all([
        chain.read(
          "balanceOf",
          [{ type: "Hash160", value: address }],
          { scriptHash: NEO_HASH },
        ),
        chain.read(
          "balanceOf",
          [{ type: "Hash160", value: address }],
          { scriptHash: GAS_HASH },
        ),
      ]);
      balances.neo = parseBigInt(neoRaw);
      balances.gas = parseBigInt(gasRaw);
      balanceRevision.set(balanceRevision.get() + 1);
      eventBus.emit("balances:refreshed", { neo: balances.neo, gas: balances.gas });
    } catch (e) {
      eventBus.emit("balances:error", {
        message: e instanceof Error ? e.message : t("walletNotConnected"),
      });
      // Re-throw so the registerActions wrapper surfaces the failure via
      // ctx.setStatus instead of leaving the user with stale balances and no
      // error indication (balances:error has no subscriber).
      throw e instanceof Error ? e : new Error(t("refreshFailed"));
    } finally {
      isRefreshing.set(false);
    }
  };

  const connectWallet = async () => {
    // In-flight guard: ensureWallet() opens a wallet prompt and leaves the
    // address null while pending, so isConnected stays false and the button
    // remains clickable. Gate entry before the first await to stop repeated
    // taps from triggering concurrent ensureWallet() calls / duplicate popups.
    if (isConnecting.get()) return;

    try {
      isConnecting.set(true);
      await chain.ensureWallet();
      if (chain.address.get()) {
        await refreshBalances();
      }
    } catch (e) {
      eventBus.emit("wallet:error", {
        message: e instanceof Error ? e.message : t("walletNotConnected"),
      });
      // Re-throw so the registerActions wrapper surfaces the failure via
      // ctx.setStatus (wallet:error has no subscriber).
      throw e instanceof Error ? e : new Error(t("walletNotConnected"));
    } finally {
      isConnecting.set(false);
    }
  };

  return {
    address: chain.address,
    isRefreshing,
    isConnecting,
    balances,
    gasOk,
    neoDisplay,
    gasDisplay,
    refreshBalances,
    connectWallet,
  };
}
