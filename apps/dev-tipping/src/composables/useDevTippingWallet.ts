import { toFixed8 } from "@shared/utils/format";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

export function useDevTippingWallet(APP_ID: string) {
  const { t } = createUseI18n(messages)();
  const {
    address,
    ensureWallet,
    invokeDirectly,
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
      const contract = await ensureContractAddress();

      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Hash160", value: contract },
          { type: "Integer", value: amountInt },
          { type: "String", value: `${APP_ID}:tip:${selectedDevId}` },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      await invokeDirectly("Tip", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: String(selectedDevId) },
        { type: "Integer", value: amountInt },
        { type: "String", value: tipMessage || "" },
        { type: "String", value: tipperName || "" },
        { type: "Boolean", value: anonymous },
      ], contract);

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
