import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { normalizeScriptHash, addressToScriptHash } from "@shared/utils/neo";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

export function useGachaWallet() {
  const { t } = createUseI18n(messages)();
  const { address, connect } = useWallet() as WalletSDK;

  const showWalletPrompt = ref(false);
  const walletMessage = ref<string | null>(null);

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
    await connect();
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
