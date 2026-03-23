import { ref, computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { messages } from "@/locale/messages";
import { sha256Hex } from "@shared/utils/hash";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Capsule } from "../pages/index/components/CapsuleList.vue";

const APP_ID = "miniapp-time-capsule";
const BURY_FEE = "0.2";
const MIN_LOCK_DAYS = 1;
const MAX_LOCK_DAYS = 3650;
const CONTENT_STORE_KEY = "time-capsule-content";

export interface CapsuleFormData {
  title: string;
  content: string;
  days: string;
  isPublic: boolean;
  category: number;
}

/** Manages time capsule creation with content hashing and lock duration. */
export function useCapsuleCreation() {
  const { t } = createUseI18n(messages)();
  const {
    address,
    ensureWallet,
    ensureContractAddress,
    invokeDirectly,
    isProcessing: paymentProcessing,
  } = useContractInteraction({
    appId: APP_ID,
    t: (key: string) => (key === "contractUnavailable" ? t("error") : t(key)),
  });

  const isProcessing = ref(false);
  const { status, setStatus } = useStatusMessage();

  const newCapsule = ref<CapsuleFormData>({
    title: "",
    content: "",
    days: "30",
    isPublic: false,
    category: 1,
  });

  const isBusy = computed(() => paymentProcessing.value || isProcessing.value);

  const canCreate = computed(() => {
    const daysValue = Number.parseInt(newCapsule.value.days, 10);
    return (
      newCapsule.value.title.trim() !== "" &&
      newCapsule.value.content.trim() !== "" &&
      Number.isFinite(daysValue) &&
      daysValue >= MIN_LOCK_DAYS &&
      daysValue <= MAX_LOCK_DAYS
    );
  });

  const saveLocalContent = (hash: string, content: string) => {
    if (!hash) return;
    try {
      const existing = uni.getStorageSync(CONTENT_STORE_KEY);
      const store = existing ? JSON.parse(existing) : {};
      store[hash] = content;
      uni.setStorageSync(CONTENT_STORE_KEY, JSON.stringify(store));
    } catch (_e: unknown) {
      console.warn("[useCapsuleCreation] local storage write failed:", _e instanceof Error ? _e.message : String(_e));
    }
  };

  const create = async (onSuccess?: () => void) => {
    if (isBusy.value || !canCreate.value) return;

    try {
      setStatus(t("creatingCapsule"), "loading");
      isProcessing.value = true;

      await ensureWallet();

      const daysValue = Number.parseInt(newCapsule.value.days, 10);
      if (!Number.isFinite(daysValue) || daysValue < MIN_LOCK_DAYS || daysValue > MAX_LOCK_DAYS) {
        throw new Error(t("invalidLockDuration"));
      }

      const unlockDate = new Date();
      unlockDate.setDate(unlockDate.getDate() + daysValue);
      const unlockTimestamp = Math.floor(unlockDate.getTime() / 1000);
      const content = newCapsule.value.content.trim();
      const contentHash = await sha256Hex(content);
      const contractHash = await ensureContractAddress();

      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.value as string },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: toFixed8(BURY_FEE) },
          { type: "String", value: `time-capsule:bury:${Date.now()}` },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      await invokeDirectly("bury", [
        { type: "Hash160", value: address.value as string },
        { type: "String", value: contentHash },
        { type: "String", value: newCapsule.value.title.trim().slice(0, 100) },
        { type: "Integer", value: String(unlockTimestamp) },
        { type: "Boolean", value: newCapsule.value.isPublic },
        { type: "Integer", value: String(newCapsule.value.category) },
      ], contractHash);

      saveLocalContent(contentHash, content);

      setStatus(t("capsuleCreated"), "success");
      newCapsule.value = { title: "", content: "", days: "30", isPublic: false, category: 1 };
      onSuccess?.();
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isProcessing.value = false;
    }
  };

  return {
    newCapsule,
    status,
    isBusy,
    canCreate,
    create,
  };
}
