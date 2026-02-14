import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { createUseI18n } from "@shared/composables/useI18n";
import { useAllEvents } from "@shared/composables/useAllEvents";
import { useContractAddress } from "@shared/composables/useContractAddress";
import { messages } from "@/locale/messages";
import { ownerMatchesAddress, parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import type { Capsule } from "../pages/index/components/CapsuleList.vue";

const APP_ID = "miniapp-time-capsule";
const FISH_FEE = "0.05";
const CONTENT_STORE_KEY = "time-capsule-content";

export function useCapsuleUnlock() {
  const { t } = createUseI18n(messages)();
  const { address, connect, invokeContract, invokeRead } = useWallet() as WalletSDK;
  const { processPayment, isProcessing: paymentProcessing } = usePaymentFlow(APP_ID);
  const { list: listEvents } = useEvents();
  const { ensure: ensureContractAddress } = useContractAddress((key: string) =>
    key === "contractUnavailable" ? t("error") : t(key),
  );
  const { listAllEvents } = useAllEvents(listEvents, APP_ID);

  const isProcessing = ref(false);
  const localContent = ref<Record<string, string>>({});

  const isBusy = computed(() => paymentProcessing.value || isProcessing.value);

  const loadLocalContent = () => {
    try {
      const raw = uni.getStorageSync(CONTENT_STORE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return {};
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
          normalized[key] = value;
        } else if (value && typeof value === "object") {
          const legacy = value as { hash?: string; content?: string };
          const hashKey = String(legacy.hash || key);
          if (legacy.content) {
            normalized[hashKey] = String(legacy.content);
          }
        }
      }
      return normalized;
    } catch {
      /* Local storage parse failure — start with empty content map */
      return {};
    }
  };

  localContent.value = loadLocalContent();

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, address.value);

  const open = async (cap: Capsule, onStatus?: (msg: string, type: string) => void) => {
    if (cap.locked) {
      onStatus?.(t("notUnlocked"), "error");
      return;
    }
    if (isBusy.value) return;

    try {
      isProcessing.value = true;
      const contract = await ensureContractAddress();

      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      if (!cap.revealed) {
        onStatus?.(t("revealing"), "loading");
        await invokeContract({
          scriptHash: contract,
          operation: "Reveal",
          args: [
            { type: "Hash160", value: address.value },
            { type: "Integer", value: cap.id },
          ],
        });
      }

      const content = cap.contentHash ? localContent.value[cap.contentHash] : "";
      if (content) {
        onStatus?.(`${t("message")} ${content}`, "success");
      } else if (cap.contentHash) {
        onStatus?.(`${t("contentUnavailable")} ${cap.contentHash}`, "success");
      } else {
        onStatus?.(t("capsuleRevealed"), "success");
      }
    } catch (e: unknown) {
      onStatus?.(formatErrorMessage(e, t("error")), "error");
    } finally {
      isProcessing.value = false;
    }
  };

  const fish = async (onStatus?: (msg: string, type: string) => void) => {
    if (isBusy.value) return;

    try {
      isProcessing.value = true;
      onStatus?.(t("fishing"), "loading");
      const requestStartedAt = Date.now();

      if (!address.value) {
        await connect();
      }
      if (!address.value) {
        throw new Error(t("connectWallet"));
      }

      const contract = await ensureContractAddress();
      const { receiptId, invoke: invokeWithReceipt } = await processPayment(
        FISH_FEE,
        `time-capsule:fish:${Date.now()}`
      );

      await invokeWithReceipt(contract, "fish", [
        { type: "Hash160", value: address.value },
        { type: "Integer", value: String(receiptId) },
      ]);

      const fishEvents = await listAllEvents("CapsuleFished");
      const match = fishEvents.find((evt) => {
        const values = Array.isArray(evt?.state) ? evt.state.map(parseStackItem) : [];
        const timestamp = evt?.created_at ? new Date(evt.created_at).getTime() : 0;
        return ownerMatches(values[0]) && timestamp >= requestStartedAt - 1000;
      });

      if (match) {
        const values = Array.isArray(match?.state) ? match.state.map(parseStackItem) : [];
        const fishedId = String(values[1] || "");
        onStatus?.(t("fishResult").replace("{id}", fishedId || "?"), "success");
      } else {
        onStatus?.(t("fishNone"), "success");
      }
    } catch (e: unknown) {
      onStatus?.(formatErrorMessage(e, t("error")), "error");
    } finally {
      isProcessing.value = false;
    }
  };

  return {
    isBusy,
    ownerMatches,
    listAllEvents,
    open,
    fish,
    ensureContractAddress,
    invokeRead,
    parseInvokeResult,
    localContent,
  };
}
