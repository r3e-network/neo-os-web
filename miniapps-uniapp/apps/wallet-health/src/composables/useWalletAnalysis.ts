import { computed, reactive, ref, unref, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { requireNeoChain } from "@shared/utils/chain";
import { formatFixed8 } from "@shared/utils/format";
import { parseInvokeResult } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const GAS_LOW_THRESHOLD = 10000000n;

export function useWalletAnalysis() {
  const { t } = createUseI18n(messages)();
  const { address, connect, invokeRead, chainType, switchToAppChain } = useWallet() as WalletSDK;

  const { status, setStatus } = useStatusMessage();
  const isRefreshing = ref(false);

  const balances = reactive({
    neo: 0n,
    gas: 0n,
  });

  const isUnsupported = computed(() => false);
  const chainLabel = computed(() => {
    const value = String(unref(chainType) ?? "");
    if (!value) return t("statusUnknown");
    return t("statusNeo");
  });
  const chainVariant = computed(() => {
    const value = String(unref(chainType) ?? "");
    if (!value) return "warning";
    return "accent";
  });

  const gasOk = computed(() => balances.gas >= GAS_LOW_THRESHOLD);
  const neoDisplay = computed(() => balances.neo.toString());
  const gasDisplay = computed(() => formatFixed8(balances.gas, 4));

  const parseBigInt = (value: unknown) => {
    try {
      return BigInt(String(value ?? "0"));
    } catch {
      return 0n;
    }
  };

  const refreshBalances = async () => {
    if (!address.value) return;
    if (isRefreshing.value) return;
    if (!requireNeoChain(chainType, t, undefined, { silent: true })) return;

    try {
      isRefreshing.value = true;
      const neoResult = await invokeRead({
        scriptHash: NEO_HASH,
        operation: "balanceOf",
        args: [{ type: "Hash160", value: address.value }],
      });
      const gasResult = await invokeRead({
        scriptHash: GAS_HASH,
        operation: "balanceOf",
        args: [{ type: "Hash160", value: address.value }],
      });

      balances.neo = parseBigInt(parseInvokeResult(neoResult));
      balances.gas = parseBigInt(parseInvokeResult(gasResult));
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("walletNotConnected")), "error");
    } finally {
      isRefreshing.value = false;
    }
  };

  const connectWallet = async () => {
    try {
      await connect();
      if (address.value) {
        await refreshBalances();
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("walletNotConnected")), "error");
    }
  };

  watch(address, async (next) => {
    if (next) {
      await refreshBalances();
    } else {
      balances.neo = 0n;
      balances.gas = 0n;
    }
  });

  return {
    address,
    status,
    isRefreshing,
    balances,
    isUnsupported,
    chainLabel,
    chainVariant,
    gasOk,
    neoDisplay,
    gasDisplay,
    chainType,
    switchToAppChain,
    refreshBalances,
    connectWallet,
    setStatus,
  };
}
