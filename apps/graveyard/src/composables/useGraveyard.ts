/**
 * useGraveyard — Domain logic for the Graveyard miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppGraveyard,
 * testnet 0xb55aa635b10a5abb5cbac169db26a38df739778e) via the MiniApp framework (ctx.framework).
 *
 * The earlier path routed every action through the Morpheus OS kernel/edge
 * (ctx.os.nft.burn + ctx.os.storage list/set + ctx.os.badge.award). That kernel
 * is down/degraded, so the app was broken at runtime: burials never anchored,
 * "forgotten" was a local flag only, and the history/stats came from a storage
 * proxy that no longer answers. None of it touched the real contract.
 *
 * MiniAppGraveyard is self-contained and uses a PREPAID-GAS model: a mutating
 * call (buryMemory / forgetMemory) consumes from the caller's prepaid balance,
 * which is topped up by a GAS transfer to the contract carrying the memo
 * "miniapp-graveyard:memory" (OnNEP17Payment credits the sender). A mutating
 * call with no prior deposit faults with "insufficient prepaid gas". The shared
 * app.chain.invokeWithPayment(amount, memo, method, args) does exactly this in one
 * step: transfer GAS → settle → invoke. We use it so every paid action is real.
 *
 * Contract interaction model (verified against the deployed ABI + live reads):
 *
 *   READS (app.chain.readRaw, default app contract script hash):
 *     getPlatformStats()              -> Map{ totalBuried, totalForgotten,
 *                                             totalMemories, buryFee, forgetFee,
 *                                             ... }  (fees in GAS base units)
 *     getMemoryDetails(memoryId)      -> Map{ id, owner, memoryType, buriedTime,
 *                                             forgotten, epitaph, forgottenTime }
 *     getUserMemoryCount(user)        -> Integer
 *
 *   USER MEMORY LIST (app.chain.events):
 *     The contract has no per-user index of memory ids, so the burial history
 *     is reconstructed from the MemoryBuried event log, filtered to the
 *     connected wallet, then enriched with getMemoryDetails for the current
 *     forgotten state. The content hash comes from the event (slot 2) since
 *     getMemoryDetails omits it.
 *       MemoryBuried(memoryId, owner, contentHash, memoryType)   slots 0..3
 *       MemoryForgotten(memoryId, owner, forgetTime)             slots 0..2
 *
 *   PAID MUTATIONS (app.chain.invokeWithPayment, GAS deposit memo
 *     "miniapp-graveyard:memory"):
 *     buryMemory(owner, contentHash, memoryType) -> Integer memoryId
 *         deposit = buryFee.    Emits MemoryBuried.
 *     forgetMemory(owner, memoryId)              -> Void
 *         deposit = forgetFee.  Emits MemoryForgotten.
 *
 * AMOUNT CONVENTION: all fees are GAS in BASE UNITS (1e8 per GAS). memoryType is
 * a small positive integer (1..5) and IS persisted on-chain.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import { parseBigInt, parseBool } from "@shared/utils/parsers";
import { sha256Hex } from "@shared/utils/hash";
import type { HistoryItem } from "../types";

// ============================================================================
// Types
// ============================================================================

export interface UseGraveyardOptions {
  /** MiniApp framework (ctx.framework); its chain layer drives every read/write. */
  app: MiniAppFramework;
  /** EventBus for UI events. */
  eventBus: { emit: (event: string, payload?: unknown) => void };
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

type ComposeMode = "hash" | "write";

export interface BurialDraftInput {
  composeMode?: unknown;
  memoryText?: unknown;
  assetHash?: unknown;
  memoryType?: unknown;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * GAS deposit memo the contract requires so OnNEP17Payment credits the sender's
 * prepaid balance (appId + ":memory"). Confirmed against the committed
 * live-validate harness (deploy/scripts/live_validate_selected_miniapps.js).
 */
const MEMORY_DEPOSIT_MEMO = "miniapp-graveyard:memory";

/** GAS base units per whole GAS (1e8). */
const GAS_DECIMALS = 100_000_000n;

/**
 * Fallback fees (GAS base units) used only until getPlatformStats resolves.
 * buryFee = 0.1 GAS, forgetFee = 1 GAS (the deployed contract's current values).
 */
const DEFAULT_BURY_FEE = 10_000_000n;
const DEFAULT_FORGET_FEE = 100_000_000n;

/** How many MemoryBuried events to scan when rebuilding the burial history. */
const HISTORY_EVENT_LIMIT = 200;

/** Max history rows surfaced to the UI (newest first). */
const HISTORY_DISPLAY_LIMIT = 20;

const EXPECTED_LOCAL_READ_FAILURES = [
  "Contract address not configured",
  "MiniApp contract address unavailable",
] as const;

function isExpectedLocalReadFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return EXPECTED_LOCAL_READ_FAILURES.some((expected) =>
    message.includes(expected),
  );
}

function warnIfUnexpectedReadFailure(context: string, error: unknown): void {
  if (isExpectedLocalReadFailure(error)) return;
  console.warn(
    context,
    error instanceof Error ? error.message : String(error),
  );
}

/**
 * The burial target is an encrypted content hash or token identifier written
 * on-chain. We reject obviously-malformed input (whitespace / control chars)
 * before the paid deposit so the fee is never spent on a target the chain
 * cannot store. Length is gated in the view (>= 12 chars); this guards only the
 * character set.
 */
const VALID_BURIAL_TARGET = /^[\x21-\x7e]+$/;

// ============================================================================
// Parsing helpers
// ============================================================================

/** Coerce a NeoVM Integer (number/string) to a JS number. */
const asNumber = (value: unknown): number => {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const parseComposeMode = (value: unknown, fallback: ComposeMode): ComposeMode =>
  value === "hash" ? "hash" : value === "write" ? "write" : fallback;

/** Format a GAS base-unit amount as a trimmed decimal string (e.g. "0.1"). */
const formatGasAmount = (base: bigint): string => {
  const whole = base / GAS_DECIMALS;
  const frac = base % GAS_DECIMALS;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(8, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr}`;
};

/**
 * Decode a base64 ByteString event value (content hashes are stored as the raw
 * UTF-8 bytes of the hash string). Returns "" for empty / non-decodable values.
 */
const decodeEventString = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0) return "";
  try {
    const decoded = atob(value);
    // Content hashes are printable ASCII; reject anything else so a malformed
    // byte blob does not surface as garbage in the record list.
    if (/^[\x20-\x7e]*$/.test(decoded)) return decoded;
    return "";
  } catch {
    return String(value);
  }
};

// ============================================================================
// Composable
// ============================================================================

export function useGraveyard({ app, eventBus, t }: UseGraveyardOptions) {
  const totalDestroyed = createObservable(0);
  // Total burial fees PAID across this wallet's burials, in GAS (display:
  // "Burial Fees"). Fees are spent, not reclaimed. This is an ESTIMATE: the
  // contract stores no per-burial fee history, so it is count × the CURRENT
  // buryFee — labelled as an estimate in the UI so a fee change can't read as
  // an authoritative lifetime total.
  const burialFeesPaid = createObservable(0);
  const assetHash = createObservable("");
  const memoryType = createObservable(1);
  const history = createObservable<HistoryItem[]>([]);
  const showConfirm = createObservable(false);
  const isDestroying = createObservable(false);
  const showWarningShake = createObservable(false);
  const forgettingId = createObservable<string | null>(null);
  const isLoading = createObservable(false);

  // Compose mode: "hash" = the user pastes a pre-made content hash (legacy);
  // "write" = the user types their memory and we sha256 it locally, so the raw
  // text never leaves the device — the same on-device-hash pattern as
  // time-capsule, giving first-time users a way to produce a burial target.
  const composeMode = createObservable<ComposeMode>("write");
  // Plaintext memory the user types in "write" mode. Hashed locally; never sent.
  const memoryText = createObservable("");

  // The history row id awaiting a forget confirmation (two-step: the first tap
  // arms the confirm with the fee shown, the second tap pays). null = none.
  const forgetConfirmId = createObservable<string | null>(null);

  // Inline epitaph editor: the row id whose epitaph is being edited (or null),
  // and the in-progress epitaph text. addEpitaph is a free, non-deposit call.
  const epitaphDraftId = createObservable<string | null>(null);
  const epitaphText = createObservable("");
  const epitaphSavingId = createObservable<string | null>(null);

  // When false, the history list is capped at HISTORY_DISPLAY_LIMIT; "Show all"
  // raises the window (events are already fetched up to HISTORY_EVENT_LIMIT).
  const showAllHistory = createObservable(false);

  // Live fees, sourced from getPlatformStats (GAS base units). Seeded with the
  // deployed defaults so the review panel shows a real fee before the first load.
  const buryFee = createObservable<bigint>(DEFAULT_BURY_FEE);
  const forgetFee = createObservable<bigint>(DEFAULT_FORGET_FEE);

  let shakeTimer: ReturnType<typeof setTimeout> | null = null;

  const memoryTypeOptions = createDerived(() => [
    { value: 1, label: t("memoryTypeSecret") },
    { value: 2, label: t("memoryTypeRegret") },
    { value: 3, label: t("memoryTypeWish") },
    { value: 4, label: t("memoryTypeConfession") },
    { value: 5, label: t("memoryTypeOther") },
  ], []);

  // "Burial Fees" total. The contract keeps no per-burial fee history, so this
  // is an ESTIMATE (count × current buryFee) — prefix "~" so it never reads as
  // an exact, authoritative lifetime figure.
  const gasReclaimedDisplay = createDerived(
    () => (burialFeesPaid.get() > 0 ? `~${burialFeesPaid.get()} ${t("tokenGas")}` : `0 ${t("tokenGas")}`),
    [burialFeesPaid],
  );
  const historyCount = createDerived(() => history.get().length, [history]);
  // Per-burial fee shown on the review panel, derived live from the on-chain
  // buryFee so a contract fee change can't leave a stale value on the paid
  // confirmation surface.
  const burialFeeDisplay = createDerived(
    () => `${formatGasAmount(buryFee.get())} ${t("tokenGas")}`,
    [buryFee],
  );
  // Forget costs the live forgetFee (10× the burial fee at current values); the
  // per-row confirm surfaces this so a tap never spends 1 GAS unannounced.
  const forgetFeeDisplay = createDerived(
    () => `${formatGasAmount(forgetFee.get())} ${t("tokenGas")}`,
    [forgetFee],
  );
  // True when the on-chain burial count exceeds the rows actually shown, so the
  // UI can footnote that the records list is truncated.
  const historyTruncated = createDerived(
    () => totalDestroyed.get() > history.get().length,
    [totalDestroyed, history],
  );

  const triggerMissingHash = () => {
    showWarningShake.set(true);
    if (shakeTimer) clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => { showWarningShake.set(false); shakeTimer = null; }, 500);
  };

  // Monotonic token so a stale async sha256 (user kept typing) can't overwrite a
  // newer one when it resolves out of order.
  let memoryHashSeq = 0;

  /**
   * "Write" mode: the user types their memory; we sha256 it LOCALLY and set that
   * 64-char hex as the burial target (assetHash). The raw text never leaves the
   * device — only the hash is ever written on-chain. Empty text clears the
   * target. This gives a first-time user an in-app way to produce a hash (the
   * legacy "hash" mode only accepted a pre-made one).
   */
  const setMemoryText = async (text: string, mode: ComposeMode = composeMode.get()) => {
    memoryText.set(text);
    const seq = ++memoryHashSeq;
    const trimmed = text.trim();
    if (!trimmed) {
      if (seq === memoryHashSeq) assetHash.set("");
      return;
    }
    if (mode === "hash") {
      if (seq === memoryHashSeq) assetHash.set(trimmed);
      return;
    }
    const digest = await sha256Hex(trimmed);
    // Ignore if a newer keystroke or mode switch superseded this one mid-hash.
    if (seq === memoryHashSeq && composeMode.get() === "write") assetHash.set(digest);
  };

  /** Switch compose mode, clearing the other mode's input so the target is unambiguous. */
  const setComposeMode = (mode: ComposeMode) => {
    if (composeMode.get() === mode) return;
    memoryHashSeq += 1;
    composeMode.set(mode);
    memoryText.set("");
    assetHash.set("");
    showConfirm.set(false);
  };

  const applyBurialDraft = async (draft: unknown) => {
    if (!isRecord(draft)) return;
    const nextMode = parseComposeMode(draft.composeMode, composeMode.get());
    if (composeMode.get() !== nextMode) setComposeMode(nextMode);

    const nextType = Number(draft.memoryType);
    if (Number.isInteger(nextType) && nextType > 0) memoryType.set(nextType);

    if (nextMode === "hash") {
      await setMemoryText(String(draft.assetHash ?? draft.memoryText ?? ""), "hash");
      return;
    }

    if ("memoryText" in draft) {
      await setMemoryText(String(draft.memoryText ?? ""), "write");
    }
  };

  const initiateDestroy = () => {
    if (!assetHash.get().trim()) {
      triggerMissingHash();
      throw new Error(t("enterAssetHash"));
    }
    showConfirm.set(true);
  };

  const cancelDestroy = () => {
    showConfirm.set(false);
  };

  // ── Wallet helper ────────────────────────────────────────────────────

  /** Resolve the connected wallet address + its script hash, prompting if needed. */
  const requireWallet = async (): Promise<{ address: string; hash: string }> => {
    const addr = app.chain.address.get() || (await app.chain.ensureWallet());
    // addressToScriptHash here is a validity-check + the owner script hash the
    // Hash160 args are built from (via app.chain.arg.hash160) — kept as-is.
    const hash = addressToScriptHash(addr || "");
    if (!addr || !hash) throw new Error(t("connectWallet"));
    return { address: addr, hash };
  };

  // ── Actions (paid, direct on-chain) ─────────────────────────────────

  /**
   * Bury a memory: deposit the buryFee in GAS (memo "miniapp-graveyard:memory")
   * then call buryMemory(owner, contentHash, memoryType). The content hash and
   * the memory type are anchored on-chain in the same paid flow; the memoryId is
   * read back from the MemoryBuried event.
   */
  const executeDestroy = async (draft?: BurialDraftInput) => {
    await applyBurialDraft(draft);
    showConfirm.set(false);
    // In-flight guard: throw (not silent return) so the host surfaces a busy
    // message instead of a misleading success toast for the dropped click.
    if (isDestroying.get()) throw new Error(t("actionBusy"));
    const currentHash = assetHash.get().trim();
    if (!currentHash) {
      triggerMissingHash();
      throw new Error(t("enterAssetHash"));
    }
    // Reject obviously-malformed targets before the paid deposit so the fee is
    // not spent on a target the chain will reject.
    if (!VALID_BURIAL_TARGET.test(currentHash)) {
      throw new Error(t("invalidHash"));
    }
    isDestroying.set(true);

    try {
      const { hash: ownerHash } = await requireWallet();
      const buriedType = memoryType.get();

      const result = await app.chain.invokeWithPayment(
        buryFee.get().toString(),
        MEMORY_DEPOSIT_MEMO,
        "buryMemory",
        [
          app.chain.arg.hash160(ownerHash),
          app.chain.arg.string(currentHash),
          app.chain.arg.integer(buriedType),
        ],
        { waitForEvent: "MemoryBuried" },
      );

      // Resolve the on-chain memoryId from the MemoryBuried event (slot 0).
      const eventMemoryId = parseBigInt(eventValue(result.event, 0));
      const memoryId =
        eventMemoryId > 0n ? eventMemoryId.toString() : String(result.txid || Date.now());

      const buriedTime = new Intl.DateTimeFormat(undefined).format(new Date());
      history.set([
        {
          id: memoryId,
          hash: currentHash,
          time: buriedTime,
          forgotten: false,
          memoryType: buriedType,
        },
        ...history.get(),
      ]);

      eventBus.emit("graveyard:buried", { action: t("memoryBuried") });
      assetHash.set("");
      memoryText.set("");

      // Refresh stats + history from chain so counters and the record list
      // reflect the settled burial (and pick up any other wallets' activity).
      await loadAll();
    } catch (e) {
      eventBus.emit("graveyard:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      isDestroying.set(false);
    }
  };

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Load platform stats + live fees from getPlatformStats. Burial-fees-paid is
   * derived from this wallet's burial count × the on-chain buryFee.
   */
  const loadStats = async () => {
    try {
      const raw = await app.chain.readRaw("getPlatformStats", []);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return;
      const stats = raw as Record<string, unknown>;

      const bury = parseBigInt(stats.buryFee);
      const forget = parseBigInt(stats.forgetFee);
      if (bury > 0n) buryFee.set(bury);
      if (forget > 0n) forgetFee.set(forget);
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGraveyard] getPlatformStats failed:", e);
    }
  };

  /**
   * Rebuild this wallet's burial history from the MemoryBuried event log,
   * filtered to the connected owner, then enriched with getMemoryDetails for the
   * current forgotten state + memory type. Newest first.
   *
   * The per-user count (getUserMemoryCount) and the displayed list both come
   * from chain, replacing the os.storage "history:" records entirely. With no
   * connected wallet, the history is empty (nothing to scope to).
   */
  const loadHistory = async () => {
    const addr = app.chain.address.get();
    if (!addr) {
      history.set([]);
      totalDestroyed.set(0);
      burialFeesPaid.set(0);
      return;
    }
    const ownerHash = addressToScriptHash(addr);

    try {
      const userCount = asNumber(
        await app.chain.readRaw("getUserMemoryCount", [
          app.chain.arg.hash160(ownerHash),
        ]),
      );
      totalDestroyed.set(userCount);
      burialFeesPaid.set(
        Number(formatGasAmount(buryFee.get() * BigInt(Math.max(0, userCount)))),
      );
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGraveyard] getUserMemoryCount failed:", e);
    }

    try {
      const events = await app.chain.events("MemoryBuried", { limit: HISTORY_EVENT_LIMIT });

      // Collect this wallet's buried memories from the event log (newest last in
      // the log → reverse for newest-first display), de-duped by memoryId.
      const mine: Array<{ id: string; hash: string; memoryType: number }> = [];
      const seen = new Set<string>();
      for (const event of events) {
        const owner = eventValue(event, 1);
        if (!ownerMatchesAddress(String(owner ?? ""), addr)) continue;
        const id = parseBigInt(eventValue(event, 0)).toString();
        if (id === "0" || seen.has(id)) continue;
        seen.add(id);
        mine.push({
          id,
          hash: decodeEventString(eventValue(event, 2)),
          memoryType: asNumber(eventValue(event, 3)) || undefined as unknown as number,
        });
      }
      mine.reverse();
      // Cap the rows we enrich+display: HISTORY_DISPLAY_LIMIT until the user
      // taps "Show all", which raises the window to the full fetched set (up to
      // HISTORY_EVENT_LIMIT). Avoids HISTORY_EVENT_LIMIT getMemoryDetails reads
      // on every load while still letting users see beyond the first 20.
      const displayLimit = showAllHistory.get() ? HISTORY_EVENT_LIMIT : HISTORY_DISPLAY_LIMIT;
      const recent = mine.slice(0, displayLimit);

      // Enrich each with getMemoryDetails for the live forgotten flag + a
      // canonical memory type / buried time / epitaph. Best-effort per row.
      const entries = await Promise.all(
        recent.map(async (item): Promise<HistoryItem> => {
          let forgotten = false;
          let buriedTime = "";
          let chainType = item.memoryType;
          let epitaph = "";
          try {
            const details = await app.chain.readRaw("getMemoryDetails", [
              app.chain.arg.integer(item.id),
            ]);
            if (details && typeof details === "object" && !Array.isArray(details)) {
              const d = details as Record<string, unknown>;
              forgotten = parseBool(d.forgotten);
              const ms = asNumber(d.buriedTime);
              if (ms > 0) {
                buriedTime = new Intl.DateTimeFormat(undefined).format(new Date(ms));
              }
              const ct = asNumber(d.memoryType);
              if (ct > 0) chainType = ct;
              const ep = typeof d.epitaph === "string" ? d.epitaph : "";
              // The epitaph comes back as raw printable text via parseByteLike;
              // keep only printable values so a byte blob never renders garbage.
              if (ep && /^[\x20-\x7e -]*$/.test(ep)) epitaph = ep;
            }
          } catch (e) {
            warnIfUnexpectedReadFailure(
              `[useGraveyard] getMemoryDetails failed for ${item.id}:`,
              e,
            );
          }
          return {
            id: item.id,
            hash: item.hash,
            time: buriedTime,
            forgotten,
            memoryType: chainType || undefined,
            epitaph,
          };
        }),
      );

      history.set(entries);
    } catch (e) {
      warnIfUnexpectedReadFailure(
        "[useGraveyard] MemoryBuried history fetch failed:",
        e,
      );
    }
  };

  /**
   * Arm the forget confirmation for a row. Forgetting costs the forgetFee (1 GAS
   * = 10× the burial fee), so it must NOT fire on a single unconfirmed tap; this
   * surfaces the fee + a Confirm/Cancel before any GAS moves.
   */
  const requestForget = (item: HistoryItem) => {
    if (!item.id || item.forgotten) return;
    if (forgettingId.get()) throw new Error(t("actionBusy"));
    forgetConfirmId.set(item.id);
  };

  /** Dismiss the forget confirmation without paying. */
  const cancelForget = () => {
    forgetConfirmId.set(null);
  };

  /**
   * Forget a memory: deposit the forgetFee in GAS (memo
   * "miniapp-graveyard:memory") then call forgetMemory(owner, memoryId). The
   * forgotten state is recorded on-chain (MemoryForgotten), not a local flag.
   *
   * Guarded by an explicit confirmation (requestForget): the paid call only
   * proceeds for the row the user confirmed, so a 1-GAS spend is never silent.
   */
  const forgetMemory = async (item: HistoryItem) => {
    // Legitimate no-ops: nothing to forget. Return silently (no toast).
    if (!item.id || item.forgotten) return;
    // Require the explicit confirmation for THIS row before paying.
    if (forgetConfirmId.get() !== item.id) {
      requestForget(item);
      return;
    }
    // Busy case: a forget is already in flight. Throw so the host surfaces a
    // busy message instead of a misleading "forgotten" success toast — only the
    // in-flight row shows a spinner, so other rows look broken otherwise.
    if (forgettingId.get()) throw new Error(t("actionBusy"));

    forgetConfirmId.set(null);
    forgettingId.set(item.id);
    try {
      const { hash: ownerHash } = await requireWallet();

      await app.chain.invokeWithPayment(
        forgetFee.get().toString(),
        MEMORY_DEPOSIT_MEMO,
        "forgetMemory",
        [
          app.chain.arg.hash160(ownerHash),
          app.chain.arg.integer(item.id),
        ],
        { waitForEvent: "MemoryForgotten" },
      );

      history.set(
        history.get().map((entry) =>
          entry.id === item.id ? { ...entry, forgotten: true } : entry,
        ),
      );
      eventBus.emit("graveyard:forgotten", { action: t("forgetSuccess") });
    } catch (e) {
      eventBus.emit("graveyard:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      forgettingId.set(null);
    }
  };

  // ── Epitaph (free, non-deposit) ─────────────────────────────────────

  const EPITAPH_MAX = 120;

  /** Open the inline epitaph editor for a row, seeded with any existing epitaph. */
  const startEpitaph = (item: HistoryItem) => {
    epitaphDraftId.set(item.id);
    epitaphText.set(item.epitaph ?? "");
  };

  /** Close the inline epitaph editor without saving. */
  const cancelEpitaph = () => {
    epitaphDraftId.set(null);
    epitaphText.set("");
  };

  /**
   * Attach an epitaph to a buried memory via addEpitaph(memoryId, epitaph). This
   * is a FREE, non-deposit call (no GAS transfer) — only the owner's witness is
   * required, supplied by the connected wallet's signature. The new epitaph is
   * read back into the row on the post-call reload.
   */
  const saveEpitaph = async (item: HistoryItem) => {
    const text = epitaphText.get().trim();
    if (!item.id) return;
    if (!text) throw new Error(t("epitaphRequired"));
    if (text.length > EPITAPH_MAX) throw new Error(t("epitaphTooLong"));
    if (epitaphSavingId.get()) throw new Error(t("actionBusy"));

    epitaphSavingId.set(item.id);
    try {
      // Ensure a wallet is connected to sign the owner witness.
      await requireWallet();
      await app.chain.invoke(
        "addEpitaph",
        [
          app.chain.arg.integer(item.id),
          app.chain.arg.string(text),
        ],
        { waitForEvent: "EpitaphAdded" },
      );
      // Optimistically reflect locally, then reload for the canonical value.
      history.set(
        history.get().map((entry) =>
          entry.id === item.id ? { ...entry, epitaph: text } : entry,
        ),
      );
      epitaphDraftId.set(null);
      epitaphText.set("");
      eventBus.emit("graveyard:epitaph", { action: t("epitaphSaved") });
      await loadHistory();
    } catch (e) {
      eventBus.emit("graveyard:error", { message: e instanceof Error ? e.message : t("error") });
      throw e;
    } finally {
      epitaphSavingId.set(null);
    }
  };

  /** Toggle the full-history view; reload so the wider slice is enriched. */
  const setShowAllHistory = async (value: boolean) => {
    showAllHistory.set(value);
    await loadHistory();
  };

  // ── Load All ────────────────────────────────────────────────────────

  const loadAll = async () => {
    isLoading.set(true);
    try {
      // Stats first so loadHistory can price burial-fees-paid off the live fee.
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
    totalDestroyed, burialFeesPaid, assetHash, memoryType, history,
    showConfirm, isDestroying, showWarningShake, forgettingId, isLoading,
    memoryTypeOptions, gasReclaimedDisplay, burialFeeDisplay, historyCount,
    // Compose mode (write/hash) + local-hash text
    composeMode, memoryText, setComposeMode, setMemoryText,
    // Forget confirmation + fee
    forgetFeeDisplay, forgetConfirmId, requestForget, cancelForget,
    // Epitaph editor (free, non-deposit)
    epitaphDraftId, epitaphText, epitaphSavingId, startEpitaph, cancelEpitaph, saveEpitaph,
    // History pagination
    showAllHistory, historyTruncated, setShowAllHistory,
    initiateDestroy, cancelDestroy, executeDestroy, loadStats, loadHistory, forgetMemory,
    loadAll, cleanupTimers,
  };
}

export type UseGraveyardReturn = ReturnType<typeof useGraveyard>;
