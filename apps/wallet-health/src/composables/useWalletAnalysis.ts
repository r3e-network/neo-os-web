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
  const isRefreshing = createObservable(false);

  const balances = {
    neo: 0n,
    gas: 0n,
  };

  const isUnsupported = createDerived(() => false, []);
  const chainLabel = createDerived(() => {
    if (!chain.address.get()) return t("statusUnknown");
    return t("statusNeo");
  }, []);
  const chainVariant = createDerived(() => {
    if (!chain.address.get()) return "warning";
    return "accent";
  }, []);

  const gasOk = createDerived(() => balances.gas >= GAS_LOW_THRESHOLD, []);
  const neoDisplay = createDerived(() => balances.neo.toString(), []);
  const gasDisplay = createDerived(() => formatFixed8(balances.gas, 4), []);

  const refreshBalances = async () => {
    if (!chain.address.get()) return;
    if (isRefreshing.get()) return;

    try {
      isRefreshing.set(true);
      balances.neo = parseBigInt(await chain.read(
        "balanceOf",
        [{ type: "Hash160", value: chain.address.get() }],
        { scriptHash: NEO_HASH },
      ));
      balances.gas = parseBigInt(await chain.read(
        "balanceOf",
        [{ type: "Hash160", value: chain.address.get() }],
        { scriptHash: GAS_HASH },
      ));
      eventBus.emit("balances:refreshed", { neo: balances.neo, gas: balances.gas });
    } catch (e) {
      eventBus.emit("balances:error", {
        message: e instanceof Error ? e.message : t("walletNotConnected"),
      });
    } finally {
      isRefreshing.set(false);
    }
  };

  const connectWallet = async () => {
    try {
      await chain.ensureWallet();
      if (chain.address.get()) {
        await refreshBalances();
      }
    } catch (e) {
      eventBus.emit("wallet:error", {
        message: e instanceof Error ? e.message : t("walletNotConnected"),
      });
    }
  };

  return {
    address: chain.address,
    isRefreshing,
    balances,
    isUnsupported,
    chainLabel,
    chainVariant,
    gasOk,
    neoDisplay,
    gasDisplay,
    refreshBalances,
    connectWallet,
  };
}
