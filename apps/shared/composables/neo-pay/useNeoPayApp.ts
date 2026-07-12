/**
 * useNeoPayApp — Domain logic for the Neo Pay miniapp (streams / vesting).
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppNeoPay) via
 * the MiniApp framework SDK (ctx.framework). The earlier OS-proxy data layer routed deposits/streams
 * through the Morpheus Oracle FEE kernel — a GAS-only fee-credit contract with
 * no vesting/escrow primitive — so NEO could never work and there was no real
 * stream ledger. This composable now drives the dedicated contract, which fully
 * supports NEO + GAS streams.
 *
 * Contract interaction model (verified against the deployed ABI):
 *
 *   READS (app.chain.readRaw / app.chain.readArray, default app contract script hash):
 *     getUserStreams(creator, offset, limit)            -> streamId[]
 *     getBeneficiaryStreams(beneficiary, offset, limit) -> streamId[]
 *     getStreamDetails(streamId)                        -> Map of fields
 *     totalStreams()                                    -> Integer
 *
 *   CREATE MUTATION (app.chain.invokeMultiple, one atomic transaction):
 *     1. transfer(from, CONTRACT, totalBaseUnits, "miniapp-neo-pay:fund")
 *        against the selected GAS/NEO token contract
 *     2. createStream(creator, beneficiary, asset, totalAmount, rateAmount,
 *        intervalSeconds, title, notes) -> streamId
 *     OnNEP17Payment credits the creator before createStream consumes that
 *     credit in the same VM transaction. A fault rolls both scripts back.
 *     claimStream(beneficiary, streamId)  — beneficiary-first witness
 *     cancelStream(creator, streamId)     — creator-first witness
 *
 * AMOUNT CONVENTION: the contract takes BASE UNITS. GAS is 1e8 base units per
 * GAS; NEO is indivisible (the integer token count, no scaling). totalAmount,
 * rateAmount and intervalSeconds are base-unit integers; rateAmount must be
 * <= totalAmount; intervalSeconds = chosen interval days * 86400.
 *
 * The composable owns:
 *   - Reactive state (observables + derived) for manifest / PlayArea bindings
 *   - Form validation (pure frontend checks)
 *   - Loading / creating / claiming / cancelling UI flags (double-submit guards)
 *   - Stream parsing and display formatting
 *   - Reading the creator / beneficiary stream lists straight from chain
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { MiniAppFramework } from "@shared/react";
import { addressToScriptHash, normalizeScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { StreamItem, StreamStatus } from "./types";

// ============================================================================
// Constants
// ============================================================================

const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);
const GAS_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.GAS_HASH);

/** Per-asset minimum total amount in BASE UNITS. */
const MIN_NEO_BASE = 1n; // 1 NEO (indivisible)
const MIN_GAS_BASE = 1n; // smallest GAS unit; positive guard handles the rest

/** Seconds in a day, for intervalDays -> intervalSeconds. */
const SECONDS_PER_DAY = 86_400;

/** Memo prefix the contract requires on the prepay transfer (appId + ":"). */
const PAYMENT_MEMO = "miniapp-neo-pay:fund";

/** How many stream ids to page in per role on a refresh. */
const LIST_PAGE_LIMIT = 200;

/** Interval-days bounds enforced by the UI. */
const MIN_INTERVAL_DAYS = 1;
const MAX_INTERVAL_DAYS = 365;

/** Local recovery record for an atomically submitted but not-yet-observed stream. */
const PENDING_CREATE_KEY = "pending-create";
const PENDING_CREATE_EXPIRY_MS = 10 * 60 * 1000;

/** Resolve the NEP-17 token script hash for an asset symbol. */
const assetHash = (asset: "NEO" | "GAS"): string =>
  asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;

// ============================================================================
// Amount helpers
// ============================================================================
// Human-entered amounts scale through app.amount.parseAssetToUnits (S6): GAS
// ×1e8 without floats, NEO the integer token count (never scaled, fractions
// rejected). The parse* lane returns null on ANY invalid input — it NEVER
// throws — so the create flow keeps raising its own localized
// t("invalidAmount") rejection (gasToFixed8/neoToUnits throw a non-localized
// message instead; do not swap back).

// ============================================================================
// Types
// ============================================================================

export interface UseNeoPayAppOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

interface PendingCreateRecord {
  txid: string;
  creatorHash: string;
  contractHash: string;
  baselineIds: string[];
  submittedAt: number;
}

type PendingRecoveryStatus = "none" | "pending" | "confirmed" | "expired";
type NeoPayDataState = "idle" | "live" | "partial" | "unavailable";

function isPendingCreateRecord(value: unknown): value is PendingCreateRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<PendingCreateRecord>;
  return Boolean(
    record.txid
    && record.creatorHash
    && record.contractHash
    && Array.isArray(record.baselineIds)
    && Number.isFinite(record.submittedAt),
  );
}

// ============================================================================
// On-chain detail parsing
// ============================================================================

const normalizeStatus = (value: unknown): StreamStatus => {
  const s = String(value ?? "active").toLowerCase();
  if (s === "completed" || s === "2") return "completed";
  if (s === "cancelled" || s === "canceled" || s === "3") return "cancelled";
  return "active";
};

/**
 * Resolve the asset symbol from a getStreamDetails Map. The contract may expose
 * either an `assetSymbol` string ("NEO"/"GAS") or the raw `asset` script hash;
 * parse both defensively.
 */
const resolveAssetSymbol = (record: Record<string, unknown>): { asset: string; assetSymbol: "NEO" | "GAS" } => {
  const symbolRaw = String(record.assetSymbol ?? "").trim().toUpperCase();
  if (symbolRaw === "NEO" || symbolRaw === "GAS") {
    const asset = String(record.asset ?? (symbolRaw === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH));
    return { asset, assetSymbol: symbolRaw };
  }

  const asset = String(record.asset ?? "");
  const normalized = normalizeScriptHash(asset);
  if (normalized === NEO_HASH_NORMALIZED) return { asset, assetSymbol: "NEO" };
  if (normalized === GAS_HASH_NORMALIZED) return { asset, assetSymbol: "GAS" };
  // Default to GAS when the asset can't be resolved.
  return { asset, assetSymbol: "GAS" };
};

/**
 * Parse a getStreamDetails Map (returned by app.chain.readRaw as a plain object) into a
 * typed StreamItem. Returns null for an empty / missing stream (no creator key).
 */
const parseStreamDetails = (raw: unknown, id: string): StreamItem | null => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  // An unknown / zeroed stream yields an empty map (no creator key).
  if (!record.creator) return null;

  const { asset, assetSymbol } = resolveAssetSymbol(record);

  const totalAmount = parseBigInt(record.totalAmount);
  // The contract may expose claimed/released under either name.
  const releasedAmount = parseBigInt(record.releasedAmount ?? record.claimedAmount);
  const remainingAmount = record.remainingAmount !== undefined
    ? parseBigInt(record.remainingAmount)
    : totalAmount - releasedAmount;
  const rateAmount = parseBigInt(record.rateAmount);
  const intervalSeconds = parseBigInt(record.intervalSeconds);
  const intervalDays = intervalSeconds > 0n ? Number(intervalSeconds / BigInt(SECONDS_PER_DAY)) : 0;
  const claimable = record.claimable !== undefined ? parseBigInt(record.claimable) : 0n;

  return {
    id,
    creator: String(record.creator ?? ""),
    beneficiary: String(record.beneficiary ?? ""),
    asset,
    assetSymbol,
    totalAmount,
    releasedAmount,
    remainingAmount: remainingAmount < 0n ? 0n : remainingAmount,
    rateAmount,
    intervalSeconds,
    intervalDays,
    status: normalizeStatus(record.status),
    claimable: claimable < 0n ? 0n : claimable,
    title: String(record.title ?? ""),
    notes: String(record.notes ?? ""),
  };
};

/** Coerce a raw stream-id list value (number/string/bigint) to a string id. */
const toIdString = (value: unknown): string => {
  try {
    return parseBigInt(value).toString();
  } catch {
    return String(value ?? "");
  }
};

// ============================================================================
// Composable
// ============================================================================

export function useNeoPayApp({ app, t }: UseNeoPayAppOptions) {
  // ── Reactive State ──────────────────────────────────────────────────────
  // isLoading drives the initial data load (list spinners), isRefreshing the
  // post-action re-reads, and isCreating ONLY the create flow — kept separate
  // so creating a stream spins the submit button without flashing the existing
  // created/incoming lists back to their loading state.
  const isLoading = createObservable(false);
  const isRefreshing = createObservable(false);
  const isCreating = createObservable(false);
  const claimingId = createObservable<string | null>(null);
  const cancellingId = createObservable<string | null>(null);
  const createdStreams = createObservable<StreamItem[]>([]);
  const beneficiaryStreams = createObservable<StreamItem[]>([]);
  const serviceNotice = createObservable("");
  const dataState = createObservable<NeoPayDataState>("idle");
  const failedDetailReads = createObservable(0);
  const storedPendingCreate = app.storage.local.get<PendingCreateRecord>(PENDING_CREATE_KEY, null);
  const pendingCreate = createObservable<PendingCreateRecord | null>(
    isPendingCreateRecord(storedPendingCreate) ? storedPendingCreate : null,
  );

  // ── Computed (manifest stat / sidebar bindings) ─────────────────────────
  const allStreams = createDerived(
    () => [...createdStreams.get(), ...beneficiaryStreams.get()],
    [createdStreams, beneficiaryStreams],
  );
  const activeCount = createDerived(
    () => allStreams.get().filter((s) => s.status === "active").length,
    [allStreams],
  );
  const createdStreamCount = createDerived(() => createdStreams.get().length, [createdStreams]);
  const beneficiaryStreamCount = createDerived(() => beneficiaryStreams.get().length, [beneficiaryStreams]);
  const totalStreamCount = createDerived(
    () => createdStreams.get().length + beneficiaryStreams.get().length,
    [createdStreams, beneficiaryStreams],
  );
  const pendingCreateTxid = createDerived(
    () => pendingCreate.get()?.txid ?? "",
    [pendingCreate],
  );

  // ── Data Loading (direct chain reads) ───────────────────────────────────

  /**
   * Read stream ids for a role and resolve each into a StreamItem via
   * getStreamDetails. Reads are best-effort: a single failed detail read is
   * dropped rather than failing the whole refresh.
   */
  const readStreamsForRole = async (
    op: "getUserStreams" | "getBeneficiaryStreams",
    addr: string,
    onDetailFailure?: () => void,
  ): Promise<StreamItem[]> => {
    const hash = addressToScriptHash(addr);
    if (!hash) return [];

    const idsRaw = await app.chain.readArray(op, [
      app.chain.arg.hash160(hash),
      app.chain.arg.integer(0),
      app.chain.arg.integer(LIST_PAGE_LIMIT),
    ]);

    const ids = (Array.isArray(idsRaw) ? idsRaw : [])
      .map(toIdString)
      .filter((id) => id && id !== "0");

    const items = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await app.chain.readRaw("getStreamDetails", [
            app.chain.arg.integer(id),
          ]);
          return parseStreamDetails(raw, id);
        } catch (e) {
          onDetailFailure?.();
          console.warn(
            "[useNeoPayApp] getStreamDetails failed for",
            id,
            ":",
            e instanceof Error ? e.message : String(e),
          );
          return null;
        }
      }),
    );

    return items.filter((item): item is StreamItem => item !== null);
  };

  const readCreatorStreamIds = async (creatorHash: string): Promise<string[]> => {
    const idsRaw = await app.chain.readArray("getUserStreams", [
      app.chain.arg.hash160(creatorHash),
      app.chain.arg.integer(0),
      app.chain.arg.integer(LIST_PAGE_LIMIT),
    ]);
    return (Array.isArray(idsRaw) ? idsRaw : [])
      .map(toIdString)
      .filter((id) => id && id !== "0");
  };

  const persistPendingCreate = (record: PendingCreateRecord | null) => {
    pendingCreate.set(record);
    if (record) app.storage.local.set(PENDING_CREATE_KEY, record);
    else app.storage.local.delete(PENDING_CREATE_KEY);
  };

  const recoverPendingCreate = async (): Promise<PendingRecoveryStatus> => {
    const record = pendingCreate.get();
    if (!record) return "none";
    if (normalizeScriptHash(app.chain.contractAddress.get() ?? "") !== normalizeScriptHash(record.contractHash)) {
      return "pending";
    }

    try {
      const ids = await readCreatorStreamIds(record.creatorHash);
      const baseline = new Set(record.baselineIds);
      if (ids.some((id) => !baseline.has(id))) {
        persistPendingCreate(null);
        return "confirmed";
      }
      if (Date.now() - record.submittedAt >= PENDING_CREATE_EXPIRY_MS) {
        // The direct contract read succeeded and still shows no new creator
        // stream after the recovery window. Because funding + creation are one
        // VM transaction, a failed batch retained no transfer and retry is safe.
        persistPendingCreate(null);
        return "expired";
      }
      return "pending";
    } catch {
      // An RPC/indexer outage cannot prove failure; preserve the txid and keep
      // resubmission locked until a later read resolves the uncertainty.
      return "pending";
    }
  };

  /**
   * Refresh created + beneficiary streams for the current user, straight from
   * the contract. Newest first (highest stream id). The beneficiary bucket
   * excludes self-streams (where the user is also the creator) so they only
   * appear once, under "created by you".
   */
  const refreshStreams = async () => {
    if (isRefreshing.get()) return;
    const addr = app.chain.address.get() ?? "";
    if (!addr) {
      createdStreams.set([]);
      beneficiaryStreams.set([]);
      failedDetailReads.set(0);
      dataState.set("idle");
      return;
    }

    try {
      isRefreshing.set(true);
      let detailFailures = 0;
      const noteDetailFailure = () => {
        detailFailures += 1;
      };

      const [created, incoming] = await Promise.all([
        readStreamsForRole("getUserStreams", addr, noteDetailFailure),
        readStreamsForRole("getBeneficiaryStreams", addr, noteDetailFailure),
      ]);

      const sortNewestFirst = (list: StreamItem[]): StreamItem[] =>
        [...list].sort((a, b) => {
          try {
            return Number(BigInt(b.id) - BigInt(a.id));
          } catch {
            return 0;
          }
        });

      const beneficiaryOnly = incoming.filter(
        (item) => !ownerMatchesAddress(item.creator, addr),
      );

      createdStreams.set(sortNewestFirst(created));
      beneficiaryStreams.set(sortNewestFirst(beneficiaryOnly));
      failedDetailReads.set(detailFailures);
      dataState.set(detailFailures > 0 ? "partial" : "live");
      serviceNotice.set(detailFailures > 0 ? t("streamListPartial") : "");
    } catch (e) {
      console.warn(
        "[useNeoPayApp] refreshStreams failed:",
        e instanceof Error ? e.message : String(e),
      );
      dataState.set("unavailable");
      serviceNotice.set(t("streamListUnavailable"));
    } finally {
      isRefreshing.set(false);
    }
  };

  // ── Actions (direct chain invocations) ──────────────────────────────────

  /**
   * Create a payment stream against the standalone contract.
   *
   * One wallet confirmation submits the asset transfer and createStream call
   * as an ordered multi-script transaction. Neo VM atomicity means a failing
   * create also reverts the transfer, so retry cannot duplicate a deposit or
   * strand prepaid credit.
   *
   * AMOUNTS ARE BASE UNITS: GAS total * 1e8; NEO is an integer count (no
   * scaling, fractional NEO rejected). rateAmount <= totalAmount;
   * intervalSeconds = intervalDays * 86400.
   */
  const handleCreateVault = async (formData: {
    name: string;
    beneficiary: string;
    asset: string;
    total: string;
    rate: string;
    intervalDays: string;
    notes: string;
  }) => {
    if (isCreating.get()) return; // double-submit guard

    const asset: "NEO" | "GAS" = formData.asset === "NEO" ? "NEO" : "GAS";

    const beneficiaryAddr = formData.beneficiary.trim();
    const beneficiaryHash = addressToScriptHash(beneficiaryAddr);
    if (!beneficiaryAddr || !beneficiaryHash) {
      throw new Error(t("invalidAddress"));
    }

    const intervalDays = Number.parseInt(formData.intervalDays, 10);
    if (!Number.isFinite(intervalDays) || intervalDays < MIN_INTERVAL_DAYS || intervalDays > MAX_INTERVAL_DAYS) {
      throw new Error(t("intervalInvalid"));
    }
    const intervalSeconds = BigInt(intervalDays) * BigInt(SECONDS_PER_DAY);

    // parse* returns null for any invalid/zero/fractional-NEO input (never
    // throws), preserving the localized invalidAmount rejection below.
    const totalUnits = app.amount.parseAssetToUnits(asset, formData.total);
    const rateUnits = app.amount.parseAssetToUnits(asset, formData.rate);
    if (totalUnits === null || rateUnits === null) {
      throw new Error(t("invalidAmount"));
    }
    const totalAmount = BigInt(totalUnits);
    const rateAmount = BigInt(rateUnits);
    // Per-asset minimum total.
    const minimum = asset === "NEO" ? MIN_NEO_BASE : MIN_GAS_BASE;
    if (totalAmount < minimum) {
      throw new Error(t("invalidAmount"));
    }
    if (rateAmount > totalAmount) {
      throw new Error(t("rateTooHigh"));
    }

    const creatorAddr = app.chain.address.get() ?? "";
    const creatorHash = addressToScriptHash(creatorAddr);
    if (!creatorAddr || !creatorHash) {
      throw new Error(t("walletNotConnected"));
    }

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) {
      throw new Error(t("contractMissing"));
    }

    const recovery = await recoverPendingCreate();
    if (recovery === "confirmed") {
      await refreshStreams();
      serviceNotice.set(t("streamRecovered"));
      return;
    }
    if (recovery === "pending") {
      serviceNotice.set(t("streamConfirmationPending"));
      throw new Error(t("streamConfirmationPending"));
    }
    if (recovery === "expired") {
      serviceNotice.set(t("streamConfirmationExpired"));
    }

    const title = formData.name.trim().slice(0, 60);
    const notes = formData.notes.trim().slice(0, 240);

    try {
      isCreating.set(true);

      let baselineIds: string[];
      try {
        baselineIds = await readCreatorStreamIds(creatorHash);
      } catch {
        throw new Error(t("streamActionUnavailable"));
      }
      const submittedAt = Date.now();

      let result;
      try {
        result = await app.chain.invokeMultiple(
          [
            {
              scriptHash: assetHash(asset),
              operation: "transfer",
              args: [
                app.chain.arg.hash160(creatorHash),
                app.chain.arg.hash160(contractHash),
                app.chain.arg.integer(totalAmount),
                app.chain.arg.string(PAYMENT_MEMO),
              ],
            },
            {
              scriptHash: contractHash,
              operation: "createStream",
              args: [
                app.chain.arg.hash160(creatorHash),
                app.chain.arg.hash160(beneficiaryHash),
                app.chain.arg.hash160(assetHash(asset)),
                app.chain.arg.integer(totalAmount),
                app.chain.arg.integer(rateAmount),
                app.chain.arg.integer(intervalSeconds),
                app.chain.arg.string(title),
                app.chain.arg.string(notes),
              ],
            },
          ],
          {
            signers: [{ account: creatorAddr, scopes: 1 }],
            notify: "silent",
            onTransactionSent: (txid) => {
              if (!txid) return;
              persistPendingCreate({
                txid,
                creatorHash,
                contractHash,
                baselineIds,
                submittedAt,
              });
            },
          },
        );
      } catch (error) {
        // invokeMultiple throws a known VM FAULT after the batch result is
        // available. Atomicity proves the transfer rolled back, so a persisted
        // txid from onTransactionSent must not keep retry locked in that case.
        persistPendingCreate(null);
        throw error;
      }
      if (!result.success || !result.txid) {
        persistPendingCreate(null);
        throw new Error(t("streamActionUnavailable"));
      }

      if (!pendingCreate.get()) {
        persistPendingCreate({
          txid: result.txid,
          creatorHash,
          contractHash,
          baselineIds,
          submittedAt,
        });
      }

      const baseline = new Set(baselineIds);
      const readConfirmedIds = () => readCreatorStreamIds(creatorHash);
      let confirmedIds = await readConfirmedIds().catch(() => null);
      if (!confirmedIds?.some((id) => !baseline.has(id))) {
        confirmedIds = await app.chain.waitForState(
          readConfirmedIds,
          (ids) => ids.some((id) => !baseline.has(id)),
          { attempts: 4, firstDelayMs: 4_000, delayMs: 5_000 },
        );
      }
      if (!confirmedIds?.some((id) => !baseline.has(id))) {
        serviceNotice.set(t("streamConfirmationPending"));
        throw new Error(t("streamConfirmationPending"));
      }

      persistPendingCreate(null);

      await refreshStreams();
    } finally {
      isCreating.set(false);
    }
  };

  /**
   * Claim vested amounts from a stream (beneficiary action). The contract is
   * actor-first, so the beneficiary witness comes before the stream id.
   */
  const claimStream = async (stream: StreamItem) => {
    if (claimingId.get()) return; // double-submit guard

    const beneficiaryAddr = app.chain.address.get() ?? "";
    const beneficiaryHash = addressToScriptHash(beneficiaryAddr);
    if (!beneficiaryHash) throw new Error(t("walletNotConnected"));

    try {
      claimingId.set(stream.id);
      await app.chain.invoke(
        "claimStream",
        [
          app.chain.arg.hash160(beneficiaryHash),
          app.chain.arg.integer(stream.id),
        ],
        { waitForEvent: "StreamClaimed" },
      );
      await refreshStreams();
    } finally {
      claimingId.set(null);
    }
  };

  /**
   * Cancel a stream and return unvested funds to the creator (creator action).
   * Actor-first: the creator witness comes before the stream id.
   */
  const cancelStream = async (stream: StreamItem) => {
    if (cancellingId.get()) return; // double-submit guard

    const creatorAddr = app.chain.address.get() ?? "";
    const creatorHash = addressToScriptHash(creatorAddr);
    if (!creatorHash) throw new Error(t("walletNotConnected"));

    try {
      cancellingId.set(stream.id);
      await app.chain.invoke(
        "cancelStream",
        [
          app.chain.arg.hash160(creatorHash),
          app.chain.arg.integer(stream.id),
        ],
        { waitForEvent: "StreamCancelled" },
      );
      await refreshStreams();
    } finally {
      cancellingId.set(null);
    }
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      const recovery = await recoverPendingCreate();
      await refreshStreams();
      if (recovery === "pending") serviceNotice.set(t("streamConfirmationPending"));
      if (recovery === "confirmed") serviceNotice.set(t("streamRecovered"));
      if (recovery === "expired") serviceNotice.set(t("streamConfirmationExpired"));
    } finally {
      isLoading.set(false);
    }
  };

  return {
    // ── State ─────────────────────────────────────────────────────────
    createdStreams,
    beneficiaryStreams,
    isLoading,
    isRefreshing,
    isCreating,
    claimingId,
    cancellingId,
    serviceNotice,
    dataState,
    failedDetailReads,
    pendingCreateTxid,

    // ── Computed ──────────────────────────────────────────────────────
    allStreams,
    activeCount,
    createdStreamCount,
    beneficiaryStreamCount,
    totalStreamCount,

    // ── Actions ───────────────────────────────────────────────────────
    refreshStreams,
    handleCreateVault,
    claimStream,
    cancelStream,
    loadAll,
  };
}

export type UseNeoPayAppReturn = ReturnType<typeof useNeoPayApp>;
