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
import { DepositConfirmedActionFailedError } from "@shared/composables/useContractInteraction";
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
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

export type ComposeMode = "hash" | "write" | "file";

/**
 * Phase of the wallet-scoped burial read.
 * - `loading`         — a read is in flight; nothing is known yet.
 * - `awaiting-wallet` — no wallet, so there is no owner to scope a read to.
 *                       A settled fact, not a pending read.
 * - `ready`           — the count came back and is real (zero included).
 * - `error`           — the read failed; the count is unknown.
 */
export type GraveyardReadStatus = "loading" | "awaiting-wallet" | "ready" | "error";

export interface BurialDraftInput {
  composeMode?: unknown;
  memoryText?: unknown;
  assetHash?: unknown;
  memoryType?: unknown;
}

type PrepaidRecoveryOperation = "buryMemory" | "forgetMemory" | "addEpitaph";
type PrepaidRecoveryPhase = "deposit-broadcast" | "target-broadcast";

interface PrepaidRecovery {
  version: 1;
  operation: PrepaidRecoveryOperation;
  phase: PrepaidRecoveryPhase;
  ownerAddress: string;
  amountBaseUnits: string;
  depositTxid: string;
  targetTxid: string;
  contentHash?: string;
  memoryType?: number;
  memoryId?: string;
  epitaph?: string;
  updatedAt: string;
}

type PrepaidRecoveryLedger = Record<string, PrepaidRecovery>;

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

/** Device-local recovery journal for deposits broadcast before a target call settles. */
const PREPAID_RECOVERY_KEY = "prepaid-recovery/v1";
const PREPAID_RECOVERY_LIMIT = 12;
const RECOVERY_STORAGE_PROBE_KEY = "prepaid-recovery/storage-probe-v1";
const EPITAPH_MAX = 120;

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
 * The only supported burial target is a SHA-256 digest. Keeping this strict
 * prevents a paid transaction from anchoring an accidental filename, plaintext
 * fragment, or malformed token identifier.
 */
const VALID_BURIAL_TARGET = /^[0-9a-f]{64}$/i;

/** File hashing is intentionally bounded so a dropped file cannot exhaust the tab. */
export const MAX_MEMORY_FILE_BYTES = 25 * 1024 * 1024;

// ============================================================================
// Parsing helpers
// ============================================================================

/** Coerce a NeoVM Integer (number/string) to a JS number. */
const asNumber = (value: unknown): number => {
  const n = Number(parseBigInt(value));
  return Number.isFinite(n) ? n : 0;
};

const normaliseSha256 = (value: string): string =>
  value.trim().replace(/^0x/i, "").toLowerCase();

const isMemoryType = (value: unknown): value is number => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 5;
};

const bytesToHex = (bytes: Uint8Array): string => {
  let result = "";
  for (const byte of bytes) result += byte.toString(16).padStart(2, "0");
  return result;
};

const readBlobBytes = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === "function") return blob.arrayBuffer();
  if (typeof FileReader !== "undefined") {
    return new Promise<ArrayBuffer>((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error ?? new Error("File read failed"));
      reader.onload = () => {
        if (reader.result instanceof ArrayBuffer) resolve(reader.result);
        else reject(new Error("File read did not produce bytes"));
      };
      reader.readAsArrayBuffer(blob);
    });
  }
  return new Response(blob).arrayBuffer();
};

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
 * UTF-8 bytes of the hash string). Already-decoded adapter strings pass through.
 */
const decodeEventString = (value: unknown): string => {
  if (typeof value !== "string" || value.length === 0) return "";
  const literal = value.trim();
  if (/^(?:0x)?[0-9a-f]{64}$/i.test(literal)) {
    return literal.replace(/^0x/i, "");
  }
  try {
    const decoded = atob(literal);
    // Content hashes are printable ASCII; reject anything else so a malformed
    // byte blob does not surface as garbage in the record list.
    if (/^[\x20-\x7e]*$/.test(decoded)) return decoded;
    try {
      const bytes = Uint8Array.from(decoded, (char) => char.charCodeAt(0));
      const utf8 = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (utf8 && !/[\u0000-\u001f\u007f]/u.test(utf8)) return utf8;
    } catch {
      // The adapter may already have returned decoded text; keep it below.
    }
    // Some adapters already decode Neo ByteStrings. If treating that plain
    // text as base64 produces binary noise, keep the adapter's literal value.
    return literal;
  } catch {
    return literal;
  }
};

const recoveryLedgerKey = (
  ownerAddress: string,
  operation: PrepaidRecoveryOperation,
): string => `${ownerAddress.trim().toLowerCase()}:${operation}`;

const isPrepaidRecovery = (value: unknown): value is PrepaidRecovery => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = value as Partial<PrepaidRecovery>;
  const baseValid = entry.version === 1
    && (
      entry.operation === "buryMemory"
      || entry.operation === "forgetMemory"
      || entry.operation === "addEpitaph"
    )
    && (entry.phase === "deposit-broadcast" || entry.phase === "target-broadcast")
    && typeof entry.ownerAddress === "string"
    && entry.ownerAddress.trim().length > 0
    && typeof entry.amountBaseUnits === "string"
    && /^\d+$/.test(entry.amountBaseUnits)
    && typeof entry.depositTxid === "string"
    && typeof entry.targetTxid === "string"
    && typeof entry.updatedAt === "string";
  if (!baseValid) return false;
  if (entry.operation !== "addEpitaph") return true;
  return entry.phase === "target-broadcast"
    && entry.amountBaseUnits === "0"
    && entry.depositTxid === ""
    && typeof entry.memoryId === "string"
    && /^[1-9]\d*$/.test(entry.memoryId)
    && typeof entry.epitaph === "string"
    && entry.epitaph.trim().length > 0
    && entry.epitaph.length <= EPITAPH_MAX;
};

const sanitizeRecoveryLedger = (value: unknown): PrepaidRecoveryLedger => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => isPrepaidRecovery(entry))
      .sort(([, left], [, right]) =>
        String((right as PrepaidRecovery).updatedAt).localeCompare(
          String((left as PrepaidRecovery).updatedAt),
        ),
      )
      .slice(0, PREPAID_RECOVERY_LIMIT),
  ) as PrepaidRecoveryLedger;
};

// ============================================================================
// Composable
// ============================================================================

export function useGraveyard({ app, t }: UseGraveyardOptions) {
  /**
   * Which phase the wallet-scoped burial read is in. This app previously had no
   * such signal, so absence and zero were the same value — `totalDestroyed`
   * rested at `0` and the chrome published "Total destroyed 0", a count
   * asserting this wallet has destroyed nothing, before any read had run.
   *
   * A count is a claim. These four states keep the claim honest, and let the
   * settled ones stay real values rather than borrowing pending copy.
   */
  const historyStatus = createObservable<GraveyardReadStatus>("loading");
  // `undefined`, not 0: nothing has been read yet. A SETTLED count of zero is a
  // real reading (a wallet that has buried nothing) and must survive.
  const totalDestroyed = createObservable<number | undefined>(undefined);
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
  const isHashing = createObservable(false);
  const sourceError = createObservable("");
  const fileName = createObservable("");
  const fileSize = createObservable(0);
  // Paid actions remain disabled until both current contract fees have been
  // read successfully. The seeded values are display fallbacks only; using a
  // stale fee can deposit GAS and then fault the business call.
  const feesReady = createObservable(false);
  /**
   * True once a fee read has actually completed, successfully or not.
   *
   * `feesReady` alone cannot tell "we have not finished asking" from "we asked
   * and got nothing", so the surface collapsed both into one placeholder: the
   * fee rails rendered "Checking…" while the panel below already showed the
   * settled-failure warning, i.e. the first screen claimed to be checking and
   * to have failed at the same time. This is the `settled` half of the shared
   * DataPhase vocabulary (apps/shared/components-react/v2/DataPhase.tsx).
   */
  const feesSettled = createObservable(false);
  const contractPaused = createObservable(false);
  const contractStateReady = createObservable(false);
  const storageHealthy = createObservable(true);

  const safeStorageGet = <T,>(key: string, fallback: T): T => {
    try {
      return app.storage.local.get<T>(key, fallback) ?? fallback;
    } catch {
      storageHealthy.set(false);
      return fallback;
    }
  };

  const safeStorageSet = (key: string, value: unknown): boolean => {
    try {
      app.storage.local.set(key, value);
      return true;
    } catch {
      storageHealthy.set(false);
      return false;
    }
  };

  const safeStorageDelete = (key: string): boolean => {
    try {
      app.storage.local.delete(key);
      return true;
    } catch {
      storageHealthy.set(false);
      return false;
    }
  };

  const assertRecoveryStorage = () => {
    const probe = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    if (!safeStorageSet(RECOVERY_STORAGE_PROBE_KEY, probe)) {
      throw new Error(t("recoveryStorageUnavailable"));
    }
    const restored = safeStorageGet(RECOVERY_STORAGE_PROBE_KEY, "");
    if (restored !== probe || !safeStorageDelete(RECOVERY_STORAGE_PROBE_KEY)) {
      storageHealthy.set(false);
      throw new Error(t("recoveryStorageUnavailable"));
    }
    storageHealthy.set(true);
  };

  const prepaidRecoveries = createObservable<PrepaidRecoveryLedger>(
    sanitizeRecoveryLedger(
      safeStorageGet<PrepaidRecoveryLedger>(PREPAID_RECOVERY_KEY, {}),
    ),
  );

  // Compose source: a private note, a local file, or an existing SHA-256 digest.
  // Notes and files are digested locally; only the 64-character hash can reach
  // the paid contract call.
  const composeMode = createObservable<ComposeMode>("write");
  // Plaintext memory the user types in "write" mode. Hashed locally; never sent.
  const memoryText = createObservable("");

  // The history row id awaiting a forget confirmation (two-step: the first tap
  // arms the confirm with the fee shown, the second tap pays). null = none.
  const forgetConfirmId = createObservable<string | null>(null);

  // Inline epitaph editor: the row id whose epitaph is being edited (or null),
  // and the in-progress epitaph text. addEpitaph uses no app deposit; the wallet
  // can still quote the normal Neo network fee for the signed invocation.
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

  const walletAddress = createDerived(
    () => app.chain.address.get() || "",
    [app.chain.address],
  );
  const walletConnected = createDerived(
    () => Boolean(app.chain.address.get()),
    [app.chain.address],
  );

  let shakeTimer: ReturnType<typeof setTimeout> | null = null;
  let lastHistoryOwner = "";
  let confirmedBurial: {
    hash: string;
    memoryType: number;
    buryFee: bigint;
  } | null = null;
  let confirmedForgetFee: bigint | null = null;

  const persistRecoveries = (next: PrepaidRecoveryLedger) => {
    const sanitized = sanitizeRecoveryLedger(next);
    if (!safeStorageSet(PREPAID_RECOVERY_KEY, sanitized)) {
      prepaidRecoveries.set(sanitized);
      throw new Error(t("recoveryStorageUnavailable"));
    }
    const restored = sanitizeRecoveryLedger(
      safeStorageGet<PrepaidRecoveryLedger>(PREPAID_RECOVERY_KEY, {}),
    );
    if (JSON.stringify(restored) !== JSON.stringify(sanitized)) {
      storageHealthy.set(false);
      prepaidRecoveries.set(sanitized);
      throw new Error(t("recoveryStorageUnavailable"));
    }
    storageHealthy.set(true);
    prepaidRecoveries.set(restored);
  };

  const getRecovery = (
    ownerAddress: string,
    operation: PrepaidRecoveryOperation,
  ): PrepaidRecovery | null => (
    prepaidRecoveries.get()[recoveryLedgerKey(ownerAddress, operation)] ?? null
  );

  const saveRecovery = (entry: PrepaidRecovery) => {
    persistRecoveries({
      ...prepaidRecoveries.get(),
      [recoveryLedgerKey(entry.ownerAddress, entry.operation)]: entry,
    });
  };

  const clearRecovery = (
    ownerAddress: string,
    operation: PrepaidRecoveryOperation,
  ) => {
    const key = recoveryLedgerKey(ownerAddress, operation);
    if (!prepaidRecoveries.get()[key]) return;
    const next = { ...prepaidRecoveries.get() };
    delete next[key];
    persistRecoveries(next);
  };

  const updateRecoveryPhase = (
    ownerAddress: string,
    operation: PrepaidRecoveryOperation,
    targetTxid: string,
  ) => {
    const current = getRecovery(ownerAddress, operation);
    if (!current) return;
    saveRecovery({
      ...current,
      phase: "target-broadcast",
      targetTxid,
      updatedAt: new Date().toISOString(),
    });
  };

  const activeRecovery = (operation: PrepaidRecoveryOperation) => {
    const ownerAddress = app.chain.address.get() || "";
    return ownerAddress ? getRecovery(ownerAddress, operation) : null;
  };

  const memoryTypeOptions = createDerived(() => [
    { value: 1, label: t("memoryTypeSecret") },
    { value: 2, label: t("memoryTypeRegret") },
    { value: 3, label: t("memoryTypeWish") },
    { value: 4, label: t("memoryTypeConfession") },
    { value: 5, label: t("memoryTypeOther") },
  ], []);
  const burialRecoveryPhase = createDerived(
    () => activeRecovery("buryMemory")?.phase ?? "",
    [prepaidRecoveries, app.chain.address],
  );
  const burialRecoveryTxid = createDerived(
    () => {
      const recovery = activeRecovery("buryMemory");
      return recovery?.targetTxid || recovery?.depositTxid || "";
    },
    [prepaidRecoveries, app.chain.address],
  );
  const forgetRecoveryPhase = createDerived(
    () => activeRecovery("forgetMemory")?.phase ?? "",
    [prepaidRecoveries, app.chain.address],
  );
  const forgetRecoveryMemoryId = createDerived(
    () => activeRecovery("forgetMemory")?.memoryId ?? "",
    [prepaidRecoveries, app.chain.address],
  );
  const epitaphRecoveryPhase = createDerived(
    () => activeRecovery("addEpitaph")?.phase ?? "",
    [prepaidRecoveries, app.chain.address],
  );
  const epitaphRecoveryMemoryId = createDerived(
    () => activeRecovery("addEpitaph")?.memoryId ?? "",
    [prepaidRecoveries, app.chain.address],
  );
  const epitaphRecoveryTxid = createDerived(
    () => activeRecovery("addEpitaph")?.targetTxid ?? "",
    [prepaidRecoveries, app.chain.address],
  );

  const restoreBurialDraftFromRecovery = () => {
    if (assetHash.get()) return;
    const recovery = activeRecovery("buryMemory");
    const recoveredHash = normaliseSha256(recovery?.contentHash ?? "");
    if (!VALID_BURIAL_TARGET.test(recoveredHash)) return;
    composeMode.set("hash");
    memoryText.set(recoveredHash);
    assetHash.set(recoveredHash);
    if (isMemoryType(recovery?.memoryType)) {
      memoryType.set(Number(recovery?.memoryType));
    }
  };
  const unsubscribeRecoveryRestore = app.chain.address.subscribe(
    restoreBurialDraftFromRecovery,
  );
  restoreBurialDraftFromRecovery();

  // "Burial Fees" total. The contract keeps no per-burial fee history, so this
  // is an ESTIMATE (count × current buryFee) — prefix "~" so it never reads as
  // an exact, authoritative lifetime figure.
  /**
   * Maps the read phase onto what the chrome can truthfully say. Only the
   * unread state is `undefined` (the manifest binding's `pendingKey` speaks for
   * it); "Connect wallet" and "N/A" are settled facts and so are real values.
   * Returns `null` when the caller should use its own settled reading.
   */
  const settledFactOr = (): string | undefined | null => {
    const status = historyStatus.get();
    if (status === "awaiting-wallet") return t("connectWallet");
    if (status === "error") return t("notAvailable");
    if (status === "loading") return undefined;
    return null; // ready — the caller's real reading stands
  };

  const totalDestroyedDisplay = createDerived(() => {
    const fact = settledFactOr();
    return fact === null ? totalDestroyed.get() : fact;
  }, [totalDestroyed, historyStatus]);

  const gasReclaimedDisplay = createDerived(
    () => {
      const fact = settledFactOr();
      if (fact !== null) return fact;
      return burialFeesPaid.get() > 0 ? `~${burialFeesPaid.get()} ${t("tokenGas")}` : `0 ${t("tokenGas")}`;
    },
    [burialFeesPaid, historyStatus],
  );
  const historyCount = createDerived(() => history.get().length, [history]);
  // The chrome's read-out of the same count. `historyCount` stays a plain number
  // for the PlayArea's arithmetic; this one can also say why it has no number.
  const historyCountDisplay = createDerived(() => {
    const fact = settledFactOr();
    return fact === null ? history.get().length : fact;
  }, [history, historyStatus]);
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
    // An unread count cannot prove the list is truncated; `undefined ?? 0`
    // keeps this false until a real count says otherwise.
    () => (totalDestroyed.get() ?? 0) > history.get().length,
    [totalDestroyed, history],
  );

  const triggerMissingHash = () => {
    showWarningShake.set(true);
    if (shakeTimer) clearTimeout(shakeTimer);
    shakeTimer = setTimeout(() => { showWarningShake.set(false); shakeTimer = null; }, 500);
  };

  const requireWritableContract = () => {
    if (contractPaused.get()) throw new Error(t("contractPausedAction"));
    if (!contractStateReady.get() || !feesReady.get()) {
      throw new Error(t("liveFeeUnavailable"));
    }
  };

  // Monotonic token so a stale async sha256 (user kept typing) can't overwrite a
  // newer one when it resolves out of order.
  let memoryHashSeq = 0;

  /**
   * Hash a private note on this device. Existing-hash mode only normalises the
   * supplied digest; it never hashes that digest a second time.
   */
  const setMemoryText = async (text: string, mode: ComposeMode = composeMode.get()) => {
    memoryText.set(text);
    sourceError.set("");
    const seq = ++memoryHashSeq;
    if (!text.trim()) {
      if (seq === memoryHashSeq) {
        assetHash.set("");
        isHashing.set(false);
      }
      return;
    }
    if (mode === "hash") {
      if (seq === memoryHashSeq) {
        assetHash.set(normaliseSha256(text));
        isHashing.set(false);
      }
      return;
    }
    if (mode !== "write") return;

    isHashing.set(true);
    assetHash.set("");
    try {
      // Hash the exact note bytes, including deliberate leading/trailing spaces.
      const digest = await sha256Hex(text);
      if (seq === memoryHashSeq && composeMode.get() === "write") {
        assetHash.set(digest);
      }
    } catch {
      if (seq === memoryHashSeq) sourceError.set(t("hashUnavailable"));
    } finally {
      if (seq === memoryHashSeq) isHashing.set(false);
    }
  };

  /** Hash a local file without uploading or retaining its bytes. */
  const hashMemoryFile = async (file: File) => {
    if (!(file instanceof Blob)) throw new Error(t("fileRequired"));
    if (composeMode.get() !== "file") setComposeMode("file");
    const seq = ++memoryHashSeq;
    fileName.set(file.name || t("localFile"));
    fileSize.set(file.size);
    sourceError.set("");
    assetHash.set("");
    isHashing.set(false);
    if (file.size <= 0) {
      sourceError.set(t("fileEmpty"));
      throw new Error(t("fileEmpty"));
    }
    if (file.size > MAX_MEMORY_FILE_BYTES) {
      sourceError.set(t("fileTooLarge"));
      throw new Error(t("fileTooLarge"));
    }
    isHashing.set(true);

    try {
      const bytes = await readBlobBytes(file);
      const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
      if (seq === memoryHashSeq && composeMode.get() === "file") {
        assetHash.set(bytesToHex(digest));
      }
    } catch (error) {
      if (seq === memoryHashSeq) {
        sourceError.set(t("fileHashFailed"));
        fileName.set("");
        fileSize.set(0);
      }
      throw error;
    } finally {
      if (seq === memoryHashSeq) isHashing.set(false);
    }
  };

  /** Switch source, clearing the previous source so the target is unambiguous. */
  const setComposeMode = (mode: ComposeMode) => {
    if (composeMode.get() === mode) return;
    memoryHashSeq += 1;
    composeMode.set(mode);
    memoryText.set("");
    assetHash.set("");
    fileName.set("");
    fileSize.set(0);
    sourceError.set("");
    isHashing.set(false);
    showConfirm.set(false);
  };

  const initiateDestroy = () => {
    if (isHashing.get()) throw new Error(t("hashingInProgress"));
    const currentHash = normaliseSha256(assetHash.get());
    if (!currentHash) {
      triggerMissingHash();
      throw new Error(t("enterAssetHash"));
    }
    if (!VALID_BURIAL_TARGET.test(currentHash)) {
      throw new Error(t("invalidHash"));
    }
    const currentType = memoryType.get();
    if (!isMemoryType(currentType)) {
      throw new Error(t("invalidMemoryType"));
    }
    requireWritableContract();
    if (activeRecovery("buryMemory")?.phase === "target-broadcast") {
      throw new Error(t("burialPendingResolution"));
    }
    confirmedBurial = {
      hash: currentHash,
      memoryType: currentType,
      buryFee: buryFee.get(),
    };
    showConfirm.set(true);
  };

  const cancelDestroy = () => {
    showConfirm.set(false);
    confirmedBurial = null;
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
  const executeDestroy = async () => {
    // In-flight guard: throw (not silent return) so the host surfaces a busy
    // message instead of a misleading success toast for the dropped click.
    if (isDestroying.get()) throw new Error(t("actionBusy"));
    const currentHash = normaliseSha256(assetHash.get());
    if (!currentHash) {
      triggerMissingHash();
      throw new Error(t("enterAssetHash"));
    }
    // Reject obviously-malformed targets before the paid deposit so the fee is
    // not spent on a target the chain will reject.
    if (!VALID_BURIAL_TARGET.test(currentHash)) {
      throw new Error(t("invalidHash"));
    }
    const buriedType = memoryType.get();
    if (!isMemoryType(buriedType)) {
      throw new Error(t("invalidMemoryType"));
    }
    requireWritableContract();

    // The paid action is intentionally unavailable without the explicit review
    // sheet. This is a logic boundary, not only a UI convention: a stray action
    // dispatch cannot skip the fee/hash/permanence confirmation.
    const reviewedBurial = confirmedBurial;
    if (!showConfirm.get() || !reviewedBurial) {
      throw new Error(t("burialConfirmationRequired"));
    }
    if (
      reviewedBurial.hash !== currentHash
      || reviewedBurial.memoryType !== buriedType
      || reviewedBurial.buryFee !== buryFee.get()
    ) {
      // Re-arm the snapshot to the values now visible in the sheet. The user
      // must press the final action again to accept the changed target or fee.
      confirmedBurial = {
        hash: currentHash,
        memoryType: buriedType,
        buryFee: buryFee.get(),
      };
      throw new Error(t("burialReviewChanged"));
    }
    isDestroying.set(true);

    try {
      // Re-read immediately before requesting a signature. A fee that changed
      // after the review sheet opened must be shown and accepted explicitly;
      // never silently transfer a newer amount than the user reviewed.
      const liveFeesAvailable = await loadStats();
      if (!liveFeesAvailable) {
        throw new Error(t(contractPaused.get() ? "contractPausedAction" : "liveFeeUnavailable"));
      }
      if (reviewedBurial.buryFee !== buryFee.get()) {
        confirmedBurial = {
          hash: currentHash,
          memoryType: buriedType,
          buryFee: buryFee.get(),
        };
        throw new Error(t("burialReviewChanged"));
      }
      const { address: ownerAddress, hash: ownerHash } = await requireWallet();
      assertRecoveryStorage();
      const args = [
        app.chain.arg.hash160(ownerHash),
        app.chain.arg.string(currentHash),
        app.chain.arg.integer(buriedType),
      ];
      const existingRecovery = getRecovery(ownerAddress, "buryMemory");
      if (existingRecovery?.phase === "target-broadcast") {
        throw new Error(t("burialPendingResolution"));
      }
      let result: Awaited<ReturnType<typeof app.chain.invoke>>;
      try {
        if (existingRecovery) {
          // A previous GAS transfer was already broadcast for this wallet. A
          // retry invokes the target directly, so recovery can never charge a
          // second deposit while the first credit remains unresolved.
          saveRecovery({
            ...existingRecovery,
            contentHash: currentHash,
            memoryType: buriedType,
            updatedAt: new Date().toISOString(),
          });
          result = await app.chain.invoke("buryMemory", args, {
            waitForEvent: "MemoryBuried",
            onTransactionSent: (txid) =>
              updateRecoveryPhase(ownerAddress, "buryMemory", txid),
          });
        } else {
          result = await app.chain.invokeWithPayment(
            buryFee.get().toString(),
            MEMORY_DEPOSIT_MEMO,
            "buryMemory",
            args,
            {
              waitForEvent: "MemoryBuried",
              onPaymentSent: (depositTxid) => saveRecovery({
                version: 1,
                operation: "buryMemory",
                phase: "deposit-broadcast",
                ownerAddress,
                amountBaseUnits: buryFee.get().toString(),
                depositTxid,
                targetTxid: "",
                contentHash: currentHash,
                memoryType: buriedType,
                updatedAt: new Date().toISOString(),
              }),
              onTransactionSent: (txid) =>
                updateRecoveryPhase(ownerAddress, "buryMemory", txid),
            },
          );
        }
      } catch (error) {
        if (error instanceof DepositConfirmedActionFailedError) {
          saveRecovery({
            version: 1,
            operation: "buryMemory",
            phase: "deposit-broadcast",
            ownerAddress,
            amountBaseUnits: buryFee.get().toString(),
            depositTxid: error.depositTxid,
            targetTxid: "",
            contentHash: currentHash,
            memoryType: buriedType,
            updatedAt: new Date().toISOString(),
          });
          throw new Error(t("prepaidBurialRecovery"));
        }
        if (existingRecovery) throw new Error(t("prepaidBurialRetryFailed"));
        throw error;
      }

      // ChainService deliberately distinguishes "broadcast" from "verified".
      // A timeout returns success:true/verified:false, so never treat txid alone
      // as burial success and never clear the private source on that path.
      if (result.verified !== true || !result.event) {
        showConfirm.set(false);
        confirmedBurial = null;
        throw new Error(t("burialUnverified"));
      }

      // Resolve the on-chain memoryId from the MemoryBuried event (slot 0).
      const eventMemoryId = parseBigInt(eventValue(result.event, 0));
      const eventOwner = eventValue(result.event, 1);
      const eventHash = normaliseSha256(
        decodeEventString(eventValue(result.event, 2)),
      );
      const eventMemoryType = asNumber(eventValue(result.event, 3));
      if (
        eventMemoryId <= 0n
        || !ownerMatchesAddress(String(eventOwner ?? ""), ownerAddress)
        || eventHash !== currentHash
        || eventMemoryType !== buriedType
      ) {
        showConfirm.set(false);
        confirmedBurial = null;
        throw new Error(t("burialUnverified"));
      }
      const memoryId = eventMemoryId.toString();
      clearRecovery(ownerAddress, "buryMemory");

      const buriedTime = new Intl.DateTimeFormat(undefined).format(new Date());
      const confirmedEntry: HistoryItem = {
        id: memoryId,
        hash: currentHash,
        time: buriedTime,
        forgotten: false,
        memoryType: buriedType,
      };
      history.set([confirmedEntry, ...history.get()]);

      assetHash.set("");
      memoryText.set("");
      fileName.set("");
      fileSize.set(0);
      sourceError.set("");
      showConfirm.set(false);
      confirmedBurial = null;

      // Refresh stats + history from chain so counters and the record list
      // reflect the settled burial (and pick up any other wallets' activity).
      await loadAll();
      // The confirming event can arrive a moment before the broad event-list
      // endpoint catches up. Keep the event-verified row visible instead of
      // letting that short indexer lag make a successful burial disappear.
      if (!history.get().some((entry) => entry.id === memoryId)) {
        history.set([confirmedEntry, ...history.get()]);
      }
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
      contractStateReady.set(false);
      const [raw, pausedRaw] = await Promise.all([
        app.chain.readRaw("getPlatformStats", []),
        app.chain.readRaw("isPaused", []),
      ]);
      if (typeof pausedRaw !== "boolean") {
        contractPaused.set(false);
        feesReady.set(false);
        return false;
      }
      contractPaused.set(pausedRaw);
      contractStateReady.set(true);
      if (pausedRaw) {
        feesReady.set(false);
        return false;
      }
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        feesReady.set(false);
        return false;
      }
      const stats = raw as Record<string, unknown>;

      const bury = parseBigInt(stats.buryFee);
      const forget = parseBigInt(stats.forgetFee);
      if (bury <= 0n || forget <= 0n) {
        feesReady.set(false);
        return false;
      }
      buryFee.set(bury);
      forgetFee.set(forget);
      feesReady.set(true);
      return true;
    } catch (e) {
      feesReady.set(false);
      contractStateReady.set(false);
      contractPaused.set(false);
      warnIfUnexpectedReadFailure("[useGraveyard] contract readiness failed:", e);
      return false;
    }
  };

  const reconcileRecoveries = (ownerAddress: string, entries: HistoryItem[]) => {
    const burial = getRecovery(ownerAddress, "buryMemory");
    if (
      burial?.contentHash
      && entries.some((entry) => normaliseSha256(entry.hash) === burial.contentHash)
    ) {
      clearRecovery(ownerAddress, "buryMemory");
    }
    const forgetting = getRecovery(ownerAddress, "forgetMemory");
    if (
      forgetting?.memoryId
      && entries.some((entry) => entry.id === forgetting.memoryId && entry.forgotten)
    ) {
      clearRecovery(ownerAddress, "forgetMemory");
    }
    const epitaph = getRecovery(ownerAddress, "addEpitaph");
    if (
      epitaph?.memoryId
      && epitaph.epitaph
      && entries.some((entry) => (
        entry.id === epitaph.memoryId && entry.epitaph === epitaph.epitaph
      ))
    ) {
      clearRecovery(ownerAddress, "addEpitaph");
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
      lastHistoryOwner = "";
      history.set([]);
      // Not zero: with no wallet there is no owner to scope a read to, so the
      // count is unknown rather than empty.
      totalDestroyed.set(undefined);
      burialFeesPaid.set(0);
      historyStatus.set("awaiting-wallet");
      return;
    }
    if (lastHistoryOwner !== addr) {
      // Never leave another wallet's records visible while the new owner's
      // reads are loading or failing.
      lastHistoryOwner = addr;
      history.set([]);
      totalDestroyed.set(undefined);
      burialFeesPaid.set(0);
    }
    historyStatus.set("loading");
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
      historyStatus.set("ready");
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGraveyard] getUserMemoryCount failed:", e);
      // The read came back broken, so the count stays unknown — it must not
      // fall back to a zero that claims this wallet has destroyed nothing.
      historyStatus.set("error");
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
              const ep = typeof d.epitaph === "string"
                ? decodeEventString(d.epitaph)
                : "";
              // Keep multilingual text but reject control bytes and oversized
              // values so malformed adapter output never reaches the record UI.
              if (
                ep
                && ep.length <= EPITAPH_MAX
                && !/[\u0000-\u001f\u007f]/u.test(ep)
              ) {
                epitaph = ep;
              }
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
      reconcileRecoveries(addr, entries);
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
    requireWritableContract();
    if (activeRecovery("forgetMemory")?.phase === "target-broadcast") {
      throw new Error(t("forgetPendingResolution"));
    }
    confirmedForgetFee = forgetFee.get();
    forgetConfirmId.set(item.id);
  };

  /** Dismiss the forget confirmation without paying. */
  const cancelForget = () => {
    forgetConfirmId.set(null);
    confirmedForgetFee = null;
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
    if (!item.id) throw new Error(t("memoryRecordMissing"));
    if (item.forgotten) throw new Error(t("memoryAlreadyForgotten"));
    // Require the explicit confirmation for THIS row before paying.
    if (forgetConfirmId.get() !== item.id) {
      throw new Error(t("forgetConfirmationRequired"));
    }
    // Busy case: a forget is already in flight. Throw so the host surfaces a
    // busy message instead of a misleading "forgotten" success toast — only the
    // in-flight row shows a spinner, so other rows look broken otherwise.
    if (forgettingId.get()) throw new Error(t("actionBusy"));
    requireWritableContract();
    if (confirmedForgetFee === null) throw new Error(t("forgetConfirmationRequired"));

    forgettingId.set(item.id);
    try {
      const reviewedFee = confirmedForgetFee;
      const liveFeesAvailable = await loadStats();
      if (!liveFeesAvailable) {
        throw new Error(t(contractPaused.get() ? "contractPausedAction" : "liveFeeUnavailable"));
      }
      if (reviewedFee !== forgetFee.get()) {
        confirmedForgetFee = forgetFee.get();
        throw new Error(t("forgetReviewChanged"));
      }
      const { address: ownerAddress, hash: ownerHash } = await requireWallet();
      assertRecoveryStorage();
      const args = [
        app.chain.arg.hash160(ownerHash),
        app.chain.arg.integer(item.id),
      ];
      const existingRecovery = getRecovery(ownerAddress, "forgetMemory");
      if (existingRecovery?.phase === "target-broadcast") {
        throw new Error(t("forgetPendingResolution"));
      }
      let result: Awaited<ReturnType<typeof app.chain.invoke>>;
      try {
        if (existingRecovery) {
          saveRecovery({
            ...existingRecovery,
            memoryId: item.id,
            updatedAt: new Date().toISOString(),
          });
          result = await app.chain.invoke("forgetMemory", args, {
            waitForEvent: "MemoryForgotten",
            onTransactionSent: (txid) =>
              updateRecoveryPhase(ownerAddress, "forgetMemory", txid),
          });
        } else {
          result = await app.chain.invokeWithPayment(
            forgetFee.get().toString(),
            MEMORY_DEPOSIT_MEMO,
            "forgetMemory",
            args,
            {
              waitForEvent: "MemoryForgotten",
              onPaymentSent: (depositTxid) => saveRecovery({
                version: 1,
                operation: "forgetMemory",
                phase: "deposit-broadcast",
                ownerAddress,
                amountBaseUnits: forgetFee.get().toString(),
                depositTxid,
                targetTxid: "",
                memoryId: item.id,
                updatedAt: new Date().toISOString(),
              }),
              onTransactionSent: (txid) =>
                updateRecoveryPhase(ownerAddress, "forgetMemory", txid),
            },
          );
        }
      } catch (error) {
        if (error instanceof DepositConfirmedActionFailedError) {
          saveRecovery({
            version: 1,
            operation: "forgetMemory",
            phase: "deposit-broadcast",
            ownerAddress,
            amountBaseUnits: forgetFee.get().toString(),
            depositTxid: error.depositTxid,
            targetTxid: "",
            memoryId: item.id,
            updatedAt: new Date().toISOString(),
          });
          throw new Error(t("prepaidForgetRecovery"));
        }
        if (existingRecovery) throw new Error(t("prepaidForgetRetryFailed"));
        throw error;
      }

      const forgottenMemoryId = parseBigInt(eventValue(result.event, 0));
      const forgottenOwner = eventValue(result.event, 1);
      if (
        result.verified !== true
        || !result.event
        || forgottenMemoryId.toString() !== item.id
        || !ownerMatchesAddress(String(forgottenOwner ?? ""), ownerAddress)
      ) {
        forgetConfirmId.set(null);
        confirmedForgetFee = null;
        throw new Error(t("forgetUnverified"));
      }
      clearRecovery(ownerAddress, "forgetMemory");

      history.set(
        history.get().map((entry) =>
          entry.id === item.id ? { ...entry, forgotten: true } : entry,
        ),
      );
      forgetConfirmId.set(null);
      confirmedForgetFee = null;
    } finally {
      forgettingId.set(null);
    }
  };

  // ── Epitaph (no app deposit; network fee can still apply) ───────────

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

  const readEpitaph = async (memoryId: string): Promise<string | null> => {
    try {
      const details = await app.chain.readRaw("getMemoryDetails", [
        app.chain.arg.integer(memoryId),
      ]);
      if (!details || typeof details !== "object" || Array.isArray(details)) {
        return null;
      }
      const raw = (details as Record<string, unknown>).epitaph;
      return typeof raw === "string" ? decodeEventString(raw) : null;
    } catch (error) {
      warnIfUnexpectedReadFailure(
        `[useGraveyard] epitaph readback failed for ${memoryId}:`,
        error,
      );
      return null;
    }
  };

  const applyConfirmedEpitaph = (item: HistoryItem, text: string) => {
    const confirmedItem: HistoryItem = { ...item, epitaph: text };
    const current = history.get();
    history.set(
      current.some((entry) => entry.id === item.id)
        ? current.map((entry) => (
          entry.id === item.id ? { ...entry, epitaph: text } : entry
        ))
        : [confirmedItem, ...current],
    );
    if (epitaphDraftId.get() === item.id) {
      epitaphDraftId.set(null);
      epitaphText.set("");
    }
  };

  /**
   * Reconcile an already-broadcast epitaph from canonical contract state.
   * This is intentionally read-only: it never opens another wallet request.
   */
  const recoverEpitaph = async () => {
    const ownerAddress = app.chain.address.get() || "";
    if (!ownerAddress) throw new Error(t("connectWallet"));
    const recovery = getRecovery(ownerAddress, "addEpitaph");
    if (!recovery?.memoryId || !recovery.epitaph) {
      throw new Error(t("epitaphRecoveryMissing"));
    }
    const canonical = await readEpitaph(recovery.memoryId);
    if (canonical !== recovery.epitaph) {
      throw new Error(t("epitaphStillPending"));
    }
    clearRecovery(ownerAddress, "addEpitaph");
    applyConfirmedEpitaph(
      history.get().find((entry) => entry.id === recovery.memoryId) ?? {
        id: recovery.memoryId,
        hash: "",
        time: "",
        forgotten: false,
      },
      recovery.epitaph,
    );
  };

  /**
   * Attach an epitaph to a buried memory via addEpitaph(memoryId, epitaph). This
   * uses no Graveyard prepaid-GAS deposit. It is still a signed Neo invocation,
   * so the wallet may quote a normal network fee. The owner's witness is
   * supplied by the connected wallet, and the canonical epitaph is reloaded.
   */
  const saveEpitaph = async (item: HistoryItem) => {
    const text = epitaphText.get().trim();
    if (!item.id) throw new Error(t("memoryRecordMissing"));
    if (!text) throw new Error(t("epitaphRequired"));
    if (text.length > EPITAPH_MAX) throw new Error(t("epitaphTooLong"));
    if (epitaphSavingId.get()) throw new Error(t("actionBusy"));

    epitaphSavingId.set(item.id);
    try {
      // Ensure a wallet is connected to sign the owner witness.
      const { address: ownerAddress } = await requireWallet();
      assertRecoveryStorage();
      const existingRecovery = getRecovery(ownerAddress, "addEpitaph");
      if (existingRecovery) {
        const canonical = existingRecovery.memoryId
          ? await readEpitaph(existingRecovery.memoryId)
          : null;
        if (
          existingRecovery.memoryId === item.id
          && existingRecovery.epitaph === text
          && canonical === text
        ) {
          clearRecovery(ownerAddress, "addEpitaph");
          applyConfirmedEpitaph(item, text);
          return;
        }
        throw new Error(t("epitaphPendingResolution"));
      }
      const result = await app.chain.invoke(
        "addEpitaph",
        [
          app.chain.arg.integer(item.id),
          app.chain.arg.string(text),
        ],
        {
          waitForEvent: "EpitaphAdded",
          onTransactionSent: (txid) => saveRecovery({
            version: 1,
            operation: "addEpitaph",
            phase: "target-broadcast",
            ownerAddress,
            amountBaseUnits: "0",
            depositTxid: "",
            targetTxid: txid,
            memoryId: item.id,
            epitaph: text,
            updatedAt: new Date().toISOString(),
          }),
        },
      );
      if (
        result.verified !== true
        || !result.event
      ) {
        throw new Error(t("epitaphUnverified"));
      }
      const eventMemoryId = parseBigInt(eventValue(result.event, 0));
      const eventEpitaph = decodeEventString(eventValue(result.event, 1));
      if (eventMemoryId.toString() !== item.id || eventEpitaph !== text) {
        throw new Error(t("epitaphUnverified"));
      }
      const canonical = await readEpitaph(item.id);
      if (canonical !== text) throw new Error(t("epitaphUnverified"));

      clearRecovery(ownerAddress, "addEpitaph");
      applyConfirmedEpitaph(item, text);
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
      try {
        assertRecoveryStorage();
        const restored = sanitizeRecoveryLedger(
          safeStorageGet<PrepaidRecoveryLedger>(PREPAID_RECOVERY_KEY, {}),
        );
        const merged = sanitizeRecoveryLedger({
          ...restored,
          ...prepaidRecoveries.get(),
        });
        persistRecoveries(merged);
      } catch {
        // The observable already carries the blocked state; reads can still load.
      }
      // Stats first so loadHistory can price burial-fees-paid off the live fee.
      await loadStats();
      await loadHistory();
    } finally {
      isLoading.set(false);
      // The read attempt is over either way. Until this flips, the surface must
      // stay in its loading state rather than assert an outcome it does not
      // have yet.
      feesSettled.set(true);
    }
  };

  const cleanupTimers = () => {
    if (shakeTimer) { clearTimeout(shakeTimer); shakeTimer = null; }
    unsubscribeRecoveryRestore();
  };

  return {
    totalDestroyed, burialFeesPaid, assetHash, memoryType, history,
    showConfirm, isDestroying, showWarningShake, forgettingId, isLoading,
    isHashing, sourceError, fileName, fileSize, feesReady, feesSettled, contractPaused,
    contractStateReady, storageHealthy, walletAddress, walletConnected,
    burialRecoveryPhase, burialRecoveryTxid, forgetRecoveryPhase,
    forgetRecoveryMemoryId, epitaphRecoveryPhase, epitaphRecoveryMemoryId,
    epitaphRecoveryTxid,
    memoryTypeOptions, gasReclaimedDisplay, burialFeeDisplay, historyCount,
    historyStatus, totalDestroyedDisplay, historyCountDisplay,
    // Compose source (write/file/hash) + local SHA-256 processing
    composeMode, memoryText, setComposeMode, setMemoryText, hashMemoryFile,
    // Forget confirmation + fee
    forgetFeeDisplay, forgetConfirmId, requestForget, cancelForget,
    // Epitaph editor (no app deposit; normal network fee may apply)
    epitaphDraftId, epitaphText, epitaphSavingId, startEpitaph, cancelEpitaph,
    saveEpitaph, recoverEpitaph,
    // History pagination
    showAllHistory, historyTruncated, setShowAllHistory,
    initiateDestroy, cancelDestroy, executeDestroy, loadStats, loadHistory, forgetMemory,
    loadAll, cleanupTimers,
  };
}

export type UseGraveyardReturn = ReturnType<typeof useGraveyard>;
