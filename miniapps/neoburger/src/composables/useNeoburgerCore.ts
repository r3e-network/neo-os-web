import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { toFixedDecimals, toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { useI18n } from "@/composables/useI18n";

const NEO_CONTRACT = "0xef4073a0f2b305a38ec4050e4d3d28bc40ea63f5";

export function useNeoburgerCore() {
  const { t } = useI18n();
  const { getAddress, invokeContract, getBalance, chainType, getContractAddress } = useWallet() as WalletSDK;

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
      const contract = await getContractAddress();
      if (contract) BNEO_CONTRACT.value = contract;
    } catch {}
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
    } catch {}
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
    } catch {
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
    } catch {
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
    } catch {
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
