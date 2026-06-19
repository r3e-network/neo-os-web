/**
 * useTimeCapsule — Domain logic for the Time Capsule miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppTimeCapsule)
 * via ctx.services.chain. The earlier path routed bury/reveal/fish through the
 * OS escrow/payment/storage/badge kernel proxies, which never actually held the
 * capsule's GAS or moved the fishing fee. This composable now drives the
 * dedicated contract, a REFUNDABLE TIME-LOCK VAULT (no oracle, no pending
 * settle state):
 *
 *   - bury() LOCKS the owner's GAS together with a content hash until an unlock
 *     time. The 0.2 GAS is a REFUNDABLE DEPOSIT, held in escrow by the contract.
 *   - reveal() after the unlock time RETURNS that GAS to the owner atomically
 *     and marks the capsule opened.
 *   - fish() lets another user pay a discovery fee on a PUBLIC, unrevealed
 *     capsule; the fee is CREDITED to the capsule owner's fish-revenue ledger
 *     (NOT forwarded in the tip tx) and the owner collects it via
 *     withdrawFishRevenue().
 *
 * Contract interaction model (verified against MiniAppTimeCapsule.cs / ABI):
 *
 *   READS (chain.read / chain.readArray, default app contract script hash):
 *     lastCapsuleId()                          -> Integer (capsules are ids 1..last)
 *     creditOf(owner)                          -> Integer (prepaid deposit credit)
 *     getCapsule(id)                           -> Map{id,owner,contentHash(ByteString),
 *                                                  unlockTime(ms),isPublic,category,
 *                                                  revealed,amount,fished}
 *     ownerCapsuleCount(owner)                 -> Integer
 *     getOwnerCapsules(owner, off, limit)      -> Integer[] (capsule ids)
 *
 *   MUTATIONS (chain.invoke):
 *     1. DEPOSIT (fund a bury) — a GAS transfer to the contract with the memo
 *        "miniapp-timecapsule:bury" so OnNEP17Payment credits the sender's
 *        prepaid balance:
 *          transfer(owner, CONTRACT, amountBaseUnits, "miniapp-timecapsule:bury")
 *          { scriptHash: GAS_HASH }
 *     2. bury(owner, contentHash, durationSeconds, isPublic, category, amount)
 *        -> capsuleId. Consumes the prepaid credit as the locked amount, so the
 *        deposit MUST land first. If bury fails after a successful deposit the
 *        credit simply remains on the contract as reusable prepaid credit for the
 *        next bury — it is also reclaimable to the wallet via withdraw(account)
 *        ("CreditWithdrawn" event), so no funds are lost. The new capsule id is
 *        read from the "Buried" event (state[0]).
 *     withdraw(owner) -> amount. Pays the owner's whole unused prepaid deposit
 *        credit (creditOf(owner)) back to the wallet — the money-out path for a
 *        deposit that landed but whose bury never completed.
 *     reveal(owner, capsuleId) -> amount. After the unlock time, returns the
 *        locked GAS to the owner atomically and marks it revealed. Guarded so it
 *        cannot double-withdraw.
 *     fish — a one-shot GAS transfer to the contract with the memo
 *        "miniapp-timecapsule:fish:<id>"; the sent amount is the fee, credited
 *        to the owner's fish-revenue ledger (collected later via
 *        withdrawFishRevenue), NOT forwarded in this tx:
 *          transfer(fisher, CONTRACT, feeBaseUnits, "miniapp-timecapsule:fish:<id>")
 *          { scriptHash: GAS_HASH }
 *
 * AMOUNT CONVENTION: the contract takes/returns BASE UNITS. GAS = human × 1e8.
 * getCapsule.unlockTime is in MILLISECONDS (Runtime.Time units), compared
 * directly against Date.now(). durationSeconds = days × 86400. contentHash is
 * the sha256Hex(content) — sent as a ByteArray (base64 of the 32 raw bytes); on
 * read it comes back as a ByteString → "0x<hex>" → decoded to the bare hex.
 *
 * ON-DEVICE vs ON-CHAIN: the contract stores only the content HASH + the lock.
 * The full message AND the human-readable title stay on this device in a local
 * store. createCapsule() persists the title/content/category locally (keyed by
 * capsuleId, and content also by contentHash); buildCapsuleFromStored() rebuilds
 * the display title/content from that store while the authoritative lock/flags
 * come from getCapsule(). A capsule discovered from another user via fishing has
 * no local title → it falls back to a placeholder.
 */

import { createObservable } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import type { ChainService } from "@shared/services";
import { readCachedJSON, writeCachedJSON } from "@shared/utils/runtime-cache";
import {
  GAS_DECIMALS_MULTIPLIER,
  gasToBaseUnits as toBaseUnits,
} from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { sha256Hex } from "@shared/utils/hash";
import { hexToBytes } from "@shared/utils/format";
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import { NOTIFICATION_EVENT } from "@shared/services";
import { formatErrorMessage } from "@shared/utils/errorHandling";

// ============================================================================
// Constants
// ============================================================================

const MIN_LOCK_DAYS = 1;
const MAX_LOCK_DAYS = 3650;

/** Local store for full message content, keyed by contentHash. */
const CONTENT_STORE_KEY = "time-capsule-content";
/** Local store for per-capsule display metadata (title/category), keyed by id. */
const META_STORE_KEY = "time-capsule-meta";

/** Memo the contract requires on the bury deposit transfer. */
const BURY_MEMO = "miniapp-timecapsule:bury";
/** Memo prefix for the one-shot fish discovery-fee transfer. */
const FISH_MEMO_PREFIX = "miniapp-timecapsule:fish:";

/**
 * GAS amounts (decimal strings) for the vault lifecycle.
 * CAPSULE_CREATE_AMOUNT is a REFUNDABLE DEPOSIT returned on reveal — NOT a fee.
 * FISH_FEE_AMOUNT is the discovery fee forwarded to the capsule's owner as a tip.
 */
const CAPSULE_CREATE_AMOUNT = "0.2";
const FISH_FEE_AMOUNT = "0.05";

/** Hard cap on how many capsules to scan per public-candidate refresh. */
const MAX_SCAN = 200;
/** How many capsule ids to page in per owner refresh. */
const OWNER_PAGE_LIMIT = 100;

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
  /**
   * Refundable deposit (decimal GAS string) locked in the vault, returned to
   * the owner on reveal. Kept as `amount` for the consuming UI shape.
   */
  amount: string;
  /**
   * True once this public capsule has been fished (discovery fee paid + tipped
   * to the owner). Fished capsules are excluded from fishCapsule()'s candidate
   * selection so the same target cannot be re-fished.
   */
  fished: boolean;
  /** Capsule category (1-5, see CATEGORY_OPTIONS), surfaced as a badge. */
  category: number;
  /** Owner script hash ("0x…") from the contract, used to scope the list. */
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
   * ChainService from ctx.services.chain. Used for every on-chain read/write
   * (bury deposit + bury, reveal, fish) and to read the connected wallet so the
   * list and hero counts are scoped to the current user.
   */
  chainService: ChainService;
  /** EventBus for UI events. */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Local metadata stored per capsule (title/category/content live on-device).
// ============================================================================

interface CapsuleMeta {
  title: string;
  category: number;
  contentHash: string;
}

// ============================================================================
// Helpers
// ============================================================================

/** Convert base units (bigint) to a human GAS decimal string (trimmed). */
const fromBaseUnits = (base: bigint): string => {
  if (base <= 0n) return "0";
  const whole = base / GAS_DECIMALS_MULTIPLIER;
  const fraction = base % GAS_DECIMALS_MULTIPLIER;
  if (fraction === 0n) return whole.toString();
  const frac = fraction.toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole.toString()}.${frac}`;
};

/** Encode a hex content hash to the base64 a ByteArray contract arg expects. */
const hexToBase64 = (hex: string): string => {
  const bytes = hexToBytes(hex);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
};

/**
 * Decode a getCapsule contentHash (a ByteString surfaced as "0x<hex>" or a
 * printable string) back to a bare lowercase hex string so it matches the
 * sha256Hex used as the local-store key.
 */
const decodeContentHash = (raw: unknown): string => {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  return value.replace(/^0x/i, "").toLowerCase();
};

/** Coerce a raw map value to a finite number, defaulting to 0. */
const toFinite = (value: unknown): number => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Coerce a raw capsule-id list value (number/string/bigint) to a string id. */
const toIdString = (value: unknown): string => {
  try {
    const n = parseBigInt(value);
    return n > 0n ? n.toString() : "";
  } catch {
    return "";
  }
};

// ============================================================================
// Composable
// ============================================================================

export function useTimeCapsule({
  chainService,
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

  // Local content store for revealing capsules (full message stays on-device).
  const localContent = createObservable<Record<string, string>>({});

  /**
   * Public, unrevealed, not-yet-fished capsules owned by OTHER users — the pool
   * the current wallet can tip ("fish"). Surfaced as a browsable list so the
   * user picks a target (id, category, unlock date) before paying the tip,
   * instead of blindly tipping the newest. Refreshed on demand via
   * loadFishCandidates(); each entry is read on-chain (loadPublicCandidates).
   */
  const fishCandidates = createObservable<Capsule[]>([]);
  /** True while loadPublicCandidates() is scanning the contract. */
  const isLoadingCandidates = createObservable(false);

  /**
   * Unused prepaid deposit credit (human GAS decimal string) held on the
   * contract under the connected wallet — a deposit that landed but whose bury
   * never completed. Read from creditOf(owner) on every load; surfaced as a
   * withdraw banner so money-in always has a money-out path.
   */
  const reusableCredit = createObservable<string>("0");

  /**
   * Emit a user-facing toast on the platform notification channel. The composable
   * runs money-moving actions (reveal returns the deposit, fish tips an owner)
   * whose feedback is DYNAMIC (capsule id / withdrawn amount), so it cannot ride
   * a static successKey — MiniAppRoot subscribes to NOTIFICATION_EVENT and renders
   * the status. This is the channel ctx.services.notify uses internally.
   */
  const notify = (
    message: string,
    type: "success" | "error" | "info",
  ) => {
    eventBus.emit(NOTIFICATION_EVENT, { message, type });
  };

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

  /** True when the connected wallet has unused prepaid deposit credit to withdraw. */
  const hasCredit: Observable = {
    get: () => {
      const value = Number(reusableCredit.get());
      return Number.isFinite(value) && value > 0;
    },
    set: () => {},
    subscribe: (listener) => reusableCredit.subscribe(listener),
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

  // ── Local Content + Metadata Helpers ─────────────────────────────────

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
      console.warn("[useTimeCapsule] local content write failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /** Read the local per-capsule metadata store (title/category/contentHash). */
  const loadLocalMeta = (): Record<string, CapsuleMeta> => {
    try {
      const parsed = readCachedJSON<Record<string, CapsuleMeta>>(META_STORE_KEY);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  /**
   * Persist a capsule's display metadata under its on-chain id. The title (and
   * category) never leave the device — only the hash + lock are on-chain — so
   * this is the source of truth buildCapsuleFromStored() reads the title from.
   */
  const saveLocalMeta = (id: string, meta: CapsuleMeta) => {
    if (!id) return;
    try {
      const store = readCachedJSON<Record<string, CapsuleMeta>>(META_STORE_KEY) ?? {};
      store[id] = meta;
      writeCachedJSON(META_STORE_KEY, store);
    } catch (e) {
      console.warn("[useTimeCapsule] local meta write failed:", e instanceof Error ? e.message : String(e));
    }
  };

  // Initialize local content from the device store.
  localContent.set(loadLocalContent());

  // ── Capsule Mapping (from getCapsule Map) ────────────────────────────

  /**
   * Map a getCapsule Map (returned by chain.read as a plain object) into the
   * Capsule shape the UI consumes. Returns null for an unknown / empty capsule
   * (no owner key).
   *
   * The authoritative lock/flags (unlockTime ms, revealed, isPublic, fished,
   * amount, category, owner, contentHash) come from the chain. The display
   * title + full content are rebuilt from the on-device stores keyed by id /
   * contentHash; a capsule discovered from another user has no local entry and
   * falls back to a placeholder title.
   */
  const mapCapsule = (raw: unknown, id: string): Capsule | null => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
    const v = raw as Record<string, unknown>;
    const owner = String(v.owner ?? "");
    if (!owner) return null;

    const contentHash = decodeContentHash(v.contentHash);
    const unlockTime = toFinite(v.unlockTime); // milliseconds
    const isPublic = Boolean(v.isPublic);
    const revealed = Boolean(v.revealed);
    const fished = Boolean(v.fished);
    const amountBase = parseBigInt(v.amount);
    const chainCategory = toFinite(v.category);

    const meta = loadLocalMeta()[id];
    const title = meta?.title ? meta.title : t("untitledCapsule");
    const category =
      meta && Number.isFinite(Number(meta.category)) && meta.category !== undefined
        ? Number(meta.category)
        : chainCategory > 0
          ? chainCategory
          : 1;
    const content = contentHash ? localContent.get()[contentHash] ?? "" : "";
    const unlockDate = unlockTime
      ? new Date(unlockTime).toISOString().slice(0, 10)
      : t("notAvailable");

    return {
      id,
      title,
      contentHash,
      unlockDate,
      unlockTime,
      locked: !revealed && Date.now() < unlockTime,
      revealed,
      isPublic,
      content,
      amount: fromBaseUnits(amountBase),
      fished,
      category,
      owner,
    };
  };

  /** Read a single capsule by id into a Capsule. */
  const readCapsule = async (id: string): Promise<Capsule | null> => {
    try {
      const raw = await chainService.read("getCapsule", [
        { type: "Integer", value: id },
      ]);
      return mapCapsule(raw, id);
    } catch (e) {
      console.warn(
        "[useTimeCapsule] getCapsule failed for",
        id,
        ":",
        e instanceof Error ? e.message : String(e),
      );
      return null;
    }
  };

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Load this user's capsules from the contract: getOwnerCapsules(wallet) yields
   * the owner's capsule ids, each read via getCapsule. When no wallet is
   * connected there is nothing owner-scoped to show.
   */
  const loadCapsules = async (): Promise<Capsule[]> => {
    try {
      const wallet = chainService.address.get();
      const ownerHash = wallet ? addressToScriptHash(wallet) || null : null;
      if (!ownerHash) return [];

      const idsRaw = await chainService.readArray("getOwnerCapsules", [
        { type: "Hash160", value: ownerHash },
        { type: "Integer", value: "0" },
        { type: "Integer", value: String(OWNER_PAGE_LIMIT) },
      ]);
      const ids = (Array.isArray(idsRaw) ? idsRaw : [])
        .map(toIdString)
        .filter((id) => id !== "");

      const results = await Promise.all(ids.map((id) => readCapsule(id)));
      return results
        .filter((c): c is Capsule => c !== null)
        .sort((a, b) => Number(b.id) - Number(a.id));
    } catch (e) {
      console.warn("[useTimeCapsule] loadCapsules failed:", e instanceof Error ? e.message : String(e));
      return [];
    }
  };

  /**
   * Scan the whole contract (ids 1..lastCapsuleId) for fishable capsules:
   * public, unrevealed, not-yet-fished, and owned by ANOTHER user. This is the
   * cross-user discovery fishing advertises — the current wallet's own capsules
   * are excluded (it can already open those). Newest-first, capped at MAX_SCAN.
   */
  const loadPublicCandidates = async (): Promise<Capsule[]> => {
    try {
      const wallet = chainService.address.get();
      const lastRaw = await chainService.read("lastCapsuleId", []);
      const last = toFinite(lastRaw);
      if (last <= 0) return [];

      const start = Math.max(1, last - MAX_SCAN + 1);
      const ids: string[] = [];
      for (let id = last; id >= start; id -= 1) ids.push(String(id));

      const results = await Promise.all(ids.map((id) => readCapsule(id)));
      return results
        .filter((c): c is Capsule => c !== null)
        .filter((c) => {
          if (!c.isPublic || c.revealed || c.fished) return false;
          // Exclude the current wallet's own capsules (it can open those itself).
          return wallet ? !ownerMatchesAddress(c.owner, wallet) : true;
        })
        .sort((a, b) => Number(b.id) - Number(a.id));
    } catch (e) {
      console.warn(
        "[useTimeCapsule] loadPublicCandidates failed:",
        e instanceof Error ? e.message : String(e),
      );
      return [];
    }
  };

  /**
   * Refresh the connected wallet's unused prepaid deposit credit from
   * creditOf(owner). Base units → human GAS. A missing wallet yields "0"; a read
   * failure leaves the last known value (withdrawCredit re-reads before acting).
   */
  const loadCredit = async () => {
    try {
      const wallet = chainService.address.get();
      const ownerHash = wallet ? addressToScriptHash(wallet) || null : null;
      if (!ownerHash) {
        reusableCredit.set("0");
        return;
      }
      const raw = await chainService.read("creditOf", [
        { type: "Hash160", value: ownerHash },
      ]);
      reusableCredit.set(fromBaseUnits(parseBigInt(raw)));
    } catch (e) {
      console.warn(
        "[useTimeCapsule] creditOf read failed:",
        e instanceof Error ? e.message : String(e),
      );
    }
  };

  // ── Actions (direct chain invocations) ─────────────────────────────

  /**
   * Create a capsule against the standalone vault contract.
   *
   * Two steps, both signed by the owner:
   *   1. DEPOSIT — transfer the 0.2 GAS refundable deposit to the contract with
   *      the "miniapp-timecapsule:bury" memo, crediting the owner's prepaid
   *      balance.
   *   2. bury(owner, contentHash, days*86400, isPublic, category, amount) —
   *      consumes that credit as the locked amount and seals the capsule. The
   *      new id is read from the "Buried" event.
   *
   * The title + full content NEVER leave the device: only the sha256 contentHash
   * and the lock are on-chain. We persist the content (keyed by contentHash) and
   * the display metadata (keyed by the on-chain capsule id) locally so the list
   * can rebuild the title later.
   *
   * If step 2 fails after a successful deposit, the prepaid credit simply remains
   * on the contract under the owner and is reused on the next bury — there is no
   * refund call (and none is needed; funds are not lost).
   */
  const createCapsule = async () => {
    if (isBusy.get() || !canCreate.get()) return;

    isCreating.set(true);
    try {
      const daysValue = Number.parseInt(newCapsule.get().days, 10);
      if (!Number.isFinite(daysValue) || daysValue < MIN_LOCK_DAYS || daysValue > MAX_LOCK_DAYS) {
        throw new Error(t("invalidLockDuration"));
      }

      const content = newCapsule.get().content.trim();
      const title = newCapsule.get().title.trim().slice(0, 100);
      if (!content || !title) throw new Error(t("invalidLockDuration"));
      const isPublic = newCapsule.get().isPublic;
      const category = newCapsule.get().category;
      const contentHash = await sha256Hex(content);

      const ownerAddr = chainService.address.get() || (await chainService.ensureWallet());
      const ownerHash = addressToScriptHash(ownerAddr || "");
      if (!ownerAddr || !ownerHash) throw new Error(t("walletRequired"));

      const contractHash = chainService.contractAddress.get();
      if (!contractHash) throw new Error(t("contractNotReady"));

      const amountBase = toBaseUnits(CAPSULE_CREATE_AMOUNT);
      const durationSeconds = daysValue * 86_400;

      // Step 1: DEPOSIT — GAS transfer to the contract with the bury memo so
      // OnNEP17Payment credits the owner's prepaid (refundable) deposit balance.
      await chainService.invoke(
        "transfer",
        [
          { type: "Hash160", value: ownerHash },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: amountBase.toString() },
          { type: "String", value: BURY_MEMO },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      // Step 2: bury — consumes the prepaid credit as the locked amount and
      // seals the capsule. Read the new id from the Buried event (state[0]).
      let capsuleId = "";
      try {
        const result = await chainService.invoke(
          "bury",
          [
            { type: "Hash160", value: ownerHash },
            { type: "ByteArray", value: hexToBase64(contentHash) },
            { type: "Integer", value: String(durationSeconds) },
            { type: "Boolean", value: isPublic },
            { type: "Integer", value: String(category) },
            { type: "Integer", value: amountBase.toString() },
          ],
          { waitForEvent: "Buried" },
        );
        capsuleId = toIdString(eventValue(result.event, 0));
        if (!capsuleId) {
          // Event slot unavailable / unparsed — fall back to lastCapsuleId().
          capsuleId = toIdString(await chainService.read("lastCapsuleId", []));
        }
      } catch (buryErr) {
        console.error(
          "[useTimeCapsule] bury failed after deposit succeeded:",
          buryErr instanceof Error ? buryErr.message : String(buryErr),
        );
        // Deposit landed, capsule not buried — credit is held under the owner as
        // reusable prepaid credit, reusable on the next bury or withdrawable to
        // the wallet. Refresh it so the recovery banner surfaces the money-out.
        await loadCredit();
        throw new Error(t("depositPrepaidNoCapsule"));
      }

      // Persist the full content + display metadata ON-DEVICE under the on-chain
      // id (only the hash + lock are on-chain).
      saveLocalContent(contentHash, content);
      if (capsuleId) {
        saveLocalMeta(capsuleId, { title, category, contentHash });
      }

      newCapsule.set({ title: "", content: "", days: "30", isPublic: false, category: 1 });

      capsules.set(await loadCapsules());
      await loadCredit();
    } catch (e) {
      throw e;
    } finally {
      isCreating.set(false);
    }
  };

  /**
   * Open/reveal a capsule via reveal(owner, capsuleId).
   *
   * Recomputes lock status live against Date.now() vs unlockTime(ms) before
   * dispatching (loadAll only runs on mount / wallet reconnect, so cap.locked
   * can be stale). After reveal the locked deposit is RETURNED to the owner
   * atomically; we reload to reflect the revealed state.
   */
  const openCapsule = async (cap: Capsule) => {
    if (!cap.revealed && Date.now() < cap.unlockTime) {
      notify(t("notUnlocked"), "error");
      return;
    }
    if (isBusy.get()) return;

    isProcessing.set(true);
    try {
      const wasSealed = !cap.revealed;
      if (wasSealed) {
        const ownerAddr = chainService.address.get() || (await chainService.ensureWallet());
        const ownerHash = addressToScriptHash(ownerAddr || "");
        if (!ownerAddr || !ownerHash) throw new Error(t("walletRequired"));

        await chainService.invoke(
          "reveal",
          [
            { type: "Hash160", value: ownerHash },
            { type: "Integer", value: cap.id },
          ],
          { waitForEvent: "Revealed" },
        );
      }

      // Reveal returns the locked deposit atomically — confirm the money-out, then
      // surface the message (or an on-device-fallback hash) on the live channel.
      if (wasSealed) {
        notify(t("capsuleRevealed"), "success");
      }
      const content = cap.contentHash ? localContent.get()[cap.contentHash] : "";
      if (content) {
        notify(`${t("message")} ${content}`, "info");
      } else if (cap.contentHash) {
        notify(`${t("contentUnavailable")} ${cap.contentHash}`, "info");
      }

      capsules.set(await loadCapsules());
    } catch (e) {
      notify(formatErrorMessage(e, t("error")), "error");
      throw e;
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Refresh the browsable list of public, tippable ("fishable") capsules from
   * other users, so the UI can show the pool and let the user pick a target
   * before paying the tip. Read-only over loadPublicCandidates().
   */
  const loadFishCandidates = async (): Promise<Capsule[]> => {
    if (isLoadingCandidates.get()) return fishCandidates.get();
    isLoadingCandidates.set(true);
    try {
      const list = await loadPublicCandidates();
      fishCandidates.set(list);
      return list;
    } finally {
      isLoadingCandidates.set(false);
    }
  };

  /**
   * Tip ("fish") a public capsule by paying the 0.05 GAS tip.
   *
   * This is a TIP, not a reveal: the fee is forwarded on-chain to the capsule's
   * owner as encouragement and the capsule is marked fished, but the message
   * stays sealed (the fisher never sees the content). Targets a public,
   * unrevealed, not-fished capsule owned by ANOTHER user. When `targetId` is
   * given (the user picked one from the browsable list) it tips that capsule;
   * otherwise it falls back to the newest tippable capsule (loadPublicCandidates
   * is newest-first). If no other-owner candidate exists we report fishNone
   * without charging the fee (a user cannot tip their own capsule — the contract
   * rejects it).
   */
  const fishCapsule = async (targetId?: string) => {
    if (isBusy.get()) return;

    isProcessing.set(true);
    try {
      const candidates = await loadPublicCandidates();
      fishCandidates.set(candidates);
      const wanted = targetId ? String(targetId) : "";
      const candidate = wanted
        ? candidates.find((c) => c.id === wanted)
        : candidates[0];

      if (!candidate) {
        notify(t("fishNone"), "info");
        return;
      }

      const fisherAddr = chainService.address.get() || (await chainService.ensureWallet());
      const fisherHash = addressToScriptHash(fisherAddr || "");
      if (!fisherAddr || !fisherHash) throw new Error(t("walletRequired"));

      const contractHash = chainService.contractAddress.get();
      if (!contractHash) throw new Error(t("contractNotReady"));

      const feeBase = toBaseUnits(FISH_FEE_AMOUNT);

      // Pay the discovery fee — a one-shot GAS transfer with the fish memo. The
      // contract forwards the fee to the capsule owner as a tip and flags the
      // capsule fished, atomically.
      await chainService.invoke(
        "transfer",
        [
          { type: "Hash160", value: fisherHash },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: feeBase.toString() },
          { type: "String", value: `${FISH_MEMO_PREFIX}${candidate.id}` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH, waitForEvent: "Fished" },
      );

      notify(t("fishResult", { id: candidate.id }), "success");

      capsules.set(await loadCapsules());
      // The tipped capsule is now flagged fished — drop it from the browsable list.
      fishCandidates.set(await loadPublicCandidates());
    } catch (e) {
      notify(formatErrorMessage(e, t("error")), "error");
      throw e;
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Withdraw the connected wallet's unused prepaid deposit credit via
   * withdraw(owner). The contract pays the WHOLE creditOf(owner) back to the
   * wallet — the money-out path for a deposit that landed but whose bury never
   * completed. Returns the withdrawn amount (human GAS) from the "CreditWithdrawn"
   * event (state[1] = amount). Reads the live credit first so an empty balance
   * surfaces a clean message instead of a VM revert.
   */
  const withdrawCredit = async (): Promise<{ amount: string }> => {
    if (isBusy.get()) return { amount: "0" };

    isProcessing.set(true);
    try {
      const ownerAddr = chainService.address.get() || (await chainService.ensureWallet());
      const ownerHash = addressToScriptHash(ownerAddr || "");
      if (!ownerAddr || !ownerHash) throw new Error(t("walletRequired"));

      let creditBase = 0n;
      try {
        creditBase = parseBigInt(
          await chainService.read("creditOf", [{ type: "Hash160", value: ownerHash }]),
        );
      } catch {
        creditBase = 0n;
      }
      if (creditBase <= 0n) {
        notify(t("noCreditToWithdraw"), "info");
        reusableCredit.set("0");
        return { amount: "0" };
      }

      const result = await chainService.invoke(
        "withdraw",
        [{ type: "Hash160", value: ownerHash }],
        { waitForEvent: "CreditWithdrawn" },
      );

      // CreditWithdrawn(account, amount) — amount is state index 1.
      const withdrawnBase = parseBigInt(eventValue(result.event, 1));
      const amount = fromBaseUnits(withdrawnBase > 0n ? withdrawnBase : creditBase);

      notify(t("creditWithdrawn", { amount }), "success");
      await loadCredit();
      return { amount };
    } catch (e) {
      notify(formatErrorMessage(e, t("error")), "error");
      throw e;
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Collect fishing-tip revenue accrued on the connected wallet's public
   * capsules via withdrawFishRevenue(owner). The contract holds each 0.05 GAS
   * tip in a separate fish-revenue ledger (it is NOT forwarded on the tip tx)
   * and pays the whole balance back here — the money-out path for tips. The
   * contract exposes no balance getter, so an empty balance reverts with
   * "no fish revenue"; that case is surfaced as a clean info message rather
   * than an error. Returns the collected amount (human GAS) from the
   * "FishRevenueWithdrawn" event (state[1] = amount).
   */
  const withdrawFishRevenue = async (): Promise<{ amount: string }> => {
    if (isBusy.get()) return { amount: "0" };

    isProcessing.set(true);
    try {
      const ownerAddr = chainService.address.get() || (await chainService.ensureWallet());
      const ownerHash = addressToScriptHash(ownerAddr || "");
      if (!ownerAddr || !ownerHash) throw new Error(t("walletRequired"));

      let result;
      try {
        result = await chainService.invoke(
          "withdrawFishRevenue",
          [{ type: "Hash160", value: ownerHash }],
          { waitForEvent: "FishRevenueWithdrawn" },
        );
      } catch (e) {
        // The contract asserts revenue > 0; an empty balance is an expected
        // "nothing to collect" outcome, not a failure to surface as an error.
        const msg = e instanceof Error ? e.message : "";
        if (/no fish revenue/i.test(msg)) {
          notify(t("noTipsToCollect"), "info");
          return { amount: "0" };
        }
        throw e;
      }

      // FishRevenueWithdrawn(owner, amount) — amount is state index 1.
      const collectedBase = parseBigInt(eventValue(result.event, 1));
      const amount = fromBaseUnits(collectedBase);
      notify(t("tipsCollected", { amount }), "success");
      return { amount };
    } catch (e) {
      notify(formatErrorMessage(e, t("error")), "error");
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
      await loadCredit();
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
    reusableCredit,
    fishCandidates,
    isLoadingCandidates,

    // ── Computed ─────────────────────────────────────────────────────
    totalCapsules,
    lockedCount,
    revealedCount,
    canCreate,
    hasCredit,

    // ── Actions ─────────────────────────────────────────────────────
    createCapsule,
    openCapsule,
    fishCapsule,
    loadFishCandidates,
    withdrawCredit,
    withdrawFishRevenue,
    loadCredit,
    loadAll,
  };
}

export type UseTimeCapsuleReturn = ReturnType<typeof useTimeCapsule>;
