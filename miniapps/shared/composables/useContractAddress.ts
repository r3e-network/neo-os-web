import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { requireNeoChain } from "@shared/utils/chain";

/**
 * Shared composable for contract address resolution with chain validation.
 *
 * Two usage styles:
 *  - `ensure()` — returns the address string or throws (for use inside try/catch flows)
 *  - `ensureSafe()` — returns boolean, stores address in `contractAddress` ref (guard-style)
 */
export function useContractAddress(t: (key: string) => string) {
  const { chainType, getContractAddress } = useWallet() as WalletSDK;
  const contractAddress = ref<string | null>(null);

  /**
   * Resolve contract address or throw.
   * Use inside a try/catch block where the caller handles the error.
   */
  const ensure = async (): Promise<string> => {
    if (!requireNeoChain(chainType, t)) {
      throw new Error(t("wrongChain"));
    }
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    if (!contractAddress.value) {
      throw new Error(t("contractUnavailable") || "Contract address unavailable");
    }
    return contractAddress.value;
  };

  /**
   * Resolve contract address, returning false on failure.
   * Use as a guard: `if (!(await ensureSafe())) return;`
   */
  const ensureSafe = async (): Promise<boolean> => {
    if (!requireNeoChain(chainType, t)) return false;
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    return !!contractAddress.value;
  };

  return { contractAddress, ensure, ensureSafe };
}
