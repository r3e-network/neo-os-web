/**
 * useTimeCapsule — Unified domain logic for the Time Capsule miniapp
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (EscrowProxy, StorageProxy, BadgeProxy) via edge functions.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.listAllEvents("CapsuleBuried")
 *     chain.read("getCapsuleDetails", [...])
 *     chain.read("totalCapsules")
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("bury", [...], { waitForEvent: "CapsuleBuried" })
 *     chain.invoke("Reveal", [...])
 *     chain.invoke("fish", [...])
 *     chain.ensureWallet()
 *
 *   AFTER (OS proxy):
 *     storageService.list("capsules:", 50)
 *     storageService.get("capsule:<id>")
 *     escrowService.create({ ... })       — bury capsule (fee + content)
 *     escrowService.completeMilestone()   — reveal capsule
 *     storageService.set("content:<hash>", content) — save local content
 *     storageService.get("fished:<user>") — fish result
 *     badgeService.award("capsule-creator", "")
 */

import { ref, computed } from "vue";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { sha256Hex } from "@shared/utils/hash";
import type { Capsule } from "../pages/index/components/CapsuleList.vue";

// ============================================================================
// Constants
// ============================================================================

const MIN_LOCK_DAYS = 1;
const MAX_LOCK_DAYS = 3650;
const CONTENT_STORE_KEY = "time-capsule-content";

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
  /** OS EscrowProxy instance from ctx.os.escrow */
  escrowService: EscrowProxy;
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

interface StoredCapsule {
  id: string;
  title: string;
  contentHash: string;
  unlockTime: number;
  isPublic: boolean;
  isRevealed: boolean;
  owner: string;
}

// ============================================================================
// Composable
// ============================================================================

export function useTimeCapsule({
  escrowService,
  storageService,
  badgeService,
  eventBus,
  t,
}: UseTimeCapsuleOptions) {
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
  const isBusy = computed(() => isCreating.value || isProcessing.value);

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

  // ── Local Content Helpers ────────────────────────────────────────────

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

  // ── Capsule Mapping ──────────────────────────────────────────────────

  const buildCapsuleFromStored = (data: StoredCapsule): Capsule => {
    const contentHash = String(data.contentHash || "");
    const unlockTime = Number(data.unlockTime || 0);
    const isPublic = Boolean(data.isPublic);
    const revealed = Boolean(data.isRevealed);
    const title = String(data.title || "");
    const unlockDate = unlockTime ? new Date(unlockTime * 1000).toISOString().split("T")[0] : t("notAvailable");
    const content = contentHash ? localContent.value[contentHash] : "";

    return {
      id: String(data.id),
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

  // ── Data Loading (via OS services) ─────────────────────────────────

  /**
   * Load all capsules via StorageProxy.list().
   * The edge function handles the contract reads and event parsing.
   */
  const loadCapsules = async (): Promise<Capsule[]> => {
    try {
      const capsuleMap = await storageService.list("capsules:", 50);
      const items: Capsule[] = [];
      if (capsuleMap && typeof capsuleMap === "object") {
        for (const [, value] of Object.entries(capsuleMap)) {
          const stored = value as StoredCapsule;
          if (stored && stored.id) {
            items.push(buildCapsuleFromStored(stored));
          }
        }
      }
      return items.sort((a, b) => Number(b.id) - Number(a.id));
    } catch (e) {
      console.warn("[useTimeCapsule] loadCapsules failed:", e instanceof Error ? e.message : String(e));
      return [];
    }
  };

  // ── Actions (via OS services) ──────────────────────────────────────

  /**
   * Create a capsule via EscrowProxy.create().
   * The edge function handles the GAS transfer + bury contract call.
   */
  const createCapsule = async () => {
    if (isBusy.value || !canCreate.value) return;

    isCreating.value = true;
    try {
      const daysValue = Number.parseInt(newCapsule.value.days, 10);
      if (!Number.isFinite(daysValue) || daysValue < MIN_LOCK_DAYS || daysValue > MAX_LOCK_DAYS) {
        throw new Error(t("invalidLockDuration"));
      }

      const unlockDate = new Date();
      unlockDate.setDate(unlockDate.getDate() + daysValue);
      const unlockTimestamp = Math.floor(unlockDate.getTime() / 1000);
      const content = newCapsule.value.content.trim();
      const contentHash = await sha256Hex(content);

      // Create capsule via EscrowProxy — the edge function handles
      // the GAS fee transfer and the bury contract call
      await escrowService.create({
        beneficiary: "",
        amount: "0.2",
        milestones: [{
          name: "bury",
          amount: "0.2",
        }],
        expiry: unlockTimestamp,
      });

      // Store content mapping locally and in StorageProxy
      saveLocalContent(contentHash, content);
      await storageService.set(`content:${contentHash}`, {
        title: newCapsule.value.title.trim().slice(0, 100),
        contentHash,
        unlockTimestamp,
        isPublic: newCapsule.value.isPublic,
        category: newCapsule.value.category,
      });

      eventBus.emit("capsule:created", { action: t("capsuleCreated") });
      newCapsule.value = { title: "", content: "", days: "30", isPublic: false, category: 1 };

      // Hint badge for capsule creator (fire-and-forget)
      badgeService.award("capsule-creator", "").catch(() => {});

      // Reload capsules
      capsules.value = await loadCapsules();
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isCreating.value = false;
    }
  };

  /**
   * Open/reveal a capsule via EscrowProxy.completeMilestone().
   * The edge function handles the Reveal contract call.
   */
  const openCapsule = async (cap: Capsule) => {
    if (cap.locked) {
      eventBus.emit("capsule:error", { message: t("notUnlocked") });
      return;
    }
    if (isBusy.value) return;

    isProcessing.value = true;
    try {
      if (!cap.revealed) {
        await escrowService.completeMilestone(cap.id, 0);
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

  /**
   * Fish a random capsule via StorageProxy.
   * The edge function handles the GAS fee + fish contract call.
   */
  const fishCapsule = async () => {
    if (isBusy.value) return;

    isProcessing.value = true;
    try {
      // Trigger fish via escrow fund (which pays the fishing fee)
      await escrowService.fund("fish");

      // Read the fish result from storage
      const result = await storageService.get("fishResult:latest") as { id?: string } | null;
      if (result && result.id) {
        eventBus.emit("capsule:fished", { message: t("fishResult", { id: result.id }) });
      } else {
        eventBus.emit("capsule:fished", { message: t("fishNone") });
      }

      // Hint badge for fisher (fire-and-forget)
      badgeService.award("capsule-fisher", "").catch(() => {});

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
