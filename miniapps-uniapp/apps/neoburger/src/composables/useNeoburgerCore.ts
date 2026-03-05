import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { toFixedDecimals, toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { messages } from "@/locale/messages";

const NEO_CONTRACT = BLOCKCHAIN_CONSTANTS.NEO_HASH;

export function useNeoburgerCore() {
  const { t } = createUseI18n(messages)();
  const { getAddress, invokeContract, getBalance, chainType } = useWallet() as WalletSDK;
  const { ensure: ensureContractAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? t("contractUnavailable") : t(key)
  );

  const neoBalance = ref(0);
  const bNeoBalance = ref(0);
  const walletAddress = ref<string | null>(null);
  const BNEO_CONTRACT = ref<string | null>(null);
  const loading = ref(false);
  const statusMessage = ref("");
  const statusType = ref<"success" | "error">("success");

  async function ensureBneoContract(): Promise<string | null> {
    if (BNEO_CONTRACT.value) return BNEO_CONTRACT.value;
    try {
      BNEO_CONTRACT.value = await ensureContractAddress({
        silentChainCheck: true,
        contractUnavailableMessage: t("contractUnavailable"),
      });
    } catch (e: unknown) {
      /* non-critical: bNEO contract resolution */
    }
    return BNEO_CONTRACT.value;
  }

  async function loadBalances() {
    try {
      const address = await getAddress();
      walletAddress.value = address || null;
      if (!address) {
        neoBalance.value = 0;
        bNeoBalance.value = 0;
        return;
      }
      const bneoContract = await ensureBneoContract();
      if (!bneoContract) return;
      const neo = await getBalance("NEO");
      const bneo = await getBalance(bneoContract);
      neoBalance.value = typeof neo === "string" ? parseFloat(neo) || 0 : typeof neo === "number" ? neo : 0;
      bNeoBalance.value = typeof bneo === "string" ? parseFloat(bneo) || 0 : typeof bneo === "number" ? bneo : 0;
    } catch (e: unknown) {
      /* non-critical: wallet balance fetch */
    }
  }

  async function handleStake(amount: string) {
    if (!requireNeoChain(chainType, t)) return false;
    const stakeAmount = Number(toFixedDecimals(amount, 0));
    if (stakeAmount <= 0 || stakeAmount > neoBalance.value) return false;
    const bneoContract = await ensureBneoContract();
    if (!bneoContract) return false;
    try {
      await invokeContract({
        scriptHash: NEO_CONTRACT,
        operation: "transfer",
        args: [
          { type: "Hash160", value: await getAddress() },
          { type: "Hash160", value: bneoContract },
          { type: "Integer", value: Math.floor(stakeAmount) },
          { type: "Any", value: null },
        ],
      });
      return true;
    } catch (e: unknown) {
      /* non-critical: stake operation failed */
      return false;
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
      await invokeContract({
        scriptHash: bneoContract,
        operation: "transfer",
        args: [
          { type: "Hash160", value: await getAddress() },
          { type: "Hash160", value: bneoContract },
          { type: "Integer", value: integerAmount },
          { type: "ByteArray", value: "" },
        ],
      });
      return true;
    } catch (e: unknown) {
      /* non-critical: unstake operation failed */
      return false;
    }
  }

  async function handleClaimRewards() {
    if (!requireNeoChain(chainType, t)) return false;
    try {
      const sdk = await import("@neo/uniapp-sdk").then((m) => m.waitForSDK?.() || null);
      if (!sdk?.invoke) return false;
      const bneoContract = await ensureBneoContract();
      if (!bneoContract) return false;
      await sdk.invoke("invokeFunction", { contract: bneoContract, method: "claim", args: [] });
      return true;
    } catch (e: unknown) {
      /* non-critical: claim rewards failed */
      return false;
    }
  }

  const walletConnected = computed(() => !!walletAddress.value);

  return {
    neoBalance,
    bNeoBalance,
    walletAddress,
    walletConnected,
    loading,
    statusMessage,
    statusType,
    ensureBneoContract,
    loadBalances,
    handleStake,
    handleUnstake,
    handleClaimRewards,
  };
}
