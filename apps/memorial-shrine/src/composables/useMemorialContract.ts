import { ref } from "vue";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

const APP_ID = "miniapp-memorial-shrine";

export function useMemorialContract(t: (key: string) => string) {
  const { ensureWallet, invokeDirectly, address, ensureContractAddress } = useContractInteraction({ appId: APP_ID, t });

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
    } catch (e) {
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
      const offeringAmount = String(Math.round(Number(offeringCost) * 1e8));

      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: addr },
          { type: "Hash160", value: contract },
          { type: "Integer", value: offeringAmount },
          { type: "String", value: `${APP_ID}:tribute:${memorialId}:${offeringType}` },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      await invokeDirectly("PayTribute", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: String(memorialId) },
        { type: "Integer", value: String(offeringType) },
        { type: "String", value: message },
      ]);

      setStatus(t("tributeSuccess"), "success");
    } catch (e) {
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
