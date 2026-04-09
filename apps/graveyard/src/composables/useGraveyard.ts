/**
 * useGraveyard — Domain logic for the Graveyard miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (NFTProxy, StorageProxy, BadgeProxy) via edge functions.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("getPlatformStats")
 *     chain.read("totalMemories")
 *     chain.listEvents("MemoryBuried", { limit: 20 })
 *     chain.read("getMemoryDetails", [...])
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("BuryMemory", [...], { waitForEvent: "MemoryBuried" })
 *     chain.invoke("ForgetMemory", [...], { waitForEvent: "MemoryForgotten" })
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     storageService.get("stats")
 *     storageService.list("history:", 20)
 *     storageService.get("memory:<id>")
 *     nftService.burn(assetHash)            — bury memory (fee + destroy)
 *     storageService.set("forget:<id>", {}) — forget memory (fee + forget)
 *     badgeService.award("memory-buried", "")
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { NFTProxy } from "@shared/services/os/NFTProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import type { HistoryItem } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface UseGraveyardOptions {
  /** OS NFTProxy instance from ctx.os.nft */
  nftService: NFTProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** EventBus for UI events */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Helpers
// ============================================================================

interface StoredHistoryItem {
  id: string;
  hash: string;
  time: string;
  forgotten: boolean;
}

interface StoredStats {
  totalBuried?: number;
  totalMemories?: number;
  buryFee?: number;
}

// ============================================================================
// Composable
// ============================================================================

export function useGraveyard({
  nftService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseGraveyardOptions) {
  const totalDestroyed = createObservable(0);
  const gasReclaimed = createObservable(0);
  const assetHash = createObservable("");
  const memoryType = createObservable(1);
  const history = createObservable<HistoryItem[]>([]);
  const showConfirm = createObservable(false);
  const isDestroying = createObservable(false);
  const showWarningShake = createObservable(false);
  const forgettingId = createObservable<string | null>(null);
  const isLoading = createObservable(false);
  let shakeTimer: ReturnType<typeof setTimeout> | null = null;

  const memoryTypeOptions = createDerived(() => [
    { value: 1, label: t("memoryTypeSecret") },
    { value: 2, label: t("memoryTypeRegret") },
    { value: 3, label: t("memoryTypeWish") },
    { value: 4, label: t("memoryTypeConfession") },
    { value: 5, label: t("memoryTypeOther") },
  ], []);

  const gasReclaimedDisplay = createDerived(() => `${gasReclaimed.get()} ${t("tokenGas")}`, []);
  const historyCount = createDerived(() => history.get().length, []);

  const initiateDestroy = () => {
    if (!assetHash.get()) {
      showWarningShake.set(true);
      if (shakeTimer) clearTimeout(shakeTimer);
      shakeTimer = setTimeout(() => { showWarningShake.set(false); shakeTimer = null; }, 500);
      throw new Error(t("enterAssetHash"));
    }
    showConfirm.set(true);
  };

  // ── Actions (via OS services) ──────────────────────────────────────

  /**
   * Bury a memory via NFTProxy.burn().
   * The edge function handles the GAS fee transfer + BuryMemory contract call.
   */
  const executeDestroy = async () => {
    showConfirm.set(false);
    if (isDestroying.get()) return;
    isDestroying.set(true);

    try {
      // Burn the asset via NFTProxy — the edge function handles
      // the fee transfer and BuryMemory contract call
      await nftService.burn(assetHash.get());

      // Record the burial in history
      const memoryId = String(Date.now());
      history.set([{
        id: memoryId,
        hash: assetHash.get(),
        time: new Intl.DateTimeFormat(undefined).format(new Date()),
        forgotten: false,
      }, ...history.get()]);

      totalDestroyed.set(totalDestroyed.get() + 1);
      gasReclaimed.set(Number((totalDestroyed.get() * 0.1).toFixed(2)));
      eventBus.emit("graveyard:buried", { action: t("memoryBuried") });

      // Hint badge for memory buried (fire-and-forget)
      badgeService.award("memory-buried", "").catch(() => {});

      assetHash.set("");
    } catch (e) {
      eventBus.emit("graveyard:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isDestroying.set(false);
    }
  };

  // ── Data Loading (via StorageProxy) ────────────────────────────────

  /**
   * Load platform stats via StorageProxy.get().
   */
  const loadStats = async () => {
    try {
      const data = await storageService.get("stats") as StoredStats | null;
      if (data && typeof data === "object") {
        const total = Number(data.totalBuried ?? data.totalMemories ?? 0);
        const fee = Number(data.buryFee ?? 0);
        totalDestroyed.set(Number.isFinite(total) ? total : 0);
        if (Number.isFinite(fee) && fee > 0) {
          gasReclaimed.set(Number(((totalDestroyed.get() * fee) / 1e8).toFixed(2)));
        } else {
          gasReclaimed.set(Number((totalDestroyed.get() * 0.1).toFixed(2)));
        }
      }
    } catch (_e) {
      console.warn("[useGraveyard] stats fetch failed:", _e instanceof Error ? _e.message : String(_e));
    }
  };

  /**
   * Load burial history via StorageProxy.list().
   */
  const loadHistory = async () => {
    try {
      const historyMap = await storageService.list("history:", 20);
      const entries: HistoryItem[] = [];
      if (historyMap && typeof historyMap === "object") {
        for (const [, value] of Object.entries(historyMap)) {
          const stored = value as StoredHistoryItem;
          if (stored && stored.id) {
            entries.push({
              id: String(stored.id),
              hash: String(stored.hash || ""),
              time: String(stored.time || ""),
              forgotten: Boolean(stored.forgotten),
            });
          }
        }
      }
      history.set(entries);
    } catch (_e) {
      console.warn("[useGraveyard] history fetch failed:", _e instanceof Error ? _e.message : String(_e));
    }
  };

  /**
   * Forget a memory via StorageProxy.set().
   * The edge function handles the GAS fee transfer + ForgetMemory contract call.
   */
  const forgetMemory = async (item: HistoryItem) => {
    if (!item.id || item.forgotten || forgettingId.get()) return;

    forgettingId.set(item.id);
    try {
      await storageService.set(`forget:${item.id}`, {
        memoryId: item.id,
        action: "forget",
      });

      history.set(history.get().map((entry) => entry.id === item.id ? { ...entry, forgotten: true } : entry));
      eventBus.emit("graveyard:forgotten", { action: t("forgetSuccess") });
    } catch (e) {
      eventBus.emit("graveyard:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      forgettingId.set(null);
    }
  };

  // ── Load All ────────────────────────────────────────────────────────

  const loadAll = async () => {
    isLoading.set(true);
    try {
      await loadStats();
      await loadHistory();
    } finally {
      isLoading.set(false);
    }
  };

  const cleanupTimers = () => {
    if (shakeTimer) { clearTimeout(shakeTimer); shakeTimer = null; }
  };
  return {
    totalDestroyed, gasReclaimed, assetHash, memoryType, history,
    showConfirm, isDestroying, showWarningShake, forgettingId, isLoading,
    memoryTypeOptions, gasReclaimedDisplay, historyCount,
    initiateDestroy, executeDestroy, loadStats, loadHistory, forgetMemory,
    loadAll, cleanupTimers,
  };
}

export type UseGraveyardReturn = ReturnType<typeof useGraveyard>;
