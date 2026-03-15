import { ref } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";

const APP_ID = "miniapp-memorial-shrine";

export function useMemorialContract(t: (key: string) => string) {
  const { ensureWallet, invokeDirectly, address, ensureContractAddress } = useContractInteraction({ appId: APP_ID, t });
  const { processPayment } = usePaymentFlow(APP_ID);

  const isSubmitting = ref(false);
  const isPaying = ref(false);

  const createMemorial = async (
    form: {
      name: string;
      photoHash: string;
      relationship: string;
      birthYear: number;
      deathYear: number;
      biography: string;
      obituary: string;
    },
    onSuccess: () => void,
    setStatus: (msg: string, type: string) => void
  ) => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    try {
      const addr = await ensureWallet();
      await invokeDirectly("createMemorial", [
        { type: "Hash160", value: addr },
        { type: "String", value: form.name },
        { type: "String", value: form.photoHash },
        { type: "String", value: form.relationship },
        { type: "Integer", value: String(form.birthYear || 0) },
        { type: "Integer", value: String(form.deathYear || 0) },
        { type: "String", value: form.biography },
        { type: "String", value: form.obituary },
      ]);
      setStatus(t("createSuccess"), "success");
      onSuccess();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isSubmitting.value = false;
    }
  };

  const payTribute = async (
    memorialId: number,
    offeringType: number,
    offeringCost: number,
    message: string,
    setStatus: (msg: string, type: string) => void
  ) => {
    if (isPaying.value) return;
    isPaying.value = true;
    try {
      const addr = await ensureWallet();
      const contract = await ensureContractAddress();

      const { receiptId, invoke: invokeWithReceipt } = await processPayment(
        String(offeringCost),
        `tribute:${memorialId}:${offeringType}`
      );

      await invokeWithReceipt(contract, "PayTribute", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: String(memorialId) },
        { type: "Integer", value: String(offeringType) },
        { type: "String", value: message },
        { type: "Integer", value: String(receiptId) },
      ]);

      setStatus(t("tributeSuccess"), "success");
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isPaying.value = false;
    }
  };

  return {
    address,
    isSubmitting,
    isPaying,
    createMemorial,
    payTribute,
  };
}
