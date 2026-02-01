import { ref, computed } from "vue";
import { useWallet, useEvents } from "@neo/uniapp-sdk";
import type { WalletSDK } from "@neo/types";
import { useI18n } from "@/composables/useI18n";
import { requireNeoChain } from "@shared/utils/chain";
import { addressToScriptHash, normalizeScriptHash, parseInvokeResult, parseStackItem } from "@shared/utils/neo";
import { usePaymentFlow } from "@shared/composables/usePaymentFlow";
import type { Capsule } from "../pages/index/components/CapsuleList.vue";

const APP_ID = "miniapp-time-capsule";
const FISH_FEE = "0.05";
const CONTENT_STORE_KEY = "time-capsule-content";

export function useCapsuleUnlock() {
  const { t } = useI18n();
  const { address, connect, invokeContract, invokeRead, chainType, getContractAddress } = useWallet() as WalletSDK;
  const { processPayment, isProcessing: paymentProcessing } = usePaymentFlow(APP_ID);
  const { list: listEvents } = useEvents();

  const contractAddress = ref<string | null>(null);
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
      return {};
    }
  };

  localContent.value = loadLocalContent();

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

  const ownerMatches = (value: unknown) => {
    if (!address.value) return false;
    const val = String(value || "");
    if (val === address.value) return true;
    const normalized = normalizeScriptHash(val);
    const addrHash = addressToScriptHash(address.value);
    return Boolean(normalized && addrHash && normalized === addrHash);
  };

  const listAllEvents = async (eventName: string) => {
    const events: any[] = [];
    let afterId: string | undefined;
    let hasMore = true;
    while (hasMore) {
      const res = await listEvents({ app_id: APP_ID, event_name: eventName, limit: 50, after_id: afterId });
      events.push(...res.events);
      hasMore = Boolean(res.has_more && res.last_id);
      afterId = res.last_id || undefined;
    }
    return events;
  };

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
    } catch (e: any) {
      onStatus?.(e.message || t("error"), "error");
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
      const { receiptId, invoke: invokeWithReceipt } = await processPayment(FISH_FEE, `time-capsule:fish:${Date.now()}`);

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
    } catch (e: any) {
      onStatus?.(e.message || t("error"), "error");
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
