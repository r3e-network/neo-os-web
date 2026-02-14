import { ref } from "vue";
import { useWallet } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { ownerMatchesAddress } from "@shared/utils/neo";

const TRUST_NAME_KEY = "heritage-trust-names";

export function useHeritageBeneficiaries() {
  const { t } = createUseI18n(messages)();
  const { address } = useWallet() as WalletSDK;

  const loadTrustNames = () => {
    try {
      const raw = uni.getStorageSync(TRUST_NAME_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const trustNames = ref<Record<string, string>>(loadTrustNames());

  const saveTrustName = (id: string, name: string) => {
    if (!id || !name) return;
    trustNames.value = { ...trustNames.value, [id]: name };
    try {
      uni.setStorageSync(TRUST_NAME_KEY, JSON.stringify(trustNames.value));
    } catch {
      // ignore storage errors
    }
  };

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, address.value);

  return {
    trustNames,
    saveTrustName,
    ownerMatches,
  };
}
