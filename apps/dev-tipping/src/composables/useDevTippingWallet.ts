import { toFixed8 } from "@shared/utils/format";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";

export function useDevTippingWallet(APP_ID: string) {
  const { t } = createUseI18n(messages)();
  const {
    address,
    ensureWallet,
    invoke,
    isProcessing: isLoading,
    ensureContractAddress,
  } = useContractInteraction({ appId: APP_ID, t });

  const MIN_TIP = 0.001;
  const { status, setStatus, clearStatus } = useStatusMessage();

  const sendTip = async (
    selectedDevId: number,
    tipAmount: string,
    tipMessage: string,
    tipperName: string,
    anonymous: boolean,
    onSuccess?: () => void
  ) => {
    if (!selectedDevId || !tipAmount) return false;

    try {
      await ensureWallet();

      const amount = Number.parseFloat(tipAmount);

      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error(t("invalidAmount"));
      }
      if (amount < MIN_TIP) {
        throw new Error(t("minTip"));
      }

      const amountInt = toFixed8(tipAmount);

      await invoke(String(amount), `tip:${selectedDevId}`, "Tip", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: String(selectedDevId) },
        { type: "Integer", value: amountInt },
        { type: "String", value: tipMessage || "" },
        { type: "String", value: tipperName || "" },
        { type: "Boolean", value: anonymous },
      ]);

      setStatus(t("tipSent"), "success");
      if (onSuccess) onSuccess();
      return true;
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
      return false;
    }
  };

  return {
    address,
    isLoading,
    status,
    setStatus,
    clearStatus,
    sendTip,
    ensureContractAddress,
  };
}
