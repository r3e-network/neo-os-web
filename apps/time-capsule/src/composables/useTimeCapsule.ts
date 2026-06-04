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
 *     escrowService.create({ ... })            — seal capsule (escrow + fee)
 *     storageService.set("capsules:<id>", rec) — index record w/ real escrowId
 *     storageService.list("capsules:", 50)     — enumerate capsules (no kernel
 *                                                enumeration endpoint exists)
 *     escrowService.completeMilestone(escrowId, 0) — reveal capsule
 *     paymentService.deposit(fee, "fish:<id>") — pay the fishing fee
 *     badgeService.award("capsule-creator", "")
 *
 * Escrow-id coherence: createCapsule() captures the escrow id from
 * escrowService.create() and persists it in the capsule's index record, so
 * openCapsule()/fishCapsule() reference the REAL escrow id rather than ad-hoc
 * strings. Full message content stays on-device (local content store).
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService } from "@shared/services";
import type { EscrowProxy } from "@shared/services/os/EscrowProxy";
import type { StorageProxy } from "@shared/services/os/StorageProxy";
import type { PaymentProxy } from "@shared/services/os/PaymentProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import { sha256Hex } from "@shared/utils/hash";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { normalizeUnlockTimeMs } from "../utils/unlockTime";
// ============================================================================
// Constants
// ============================================================================

const MIN_LOCK_DAYS = 1;
const MAX_LOCK_DAYS = 3650;
const CONTENT_STORE_KEY = "time-capsule-content";

/**
 * os-storage index prefix for capsule records. loadCapsules() enumerates
 * this prefix via storageService.list() to rebuild the capsule list, since
 * the OS kernel has no capsule/escrow enumeration endpoint.
 */
const CAPSULE_INDEX_PREFIX = "capsules:";

/** GAS amounts (decimal strings) for the escrow-backed capsule lifecycle. */
const CAPSULE_CREATE_AMOUNT = "0.2";
const FISH_FEE_AMOUNT = "0.05";

// ============================================================================
// Types
// ============================================================================

export interface Capsule {
  id: string;
  title: string;
  contentHash: string;
  unlockDate: string;
  unlockTime: number;
  locked: boolean;
  revealed: boolean;
  isPublic: boolean;
  content: string;
  /** Real escrow id returned by escrowService.create(), used by open/fish. */
  escrowId: string;
  /** Escrow amount (decimal GAS string) backing this capsule. */
  amount: string;
  /**
   * True once this public capsule has been fished (discovery fee paid).
   * Fished capsules are excluded from fishCapsule()'s candidate selection so
   * the same target cannot be re-fished and re-charged with no effect.
   */
  fished: boolean;
  /** Capsule category (1-5, see CATEGORY_OPTIONS), surfaced as a badge. */
  category: number;
  /**
   * Wallet address that created this capsule. Persisted at seal time so the
   * list and hero counts can be scoped to the current user. Legacy records
   * predating owner tagging carry "".
   */
  owner: string;
}

export interface CapsuleFormData {
  title: string;
  content: string;
  days: string;
  isPublic: boolean;
  category: number;
}

export interface UseTimeCapsuleOptions {
  /**
   * ChainService from ctx.services.chain. Used to read the connected wallet
   * address so each capsule record is tagged with its owner and the list /
   * hero counts can be scoped to the current user rather than every user in
   * the shared app namespace.
   */
  chainService: ChainService;
  /** OS EscrowProxy instance from ctx.os.escrow */
  escrowService: EscrowProxy;
  /** OS StorageProxy instance from ctx.os.storage */
  storageService: StorageProxy;
  /** OS PaymentProxy instance from ctx.os.payment (fishing fee) */
  paymentService: PaymentProxy;
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
  unlockTime?: number;
  unlockTimestamp?: number;
  isPublic: boolean;
  isRevealed: boolean;
  owner: string;
  /** Real escrow id captured from escrowService.create() at seal time. */
  escrowId?: string;
  /** Escrow amount (decimal GAS string) backing this capsule. */
  amount?: string;
  /** True once the capsule has been fished (discovery fee paid). */
  fished?: boolean;
  /** Capsule category (1-5, see CATEGORY_OPTIONS). */
  category?: number;
}

/**
 * Extract the escrow id from an escrowService.create() result.
 *
 * EscrowProxy.create() resolves the os-binder response. Depending on the
 * wallet adapter that value may be a bare id string, or an object carrying
 * the kernel's escrow id (commonly under `escrowId`/`id`) alongside the
 * wallet txid. We probe the known shapes and fall back to "" when the id
 * is not available synchronously (e.g. build/preview without a live kernel).
 */
function extractEscrowId(result: unknown): string {
  if (typeof result === "string") return result.trim();
  if (result && typeof result === "object") {
    const obj = result as Record<string, unknown>;
    const candidate =
      obj.escrowId ?? obj.escrow_id ?? obj.id ?? obj.escrow;
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
    if (typeof candidate === "number") return String(candidate);
  }
  return "";
}

// ============================================================================
// Composable
// ============================================================================

export function useTimeCapsule({
  chainService,
  escrowService,
  storageService,
  paymentService,
  badgeService,
  eventBus,
  t,
}: UseTimeCapsuleOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const capsules = createObservable<Capsule[]>([]);
  const isLoading = createObservable(false);
  const isCreating = createObservable(false);
  const isProcessing = createObservable(false);

  const newCapsule = createObservable<CapsuleFormData>({
    title: "",
    content: "",
    days: "30",
    isPublic: false,
    category: 1,
  });

  // Local content store for decrypting capsules
  const localContent = createObservable<Record<string, string>>({});

  // ── Computed ──────────────────────────────────────────────────────────
  const totalCapsules: Observable = {
    get: () => capsules.get().length,
    set: () => {},
    subscribe: (listener) => capsules.subscribe(listener),
  };
  const lockedCount: Observable = {
    get: () => capsules.get().filter((c) => c.locked).length,
    set: () => {},
    subscribe: (listener) => capsules.subscribe(listener),
  };
  const revealedCount: Observable = {
    get: () => capsules.get().filter((c) => c.revealed).length,
    set: () => {},
    subscribe: (listener) => capsules.subscribe(listener),
  };
  const isBusy: Observable = {
    get: () => isCreating.get() || isProcessing.get(),
    set: () => {},
    subscribe: (listener) => isCreating.subscribe(listener),
  };

  const canCreate: Observable = {
    get: () => {
    const daysValue = Number.parseInt(newCapsule.get().days, 10);
    return (
      newCapsule.get().title.trim() !== "" &&
      newCapsule.get().content.trim() !== "" &&
      Number.isFinite(daysValue) &&
      daysValue >= MIN_LOCK_DAYS &&
      daysValue <= MAX_LOCK_DAYS
    );
    },
    set: () => {},
    subscribe: (listener) => newCapsule.subscribe(listener),
  };

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
  localContent.set(loadLocalContent());

  // ── Capsule Mapping ──────────────────────────────────────────────────

  const buildCapsuleFromStored = (data: StoredCapsule): Capsule => {
    const contentHash = String(data.contentHash || "");
    const unlockTime = normalizeUnlockTimeMs(
      data.unlockTime ?? data.unlockTimestamp,
    );
    const isPublic = Boolean(data.isPublic);
    const revealed = Boolean(data.isRevealed);
    const title = String(data.title || "");
    const unlockDate = unlockTime ? new Date(unlockTime).toISOString().split("T")[0] : t("notAvailable");
    const content = contentHash ? localContent.get()[contentHash] : "";
    const escrowId = String(data.escrowId || data.id || "");
    const amount = String(data.amount || CAPSULE_CREATE_AMOUNT);
    const fished = Boolean(data.fished);
    const owner = String(data.owner || "");
    // Read category back so the persisted selection is surfaced in the UI
    // (it was previously write-only). Use ?? so a real 0 is not masked, and
    // fall back to the default category (1 = Personal) for legacy records.
    const category =
      Number.isFinite(Number(data.category)) && data.category !== undefined
        ? Number(data.category)
        : 1;

    return {
      id: String(data.id),
      title,
      contentHash,
      unlockDate,
      unlockTime,
      locked: !revealed && Date.now() < unlockTime,
      revealed,
      isPublic,
      content,
      escrowId,
      amount,
      fished,
      category,
      owner,
    } as Capsule;
  };

  // ── Data Loading (via OS services) ─────────────────────────────────

  /**
   * Load this user's capsules via StorageProxy.list().
   *
   * os-storage-list is scoped only by appId (no per-owner filter), so the raw
   * list contains every user's records in the shared app namespace. We tag each
   * record with its creating wallet (see createCapsule) and filter here so the
   * list and the hero/sidebar counts reflect the current user rather than the
   * whole app. Legacy records that predate owner tagging carry owner === "" and
   * are kept so a user's earlier capsules are not hidden by this change.
   */
  const loadCapsules = async (): Promise<Capsule[]> => {
    try {
      const wallet = chainService.address.get();
      const capsuleMap = await storageService.list("capsules:", 50);
      const items: Capsule[] = [];
      if (capsuleMap && typeof capsuleMap === "object") {
        for (const [, value] of Object.entries(capsuleMap)) {
          const stored = value as StoredCapsule;
          if (!stored || !stored.id) continue;
          const recordOwner = String(stored.owner || "");
          // Keep records that belong to the current wallet, plus legacy
          // untagged records (owner === ""). When no wallet is connected we
          // can only safely show untagged records.
          const mine = wallet
            ? recordOwner === "" || ownerMatchesAddress(recordOwner, wallet)
            : recordOwner === "";
          if (mine) {
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
   *
   * The escrow created here is the authoritative on-chain record for the
   * capsule. We capture the escrow id returned by create() and persist it,
   * together with the capsule metadata, under an os-storage index entry
   * (`capsules:<id>`). This index is what loadCapsules() enumerates and what
   * openCapsule()/fishCapsule() reference — so they act on the REAL escrow id
   * rather than ad-hoc strings like "fish".
   */
  const createCapsule = async () => {
    if (isBusy.get() || !canCreate.get()) return;

    isCreating.set(true);
    try {
      const daysValue = Number.parseInt(newCapsule.get().days, 10);
      if (!Number.isFinite(daysValue) || daysValue < MIN_LOCK_DAYS || daysValue > MAX_LOCK_DAYS) {
        throw new Error(t("invalidLockDuration"));
      }

      const unlockDate = new Date();
      unlockDate.setDate(unlockDate.getDate() + daysValue);
      const unlockTime = unlockDate.getTime();
      const content = newCapsule.get().content.trim();
      const title = newCapsule.get().title.trim().slice(0, 100);
      const isPublic = newCapsule.get().isPublic;
      const category = newCapsule.get().category;
      const contentHash = await sha256Hex(content);

      // Tag the record with the creating wallet so loadCapsules() can scope the
      // list and counts to this user. Ensure a wallet is connected first — the
      // escrow that follows needs a signer anyway, so this fails fast with a
      // friendly message instead of an opaque downstream error.
      const owner = await chainService.ensureWallet();
      if (!owner) {
        throw new Error(t("walletRequired"));
      }

      // Create capsule via EscrowProxy — the edge function builds the
      // CreateEscrow intent (GAS fee transfer + on-chain record). Capture
      // the returned escrow id so it can be referenced for open/fish later.
      const createResult = await escrowService.create({
        beneficiary: "",
        amount: CAPSULE_CREATE_AMOUNT,
        milestones: [{
          name: "bury",
          amount: CAPSULE_CREATE_AMOUNT,
        }],
        expiry: unlockTime,
      });

      // Derive a stable capsule/escrow id. Prefer the kernel escrow id from
      // the create() response; fall back to a deterministic local id (content
      // hash + unlock time) so the index entry is still coherent and unique
      // when the id is not yet available synchronously (build/preview).
      const escrowId = extractEscrowId(createResult);
      const capsuleId =
        escrowId || `${contentHash.slice(0, 16)}-${unlockTime}`;

      // Persist content locally (full message stays on-device).
      saveLocalContent(contentHash, content);

      // Write the authoritative capsule record into the os-storage index.
      // Shape matches StoredCapsule so loadCapsules()/buildCapsuleFromStored
      // can rebuild it, and carries the real escrow id for value flows.
      const record: StoredCapsule = {
        id: capsuleId,
        title,
        contentHash,
        unlockTime,
        isPublic,
        isRevealed: false,
        owner,
        escrowId: escrowId || capsuleId,
        amount: CAPSULE_CREATE_AMOUNT,
        category,
      };
      // Compensation: the escrow (0.2 GAS) already exists on-chain. If the
      // index write fails the capsule is orphaned — loadCapsules() rebuilds the
      // list purely from this index, so an escrow with no index entry can never
      // be opened (openCapsule needs cap.escrowId) and its funds are stranded.
      // On a failed index write, refund the escrow before re-throwing so no
      // funds are locked. Only attempt the refund when a REAL kernel escrow id
      // was returned (a deterministic local id has no on-chain escrow to undo).
      try {
        await storageService.set(`${CAPSULE_INDEX_PREFIX}${capsuleId}`, record);
      } catch (writeErr) {
        if (escrowId) {
          try {
            await escrowService.refund(escrowId);
          } catch {
            // The inverse also failed: the escrow exists with no index entry
            // and could not be refunded automatically. Surface a distinct
            // recoverable message so the user knows the funds need manual
            // recovery rather than silently losing them.
            throw new Error(t("createRecoverable", { escrowId }));
          }
        }
        // Index write failed but the escrow was rolled back (or never had a
        // real on-chain id): no orphaned funds remain. Surface the failure.
        throw writeErr instanceof Error
          ? new Error(`${t("createRolledBack")} ${writeErr.message}`)
          : new Error(t("createRolledBack"));
      }

      eventBus.emit("capsule:created", { action: t("capsuleCreated") });
      newCapsule.set({ title: "", content: "", days: "30", isPublic: false, category: 1 });

      // Hint badge for capsule creator (fire-and-forget)
      badgeService.award("capsule-creator", "").catch(() => {});

      // Reload capsules
      capsules.set(await loadCapsules());
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isCreating.set(false);
    }
  };

  /**
   * Open/reveal a capsule via EscrowProxy.completeMilestone().
   *
   * Uses the REAL escrow id persisted at create time (cap.escrowId), not the
   * display id, so the milestone completes against the escrow that was
   * actually created. After revealing, the index record is updated so the
   * revealed state survives reloads.
   */
  const openCapsule = async (cap: Capsule) => {
    // Recompute lock status live rather than trusting cap.locked, which was
    // computed once in buildCapsuleFromStored at load time. loadAll only runs
    // on mount / wallet reconnect (there is no timer), so a capsule whose
    // unlock instant passed while the app stayed open would still carry a stale
    // locked=true. PlayArea decides Open-button visibility with the same live
    // Date.now() check, so this keeps the guard consistent with the UI.
    if (!cap.revealed && Date.now() < cap.unlockTime) {
      eventBus.emit("capsule:error", { message: t("notUnlocked") });
      return;
    }
    if (isBusy.get()) return;

    const escrowId = cap.escrowId || cap.id;

    isProcessing.set(true);
    try {
      if (!cap.revealed) {
        await escrowService.completeMilestone(escrowId, 0);
        // Persist revealed state back into the os-storage index.
        await storageService.set(`${CAPSULE_INDEX_PREFIX}${cap.id}`, {
          id: cap.id,
          title: cap.title,
          contentHash: cap.contentHash,
          unlockTime: cap.unlockTime,
          isPublic: cap.isPublic,
          isRevealed: true,
          owner: cap.owner,
          escrowId,
          amount: cap.amount,
          fished: cap.fished,
          category: cap.category,
        } satisfies StoredCapsule).catch(() => {});
      }

      const content = cap.contentHash ? localContent.get()[cap.contentHash] : "";
      if (content) {
        eventBus.emit("capsule:opened", { message: `${t("message")} ${content}` });
      } else if (cap.contentHash) {
        eventBus.emit("capsule:opened", { message: `${t("contentUnavailable")} ${cap.contentHash}` });
      } else {
        eventBus.emit("capsule:opened", { message: t("capsuleRevealed") });
      }

      // Reload capsules
      capsules.set(await loadCapsules());
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Fish a public capsule by paying the fishing fee.
   *
   * Previously this called escrowService.fund("fish") with no amount, which
   * the os-escrow-fund edge function always rejects: "fish" is not a real
   * escrow id, and EscrowProxy.fund() never sends an amount (so the required
   * positive amount is missing). Fishing is a discovery FEE, not funding an
   * existing escrow — so the correct primitive is os-payment deposit, which
   * transfers a positive GAS amount with a memo.
   *
   * Candidate selection is derived client-side from the os-storage capsule
   * index (a public, unrevealed, not-yet-fished capsule — the only kind that
   * can be fished). If none exists we report fishNone without charging the fee.
   *
   * On a successful fee deposit the candidate's index record is marked
   * `fished` via storageService.set, so the same target is excluded on the
   * next reload. Without this, os-storage-list (scoped only by appId, with no
   * per-owner filter) would return the identical public+unrevealed capsule on
   * every reload, letting the 0.05 GAS fee be charged repeatedly for no effect.
   */
  const fishCapsule = async () => {
    if (isBusy.get()) return;

    isProcessing.set(true);
    try {
      // Find a fishable candidate from the index: public, unrevealed, and not
      // already fished (a fished capsule has had its discovery fee paid).
      const candidate = capsules
        .get()
        .find((c) => c.isPublic && !c.revealed && !c.fished);

      if (!candidate) {
        eventBus.emit("capsule:fished", { message: t("fishNone") });
        return;
      }

      // Pay the fishing fee via os-payment deposit (positive amount + memo).
      await paymentService.deposit(FISH_FEE_AMOUNT, `fish:${candidate.id}`);

      // Mark the candidate fished in the os-storage index so it is no longer
      // re-selectable. This is the real state change the fee pays for; without
      // it the same target would be fished and charged on every reload.
      await storageService.set(`${CAPSULE_INDEX_PREFIX}${candidate.id}`, {
        id: candidate.id,
        title: candidate.title,
        contentHash: candidate.contentHash,
        unlockTime: candidate.unlockTime,
        isPublic: candidate.isPublic,
        isRevealed: candidate.revealed,
        owner: candidate.owner,
        escrowId: candidate.escrowId || candidate.id,
        amount: candidate.amount,
        fished: true,
        category: candidate.category,
      } satisfies StoredCapsule).catch(() => {});

      eventBus.emit("capsule:fished", {
        message: t("fishResult", { id: candidate.id }),
      });

      // Hint badge for fisher (fire-and-forget)
      badgeService.award("capsule-fisher", "").catch(() => {});

      // Reload capsules
      capsules.set(await loadCapsules());
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      capsules.set(await loadCapsules());
    } finally {
      isLoading.set(false);
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
