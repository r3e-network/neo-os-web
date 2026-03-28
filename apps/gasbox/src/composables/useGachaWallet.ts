/**
 * useGachaWallet — Wallet state for the GasBox miniapp
 *
 * Receives ChainService from PlatformServices.
 */

import { ref, computed } from "vue";
import type { ChainService } from "@shared/services";
import { normalizeScriptHash, addressToScriptHash } from "@shared/utils/neo";

export interface UseGachaWalletOptions {
  chain: ChainService;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGachaWallet({ chain, t }: UseGachaWalletOptions) {
  const showWalletPrompt = ref(false);
  const walletMessage = ref<string | null>(null);

  const address = chain.address;

  const walletHash = computed(() => {
    if (!address.value) return "";
    const scriptHash = addressToScriptHash(address.value as string);
    return normalizeScriptHash(scriptHash);
  });

  const requestWallet = (message: string) => {
    walletMessage.value = message;
    showWalletPrompt.value = true;
  };

  const handleWalletConnect = async () => {
    await chain.ensureWallet();
    showWalletPrompt.value = false;
  };

  return {
    address,
    walletHash,
    showWalletPrompt,
    walletMessage,
    requestWallet,
    handleWalletConnect,
    t,
  };
}
