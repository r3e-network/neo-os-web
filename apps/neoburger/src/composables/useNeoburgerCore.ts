import { ref, computed } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { toFixedDecimals, toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useWalletBalanceReader } from "@shared/composables/useWalletBalanceReader";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { BLOCKCHAIN_CONSTANTS, TOKEN_CONSTANTS } from "@shared/constants";
import { messages } from "@/locale/messages";

const NEO_CONTRACT = BLOCKCHAIN_CONSTANTS.NEO_HASH;
const BNEO_DECIMALS = TOKEN_CONSTANTS.GAS_DECIMALS;

export function useNeoburgerCore() {
  const { t } = createUseI18n(messages)();
  const { setStatus } = useStatusMessage();
  const wallet = useWallet() as WalletSDK;
  const { chainType } = wallet;
  const { address, ensureContractAddress, ensureWallet, invokeDirectly } = useContractInteraction({
    appId: "miniapp-neoburger",
    t,
    wallet,
  });
  const { readBalance } = useWalletBalanceReader();

  const neoBalance = ref(0);
  const bNeoBalance = ref(0);
  const walletAddress = ref<string | null>(null);
  const BNEO_CONTRACT = ref<string | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);
  const statusMessage = ref("");
  const statusType = ref<"success" | "error">("success");

  async function ensureBneoContract(): Promise<string | null> {
    if (BNEO_CONTRACT.value) return BNEO_CONTRACT.value;
    try {
      BNEO_CONTRACT.value = await ensureContractAddress();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("contractUnavailable");
      error.value = msg;
      setStatus(msg, "error");
    } finally {
      error.value = null;
    }
    return BNEO_CONTRACT.value;
  }

  async function loadBalances(connectIfNeeded = false) {
    try {
      if (connectIfNeeded) {
        await ensureWallet();
      }
      walletAddress.value = address.value || null;
      if (!address.value) {
        neoBalance.value = 0;
        bNeoBalance.value = 0;
        return;
      }
      const bneoContract = await ensureBneoContract();
      if (!bneoContract) return;
      neoBalance.value = await readBalance("NEO", { decimals: 0 });
      bNeoBalance.value = await readBalance(bneoContract, { decimals: BNEO_DECIMALS });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("balanceLoadFailed");
      error.value = msg;
      setStatus(msg, "error");
    } finally {
      error.value = null;
    }
  }

  async function connectWallet() {
    try {
      await ensureWallet();
      await loadBalances(false);
      return Boolean(address.value);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("connectWallet");
      error.value = msg;
      setStatus(msg, "error");
      return false;
    } finally {
      error.value = null;
    }
  }

  async function handleStake(amount: string) {
    if (!requireNeoChain(chainType, t)) return false;
    const stakeAmount = Number(toFixedDecimals(amount, 0));
    if (stakeAmount <= 0 || stakeAmount > neoBalance.value) return false;
    const bneoContract = await ensureBneoContract();
    if (!bneoContract) return false;
    try {
      const walletAddress = await ensureWallet();
      await invokeDirectly("transfer", [
        { type: "Hash160", value: walletAddress },
        { type: "Hash160", value: bneoContract },
        { type: "Integer", value: Math.floor(stakeAmount) },
        { type: "Any", value: null },
      ], NEO_CONTRACT);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("stakeFailed");
      error.value = msg;
      setStatus(msg, "error");
      return false;
    } finally {
      error.value = null;
    }
  }

  async function handleUnstake(amount: string) {
    if (!requireNeoChain(chainType, t)) return false;
    const unstakeAmount = parseFloat(amount) || 0;
    if (unstakeAmount <= 0 || unstakeAmount > bNeoBalance.value) return false;
    const bneoContract = await ensureBneoContract();
    if (!bneoContract) return false;
    const integerAmount = toFixed8(amount);
    try {
      const walletAddress = await ensureWallet();
      await invokeDirectly("transfer", [
        { type: "Hash160", value: walletAddress },
        { type: "Hash160", value: bneoContract },
        { type: "Integer", value: integerAmount },
        { type: "ByteArray", value: "" },
      ], bneoContract);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("unstakeFailed");
      error.value = msg;
      setStatus(msg, "error");
      return false;
    } finally {
      error.value = null;
    }
  }

  async function handleClaimRewards() {
    if (!requireNeoChain(chainType, t)) return false;
    try {
      const bneoContract = await ensureBneoContract();
      if (!bneoContract) return false;
      await invokeDirectly("claim", [], bneoContract);
      return true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("claimFailed");
      error.value = msg;
      setStatus(msg, "error");
      return false;
    } finally {
      error.value = null;
    }
  }

  const walletConnected = computed(() => !!walletAddress.value);

  return {
    neoBalance,
    bNeoBalance,
    walletAddress,
    walletConnected,
    BNEO_CONTRACT,
    loading,
    error,
    statusMessage,
    statusType,
    ensureBneoContract,
    connectWallet,
    loadBalances,
    handleStake,
    handleUnstake,
    handleClaimRewards,
  };
}
