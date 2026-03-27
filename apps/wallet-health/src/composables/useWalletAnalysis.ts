import { computed, reactive, ref, unref, watch, onUnmounted } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { requireNeoChain } from "@shared/utils/chain";
import { formatFixed8 } from "@shared/utils/format";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const NEO_HASH = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const GAS_HASH = BLOCKCHAIN_CONSTANTS.GAS_HASH;
const GAS_LOW_THRESHOLD = 10000000n;

export function useWalletAnalysis() {
  const { t } = createUseI18n(messages)();
  const wallet = useWallet() as WalletSDK;
  const { address, chainType, switchToAppChain } = wallet;
  const { read, ensureWallet } = useContractInteraction({
    appId: "miniapp-wallet-health",
    t,
    wallet,
  });

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
    } catch (_e: unknown) {
      console.warn("[useWalletAnalysis] parseBigInt failed:", _e instanceof Error ? _e.message : String(_e));
      return 0n;
    }
  };

  const refreshBalances = async () => {
    if (!address.value) return;
    if (isRefreshing.value) return;
    if (!requireNeoChain(chainType, t, undefined, { silent: true })) return;

    try {
      isRefreshing.value = true;
      balances.neo = parseBigInt(await read(
        "balanceOf",
        [{ type: "Hash160", value: address.value }],
        NEO_HASH,
      ));
      balances.gas = parseBigInt(await read(
        "balanceOf",
        [{ type: "Hash160", value: address.value }],
        GAS_HASH,
      ));
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("walletNotConnected")), "error");
    } finally {
      isRefreshing.value = false;
    }
  };

  const connectWallet = async () => {
    try {
      await ensureWallet();
      if (address.value) {
        await refreshBalances();
      }
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("walletNotConnected")), "error");
    }
  };

  const mountedRef = ref(true);
  const stopAddressWatch = watch(address, async (next) => {
    if (!mountedRef.value) return;
    if (next) {
      try {
        await refreshBalances();
        if (!mountedRef.value) return;
      } catch (_e: unknown) {
        console.warn("[useWalletAnalysis] balance refresh failed:", _e instanceof Error ? _e.message : String(_e));
      }
    } else {
      if (!mountedRef.value) return;
      balances.neo = 0n;
      balances.gas = 0n;
    }
  });

  onUnmounted(() => { mountedRef.value = false; stopAddressWatch(); });

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
