/**
 * useMemorialShrine — Domain logic for the Memorial Shrine miniapp
 *
 * Writes go through the MiniApp contract so the play area is a real wallet
 * workflow, while reads keep the storage fallback used by the current host.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService, ContractArg, TxResult } from "@shared/services";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { readQueryParam } from "@shared/utils/url";
import type { Memorial } from "../types";

const APP_ID = "miniapp-memorial-shrine";
const FIXED8_DECIMALS = 100000000n;

const OFFERING_COSTS_FIXED8: Record<number, bigint> = {
  1: 1000000n,
  2: 2000000n,
  3: 3000000n,
  4: 5000000n,
  5: 10000000n,
  6: 50000000n,
};

function fixed8ToGas(value: bigint): string {
  const whole = value / FIXED8_DECIMALS;
  const fraction = (value % FIXED8_DECIMALS)
    .toString()
    .padStart(8, "0")
    .replace(/0+$/, "");
  return `${whole.toString()}${fraction ? `.${fraction}` : ""}`;
}

function normalizeText(value: unknown, maxLength: number): string {
  return String(value ?? "").trim().slice(0, maxLength);
}

function eventValue(event: unknown, index: number): unknown {
  if (!event || typeof event !== "object") return undefined;
  const state = (event as { state?: unknown }).state;
  if (!Array.isArray(state)) return undefined;
  const item = state[index];
  return item && typeof item === "object" && "value" in item
    ? (item as { value?: unknown }).value
    : item;
}

// ============================================================================
// Types
// ============================================================================

export interface UseMemorialShrineOptions {
  /** Chain service used to submit wallet-confirmed memorial writes. */
  chainService: ChainService;
  /** Network inferred from launch params; mainnet tribute requires receipt ID. */
  launchNetwork?: "mainnet" | "testnet" | null;
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
  chainService,
  launchNetwork,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseMemorialShrineOptions) {
  const memorials = createObservable<Memorial[]>([]);
  const visitedMemorials = createObservable<Memorial[]>([]);
  const recentObituaries = createObservable<{ id: number; name: string; text: string }[]>([]);
  const selectedMemorial = createObservable<Memorial | null>(null);
  const shareStatus = createObservable<string | null>(null);
  const isSubmitting = createObservable(false);
  const isPaying = createObservable(false);
  const lastTx = createObservable<TxResult | null>(null);
  let shareStatusTimer: ReturnType<typeof setTimeout> | null = null;

  const memorialCount = createDerived(() => memorials.get().length, []);
  const tributeCount = createDerived(() => visitedMemorials.get().length, []);
  const obituaryCount = createDerived(() => recentObituaries.get().length, []);

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
        memorials.set(items.length > 0 ? items : getDefaultMemorials());
      } else {
        memorials.set(getDefaultMemorials());
      }
    } catch (_e) {
      memorials.set(getDefaultMemorials());
    }

    try {
      const obituaryMap = await storageService.list("obituaries:", 20);
      if (obituaryMap && typeof obituaryMap === "object") {
        const items: { id: number; name: string; text: string }[] = [];
        for (const [, value] of Object.entries(obituaryMap)) {
          const stored = value as { id: number; name: string; text: string };
          if (stored && stored.id) items.push(stored);
        }
        recentObituaries.set(items.length > 0 ? items : getDefaultObituaries());
      } else {
        recentObituaries.set(getDefaultObituaries());
      }
    } catch (_e) {
      recentObituaries.set(getDefaultObituaries());
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
    visitedMemorials.set(memorials.get().slice(0, 2));
  };

  // ------------------------------------------
  // Navigation
  // ------------------------------------------

  const openMemorial = (id: number) => {
    const memorial = memorials.get().find((m) => m.id === id);
    if (memorial) {
      selectedMemorial.set(memorial);
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        url.searchParams.set("id", String(id));
        window.history.replaceState({}, "", url.toString());
      }
    }
  };

  const closeMemorial = () => {
    selectedMemorial.set(null);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete("id");
      window.history.replaceState({}, "", url.toString());
    }
  };

  const shareMemorial = (memorial?: Memorial) => {
    const target = memorial || selectedMemorial.get();
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
        const memorial = memorials.get().find((m) => m.id === id);
        if (memorial) selectedMemorial.set(memorial);
      }
    }
  };

  // ------------------------------------------
  // Write: create memorial (direct MiniApp contract)
  // ------------------------------------------

  /**
   * Create a memorial directly on the MiniApp contract. The wallet signs the
   * `createMemorial` invocation and the UI listens for `MemorialCreated`.
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
    if (isSubmitting.get()) return;
    isSubmitting.set(true);
    try {
      const creator = await chainService.ensureWallet();
      const args: ContractArg[] = [
        { type: "Hash160", value: creator },
        { type: "String", value: normalizeText(form.name, 96) },
        { type: "String", value: normalizeText(form.photoHash, 160) },
        { type: "String", value: normalizeText(form.relationship, 64) },
        { type: "Integer", value: String(form.birthYear || 0) },
        { type: "Integer", value: String(form.deathYear || 0) },
        { type: "String", value: normalizeText(form.biography, 600) },
        { type: "String", value: normalizeText(form.obituary, 600) },
      ];

      const result = await chainService.invoke("createMemorial", args, {
        waitForEvent: "MemorialCreated",
        waitTimeoutMs: 30_000,
      });
      lastTx.set(result);

      eventBus.emit("memorial:created", {
        name: form.name,
        memorialId: eventValue(result.event, 0),
        txid: result.txid,
      });

      // Hint badge for memorial creator (fire-and-forget)
      badgeService.award("memorial-creator", "").catch(() => {});

      await loadMemorials();
    } finally {
      isSubmitting.set(false);
    }
  };

  // ------------------------------------------
  // Write: pay tribute (direct-prepaid GAS + contract call)
  // ------------------------------------------

  /**
   * Pay tribute by prepaying the selected offering cost and invoking
   * `payTribute(visitor, memorialId, offeringType, message)`.
   */
  const payTribute = async (
    memorialId: number,
    offeringType: number,
    message: string,
    receiptId?: string,
  ) => {
    if (isPaying.get()) return;
    isPaying.set(true);
    try {
      const visitor = await chainService.ensureWallet();
      const selectedOffering = Number.isInteger(offeringType) ? offeringType : 1;
      const offeringCost =
        OFFERING_COSTS_FIXED8[selectedOffering] ?? OFFERING_COSTS_FIXED8[1] ?? 1000000n;
      const args: ContractArg[] = [
        { type: "Hash160", value: visitor },
        { type: "Integer", value: String(memorialId) },
        { type: "Integer", value: String(selectedOffering) },
        { type: "String", value: normalizeText(message, 280) },
      ];
      let result: TxResult;
      if (launchNetwork === "mainnet") {
        const normalizedReceiptId = String(receiptId ?? "").trim();
        if (!/^[1-9]\d*$/.test(normalizedReceiptId)) {
          throw new Error(t("receiptIdRequired"));
        }
        result = await chainService.invoke(
          "payTribute",
          [
            ...args,
            { type: "Integer", value: normalizedReceiptId },
          ],
          { waitForEvent: "TributePaid", waitTimeoutMs: 30_000 },
        );
      } else {
        result = await chainService.invokeWithPayment(
          offeringCost.toString(),
          `${APP_ID}:tribute:${memorialId}:${selectedOffering}`,
          "payTribute",
          args,
          { waitForEvent: "TributePaid", waitTimeoutMs: 30_000 },
        );
      }
      lastTx.set(result);

      eventBus.emit("tribute:paid", {
        memorialId,
        offeringType: selectedOffering,
        amountGas: fixed8ToGas(offeringCost),
        txid: result.txid,
      });

      // Hint badge for tribute payer (fire-and-forget)
      badgeService.award("tribute-payer", "").catch(() => {});

      // Reload and update selected memorial
      await loadMemorials();
      if (selectedMemorial.get()?.id === memorialId) {
        selectedMemorial.set(memorials.get().find((m) => m.id === memorialId) || null);
      }
    } finally {
      isPaying.set(false);
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
  return {
    // State
    memorials, visitedMemorials, recentObituaries, selectedMemorial, shareStatus,
    isSubmitting, isPaying,
    lastTx,
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
