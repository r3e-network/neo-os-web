import { ref } from "vue";
import { useWallet } from "@shared/utils/wallet-sdk";
import type { WalletSDK } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const APP_ID = "miniapp-gas-sponsor";
const SPONSOR_POOL_ADDRESS = "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK";

export function useGasTransfers(
  showStatus: (msg: string, type: string) => void,
  loadUserData: () => Promise<void>,
) {
  const { t } = createUseI18n(messages)();
  const translate = (key: string) => t(key as never);
  const wallet = useWallet() as WalletSDK;
  const { chainType } = wallet;
  const { ensureWallet, invokeDirectly } = useContractInteraction({ appId: APP_ID, t: translate, wallet });

  const donateAmount = ref("0.1");
  const sendAmount = ref("0.1");
  const recipientAddress = ref("");
  const isDonating = ref(false);
  const isSending = ref(false);

  const handleDonate = async () => {
    if (isDonating.value) return;
    if (!requireNeoChain(chainType, translate)) return;
    const amount = parseFloat(donateAmount.value);
    if (Number.isNaN(amount) || amount <= 0) {
      showStatus(t("invalidAmount"), "error");
      return;
    }
    isDonating.value = true;
    try {
      const sender = await ensureWallet();
      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: sender },
          { type: "Hash160", value: SPONSOR_POOL_ADDRESS },
          { type: "Integer", value: toFixed8(donateAmount.value) },
          { type: "Any", value: null },
        ] as unknown as Parameters<typeof invokeDirectly>[1],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );
      showStatus(t("donateSuccess"), "success");
      donateAmount.value = "0.1";
      await loadUserData();
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isDonating.value = false;
    }
  };

  const handleSend = async () => {
    if (isSending.value) return;
    if (!requireNeoChain(chainType, translate)) return;
    if (!recipientAddress.value || recipientAddress.value.length < 30) {
      showStatus(t("invalidAddress"), "error");
      return;
    }
    const amount = parseFloat(sendAmount.value);
    if (Number.isNaN(amount) || amount <= 0) {
      showStatus(t("invalidAmount"), "error");
      return;
    }
    isSending.value = true;
    try {
      const sender = await ensureWallet();
      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: sender },
          { type: "Hash160", value: recipientAddress.value },
          { type: "Integer", value: toFixed8(sendAmount.value) },
          { type: "Any", value: null },
        ] as unknown as Parameters<typeof invokeDirectly>[1],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );
      showStatus(t("sendSuccess"), "success");
      sendAmount.value = "0.1";
      recipientAddress.value = "";
      await loadUserData();
    } catch (e: unknown) {
      showStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isSending.value = false;
    }
  };

  return {
    donateAmount,
    sendAmount,
    recipientAddress,
    isDonating,
    isSending,
    handleDonate,
    handleSend,
  };
}
