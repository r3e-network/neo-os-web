/**
 * useMemorialShrine — Domain logic for the Memorial Shrine miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Contains memorial browsing, creation, and tribute payment logic.
 */

import { ref, computed, onUnmounted } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { readQueryParam } from "@shared/utils/url";
import type { Memorial } from "../types";

// ============================================================================
// Constants
// ============================================================================

const WAIT_AFTER_TRANSFER_MS = 4000;

// ============================================================================
// Types
// ============================================================================

export interface UseMemorialShrineOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useMemorialShrine({ chain, eventBus, t }: UseMemorialShrineOptions) {
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
  // Read: load memorials
  // ------------------------------------------

  const loadMemorials = async () => {
    // Placeholder: In production this would call chain.read or chain.listEvents
    memorials.value = [
      { id: 1, name: "\u5F20\u5FB7\u660E", photoHash: "", birthYear: 1938, deathYear: 2024, relationship: "\u7236\u4EB2", biography: "\u4E00\u751F\u52E4\u52B3\u6734\u5B9E\uFF0C\u70ED\u7231\u5BB6\u5EAD\u3002", obituary: "", hasRecentTribute: true, offerings: { incense: 128, candle: 45, flower: 56, fruit: 34, wine: 12, feast: 3 } },
      { id: 2, name: "\u674E\u6DD1\u82AC", photoHash: "", birthYear: 1942, deathYear: 2023, relationship: "\u6BCD\u4EB2", biography: "\u6148\u6BCD\u4E00\u751F\u4E3A\u5BB6\u5EAD\u5949\u732E\u3002", obituary: "", hasRecentTribute: true, offerings: { incense: 89, candle: 32, flower: 67, fruit: 21, wine: 8, feast: 2 } },
      { id: 3, name: "\u738B\u5EFA\u56FD", photoHash: "", birthYear: 1950, deathYear: 2022, relationship: "\u7237\u7237", biography: "\u8001\u9769\u547D\uFF0C\u4E00\u751F\u6B63\u76F4\u3002", obituary: "", hasRecentTribute: false, offerings: { incense: 56, candle: 23, flower: 34, fruit: 12, wine: 5, feast: 1 } },
    ];
    recentObituaries.value = [
      { id: 1, name: "\u5F20\u8001\u5148\u751F", text: "\u5F20\u8001\u5148\u751F\u4E8E2024\u5E741\u6708\u9A7E\u9E64\u897F\u53BB" },
      { id: 2, name: "\u674E\u5976\u5976", text: "\u6148\u6BCD\u674E\u5976\u5976\u5B89\u8BE6\u79BB\u4E16" },
    ];
  };

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
  // Write: create memorial
  // ------------------------------------------

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
      const addr = await chain.ensureWallet();
      await chain.invoke("createMemorial", [
        { type: "Hash160", value: addr },
        { type: "String", value: form.name },
        { type: "String", value: form.photoHash },
        { type: "String", value: form.relationship },
        { type: "Integer", value: String(form.birthYear || 0) },
        { type: "Integer", value: String(form.deathYear || 0) },
        { type: "String", value: form.biography },
        { type: "String", value: form.obituary },
      ]);
      eventBus.emit("memorial:created", { name: form.name });
      await loadMemorials();
    } finally {
      isSubmitting.value = false;
    }
  };

  // ------------------------------------------
  // Write: pay tribute (GAS transfer + contract call)
  // ------------------------------------------

  const payTribute = async (
    memorialId: number,
    offeringType: number,
    offeringCost: number,
    message: string,
  ) => {
    if (isPaying.value) return;
    isPaying.value = true;
    try {
      const addr = await chain.ensureWallet();
      const contractAddr = chain.contractAddress.value;
      if (!contractAddr) throw new Error(t("contractUnavailable"));

      const offeringAmount = String(Math.round(Number(offeringCost) * 1e8));

      // Step 1: Transfer GAS to the contract with a memo
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: addr },
          { type: "Hash160", value: contractAddr },
          { type: "Integer", value: offeringAmount },
          { type: "String", value: `miniapp-memorial-shrine:tribute:${memorialId}:${offeringType}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_TRANSFER_MS));

      // Step 2: Call PayTribute on the contract
      await chain.invoke("PayTribute", [
        { type: "Hash160", value: addr },
        { type: "Integer", value: String(memorialId) },
        { type: "Integer", value: String(offeringType) },
        { type: "String", value: message },
      ]);

      eventBus.emit("tribute:paid", { memorialId, offeringType });

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
