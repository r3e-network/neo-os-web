/**
 * useGraveyard — Domain logic for the Graveyard miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 */

import { ref, computed, onUnmounted } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { HistoryItem } from "../types";

const APP_ID = "miniapp-graveyard";

export interface UseGraveyardOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

export function useGraveyard({ chain, eventBus, t }: UseGraveyardOptions) {
  const totalDestroyed = ref(0);
  const gasReclaimed = ref(0);
  const assetHash = ref("");
  const memoryType = ref(1);
  const history = ref<HistoryItem[]>([]);
  const showConfirm = ref(false);
  const isDestroying = ref(false);
  const showWarningShake = ref(false);
  const forgettingId = ref<string | null>(null);
  const isLoading = ref(false);
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;

  const memoryTypeOptions = computed(() => [
    { value: 1, label: t("memoryTypeSecret") },
    { value: 2, label: t("memoryTypeRegret") },
    { value: 3, label: t("memoryTypeWish") },
    { value: 4, label: t("memoryTypeConfession") },
    { value: 5, label: t("memoryTypeOther") },
  ]);

  const gasReclaimedDisplay = computed(() => `${gasReclaimed.value} ${t("tokenGas")}`);
  const historyCount = computed(() => history.value.length);

  const initiateDestroy = () => {
    if (!assetHash.value) {
      showWarningShake.value = true;
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => { showWarningShake.value = false; shakeTimer = null; }, 500);
      throw new Error(t("enterAssetHash"));
    }
    showConfirm.value = true;
  };

  const executeDestroy = async () => {
    showConfirm.value = false;
    if (isDestroying.value) return;
    isDestroying.value = true;

    try {
      await chain.ensureWallet();

      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: "10000000" },
          { type: "String", value: `graveyard:bury:${assetHash.value.slice(0, 10)}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      const result = await chain.invoke(
        "BuryMemory",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "String", value: assetHash.value },
          { type: "Integer", value: String(memoryType.value) },
        ],
        { waitForEvent: "MemoryBuried" },
      );

      if (result.event) {
        const evtRecord = result.event as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
        const memoryId = String(values[0] ?? "");
        const contentHash = String(values[2] ?? assetHash.value);
        history.value.unshift({
          id: memoryId || String(Date.now()),
          hash: contentHash,
          time: new Intl.DateTimeFormat(undefined).format(new Date()),
          forgotten: false,
        });
      }

      totalDestroyed.value += 1;
      gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
      eventBus.emit("graveyard:buried", { action: t("memoryBuried") });
      assetHash.value = "";
    } catch (e) {
      eventBus.emit("graveyard:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isDestroying.value = false;
    }
  };

  const loadStats = async () => {
    try {
      const parsed = await chain.read("getPlatformStats");
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
      const totalResult = await chain.read("totalMemories");
      totalDestroyed.value = Number(totalResult || 0);
      gasReclaimed.value = Number((totalDestroyed.value * 0.1).toFixed(2));
    } catch (_e) {
      console.warn("[useGraveyard] stats fetch failed:", _e instanceof Error ? _e.message : String(_e));
    }
  };

  const loadHistory = async () => {
    try {
      const events = await chain.listEvents("MemoryBuried", { limit: 20 });
      const entries = await Promise.all(
        events.map(async (evt: unknown) => {
          const evtRecord = evt as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state) ? (evtRecord.state as unknown[]).map(parseStackItem) : [];
          const memoryId = String(values[0] ?? evtRecord.id);
          let contentHash = String(values[2] ?? "");
          let forgotten = false;
          if (memoryId) {
            try {
              const parsed = await chain.read("getMemoryDetails", [{ type: "Integer", value: memoryId }]);
              if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                const detail = parsed as Record<string, unknown>;
                forgotten = Boolean(detail.forgotten);
                if (!forgotten && detail.contentHash) contentHash = String(detail.contentHash);
              }
            } catch (_e) {
              // non-critical enrichment
            }
          }
          return {
            id: memoryId,
            hash: contentHash,
            time: new Intl.DateTimeFormat(undefined).format(new Date((evtRecord.created_at as string) || Date.now())),
            forgotten,
          };
        })
      );
      history.value = entries;
    } catch (_e) {
      console.warn("[useGraveyard] history fetch failed:", _e instanceof Error ? _e.message : String(_e));
    }
  };

  const forgetMemory = async (item: HistoryItem) => {
    if (!item.id || item.forgotten || forgettingId.value) return;

    forgettingId.value = item.id;
    try {
      await chain.ensureWallet();

      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: "100000000" },
          { type: "String", value: `${APP_ID}:forget:${item.id}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, 4000));

      await chain.invoke(
        "ForgetMemory",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: String(item.id) },
        ],
        { waitForEvent: "MemoryForgotten" },
      );

      history.value = history.value.map((entry) => entry.id === item.id ? { ...entry, forgotten: true } : entry);
      eventBus.emit("graveyard:forgotten", { action: t("forgetSuccess") });
    } catch (e) {
      eventBus.emit("graveyard:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      forgettingId.value = null;
    }
  };

  const loadAll = async () => {
    isLoading.value = true;
    try {
      await loadStats();
      await loadHistory();
    } finally {
      isLoading.value = false;
    }
  };

  const cleanupTimers = () => {
    if (shakeTimer) { clearTimeout(shakeTimer); shakeTimer = null; }
  };

  onUnmounted(() => cleanupTimers());

  return {
    totalDestroyed, gasReclaimed, assetHash, memoryType, history,
    showConfirm, isDestroying, showWarningShake, forgettingId, isLoading,
    memoryTypeOptions, gasReclaimedDisplay, historyCount,
    initiateDestroy, executeDestroy, loadStats, loadHistory, forgetMemory,
    loadAll, cleanupTimers,
  };
}

export type UseGraveyardReturn = ReturnType<typeof useGraveyard>;
