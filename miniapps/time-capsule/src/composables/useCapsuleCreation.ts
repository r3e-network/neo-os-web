import { ref, computed } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { sha256Hex } from "@shared/utils/hash";
import { requireNeoChain } from "@shared/utils/chain";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
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

export function useCapsuleCreation() {
  const { t } = useI18n();
  const { address, connect, invokeContract, chainType, getContractAddress } = useWallet() as WalletSDK;
  const { processPayment, isProcessing: paymentProcessing } = usePaymentFlow(APP_ID);

  const contractAddress = ref<string | null>(null);
  const isProcessing = ref(false);
  const { status, setStatus, clearStatus } = useStatusMessage();

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

  const ensureContractAddress = async () => {
    if (!requireNeoChain(chainType, t)) {
      throw new Error(t("wrongChain"));
    }
    if (!contractAddress.value) {
      contractAddress.value = await getContractAddress();
    }
    if (!contractAddress.value) throw new Error(t("error"));
    return contractAddress.value;
  };

  const saveLocalContent = (hash: string, content: string) => {
    if (!hash) return;
    try {
      const existing = uni.getStorageSync(CONTENT_STORE_KEY);
      const store = existing ? JSON.parse(existing) : {};
      store[hash] = content;
      uni.setStorageSync(CONTENT_STORE_KEY, JSON.stringify(store));
    } catch {
      /* Local storage write is non-critical */
    }
  };

  const create = async (onSuccess?: () => void) => {
    if (isBusy.value || !canCreate.value) return;

    try {
      setStatus(t("creatingCapsule"), "loading");
      isProcessing.value = true;

      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      const contract = await ensureContractAddress();
      const { receiptId, invoke: invokeWithReceipt } = await processPayment(
        BURY_FEE,
        `time-capsule:bury:${Date.now()}`
      );

      const daysValue = Number.parseInt(newCapsule.value.days, 10);
      if (!Number.isFinite(daysValue) || daysValue < MIN_LOCK_DAYS || daysValue > MAX_LOCK_DAYS) {
        throw new Error(t("invalidLockDuration"));
      }

      const unlockDate = new Date();
      unlockDate.setDate(unlockDate.getDate() + daysValue);
      const unlockTimestamp = Math.floor(unlockDate.getTime() / 1000);
      const content = newCapsule.value.content.trim();
      const contentHash = await sha256Hex(content);

      await invokeWithReceipt(contract, "bury", [
        { type: "Hash160", value: address.value },
        { type: "String", value: contentHash },
        { type: "String", value: newCapsule.value.title.trim().slice(0, 100) },
        { type: "Integer", value: String(unlockTimestamp) },
        { type: "Boolean", value: newCapsule.value.isPublic },
        { type: "Integer", value: String(newCapsule.value.category) },
        { type: "Integer", value: String(receiptId) },
      ]);

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
