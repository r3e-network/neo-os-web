/**
 * useMemorialShrine — Domain logic for the Memorial Shrine miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (NFTProxy, StorageProxy, BadgeProxy) via edge functions.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.invoke("createMemorial", [...])
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("PayTribute", [...])
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     nftService.mint({ type: "memorial", ...form })
 *     storageService.list("memorials:", 50)
 *     storageService.set("tribute:<memorialId>", { ... })
 *     storageService.list("obituaries:", 20)
 *     badgeService.award("memorial-creator", "")
 */

import { ref, computed, onUnmounted } from "vue";
import type { NFTProxy } from "@shared/services/os/NFTProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { readQueryParam } from "@shared/utils/url";
import type { Memorial } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface UseMemorialShrineOptions {
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
// Composable
// ============================================================================

export function useMemorialShrine({
  nftService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseMemorialShrineOptions) {
  const memorials = ref<Memorial[]>([]);
  const visitedMemorials = ref<Memorial[]>([]);
  const recentObituaries = ref<{ id: number; name: string; text: string }[]>([]);
  const selectedMemorial = ref<Memorial | null>(null);
  const shareStatus = ref<string | null>(null);
  const isSubmitting = ref(false);
  const isPaying = ref(false);
  let shareStatusTimer: ReturnType<typeof setTimeout> | null = null;

  const memorialCount = computed(() => memorials.value.length);
  const tributeCount = computed(() => visitedMemorials.value.length);
  const obituaryCount = computed(() => recentObituaries.value.length);

  // ------------------------------------------
  // Read: load memorials (via StorageProxy)
  // ------------------------------------------

  const loadMemorials = async () => {
    try {
      const memorialMap = await storageService.list("memorials:", 50);
      if (memorialMap && typeof memorialMap === "object") {
        const items: Memorial[] = [];
        for (const [, value] of Object.entries(memorialMap)) {
          const stored = value as Memorial;
          if (stored && stored.id) {
            items.push(stored);
          }
        }
        memorials.value = items.length > 0 ? items : getDefaultMemorials();
      } else {
        memorials.value = getDefaultMemorials();
      }
    } catch (_e) {
      memorials.value = getDefaultMemorials();
    }

    try {
      const obituaryMap = await storageService.list("obituaries:", 20);
      if (obituaryMap && typeof obituaryMap === "object") {
        const items: { id: number; name: string; text: string }[] = [];
        for (const [, value] of Object.entries(obituaryMap)) {
          const stored = value as { id: number; name: string; text: string };
          if (stored && stored.id) items.push(stored);
        }
        recentObituaries.value = items.length > 0 ? items : getDefaultObituaries();
      } else {
        recentObituaries.value = getDefaultObituaries();
      }
    } catch (_e) {
      recentObituaries.value = getDefaultObituaries();
    }
  };

  const getDefaultMemorials = (): Memorial[] => [
    { id: 1, name: "\u5F20\u5FB7\u660E", photoHash: "", birthYear: 1938, deathYear: 2024, relationship: "\u7236\u4EB2", biography: "\u4E00\u751F\u52E4\u52B3\u6734\u5B9E\uFF0C\u70ED\u7231\u5BB6\u5EAD\u3002", obituary: "", hasRecentTribute: true, offerings: { incense: 128, candle: 45, flower: 56, fruit: 34, wine: 12, feast: 3 } },
    { id: 2, name: "\u674E\u6DD1\u82AC", photoHash: "", birthYear: 1942, deathYear: 2023, relationship: "\u6BCD\u4EB2", biography: "\u6148\u6BCD\u4E00\u751F\u4E3A\u5BB6\u5EAD\u5949\u732E\u3002", obituary: "", hasRecentTribute: true, offerings: { incense: 89, candle: 32, flower: 67, fruit: 21, wine: 8, feast: 2 } },
    { id: 3, name: "\u738B\u5EFA\u56FD", photoHash: "", birthYear: 1950, deathYear: 2022, relationship: "\u7237\u7237", biography: "\u8001\u9769\u547D\uFF0C\u4E00\u751F\u6B63\u76F4\u3002", obituary: "", hasRecentTribute: false, offerings: { incense: 56, candle: 23, flower: 34, fruit: 12, wine: 5, feast: 1 } },
  ];

  const getDefaultObituaries = () => [
    { id: 1, name: "\u5F20\u8001\u5148\u751F", text: "\u5F20\u8001\u5148\u751F\u4E8E2024\u5E741\u6708\u9A7E\u9E64\u897F\u53BB" },
    { id: 2, name: "\u674E\u5976\u5976", text: "\u6148\u6BCD\u674E\u5976\u5976\u5B89\u8BE6\u79BB\u4E16" },
  ];

  const loadVisitedMemorials = async () => {
    visitedMemorials.value = memorials.value.slice(0, 2);
  };

  // ------------------------------------------
  // Navigation
  // ------------------------------------------

  const openMemorial = (id: number) => {
    const memorial = memorials.value.find((m) => m.id === id);
    if (memorial) {
      selectedMemorial.value = memorial;
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("id", String(id));
        window.history.replaceState({}, "", url.toString());
      }
    }
  };

  const closeMemorial = () => {
    selectedMemorial.value = null;
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const shareMemorial = (memorial?: Memorial) => {
    const target = memorial || selectedMemorial.value;
    if (!target || typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}${window.location.pathname}?id=${target.id}`;
    if (navigator.share) {
      navigator.share({ title: `${target.name} - ${t("title")}`, text: `${t("tagline")} | ${target.name} (${target.birthYear}-${target.deathYear})`, url: shareUrl })
        .catch(() => { /* fallback handled silently */ });
    }
  };

  const checkUrlForMemorial = async () => {
    const idParam = readQueryParam("id");
    if (idParam) {
      const id = parseInt(idParam, 10);
      if (!isNaN(id)) {
        await loadMemorials();
        const memorial = memorials.value.find((m) => m.id === id);
        if (memorial) selectedMemorial.value = memorial;
      }
    }
  };

  // ------------------------------------------
  // Write: create memorial (via NFTProxy)
  // ------------------------------------------

  /**
   * Create a memorial via NFTProxy.mint() with soulbound metadata.
   * The edge function handles the createMemorial contract call and
   * stores the memorial data via storage.
   */
  const createMemorial = async (form: {
    name: string;
    photoHash: string;
    relationship: string;
    birthYear: number;
    deathYear: number;
    biography: string;
    obituary: string;
  }) => {
    if (isSubmitting.value) return;
    isSubmitting.value = true;
    try {
      await nftService.mint({
        type: "memorial",
        soulbound: true,
        name: form.name,
        photoHash: form.photoHash,
        relationship: form.relationship,
        birthYear: form.birthYear,
        deathYear: form.deathYear,
        biography: form.biography,
        obituary: form.obituary,
      });

      eventBus.emit("memorial:created", { name: form.name });

      // Hint badge for memorial creator (fire-and-forget)
      badgeService.award("memorial-creator", "").catch(() => {});

      await loadMemorials();
    } finally {
      isSubmitting.value = false;
    }
  };

  // ------------------------------------------
  // Write: pay tribute (via StorageProxy)
  // ------------------------------------------

  /**
   * Pay tribute via StorageProxy.set().
   * The edge function handles the GAS transfer + PayTribute contract call.
   */
  const payTribute = async (
    memorialId: number,
    offeringType: number,
    offeringCost: number,
    message: string,
  ) => {
    if (isPaying.value) return;
    isPaying.value = true;
    try {
      await storageService.set(`tribute:${memorialId}`, {
        memorialId,
        offeringType,
        offeringCost,
        message,
      });

      eventBus.emit("tribute:paid", { memorialId, offeringType });

      // Hint badge for tribute payer (fire-and-forget)
      badgeService.award("tribute-payer", "").catch(() => {});

      // Reload and update selected memorial
      await loadMemorials();
      if (selectedMemorial.value?.id === memorialId) {
        selectedMemorial.value = memorials.value.find((m) => m.id === memorialId) || null;
      }
    } finally {
      isPaying.value = false;
    }
  };

  // ------------------------------------------
  // Load all
  // ------------------------------------------

  const loadAll = async () => {
    await loadMemorials();
    await checkUrlForMemorial();
    await loadVisitedMemorials();
  };

  const cleanupTimers = () => {
    if (shareStatusTimer) { clearTimeout(shareStatusTimer); shareStatusTimer = null; }
  };

  onUnmounted(() => cleanupTimers());

  return {
    // State
    memorials, visitedMemorials, recentObituaries, selectedMemorial, shareStatus,
    isSubmitting, isPaying,
    memorialCount, tributeCount, obituaryCount,

    // Navigation
    loadMemorials, loadVisitedMemorials, openMemorial, closeMemorial,
    shareMemorial, checkUrlForMemorial,

    // Write actions
    createMemorial, payTribute,

    // Lifecycle
    loadAll, cleanupTimers,
  };
}

export type UseMemorialShrineReturn = ReturnType<typeof useMemorialShrine>;
