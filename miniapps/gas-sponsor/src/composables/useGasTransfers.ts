import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { toFixed8 } from "@shared/utils/format";
import { requireNeoChain } from "@shared/utils/chain";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const SPONSOR_POOL_ADDRESS = "NhWxcoEc9qtmnjsTLF1fVF6myJ5MZZhSMK";

export function useGasTransfers(
  showStatus: (msg: string, type: string) => void,
  loadUserData: () => Promise<void>,
) {
  const { t } = useI18n();
  const { address, connect, invokeContract, chainType } = useWallet() as WalletSDK;

  const donateAmount = ref("0.1");
  const sendAmount = ref("0.1");
  const recipientAddress = ref("");
  const isDonating = ref(false);
  const isSending = ref(false);

  const handleDonate = async () => {
    if (isDonating.value) return;
    if (!requireNeoChain(chainType, t)) return;
    const amount = parseFloat(donateAmount.value);
    if (Number.isNaN(amount) || amount <= 0) {
      showStatus(t("invalidAmount"), "error");
      return;
    }
    isDonating.value = true;
    try {
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      await invokeContract({
        scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: SPONSOR_POOL_ADDRESS },
          { type: "Integer", value: toFixed8(donateAmount.value) },
          { type: "Any", value: null },
        ],
      });
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
    if (!requireNeoChain(chainType, t)) return;
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
      if (!address.value) await connect();
      if (!address.value) throw new Error(t("walletNotConnected"));
      await invokeContract({
        scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH,
        operation: "transfer",
        args: [
          { type: "Hash160", value: address.value },
          { type: "Hash160", value: recipientAddress.value },
          { type: "Integer", value: toFixed8(sendAmount.value) },
          { type: "Any", value: null },
        ],
      });
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
