import { computed, reactive, ref, watch } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { requireNeoChain } from "@shared/utils/chain";
import { formatFixed8 } from "@shared/utils/format";
import { parseInvokeResult } from "@shared/utils/neo";

const NEO_HASH = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";
const GAS_HASH = "0xd2a4cff31913016155e38e474a2c06d08be276cf";
const GAS_LOW_THRESHOLD = 10000000n;

export function useWalletAnalysis() {
  const { t } = useI18n();
  const { address, connect, invokeRead, chainType, switchToAppChain } = useWallet() as WalletSDK;

  const status = ref<{ msg: string; type: "success" | "error" } | null>(null);
  const isRefreshing = ref(false);

  const balances = reactive({
    neo: 0n,
    gas: 0n,
  });

  const isUnsupported = computed(() => false);
  const chainLabel = computed(() => {
    const value = (chainType as any)?.value ?? chainType ?? "";
    if (!value) return t("statusUnknown");
    return t("statusNeo");
  });
  const chainVariant = computed(() => {
    const value = (chainType as any)?.value ?? chainType ?? "";
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

  const setStatus = (msg: string, type: "success" | "error") => {
    status.value = { msg, type };
    setTimeout(() => {
      if (status.value?.msg === msg) status.value = null;
    }, 4000);
  };

  const refreshBalances = async () => {
    if (!address.value) return;
    if (isRefreshing.value) return;
    if (!requireNeoChain(chainType, t, undefined, { silent: true })) return;

    try {
      isRefreshing.value = true;
      const neoResult = await invokeRead({
        contractAddress: NEO_HASH,
        operation: "balanceOf",
        args: [{ type: "Hash160", value: address.value }],
      });
      const gasResult = await invokeRead({
        contractAddress: GAS_HASH,
        operation: "balanceOf",
        args: [{ type: "Hash160", value: address.value }],
      });

      balances.neo = parseBigInt(parseInvokeResult(neoResult));
      balances.gas = parseBigInt(parseInvokeResult(gasResult));
    } catch (e: any) {
      setStatus(e.message || t("walletNotConnected"), "error");
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
    } catch (e: any) {
      setStatus(e.message || t("walletNotConnected"), "error");
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
