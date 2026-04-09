/**
 * useWalletAnalysis — Chain data and balance analysis for Wallet Health
 *
 * Receives ChainService + BalanceService + EventBus from PlatformServices
 * instead of wiring useContractInteraction + useStatusMessage + useWallet directly.
 */

import { computed, reactive, ref } from "vue";
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
  const isRefreshing = ref(false);

  const balances = reactive({
    neo: 0n,
    gas: 0n,
  });

  const isUnsupported = computed(() => false);
  const chainLabel = computed(() => {
    if (!chain.address.value) return t("statusUnknown");
    return t("statusNeo");
  });
  const chainVariant = computed(() => {
    if (!chain.address.value) return "warning";
    return "accent";
  });

  const gasOk = computed(() => balances.gas >= GAS_LOW_THRESHOLD);
  const neoDisplay = computed(() => balances.neo.toString());
  const gasDisplay = computed(() => formatFixed8(balances.gas, 4));

  const refreshBalances = async () => {
    if (!chain.address.value) return;
    if (isRefreshing.value) return;

    try {
      isRefreshing.value = true;
      balances.neo = parseBigInt(await chain.read(
        "balanceOf",
        [{ type: "Hash160", value: chain.address.value }],
        { scriptHash: NEO_HASH },
      ));
      balances.gas = parseBigInt(await chain.read(
        "balanceOf",
        [{ type: "Hash160", value: chain.address.value }],
        { scriptHash: GAS_HASH },
      ));
      eventBus.emit("balances:refreshed", { neo: balances.neo, gas: balances.gas });
    } catch (e) {
      eventBus.emit("balances:error", {
        message: e instanceof Error ? e.message : t("walletNotConnected"),
      });
    } finally {
      isRefreshing.value = false;
    }
  };

  const connectWallet = async () => {
    try {
      await chain.ensureWallet();
      if (chain.address.value) {
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
