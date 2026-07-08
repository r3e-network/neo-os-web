/**
 * useWalletAnalysis — Chain data and balance analysis for Wallet Health
 *
 * Receives the MiniApp framework SDK (ctx.framework): wallet identity and
 * NEO/GAS balance reads go through app.wallet instead of hand-rolled
 * ChainService balanceOf reads.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { formatFixed8 } from "@shared/utils/format";

const GAS_LOW_THRESHOLD = 10000000n;

export interface UseWalletAnalysisOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useWalletAnalysis({ app, t }: UseWalletAnalysisOptions) {
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
    if (!app.wallet.isConnected()) return;
    if (isRefreshing.get()) return;

    try {
      isRefreshing.set(true);
      // NEO and GAS reads are independent (same address, different asset);
      // run them concurrently to roughly halve refresh latency on slow RPC.
      const [neoRaw, gasRaw] = await Promise.all([
        app.wallet.raw("NEO"),
        app.wallet.raw("GAS"),
      ]);
      balances.neo = neoRaw;
      balances.gas = gasRaw;
      balanceRevision.set(balanceRevision.get() + 1);
    } catch (e) {
      // Re-throw so the registerActions wrapper surfaces the failure via
      // ctx.setStatus instead of leaving the user with stale balances and no
      // error indication.
      throw e instanceof Error ? e : new Error(t("refreshFailed"));
    } finally {
      isRefreshing.set(false);
    }
  };

  const connectWallet = async () => {
    // In-flight guard: wallet.ensure() opens a wallet prompt and leaves the
    // address null while pending, so isConnected stays false and the button
    // remains clickable. Gate entry before the first await to stop repeated
    // taps from triggering concurrent ensure() calls / duplicate popups.
    if (isConnecting.get()) return;

    try {
      isConnecting.set(true);
      await app.wallet.ensure();
      if (app.wallet.isConnected()) {
        await refreshBalances();
      }
    } catch (e) {
      // Re-throw so the registerActions wrapper surfaces the failure via
      // ctx.setStatus.
      throw e instanceof Error ? e : new Error(t("walletNotConnected"));
    } finally {
      isConnecting.set(false);
    }
  };

  return {
    address: app.wallet.observe(),
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
