import { ref, computed } from "vue";
import { useEvents } from "@neo/uniapp-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { parseStackItem } from "@shared/utils/neo";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { isTxEventPendingError, waitForEventByTransaction } from "@shared/utils/transaction";
import type { HistoryItem } from "@/types";

const APP_ID = "miniapp-graveyard";

export function useGraveyardActions() {
  const { t } = createUseI18n(messages)();
  const {
    address,
    ensureWallet,
    read,
    invoke,
    contractAddress,
    ensureContractAddress,
    isProcessing: isLoading,
  } = useContractInteraction({ appId: APP_ID, t });
  const { list: listEvents } = useEvents();

  const totalDestroyed = ref(0);
  const gasReclaimed = ref(0);
  const assetHash = ref("");
  const memoryType = ref(1);
  const { status, setStatus } = useStatusMessage();
  const history = ref<HistoryItem[]>([]);
  const showConfirm = ref(false);
  const isDestroying = ref(false);
  const showWarningShake = ref(false);
  const forgettingId = ref<string | null>(null);
  const memoryTypeOptions = computed(() => [
    { value: 1, label: t("memoryTypeSecret") },
    { value: 2, label: t("memoryTypeRegret") },
    { value: 3, label: t("memoryTypeWish") },
    { value: 4, label: t("memoryTypeConfession") },
    { value: 5, label: t("memoryTypeOther") },
  ]);
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;

  const initiateDestroy = () => {
    if (!assetHash.value) {
      setStatus(t("enterAssetHash"), "error");
      showWarningShake.value = true;
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => {
        showWarningShake.value = false;
        shakeTimer = null;
      }, 500);
      return;
    }
    showConfirm.value = true;
  };

  const executeDestroy = async () => {
    showConfirm.value = false;
    if (isLoading.value || isDestroying.value) return;
    isDestroying.value = true;

    try {
      await ensureWallet();

      const { txid, waitForEvent } = await invoke(
        "0.1",
        `graveyard:bury:${assetHash.value.slice(0, 10)}`,
        "BuryMemory",
        [
          { type: "Hash160", value: address.value as string },
          { type: "String", value: assetHash.value },
          { type: "Integer", value: String(memoryType.value) },
        ]
      );

      let evt: { created_at?: string; state?: unknown[] } | null = null;
      try {
        evt = (await waitForEventByTransaction({ txid, receiptId: "" }, "MemoryBuried", waitForEvent)) as {
          created_at?: string;
          state?: unknown[];
        } | null;
      } catch (e: unknown) {
        if (isTxEventPendingError(e, "MemoryBuried")) {
          evt = null;
        } else {
          throw e;
        }
      }
      if (!evt) throw new Error(t("buryPending"));

      const evtRecord = evt as unknown as Record<string, unknown>;
      const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const memoryId = String(values[0] ?? "");
      const contentHash = String(values[2] ?? assetHash.value);
      history.value.unshift({
        id: memoryId || String(Date.now()),
        hash: contentHash,
        time: new Date(evt.created_at || Date.now()).toLocaleString(),
        forgotten: false,
      });

      totalDestroyed.value += 1;
      gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
      setStatus(t("memoryBuried"), "success");
      assetHash.value = "";
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isDestroying.value = false;
    }
  };

  const loadStats = async () => {
    if (!contractAddress.value) {
      await ensureContractAddress();
    }
    if (!contractAddress.value) return;
    try {
      const parsed = await read("getPlatformStats");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const stats = parsed as Record<string, unknown>;
        const total = Number(stats.totalBuried ?? stats.totalMemories ?? 0);
        const fee = Number(stats.buryFee ?? 0);
        totalDestroyed.value = Number.isFinite(total) ? total : 0;
        if (Number.isFinite(fee) && fee > 0) {
          gasReclaimed.value = Number(((totalDestroyed.value * fee) / 1e8).toFixed(2));
        } else {
          gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
        }
        return;
      }
      const totalResult = await read("totalMemories");
      totalDestroyed.value = Number(totalResult || 0);
      gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
    } catch (e: unknown) {
      /* non-critical: graveyard stats fetch */
    }
  };

  const loadHistory = async () => {
    try {
      const contract = await ensureContractAddress();
      const res = await listEvents({ app_id: APP_ID, event_name: "MemoryBuried", limit: 20 });
      const entries = await Promise.all(
        res.events.map(async (evt) => {
          const evtRecord = evt as unknown as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
          const memoryId = String(values[0] ?? evt.id);
          let contentHash = String(values[2] ?? "");
          let forgotten = false;
          if (memoryId) {
            try {
              const parsed = await read("getMemoryDetails", [{ type: "Integer", value: memoryId }]);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const detail = parsed as Record<string, unknown>;
                forgotten = Boolean(detail.forgotten);
                if (!forgotten && detail.contentHash) {
                  contentHash = String(detail.contentHash);
                }
              }
            } catch {
              /* Individual memory detail fetch failure -- skip enrichment */
            }
          }
          return {
            id: memoryId,
            hash: contentHash,
            time: new Date(evt.created_at || Date.now()).toLocaleString(),
            forgotten,
          };
        })
      );
      history.value = entries;
    } catch (e: unknown) {
      /* non-critical: graveyard history fetch */
    }
  };

  const forgetMemory = async (item: HistoryItem) => {
    if (!item.id || item.forgotten) return;
    if (isLoading.value || forgettingId.value) return;

    const confirmed = await new Promise<boolean>((resolve) => {
      uni.showModal({
        title: t("forgetConfirmTitle"),
        content: t("forgetConfirmText"),
        confirmText: t("forgetAction"),
        cancelText: t("cancel"),
        success: (res) => resolve(Boolean(res.confirm)),
        fail: () => resolve(false),
      });
    });

    if (!confirmed) return;

    forgettingId.value = item.id;
    try {
      await ensureWallet();

      await invoke("1", `graveyard:forget:${item.id}`, "ForgetMemory", [
        { type: "Hash160", value: address.value as string },
        { type: "Integer", value: String(item.id) },
      ]);

      history.value = history.value.map((entry) => (entry.id === item.id ? { ...entry, forgotten: true } : entry));
      setStatus(t("forgetSuccess"), "success");
    } catch (e: unknown) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      forgettingId.value = null;
    }
  };

  const cleanupTimers = () => {
    if (shakeTimer) {
      clearTimeout(shakeTimer);
      shakeTimer = null;
    }
  };

  return {
    // State
    totalDestroyed,
    gasReclaimed,
    assetHash,
    memoryType,
    status,
    history,
    showConfirm,
    isDestroying,
    showWarningShake,
    forgettingId,
    memoryTypeOptions,
    // Actions
    initiateDestroy,
    executeDestroy,
    loadStats,
    loadHistory,
    forgetMemory,
    cleanupTimers,
  };
}
