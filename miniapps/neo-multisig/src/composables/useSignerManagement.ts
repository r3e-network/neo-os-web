import { ref, computed } from "vue";
import { useI18n } from "@/composables/useI18n";

export interface SignerEntry {
  id: number;
  value: string;
}

export function useSignerManagement(initialSigners: string[] = ["", ""]) {
  const { t } = useI18n();

  const signers = ref<string[]>([...initialSigners]);
  const threshold = ref(1);

  const signerEntries = computed(() =>
    signers.value.map((value, index) => ({
      id: index,
      value,
      index: index + 1,
      canRemove: signers.value.length > 1,
    })),
  );

  const addSigner = () => {
    signers.value.push("");
  };

  const removeSigner = (index: number) => {
    if (signers.value.length > 1) {
      signers.value.splice(index, 1);
      if (threshold.value > signers.value.length) {
        threshold.value = signers.value.length;
      }
    }
  };

  const updateSigner = (index: number, value: string) => {
    signers.value[index] = value;
  };

  const updateThreshold = (value: number) => {
    const max = signers.value.length;
    threshold.value = Math.max(1, Math.min(value, max));
  };

  const validateSigners = (): boolean => {
    const trimmed = signers.value.map((s) => s.trim());
    if (trimmed.some((s) => !s)) {
      uni.showToast({ title: t("toastInvalidSigners"), icon: "none" });
      return false;
    }
    return true;
  };

  return {
    signers,
    threshold,
    signerEntries,
    addSigner,
    removeSigner,
    updateSigner,
    updateThreshold,
    validateSigners,
  };
}
