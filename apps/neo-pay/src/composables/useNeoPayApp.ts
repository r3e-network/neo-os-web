/**
 * useNeoPayApp — Domain logic for the Neo Pay miniapp (streams / vesting).
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppNeoPay) via
 * ctx.services.chain. The earlier OS-proxy data layer routed deposits/streams
 * through the Morpheus Oracle FEE kernel — a GAS-only fee-credit contract with
 * no vesting/escrow primitive — so NEO could never work and there was no real
 * stream ledger. This composable now drives the dedicated contract, which fully
 * supports NEO + GAS streams.
 *
 * Contract interaction model (verified against the deployed ABI):
 *
 *   READS (chain.read / chain.readArray, default app contract script hash):
 *     getUserStreams(creator, offset, limit)            -> streamId[]
 *     getBeneficiaryStreams(beneficiary, offset, limit) -> streamId[]
 *     getStreamDetails(streamId)                        -> Map of fields
 *     totalStreams()                                    -> Integer
 *
 *   MUTATIONS (chain.invoke):
 *     1. DEPOSIT — a NEP-17 transfer to the contract, targeting the *asset*
 *        token (scriptHash override), with a memo that MUST start with the app
 *        id + ":" so OnNEP17Payment credits the depositor's prepaid balance:
 *          transfer(from, CONTRACT, totalBaseUnits, "miniapp-neo-pay:fund")
 *          { scriptHash: <GAS_HASH | NEO_HASH> }
 *     2. createStream(creator, beneficiary, asset, totalAmount, rateAmount,
 *        intervalSeconds, title, notes) -> streamId
 *        Consumes the creator's prepaid credit, so the deposit MUST land first.
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
import type { ChainService } from "@shared/services/ChainService";
import { addressToScriptHash, normalizeScriptHash, ownerMatchesAddress } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import type { StreamItem, StreamStatus } from "../types";

// ============================================================================
// Constants
// ============================================================================

const NEO_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.NEO_HASH);
const GAS_HASH_NORMALIZED = normalizeScriptHash(BLOCKCHAIN_CONSTANTS.GAS_HASH);

/** GAS base units per whole GAS (1e8). */
const GAS_DECIMALS_MULTIPLIER = 100_000_000n;

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

/** Resolve the NEP-17 token script hash for an asset symbol. */
const assetHash = (asset: "NEO" | "GAS"): string =>
  asset === "NEO" ? BLOCKCHAIN_CONSTANTS.NEO_HASH : BLOCKCHAIN_CONSTANTS.GAS_HASH;

// ============================================================================
// Amount helpers
// ============================================================================

/**
 * Convert a human-entered amount string to contract BASE UNITS for an asset.
 *
 * GAS: value * 1e8, up to 8 decimal places, scaled without floats. NEO: the
 * integer token count with NO scaling — fractional NEO is rejected (NEO is
 * indivisible). Returns 0n for any invalid / non-positive input so callers can
 * reject before touching the chain.
 */
const toBaseUnits = (raw: string, asset: "NEO" | "GAS"): bigint => {
  const trimmed = String(raw ?? "").trim();
  if (!trimmed) return 0n;

  if (asset === "NEO") {
    // Indivisible: reject anything that is not a positive integer.
    if (!/^\d+$/.test(trimmed)) return 0n;
    const n = BigInt(trimmed);
    return n > 0n ? n : 0n;
  }

  // GAS: accept up to 8 decimal places, scale to base units without floats.
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return 0n;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const paddedFraction = (fraction + "00000000").slice(0, 8);
  const base = BigInt(whole) * GAS_DECIMALS_MULTIPLIER + BigInt(paddedFraction);
  return base > 0n ? base : 0n;
};

// ============================================================================
// Types
// ============================================================================

export interface UseNeoPayAppOptions {
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
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
 * Parse a getStreamDetails Map (returned by chain.read as a plain object) into a
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

export function useNeoPayApp({ chain, t }: UseNeoPayAppOptions) {
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

  // ── Data Loading (direct chain reads) ───────────────────────────────────

  /**
   * Read stream ids for a role and resolve each into a StreamItem via
   * getStreamDetails. Reads are best-effort: a single failed detail read is
   * dropped rather than failing the whole refresh.
   */
  const readStreamsForRole = async (
    op: "getUserStreams" | "getBeneficiaryStreams",
    addr: string,
  ): Promise<StreamItem[]> => {
    const hash = addressToScriptHash(addr);
    if (!hash) return [];

    const idsRaw = await chain.readArray(op, [
      { type: "Hash160", value: hash },
      { type: "Integer", value: "0" },
      { type: "Integer", value: String(LIST_PAGE_LIMIT) },
    ]);

    const ids = (Array.isArray(idsRaw) ? idsRaw : [])
      .map(toIdString)
      .filter((id) => id && id !== "0");

    const items = await Promise.all(
      ids.map(async (id) => {
        try {
          const raw = await chain.read("getStreamDetails", [
            { type: "Integer", value: id },
          ]);
          return parseStreamDetails(raw, id);
        } catch (e) {
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

  /**
   * Refresh created + beneficiary streams for the current user, straight from
   * the contract. Newest first (highest stream id). The beneficiary bucket
   * excludes self-streams (where the user is also the creator) so they only
   * appear once, under "created by you".
   */
  const refreshStreams = async () => {
    if (isRefreshing.get()) return;
    const addr = chain.address.get() ?? "";
    if (!addr) {
      createdStreams.set([]);
      beneficiaryStreams.set([]);
      return;
    }

    try {
      isRefreshing.set(true);

      const [created, incoming] = await Promise.all([
        readStreamsForRole("getUserStreams", addr),
        readStreamsForRole("getBeneficiaryStreams", addr),
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
      serviceNotice.set("");
    } catch (e) {
      console.warn(
        "[useNeoPayApp] refreshStreams failed:",
        e instanceof Error ? e.message : String(e),
      );
      serviceNotice.set(t("streamListUnavailable"));
    } finally {
      isRefreshing.set(false);
    }
  };

  // ── Actions (direct chain invocations) ──────────────────────────────────

  /**
   * Create a payment stream against the standalone contract.
   *
   * Two-step, both signed by the creator:
   *   1. DEPOSIT — transfer the total to the contract on the asset token, with
   *      the required memo, crediting the creator's prepaid balance.
   *   2. createStream — consumes that credit and opens the stream.
   *
   * If step 1 succeeds but step 2 fails, the prepaid credit remains on the
   * contract under (asset, creator) and can be reused on retry — we surface a
   * "prepaid credit held, retry" message rather than claiming a total loss.
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

    const totalAmount = toBaseUnits(formData.total, asset);
    const rateAmount = toBaseUnits(formData.rate, asset);

    if (totalAmount <= 0n || rateAmount <= 0n) {
      throw new Error(t("invalidAmount"));
    }
    // Per-asset minimum total.
    const minimum = asset === "NEO" ? MIN_NEO_BASE : MIN_GAS_BASE;
    if (totalAmount < minimum) {
      throw new Error(t("invalidAmount"));
    }
    if (rateAmount > totalAmount) {
      throw new Error(t("rateTooHigh"));
    }

    const creatorAddr = chain.address.get() ?? "";
    const creatorHash = addressToScriptHash(creatorAddr);
    if (!creatorAddr || !creatorHash) {
      throw new Error(t("walletNotConnected"));
    }

    const contractHash = chain.contractAddress.get();
    if (!contractHash) {
      throw new Error(t("contractMissing"));
    }

    const title = formData.name.trim().slice(0, 60);
    const notes = formData.notes.trim().slice(0, 240);

    try {
      isCreating.set(true);

      // Step 1: DEPOSIT — NEP-17 transfer to the contract on the asset token.
      // The scriptHash override targets the token contract (not the app), and
      // the memo must start with the app id so OnNEP17Payment credits us.
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: creatorHash },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: totalAmount.toString() },
          { type: "String", value: PAYMENT_MEMO },
        ],
        { scriptHash: assetHash(asset) },
      );

      // Step 2: createStream — consumes the prepaid credit and opens the
      // stream. If this fails, the credit stays on the contract under the
      // creator and the asset, recoverable by retrying create.
      try {
        await chain.invoke(
          "createStream",
          [
            { type: "Hash160", value: creatorHash },
            { type: "Hash160", value: beneficiaryHash },
            { type: "Hash160", value: assetHash(asset) },
            { type: "Integer", value: totalAmount.toString() },
            { type: "Integer", value: rateAmount.toString() },
            { type: "Integer", value: intervalSeconds.toString() },
            { type: "String", value: title },
            { type: "String", value: notes },
          ],
          { waitForEvent: "StreamCreated" },
        );
      } catch (createError) {
        console.error(
          "[useNeoPayApp] createStream failed after deposit succeeded:",
          createError instanceof Error ? createError.message : String(createError),
        );
        // Deposit landed, stream did not — credit is held under the creator.
        throw new Error(t("depositStrandedRecoverable"));
      }

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

    const beneficiaryHash = addressToScriptHash(chain.address.get() ?? "");
    if (!beneficiaryHash) throw new Error(t("walletNotConnected"));

    try {
      claimingId.set(stream.id);
      await chain.invoke(
        "claimStream",
        [
          { type: "Hash160", value: beneficiaryHash },
          { type: "Integer", value: stream.id },
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

    const creatorHash = addressToScriptHash(chain.address.get() ?? "");
    if (!creatorHash) throw new Error(t("walletNotConnected"));

    try {
      cancellingId.set(stream.id);
      await chain.invoke(
        "cancelStream",
        [
          { type: "Hash160", value: creatorHash },
          { type: "Integer", value: stream.id },
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
      await refreshStreams();
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
