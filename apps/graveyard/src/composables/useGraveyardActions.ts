import { createObservable, createDerived, refToObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { useEvents } from "@shared/utils/wallet-sdk";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { parseStackItem } from "@shared/utils/neo";
import { useContractInteraction } from "@shared/composables/useContractInteraction";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { formatErrorMessage } from "@shared/utils/errorHandling";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { waitForListedEventByTransaction } from "@shared/utils/transaction";
import type { HistoryItem } from "@/types";

const APP_ID = "miniapp-graveyard";

export function useGraveyardActions() {
  const { t } = createUseI18n(messages)();
  const ci = useContractInteraction({ appId: APP_ID, t });
  const address = refToObservable(ci.address);
  const contractAddress = refToObservable(ci.contractAddress);
  const isLoading = refToObservable(ci.isProcessing);
  const { ensureWallet, read, invokeDirectly, ensureContractAddress } = ci;
  const { list: listEvents } = useEvents();

  const totalDestroyed = createObservable(0);
  const gasReclaimed = createObservable(0);
  const assetHash = createObservable("");
  const memoryType = createObservable(1);
  const sm = useStatusMessage();
  const status = refToObservable(sm.status);
  const { setStatus } = sm;
  const history = createObservable<HistoryItem[]>([]);
  const showConfirm = createObservable(false);
  const isDestroying = createObservable(false);
  const showWarningShake = createObservable(false);
  const forgettingId = createObservable<string | null>(null);
  const memoryTypeOptions = createDerived(() => [
    { value: 1, label: t("memoryTypeSecret") },
    { value: 2, label: t("memoryTypeRegret") },
    { value: 3, label: t("memoryTypeWish") },
    { value: 4, label: t("memoryTypeConfession") },
    { value: 5, label: t("memoryTypeOther") },
  ], []);
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;

  const initiateDestroy = () => {
    if (!assetHash.get()) {
      setStatus(t("enterAssetHash"), "error");
      showWarningShake.set(true);
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => {
        showWarningShake.set(false);
        shakeTimer = null;
      }, 500);
      return;
    }
    showConfirm.set(true);
  };

  const executeDestroy = async () => {
    showConfirm.set(false);
    if (isLoading.get() || isDestroying.get()) return;
    isDestroying.set(true);

    try {
      await ensureWallet();
      const contract = await ensureContractAddress();

      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Hash160", value: contract },
          { type: "Integer", value: "10000000" },
          { type: "String", value: `graveyard:bury:${assetHash.get().slice(0, 10)}` },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      const result = await invokeDirectly("BuryMemory", [
        { type: "Hash160", value: address.get() as string },
          { type: "String", value: assetHash.get() },
          { type: "Integer", value: String(memoryType.get()) },
      ], contract);

      const evt = await waitForListedEventByTransaction<{ created_at?: string; state?: unknown[]; tx_hash?: string }>(result.tx, {
        listEvents: async () => {
          const res = await listEvents({ app_id: APP_ID, event_name: "MemoryBuried", limit: 20 });
          return res.events || [];
        },
        timeoutMs: 30000,
        pollIntervalMs: 1500,
        errorMessage: t("buryPending"),
      });
      if (!evt) throw new Error(t("buryPending"));

      const evtRecord = evt as unknown as Record<string, unknown>;
      const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
      const memoryId = String(values[0] ?? "");
      const contentHash = String(values[2] ?? assetHash.get());
      history.set([{
        id: memoryId || String(Date.now()),
        hash: contentHash,
        time: new Intl.DateTimeFormat(undefined).format(new Date(evt.created_at || Date.now())),
        forgotten: false,
      }, ...history.get()]);

      totalDestroyed.set(totalDestroyed.get() + 1);
      gasReclaimed.set(Number((totalDestroyed.get() * 0.1).toFixed(2)));
      setStatus(t("memoryBuried"), "success");
      assetHash.set("");
    } catch (e) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      isDestroying.set(false);
    }
  };

  const loadStats = async () => {
    if (!contractAddress.get()) {
      await ensureContractAddress();
    }
    if (!contractAddress.get()) return;
    try {
      const parsed = await read("getPlatformStats");
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        const stats = parsed as Record<string, unknown>;
        const total = Number(stats.totalBuried ?? stats.totalMemories ?? 0);
        const fee = Number(stats.buryFee ?? 0);
        totalDestroyed.set(Number.isFinite(total) ? total : 0);
        if (Number.isFinite(fee) && fee > 0) {
          gasReclaimed.set(Number(((totalDestroyed.get() * fee) / 1e8).toFixed(2)));
        } else {
          gasReclaimed.set(Number((totalDestroyed.get() * 0.1).toFixed(2)));
        }
        return;
      }
      const totalResult = await read("totalMemories");
      totalDestroyed.set(Number(totalResult || 0));
      gasReclaimed.set(Number((totalDestroyed.get() * 0.1).toFixed(2)));
    } catch (_e) {
      console.warn("[useGraveyardActions] stats fetch failed:", _e instanceof Error ? _e.message : String(_e));
      setStatus(t("loadFailed") || "Failed to load stats", "error");
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
            } catch (_e) {
              console.warn("[useGraveyardActions] memory detail fetch failed, skipping enrichment:", _e instanceof Error ? _e.message : String(_e));
            }
          }
          return {
            id: memoryId,
            hash: contentHash,
            time: new Intl.DateTimeFormat(undefined).format(new Date(evt.created_at || Date.now())),
            forgotten,
          };
        })
      );
      history.set(entries);
    } catch (_e) {
      console.warn("[useGraveyardActions] history fetch failed:", _e instanceof Error ? _e.message : String(_e));
      setStatus(t("loadFailed") || "Failed to load history", "error");
    }
  };

  const forgetMemory = async (item: HistoryItem) => {
    if (!item.id || item.forgotten) return;
    if (isLoading.get() || forgettingId.get()) return;

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

    forgettingId.set(item.id);
    try {
      await ensureWallet();
      const contract = await ensureContractAddress();

      await invokeDirectly(
        "transfer",
        [
          { type: "Hash160", value: address.get() as string },
          { type: "Hash160", value: contract },
          { type: "Integer", value: "100000000" },
          { type: "String", value: `${APP_ID}:forget:${item.id}` },
        ],
        BLOCKCHAIN_CONSTANTS.GAS_HASH,
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      const result = await invokeDirectly("ForgetMemory", [
        { type: "Hash160", value: address.get() as string },
        { type: "Integer", value: String(item.id) },
      ], contract);

      await waitForListedEventByTransaction<{ tx_hash?: string }>(result.tx, {
        listEvents: async () => {
          const res = await listEvents({ app_id: APP_ID, event_name: "MemoryForgotten", limit: 20 });
          return res.events || [];
        },
        timeoutMs: 30000,
        pollIntervalMs: 1500,
        errorMessage: t("error"),
      });

      history.set(history.get().map((entry) => (entry.id === item.id ? { ...entry, forgotten: true } : entry)));
      setStatus(t("forgetSuccess"), "success");
    } catch (e) {
      setStatus(formatErrorMessage(e, t("error")), "error");
    } finally {
      forgettingId.set(null);
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
