import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { requireNeoChain } from "@shared/utils/chain";

type EnsureOptions = {
  silentChainCheck?: boolean;
  contractUnavailableMessage?: string;
};

type EnsureSafeOptions = {
  silentChainCheck?: boolean;
};

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

  const resolveAddress = async () => {
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    return contractAddress.value;
  };

  /**
   * Resolve contract address or throw.
   * Use inside a try/catch block where the caller handles the error.
   */
  const ensure = async (options: EnsureOptions = {}): Promise<string> => {
    const silentChainCheck = options.silentChainCheck ?? false;
    if (!requireNeoChain(chainType, silentChainCheck ? undefined : t, undefined, { silent: silentChainCheck })) {
      throw new Error(t("wrongChain"));
    }
    const resolved = await resolveAddress();
    if (!resolved) {
      throw new Error(options.contractUnavailableMessage || t("contractUnavailable") || "Contract address unavailable");
    }
    return resolved;
  };

  /**
   * Resolve contract address, returning false on failure.
   * Use as a guard: `if (!(await ensureSafe())) return;`
   */
  const ensureSafe = async (options: EnsureSafeOptions = {}): Promise<boolean> => {
    const silentChainCheck = options.silentChainCheck ?? false;
    if (!requireNeoChain(chainType, silentChainCheck ? undefined : t, undefined, { silent: silentChainCheck })) {
      return false;
    }
    return !!(await resolveAddress());
  };

  return { contractAddress, ensure, ensureSafe };
}
