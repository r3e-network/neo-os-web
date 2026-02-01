import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { toFixedDecimals } from "@shared/utils/format";

export function useNeoburgerBalances() {
  const { getAddress, getBalance } = useWallet() as WalletSDK;
  
  const neoBalance = ref(0);
  const bNeoBalance = ref(0);
  const walletAddress = ref<string | null>(null);

  async function loadBalances(bneoContract: string | null) {
    try {
      const address = await getAddress();
      walletAddress.value = address || null;
      if (!address) {
        neoBalance.value = 0;
        bNeoBalance.value = 0;
        return;
      }

      if (!bneoContract) return;

      const neo = await getBalance("NEO");
      const bneo = await getBalance(bneoContract);
      neoBalance.value = typeof neo === "string" ? parseFloat(neo) || 0 : typeof neo === "number" ? neo : 0;
      bNeoBalance.value = typeof bneo === "string" ? parseFloat(bneo) || 0 : typeof bneo === "number" ? bneo : 0;
    } catch {}
  }

  const walletConnected = computed(() => !!walletAddress.value);

  return {
    neoBalance,
    bNeoBalance,
    walletAddress,
    walletConnected,
    loadBalances,
  };
}
