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
 *     capsule; the fee is forwarded to the capsule's owner as a TIP, same tx.
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
 *        next bury — there is no refund call (and none is needed; funds are not
 *        lost). The new capsule id is read from the "Buried" event (state[0]).
 *     reveal(owner, capsuleId) -> amount. After the unlock time, returns the
 *        locked GAS to the owner atomically and marks it revealed. Guarded so it
 *        cannot double-withdraw.
 *     fish — a one-shot GAS transfer to the contract with the memo
 *        "miniapp-timecapsule:fish:<id>"; the sent amount is the fee, forwarded
 *        to the owner as a tip:
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
import { sha256Hex } from "@shared/utils/hash";
import { hexToBytes } from "@shared/utils/format";
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

const MIN_LOCK_DAYS = 1;
const MAX_LOCK_DAYS = 3650;

/** Local store for full message content, keyed by contentHash. */
const CONTENT_STORE_KEY = "time-capsule-content";
/** Local store for per-capsule display metadata (title/category), keyed by id. */
const META_STORE_KEY = "time-capsule-meta";

/** GAS base units per whole GAS (1e8). */
const GAS_DECIMALS_MULTIPLIER = 100_000_000n;

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

/**
 * Convert a human-entered GAS amount string to BASE UNITS without floats.
 * Returns 0n for any invalid / non-positive input.
 */
const toBaseUnits = (raw: string): bigint => {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return 0n;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const paddedFraction = (fraction + "00000000").slice(0, 8);
  const base = BigInt(whole) * GAS_DECIMALS_MULTIPLIER + BigInt(paddedFraction);
  return base > 0n ? base : 0n;
};

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

/** Read a single state slot from a contract event payload (positional). */
const eventValue = (entry: unknown, index: number): unknown => {
  if (!entry || typeof entry !== "object") return undefined;
  const state = (entry as { state?: unknown }).state;
  if (Array.isArray(state)) {
    const item = state[index] as unknown;
    if (item && typeof item === "object" && "value" in item) {
      return (item as { value?: unknown }).value;
    }
    return item;
  }
  return undefined;
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
        // reusable prepaid credit for the next bury (no refund needed).
        throw new Error(t("depositPrepaidNoCapsule"));
      }

      // Persist the full content + display metadata ON-DEVICE under the on-chain
      // id (only the hash + lock are on-chain).
      saveLocalContent(contentHash, content);
      if (capsuleId) {
        saveLocalMeta(capsuleId, { title, category, contentHash });
      }

      eventBus.emit("capsule:created", { action: t("capsuleCreated") });
      newCapsule.set({ title: "", content: "", days: "30", isPublic: false, category: 1 });

      capsules.set(await loadCapsules());
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
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
      eventBus.emit("capsule:error", { message: t("notUnlocked") });
      return;
    }
    if (isBusy.get()) return;

    isProcessing.set(true);
    try {
      if (!cap.revealed) {
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

      const content = cap.contentHash ? localContent.get()[cap.contentHash] : "";
      if (content) {
        eventBus.emit("capsule:opened", { message: `${t("message")} ${content}` });
      } else if (cap.contentHash) {
        eventBus.emit("capsule:opened", { message: `${t("contentUnavailable")} ${cap.contentHash}` });
      } else {
        eventBus.emit("capsule:opened", { message: t("capsuleRevealed") });
      }

      capsules.set(await loadCapsules());
    } catch (e) {
      eventBus.emit("capsule:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isProcessing.set(false);
    }
  };

  /**
   * Fish a public capsule by paying the discovery fee.
   *
   * Picks a public, unrevealed, not-fished capsule owned by ANOTHER user (via
   * loadPublicCandidates, a full 1..lastCapsuleId scan). The fee is paid with a
   * one-shot GAS transfer carrying the "miniapp-timecapsule:fish:<id>" memo; the
   * contract forwards it to the capsule's owner as a TIP in the same tx and
   * marks the capsule fished. If no other-owner candidate exists we report
   * fishNone without charging the fee (a user cannot fish their own capsule —
   * the contract rejects it).
   */
  const fishCapsule = async () => {
    if (isBusy.get()) return;

    isProcessing.set(true);
    try {
      const candidates = await loadPublicCandidates();
      const candidate = candidates[0];

      if (!candidate) {
        eventBus.emit("capsule:fished", { message: t("fishNone") });
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

      eventBus.emit("capsule:fished", {
        message: t("fishResult", { id: candidate.id }),
      });

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
