/**
 * useTimeCapsule — Unified domain logic for the Time Capsule miniapp
 *
 * Receives ChainService + EventBus from PlatformServices.
 * Consolidates capsule creation, listing, unlocking, and fishing into
 * a single composable, replacing the legacy useCapsuleCreation.ts and
 * useCapsuleUnlock.ts which wired useContractInteraction + useStatusMessage +
 * useEvents directly.
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { sha256Hex } from "@shared/utils/hash";
import { ownerMatchesAddress, parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { Capsule } from "../pages/index/components/CapsuleList.vue";

// ============================================================================
// Constants
// ============================================================================

const BURY_FEE_BASE = String(Math.round(0.2 * 1e8)); // 0.2 GAS in Fixed8
const FISH_FEE_BASE = "5000000"; // 0.05 GAS in Fixed8
const MIN_LOCK_DAYS = 1;
const MAX_LOCK_DAYS = 3650;
const CONTENT_STORE_KEY = "time-capsule-content";
const WAIT_AFTER_TRANSFER_MS = 4000;

// ============================================================================
// Types
// ============================================================================

export interface CapsuleFormData {
  title: string;
  content: string;
  days: string;
  isPublic: boolean;
  category: number;
}

export interface UseTimeCapsuleOptions {
  chain: ChainService;
  eventBus: EventBus;
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useTimeCapsule({ chain, eventBus, t }: UseTimeCapsuleOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const capsules = ref<Capsule[]>([]);
  const isLoading = ref(false);
  const isCreating = ref(false);
  const isProcessing = ref(false);

  const newCapsule = ref<CapsuleFormData>({
    title: "",
    content: "",
    days: "30",
    isPublic: false,
    category: 1,
  });

  // Local content store for decrypting capsules
  const localContent = ref<Record<string, string>>({});

  // ── Computed ──────────────────────────────────────────────────────────
  const totalCapsules = computed(() => capsules.value.length);
  const lockedCount = computed(() => capsules.value.filter((c) => c.locked).length);
  const revealedCount = computed(() => capsules.value.filter((c) => c.revealed).length);
  const isBusy = computed(() => isCreating.value || isProcessing.value || chain.isProcessing.value);

  const canCreate = computed(() => {
    const daysValue = Number.parseInt(newCapsule.value.days, 10);
    return (
      newCapsule.value.title.trim() !== "" &&
      newCapsule.value.content.trim() !== "" &&
      Number.isFinite(daysValue) &&
      daysValue >= MIN_LOCK_DAYS &&
      daysValue <= MAX_LOCK_DAYS
    );
  });

  // ── Helpers ───────────────────────────────────────────────────────────

  const loadLocalContent = (): Record<string, string> => {
    try {
      const parsed = readCachedJSON<Record<string, string | { hash?: string; content?: string }>>(CONTENT_STORE_KEY);
      if (!parsed || typeof parsed !== "object") return {};
      const normalized: Record<string, string> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === "string") {
          normalized[key] = value;
        } else if (value && typeof value === "object") {
          const legacy = value as { hash?: string; content?: string };
          const hashKey = String(legacy.hash || key);
          if (legacy.content) normalized[hashKey] = String(legacy.content);
        }
      }
      return normalized;
    } catch {
      return {};
    }
  };

  const saveLocalContent = (hash: string, content: string) => {
    if (!hash) return;
    try {
      const store = readCachedJSON<Record<string, string>>(CONTENT_STORE_KEY) ?? {};
      store[hash] = content;
      writeCachedJSON(CONTENT_STORE_KEY, store);
    } catch (e) {
      console.warn("[useTimeCapsule] local storage write failed:", e instanceof Error ? e.message : String(e));
    }
  };

  // Initialize local content
  localContent.value = loadLocalContent();

  const ownerMatches = (value: unknown) => ownerMatchesAddress(value, chain.address.value);

  const toNumber = (value: unknown) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };

  const buildCapsuleFromDetails = (
    id: string,
    data: Record<string, unknown>,
    fallback?: { unlockTime?: number; isPublic?: boolean },
  ): Capsule => {
    const contentHash = String(data.contentHash || "");
    const unlockTime = toNumber(data.unlockTime ?? fallback?.unlockTime ?? 0);
    const isPublic = typeof data.isPublic === "boolean" ? data.isPublic : Boolean(data.isPublic ?? fallback?.isPublic);
    const revealed = Boolean(data.isRevealed);
    const title = String(data.title || "");
    const unlockDate = unlockTime ? new Date(unlockTime * 1000).toISOString().split("T")[0] : t("notAvailable");
    const content = contentHash ? localContent.value[contentHash] : "";

    return {
      id,
      title,
      contentHash,
      unlockDate,
      unlockTime,
      locked: !revealed && Date.now() < unlockTime * 1000,
      revealed,
      isPublic,
      content,
    } as Capsule;
  };

  // ── Data Loading ─────────────────────────────────────────────────────

  const loadCapsules = async (): Promise<Capsule[]> => {
    if (!chain.address.value) return [];
    try {
      const buriedEvents = await chain.listAllEvents("CapsuleBuried");

      const userCapsules = await Promise.all(
        buriedEvents.map(async (evt: unknown) => {
          const evtRecord = evt as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state)
            ? (evtRecord.state as unknown[]).map(parseStackItem)
            : [];
          const owner = values[0];
          const id = String(values[1] || "");
          const unlockTimeEvent = toNumber(values[2] || 0);
          const isPublicEvent = Boolean(values[3]);
          if (!id || !ownerMatches(owner)) return null;

          try {
            const parsed = await chain.read("getCapsuleDetails", [{ type: "Integer", value: id }]);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              const data = parsed as Record<string, unknown>;
              return buildCapsuleFromDetails(id, data, { unlockTime: unlockTimeEvent, isPublic: isPublicEvent });
            }
          } catch (e) {
            console.warn("[useTimeCapsule] getCapsuleDetails failed:", e instanceof Error ? e.message : String(e));
          }

          return buildCapsuleFromDetails(
            id,
            { contentHash: "", title: "", unlockTime: unlockTimeEvent, isPublic: isPublicEvent, isRevealed: false },
            { unlockTime: unlockTimeEvent, isPublic: isPublicEvent },
          );
        }),
      );

      let resolved = userCapsules.filter(Boolean) as Capsule[];

      // Fallback: scan capsule IDs if no events found
      if (resolved.length === 0) {
        const totalCount = Number((await chain.read("totalCapsules")) || 0);
        const discovered: Capsule[] = [];
        for (let i = 1; i <= totalCount; i++) {
          const parsed = await chain.read("getCapsuleDetails", [{ type: "Integer", value: String(i) }]);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
          const data = parsed as Record<string, unknown>;
          if (!ownerMatches(data.owner)) continue;
          discovered.push(buildCapsuleFromDetails(String(i), data));
        }
        resolved = discovered;
      }

      return resolved.sort((a, b) => Number(b.id) - Number(a.id));
    } catch (e) {
      console.warn("[useTimeCapsule] loadCapsules failed:", e instanceof Error ? e.message : String(e));
      return [];
    }
  };

  // ── Actions ──────────────────────────────────────────────────────────

  const createCapsule = async () => {
    if (isBusy.value || !canCreate.value) return;

    isCreating.value = true;
    try {
      await chain.ensureWallet();

      const daysValue = Number.parseInt(newCapsule.value.days, 10);
      if (!Number.isFinite(daysValue) || daysValue < MIN_LOCK_DAYS || daysValue > MAX_LOCK_DAYS) {
        throw new Error(t("invalidLockDuration"));
      }

      const unlockDate = new Date();
      unlockDate.setDate(unlockDate.getDate() + daysValue);
      const unlockTimestamp = Math.floor(unlockDate.getTime() / 1000);
      const content = newCapsule.value.content.trim();
      const contentHash = await sha256Hex(content);

      // Step 1: Pay bury fee
      const contractHash = chain.contractAddress.value;
      if (!contractHash) throw new Error(t("error"));

      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: BURY_FEE_BASE },
          { type: "String", value: `time-capsule:bury:${Date.now()}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_TRANSFER_MS));

      // Step 2: Bury the capsule
      await chain.invoke(
        "bury",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "String", value: contentHash },
          { type: "String", value: newCapsule.value.title.trim().slice(0, 100) },
          { type: "Integer", value: String(unlockTimestamp) },
          { type: "Boolean", value: newCapsule.value.isPublic },
          { type: "Integer", value: String(newCapsule.value.category) },
        ],
        { waitForEvent: "CapsuleBuried" },
      );

      saveLocalContent(contentHash, content);

      eventBus.emit("capsule:created", { action: t("capsuleCreated") });
      newCapsule.value = { title: "", content: "", days: "30", isPublic: false, category: 1 };

      // Reload capsules
      capsules.value = await loadCapsules();
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isCreating.value = false;
    }
  };

  const openCapsule = async (cap: Capsule) => {
    if (cap.locked) {
      eventBus.emit("capsule:error", { message: t("notUnlocked") });
      return;
    }
    if (isBusy.value) return;

    isProcessing.value = true;
    try {
      await chain.ensureWallet();

      if (!cap.revealed) {
        await chain.invoke("Reveal", [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: cap.id },
        ]);
      }

      const content = cap.contentHash ? localContent.value[cap.contentHash] : "";
      if (content) {
        eventBus.emit("capsule:opened", { message: `${t("message")} ${content}` });
      } else if (cap.contentHash) {
        eventBus.emit("capsule:opened", { message: `${t("contentUnavailable")} ${cap.contentHash}` });
      } else {
        eventBus.emit("capsule:opened", { message: t("capsuleRevealed") });
      }

      // Reload capsules
      capsules.value = await loadCapsules();
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  const fishCapsule = async () => {
    if (isBusy.value) return;

    isProcessing.value = true;
    try {
      const requestStartedAt = Date.now();
      await chain.ensureWallet();

      const contractHash = chain.contractAddress.value;
      if (!contractHash) throw new Error(t("error"));

      // Step 1: Pay fishing fee
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: FISH_FEE_BASE },
          { type: "String", value: `time-capsule:fish:${Date.now()}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      await new Promise((resolve) => setTimeout(resolve, WAIT_AFTER_TRANSFER_MS));

      // Step 2: Fish
      await chain.invoke("fish", [
        { type: "Hash160", value: chain.address.value as string },
      ]);

      // Step 3: Check for CapsuleFished event
      const fishEvents = await chain.listAllEvents("CapsuleFished");
      const match = (fishEvents as unknown[]).find((evt: unknown) => {
        const evtRecord = evt as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state)
          ? (evtRecord.state as unknown[]).map(parseStackItem)
          : [];
        const timestamp = evtRecord?.created_at ? new Date(evtRecord.created_at as string).getTime() : 0;
        return ownerMatches(values[0]) && timestamp >= requestStartedAt - 1000;
      });

      if (match) {
        const evtRecord = match as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state)
          ? (evtRecord.state as unknown[]).map(parseStackItem)
          : [];
        const fishedId = String(values[1] || "");
        eventBus.emit("capsule:fished", { message: t("fishResult", { id: fishedId || "?" }) });
      } else {
        eventBus.emit("capsule:fished", { message: t("fishNone") });
      }

      // Reload capsules
      capsules.value = await loadCapsules();
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isProcessing.value = false;
    }
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    isLoading.value = true;
    try {
      capsules.value = await loadCapsules();
    } finally {
      isLoading.value = false;
    }
  };

  return {
    // ── State ────────────────────────────────────────────────────────
    capsules,
    isLoading,
    isCreating,
    isProcessing,
    isBusy,
    newCapsule,
    localContent,

    // ── Computed ─────────────────────────────────────────────────────
    totalCapsules,
    lockedCount,
    revealedCount,
    canCreate,

    // ── Actions ─────────────────────────────────────────────────────
    createCapsule,
    openCapsule,
    fishCapsule,
    loadAll,
  };
}

export type UseTimeCapsuleReturn = ReturnType<typeof useTimeCapsule>;
