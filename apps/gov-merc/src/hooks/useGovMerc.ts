/**
 * useGovMerc — Domain logic for the Gov Merc (mercenary governance market) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppGovMerc)
 * through the MiniApp framework SDK (ctx.framework → app). The earlier path kept
 * NEO deposits and per-epoch GAS bids
 * in OS StorageProxy/PaymentProxy that no contract enforced — "settlement" only
 * wrote a record and the bid GAS was never paid out or refunded (a latent
 * strand). This composable drives the dedicated contract, a two-sided market:
 *
 *   * STAKERS lock NEO (governance power). NEO sent to the contract with the memo
 *     "govmerc:stake" credits the staker; stakers earn the auction revenue
 *     pro-rata and claim it as GAS (claimRewards). The transfer IS the stake —
 *     there is NO separate stake call.
 *   * MERCENARIES bid GAS each epoch for the "router" title. GAS sent with the
 *     memo "govmerc:bid" credits a GAS bid balance; bid(bidder, addAmount) raises
 *     the sender's epoch bid (first bid >= 1 GAS). Losing bidders pull-refund
 *     their bid from a settled epoch (reclaimBid); unused bid credit is reclaimed
 *     via withdraw.
 *   * settleEpoch() is PERMISSIONLESS: the top bidder wins, their bid is paid
 *     pro-rata to stakers, and the epoch advances.
 *
 * Contract interaction model (verified against MiniAppGovMerc.cs / ABI):
 *
 *   READS (app.chain.readRaw, default app contract script hash):
 *     totalStaked()              -> Integer (whole NEO — NOT scaled)
 *     stakeOf(user)              -> Integer (whole NEO — NOT scaled)
 *     currentEpoch()             -> Integer
 *     highestBid(epoch)          -> Integer (GAS base units)
 *     highestBidder(epoch)       -> Hash160
 *     settlementWinner(epoch)    -> Hash160 (zero address until settled)
 *     settlementAmount(epoch)    -> Integer (GAS base units)
 *     pendingRewards(user)       -> Integer (GAS base units, banked + unrealized)
 *     bidOf(epoch, bidder)       -> Integer (GAS base units)
 *     gasCreditOf(user)          -> Integer (GAS base units)
 *     epochDuration()            -> Integer (bidding-window length, ms) [v2]
 *     epochDeadline(epoch)       -> Integer (ms timestamp; 0 until the epoch's
 *                                   first bid opens its bidding window) [v2]
 *
 *   EVENTS (app.chain.events):
 *     BidPlaced(epoch, bidder, totalBid) — leaderboard source for the CURRENT
 *       epoch: state slots [0]=epoch, [1]=bidder(address), [2]=totalBid(GAS base
 *       units). Board is the LATEST totalBid per bidder for the current epoch,
 *       ranked desc.
 *     EpochSettled(epoch, winner, bid, distributed) — settlement source.
 *     EpochOpened(epoch, deadline) — the FIRST bid of an epoch opened its fixed
 *       bidding window (deadline = ms timestamp). [v2]
 *
 * BIDDING-WINDOW SEMANTICS (v2 contract):
 *   The first bid of an epoch opens a fixed bidding window (epochDuration(),
 *   5 minutes). Later bids must land BEFORE epochDeadline(epoch) — the contract
 *   reverts "bidding closed" — and settleEpoch() only succeeds AFTER the
 *   deadline — the contract reverts "epoch not ended". Both reverts are mapped
 *   to friendly messages here, and mirrored locally as pre-flight guards.
 *
 *   MUTATIONS (app.chain.invoke / app.funds.payAndCall):
 *     STAKE — a NEO transfer to the contract with memo "govmerc:stake". The whole
 *       NEO integer is the amount; NEO is INDIVISIBLE so it is NEVER scaled.
 *         transfer(from, CONTRACT, neoInteger, "govmerc:stake") { scriptHash: NEO_HASH }
 *     withdrawStake(user, neoInteger) — returns NEO to the user (banks rewards first).
 *     BID (deposit-then-act via app.funds.payAndCall) — a GAS transfer with memo
 *       "govmerc:bid" (only topped up when gasCreditOf(bidder) < addBase),
 *       confirmed in a block, then bid(bidder, addBase). GAS is in BASE UNITS
 *       (×1e8, scaled once, no floats); first bid >= 1 GAS.
 *     settleEpoch() — permissionless; the top bidder is paid by the contract.
 *     claimRewards(user) — staker claims accrued GAS rewards.
 *     reclaimBid(bidder, epoch) — a LOSING bidder reclaims their bid from a
 *       settled epoch (epoch < currentEpoch).
 *     withdraw(account) — reclaim unused GAS bid credit.
 *
 * ASSET CONVENTION (the #1 correctness risk — kept strictly separate):
 *   * NEO is an INTEGER token (no decimals): 1 NEO = 1 unit. Stake amounts,
 *     totalStaked, stakeOf are WHOLE NEO and are NEVER multiplied by 1e8.
 *   * GAS uses BASE UNITS (×1e8). Bids, rewards, and gasCredit are GAS base units
 *     on-chain; the UI divides by 1e8 for display and scales once with
 *     gasToBaseUnits (no floats) on input.
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { Observable } from "@shared/react/context";
import { FrameworkPrepaidActionError, revertKeyOf } from "@shared/react";
import type { MiniAppFramework } from "@shared/react";
import { gasToBaseUnits, neoToInteger } from "@shared/utils/amounts";
import { eventValue } from "@shared/utils/chain-events";
import { formatNum } from "@shared/utils/format";
import { ownerMatchesAddress } from "@shared/utils/neo";
import { combineBusy } from "@shared/utils/observables";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";
import {
  assertGovMercRecoveryStorage,
  buildPendingGovMercOperation,
  govMercEventMatches,
  govMercReadbackSatisfied,
  normalizeGovMercAccount,
  readGovMercTransactionOutcome,
  readPendingGovMercOperation,
  requireExactGovMercContext,
  writePendingGovMercOperation,
  type GovMercOperationKind,
  type GovMercReadback,
  type GovMercTransactionOutcome,
  type PendingGovMercDraft,
  type PendingGovMercOperation,
} from "../gov-merc-production";

// ============================================================================
// Constants
// ============================================================================

/** Minimum bid in GAS (mirrors the contract's MIN_BID = 1 GAS). */
export const MIN_BID = 1;
/** MIN_BID in base units (1 GAS = 1e8). */
const MIN_BID_BASE = 1_00000000n;

/** Memo the contract requires on the NEO stake transfer. */
const STAKE_MEMO = "govmerc:stake";
/** Memo the contract requires on the GAS bid-funding transfer. */
const BID_MEMO = "govmerc:bid";

/** How many recent BidPlaced events to page in when rebuilding the leaderboard. */
const BID_EVENTS_LIMIT = 200;

/** The zero script hash a contract returns for an unset Hash160. */
const ZERO_HASH = "0x0000000000000000000000000000000000000000";

/** Fallback bidding-window length (ms) until epochDuration() has loaded. */
export const EPOCH_DURATION_FALLBACK_MS = 300_000;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

const EXPECTED_LOCAL_READ_FAILURES = [
  "Contract address not configured",
  "MiniApp contract address unavailable",
  "Contract not configured",
  "合约未配置",
] as const;

function isExpectedLocalReadFailure(error: unknown): boolean {
  const message = errorMessage(error);
  return EXPECTED_LOCAL_READ_FAILURES.some((expected) =>
    message.includes(expected),
  );
}

function warnIfUnexpectedReadFailure(context: string, error: unknown): void {
  if (isExpectedLocalReadFailure(error)) return;
  console.warn(context, errorMessage(error));
}

function requireUnsignedRaw(value: unknown, field: string): bigint {
  if (value === null || value === undefined || String(value).trim() === "") {
    throw new Error(`govMercReadUnavailable:${field}`);
  }
  const parsed = parseBigInt(value);
  if (parsed < 0n) throw new Error(`govMercReadInvalid:${field}`);
  return parsed;
}

function requireSafeNumber(value: bigint, field: string): number {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 0) {
    throw new Error(`govMercReadInvalid:${field}`);
  }
  return number;
}

// ============================================================================
// Bidding-window helpers (v2 contract: fixed window per epoch)
// ============================================================================

/** Phase of an epoch's bidding window derived from epochDeadline(epoch). */
export type EpochWindowPhase = "unopened" | "open" | "closed";

/**
 * Resolve the bidding-window phase. The v2 contract opens a FIXED window when
 * the first bid of an epoch lands (EpochOpened); epochDeadline(epoch) stays 0
 * until then, so 0 / negative means "window not opened yet".
 */
export function epochWindowPhase(deadlineMs: number, nowMs: number): EpochWindowPhase {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) return "unopened";
  return nowMs < deadlineMs ? "open" : "closed";
}

/**
 * Map the v2 contract's bidding-window revert reasons onto friendly i18n
 * message keys ("bidding closed" / "epoch not ended" asserts) via the
 * framework's revertKeyOf. A FrameworkPrepaidActionError embeds the consuming
 * call's revert reason in its message, so it maps here too.
 */
export function windowRevertKey(error: unknown): "biddingClosed" | "epochNotEnded" | null {
  return revertKeyOf(error, {
    biddingClosed: /bidding closed/i,
    epochNotEnded: /epoch not ended/i,
  });
}

// ============================================================================
// Amount helpers (NEO integer vs GAS base units kept strictly separate)
// ============================================================================
// gasToBaseUnits / neoToInteger come from @shared/utils/amounts — the SINGLE
// GAS scaling point (the contract scales nothing); NEO is never ×1e8.

/** Convert a GAS base-unit Integer to whole GAS as a number (÷ 1e8). */
const gasFromBaseUnits = (base: bigint): number => Number(base) / 1e8;

/** Is a parsed Hash160 / address the zero address (an unset contract slot)? */
const isZeroAddress = (value: string): boolean => {
  if (!value) return true;
  const v = value.trim();
  if (v === ZERO_HASH) return true;
  return /^0x0{40}$/i.test(v);
};

/**
 * Identity equality across the two forms these values arrive in: contract reads
 * and decoded events deliver a Hash160 (little-endian 0x hex), while the wallet
 * supplies a base58 N-address. Plain string compare never matches the two, so
 * the winner-exclusion guard and "is this my bid" check silently failed —
 * ownerMatchesAddress normalizes both sides to a script hash before comparing.
 * (Falls back to a direct/case-insensitive compare for same-form values.)
 */
function addressMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  if (a === b || a.toLowerCase() === b.toLowerCase()) return true;
  // a is the on-chain hash value, b the wallet address (or vice versa).
  return ownerMatchesAddress(a, b) || ownerMatchesAddress(b, a);
}

// ============================================================================
// Types
// ============================================================================

export interface SettlementResult {
  epoch: number;
  winner: string;
  /** Winning bid in whole GAS (display units). */
  amount: number;
}

/** A reclaimable losing bid the connected wallet can pull back. */
export interface ReclaimableBid {
  epoch: number;
  /** The bid amount in whole GAS (display units). */
  amount: number;
}

export interface UseGovMercOptions {
  /** MiniApp framework SDK from ctx.framework. */
  app: MiniAppFramework;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Injectable exact transaction reader for deterministic focused tests. */
  transactionReader?: (record: PendingGovMercOperation) => Promise<GovMercTransactionOutcome>;
}

// ============================================================================
// Composable
// ============================================================================

export function useGovMerc({ app, t, transactionReader = readGovMercTransactionOutcome }: UseGovMercOptions) {
  // ── Inputs ────────────────────────────────────────────────────────────
  const depositAmount = createObservable("");
  const withdrawAmount = createObservable("");
  const bidAmount = createObservable("");

  // ── On-chain state ────────────────────────────────────────────────────
  /** Total NEO staked across all stakers (WHOLE NEO — not scaled). */
  const totalPool = createObservable(0);
  /** Connected wallet's staked NEO (WHOLE NEO — not scaled). */
  const userDeposits = createObservable(0);
  const currentEpoch = createObservable(0);
  /** Live epoch's bidding deadline (ms timestamp); 0 until its first bid. */
  const epochDeadline = createObservable(0);
  /** Bidding-window length in ms (epochDuration(); 5 minutes on the v2 contract). */
  const epochDurationMs = createObservable(EPOCH_DURATION_FALLBACK_MS);
  /** Current-epoch leaderboard: { address, amount } where amount is whole GAS. */
  const bids = createObservable<{ address: string; amount: number }[]>([]);
  /**
   * Whether the live epoch has a bid on-chain — read from highestBid(epoch), the
   * contract's own settle precondition. Independent of the event-derived
   * leaderboard so settlement stays reachable even when the events feed degrades.
   */
  const hasLiveBid = createObservable(false);
  /**
   * The live epoch's highest bid in whole GAS — the prize a mercenary must beat
   * and the GAS stakers will receive this epoch. Read from highestBid(epoch).
   */
  const highestBid = createObservable(0);
  const lastSettlement = createObservable<SettlementResult | null>(null);
  /** Connected staker's claimable GAS rewards (whole GAS). */
  const pendingRewards = createObservable(0);
  /** Connected wallet's unused GAS bid credit (whole GAS). */
  const gasCredit = createObservable(0);
  /** Losing bids the connected wallet can reclaim from settled epochs. */
  const reclaimableBids = createObservable<ReclaimableBid[]>([]);

  // ── Read availability (an unavailable read is never rendered as a real 0) ──
  const marketAvailable = createObservable(false);
  const windowAvailable = createObservable(false);
  const highestBidAvailable = createObservable(false);
  const walletAvailable = createObservable(false);
  const bidsAvailable = createObservable(false);
  const settlementAvailable = createObservable(false);
  const reclaimableAvailable = createObservable(false);
  const readError = createObservable("");

  // ── UI flags ──────────────────────────────────────────────────────────
  const dataLoading = createObservable(false);
  /**
   * True once `loadData` has completed at least one round. Separates a cold
   * first paint (reads in flight — show skeletons) from a settled read with no
   * data (show honest zero-state copy). Without it every `*Available` flag
   * above starts false and is indistinguishable from a failure.
   */
  const loaded = createObservable(false);
  const isProcessing = createObservable(false);
  const isRecovering = createObservable(false);
  const address = createObservable("");
  const activeAction = createObservable("");
  const pendingOperation = createObservable<PendingGovMercOperation | null>(null);
  const transactionStatus = createObservable<"idle" | "pending" | "confirmed" | "fault" | "credit-held">("idle");
  const storageHealthy = createObservable(true);
  const pendingTxid = createObservable("");

  const isBusy: Observable<boolean> = combineBusy(isProcessing, dataLoading, isRecovering);

  let isMounted = true;

  const setAddress = (addr: string) => {
    address.set(addr ?? "");
  };

  // Build a Hash160 arg for an address, or null when empty/invalid. arg.hash160
  // THROWS on an empty/invalid address, so this swallows a build failure into
  // null — mirroring the old `addr ? addressToScriptHash(addr) : null` guard
  // (which yielded null for a missing or malformed address).
  const safeHash160Arg = (
    addr: string | null | undefined,
  ): ReturnType<typeof app.chain.arg.hash160> | null => {
    if (!addr) return null;
    try {
      return app.chain.arg.hash160(addr);
    } catch {
      return null;
    }
  };

  // The connected wallet's Hash160 arg (or null when disconnected/invalid).
  const myHashArg = (): ReturnType<typeof app.chain.arg.hash160> | null =>
    safeHash160Arg(address.get());

  // ── Data loading (direct chain reads + events) ─────────────────────────

  /**
   * Read the authoritative market state: total NEO staked, current epoch, the
   * connected staker's stake/rewards/credit, and the last settlement. NEO values
   * are whole integers; GAS values are scaled from base units to whole GAS.
   */
  const loadStats = async () => {
    marketAvailable.set(false);
    const [totalStakedRaw, epochRaw] = await Promise.all([
      app.chain.readRaw("totalStaked", []),
      app.chain.readRaw("currentEpoch", []),
    ]);

    // Apply the market snapshot atomically. A failed/invalid read leaves the
    // previous numbers untouched and flips availability instead of fabricating 0.
    const nextTotalPool = requireSafeNumber(requireUnsignedRaw(totalStakedRaw, "totalStaked"), "totalStaked");
    const epoch = requireSafeNumber(requireUnsignedRaw(epochRaw, "currentEpoch"), "currentEpoch");
    totalPool.set(nextTotalPool);
    currentEpoch.set(epoch);
    marketAvailable.set(true);

    // v2: the first bid of an epoch opens a fixed bidding window. Read the live
    // epoch's deadline (0 until that first bid) and the window length so the UI
    // can show a countdown / closed state. A failed read degrades to "unopened"
    // — the contract stays the authority via its own reverts.
    try {
      const [deadlineRaw, durationRaw] = await Promise.all([
        app.chain.readRaw("epochDeadline", [app.chain.arg.integer(epoch)]),
        app.chain.readRaw("epochDuration", []),
      ]);
      const deadline = requireSafeNumber(requireUnsignedRaw(deadlineRaw, "epochDeadline"), "epochDeadline");
      const duration = requireSafeNumber(requireUnsignedRaw(durationRaw, "epochDuration"), "epochDuration");
      if (duration <= 0) throw new Error("govMercReadInvalid:epochDuration");
      epochDeadline.set(deadline);
      epochDurationMs.set(duration);
      windowAvailable.set(true);
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] bidding-window read failed:", e);
      windowAvailable.set(false);
    }

    // Read highestBid(epoch) directly — the contract's own settle precondition —
    // so the Route Governance button can enable even if the BidPlaced events
    // feed is empty/stale (the leaderboard alone could wrongly disable settle
    // while highestBid > 0 proves the epoch is settleable).
    try {
      const highestRaw = await app.chain.readRaw("highestBid", [
        app.chain.arg.integer(epoch),
      ]);
      const highestBase = requireUnsignedRaw(highestRaw, "highestBid");
      hasLiveBid.set(highestBase > 0n);
      // Surface the live top bid (whole GAS) so bidders see the prize to beat and
      // stakers see the incoming yield without scanning the leaderboard.
      highestBid.set(gasFromBaseUnits(highestBase));
      highestBidAvailable.set(true);
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] highestBid read failed:", e);
      highestBidAvailable.set(false);
    }

    const hashArg = myHashArg();
    if (hashArg) {
      try {
        const [stakeRaw, pendingRaw, creditRaw] = await Promise.all([
          app.chain.readRaw("stakeOf", [hashArg]),
          app.chain.readRaw("pendingRewards", [hashArg]),
          app.chain.readRaw("gasCreditOf", [hashArg]),
        ]);
        const nextStake = requireSafeNumber(requireUnsignedRaw(stakeRaw, "stakeOf"), "stakeOf");
        const nextRewards = requireUnsignedRaw(pendingRaw, "pendingRewards");
        const nextCredit = requireUnsignedRaw(creditRaw, "gasCreditOf");
        // stakeOf is WHOLE NEO; rewards / credit are GAS base units.
        userDeposits.set(nextStake);
        pendingRewards.set(gasFromBaseUnits(nextRewards));
        gasCredit.set(gasFromBaseUnits(nextCredit));
        walletAvailable.set(true);
      } catch (e) {
        warnIfUnexpectedReadFailure("[useGovMerc] wallet reads failed:", e);
        walletAvailable.set(false);
      }
    } else if (!address.get()) {
      userDeposits.set(0);
      pendingRewards.set(0);
      gasCredit.set(0);
      walletAvailable.set(true);
    } else {
      walletAvailable.set(false);
    }
  };

  /**
   * Rebuild the current-epoch leaderboard from BidPlaced events.
   *
   * BidPlaced(epoch, bidder, totalBid) carries each bidder's CUMULATIVE total
   * bid. Events arrive newest-first, so the FIRST event seen per bidder within
   * the current epoch is their latest total. Amounts are GAS base units → ÷1e8.
   */
  const loadBids = async () => {
    const epoch = currentEpoch.get();
    bidsAvailable.set(false);
    try {
      const events = await app.chain.events("BidPlaced", { limit: BID_EVENTS_LIMIT });
      const latestByBidder = new Map<string, number>();
      for (const event of events) {
        const evtEpoch = requireSafeNumber(requireUnsignedRaw(eventValue(event, 0), "BidPlaced.epoch"), "BidPlaced.epoch");
        if (evtEpoch !== epoch) continue;
        const bidder = String(eventValue(event, 1) ?? "").trim();
        if (!normalizeGovMercAccount(bidder)) throw new Error("govMercReadInvalid:BidPlaced.bidder");
        if (latestByBidder.has(bidder)) continue; // newest total already kept
        latestByBidder.set(bidder, gasFromBaseUnits(requireUnsignedRaw(eventValue(event, 2), "BidPlaced.amount")));
      }
      bids.set(
        Array.from(latestByBidder.entries())
          .map(([addr, amount]) => ({ address: addr, amount }))
          .filter((b) => b.amount > 0)
          .sort((a, b) => b.amount - a.amount),
      );
      bidsAvailable.set(true);
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] loadBids failed:", e);
      bidsAvailable.set(false);
    }
  };

  /**
   * Resolve the most recently settled epoch (the one before the live epoch) from
   * the contract's settlement reads. Winner is a Hash160 (zero until settled);
   * the amount is GAS base units → ÷1e8.
   */
  const loadSettlement = async () => {
    const epoch = currentEpoch.get();
    settlementAvailable.set(false);
    if (epoch <= 0) {
      lastSettlement.set(null);
      settlementAvailable.set(true);
      return;
    }
    const settledEpoch = epoch - 1;
    try {
      const [winnerRaw, amountRaw] = await Promise.all([
        app.chain.readRaw("settlementWinner", [app.chain.arg.integer(settledEpoch)]),
        app.chain.readRaw("settlementAmount", [app.chain.arg.integer(settledEpoch)]),
      ]);
      const winner = String(winnerRaw ?? "").trim();
      if (isZeroAddress(winner)) {
        lastSettlement.set(null);
        settlementAvailable.set(true);
        return;
      }
      if (!normalizeGovMercAccount(winner)) throw new Error("govMercReadInvalid:settlementWinner");
      lastSettlement.set({
        epoch: settledEpoch,
        winner,
        amount: gasFromBaseUnits(requireUnsignedRaw(amountRaw, "settlementAmount")),
      });
      settlementAvailable.set(true);
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] loadSettlement failed:", e);
      settlementAvailable.set(false);
    }
  };

  /**
   * Find the connected wallet's reclaimable losing bids: scan prior settled
   * epochs (the contract only allows reclaim for epoch < currentEpoch) and keep
   * the ones where the wallet bid, was NOT the winner, and the bid is still held
   * by the contract (bidOf > 0 — a prior reclaim deletes it). Bounded to a recent
   * window so this is cheap.
   */
  const RECLAIM_LOOKBACK = 12;
  const loadReclaimable = async () => {
    const hashArg = myHashArg();
    const epoch = currentEpoch.get();
    reclaimableAvailable.set(false);
    if (!hashArg || epoch <= 0) {
      reclaimableBids.set([]);
      reclaimableAvailable.set(true);
      return;
    }
    try {
      const startEpoch = Math.max(0, epoch - RECLAIM_LOOKBACK);
      const epochs: number[] = [];
      for (let e = startEpoch; e < epoch; e += 1) epochs.push(e);

      const results = await Promise.all(epochs.map(async (e): Promise<ReclaimableBid | null> => {
        const bidRaw = await app.chain.readRaw("bidOf", [app.chain.arg.integer(e), hashArg]);
        const bidBase = requireUnsignedRaw(bidRaw, `bidOf:${e}`);
        if (bidBase <= 0n) return null;
        const winnerRaw = await app.chain.readRaw("settlementWinner", [app.chain.arg.integer(e)]);
        const winner = String(winnerRaw ?? "").trim();
        if (!isZeroAddress(winner) && !normalizeGovMercAccount(winner)) {
          throw new Error(`govMercReadInvalid:settlementWinner:${e}`);
        }
        if (addressMatches(winner, address.get())) return null;
        return { epoch: e, amount: gasFromBaseUnits(bidBase) };
      }));

      reclaimableBids.set(
        results
          .filter((r): r is ReclaimableBid => r !== null)
          .sort((a, b) => b.epoch - a.epoch),
      );
      reclaimableAvailable.set(true);
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] loadReclaimable failed:", e);
      reclaimableAvailable.set(false);
    }
  };

  const loadData = async () => {
    if (!isMounted) return;
    dataLoading.set(true);
    readError.set("");
    try {
      try {
        assertGovMercRecoveryStorage();
        storageHealthy.set(true);
      } catch {
        storageHealthy.set(false);
      }
      const restored = pendingOperation.get() ?? restorePendingOperation();
      await loadStats();
      if (!isMounted) return;
      // Bids, settlement and reclaimable lookups all depend on the epoch read by
      // loadStats, so they run after it.
      await Promise.all([loadBids(), loadSettlement(), loadReclaimable()]);
      if (restored && !isRecovering.get()) await recoverPendingOperation();
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] loadData failed:", e);
      marketAvailable.set(false);
      windowAvailable.set(false);
      highestBidAvailable.set(false);
      walletAvailable.set(false);
      bidsAvailable.set(false);
      settlementAvailable.set(false);
      reclaimableAvailable.set(false);
      // An expected local read failure — no contract address bound yet, i.e. the
      // desk has not reached the network — is the NORMAL first paint for a
      // visitor, not a fault. Raising "Failed to load data" for it makes a
      // healthy app look broken on arrival. The availability flags above already
      // say "no data"; the view renders that as honest zero-state copy. Only a
      // genuinely unexpected failure earns the error banner.
      readError.set(isExpectedLocalReadFailure(e) ? "" : t("loadFailed"));
    } finally {
      dataLoading.set(false);
      // One read round has completed, success or not. Until this flips, "no
      // data" means "still asking" and the view shows skeletons.
      loaded.set(true);
    }
  };

  // ── Durable transaction recovery ─────────────────────────────────────

  const setPending = (record: PendingGovMercOperation | null) => {
    pendingOperation.set(record);
    pendingTxid.set(record?.txid ?? "");
    if (record) transactionStatus.set("pending");
  };

  const persistPending = (record: PendingGovMercOperation) => {
    try {
      writePendingGovMercOperation(record);
      storageHealthy.set(true);
      setPending(record);
    } catch (error) {
      storageHealthy.set(false);
      setPending(record);
      throw error;
    }
  };

  const clearPending = () => {
    try {
      writePendingGovMercOperation(null);
      storageHealthy.set(true);
      setPending(null);
    } catch (error) {
      storageHealthy.set(false);
      throw error;
    }
  };

  const restorePendingOperation = () => {
    const restored = readPendingGovMercOperation();
    setPending(restored);
    if (restored) transactionStatus.set("pending");
    return restored;
  };

  const assertDurableWriteReady = () => {
    try {
      assertGovMercRecoveryStorage();
      storageHealthy.set(true);
    } catch (error) {
      storageHealthy.set(false);
      throw error;
    }
    const restored = pendingOperation.get() ?? restorePendingOperation();
    if (restored) throw new Error(t("transactionAlreadyPending"));
  };

  const authorizeWrite = async () => {
    assertDurableWriteReady();
    const addr = address.get() || (await app.chain.ensureWallet());
    const actorHash = normalizeGovMercAccount(addr);
    if (!addr || !actorHash) throw new Error(t("walletAddressInvalid"));
    setAddress(addr);
    const context = await requireExactGovMercContext(app);
    return { addr, actorHash, context };
  };

  const readFreshBaselines = async (actorHash: string) => {
    const actorArg = app.chain.arg.hash160(actorHash);
    const epochRaw = await app.chain.readRaw("currentEpoch", []);
    const epoch = requireSafeNumber(requireUnsignedRaw(epochRaw, "currentEpoch"), "currentEpoch");
    const [stakeRaw, bidRaw, rewardsRaw, creditRaw] = await Promise.all([
      app.chain.readRaw("stakeOf", [actorArg]),
      app.chain.readRaw("bidOf", [app.chain.arg.integer(epoch), actorArg]),
      app.chain.readRaw("pendingRewards", [actorArg]),
      app.chain.readRaw("gasCreditOf", [actorArg]),
    ]);
    return {
      epoch,
      stakeRaw: requireUnsignedRaw(stakeRaw, "stakeOf").toString(),
      bidRaw: requireUnsignedRaw(bidRaw, "bidOf").toString(),
      rewardsRaw: requireUnsignedRaw(rewardsRaw, "pendingRewards").toString(),
      creditRaw: requireUnsignedRaw(creditRaw, "gasCreditOf").toString(),
    };
  };

  const pendingDraft = (
    kind: GovMercOperationKind,
    actorHash: string,
    contractHash: string,
    network: "mainnet" | "testnet",
    baseline: Awaited<ReturnType<typeof readFreshBaselines>>,
    amountRaw: bigint,
    options: { epoch?: number; fundingAmountRaw?: bigint } = {},
  ): PendingGovMercDraft => ({
    kind,
    network,
    contractHash,
    actorHash,
    epoch: options.epoch ?? baseline.epoch,
    amountRaw: amountRaw.toString(),
    ...(options.fundingAmountRaw !== undefined
      ? { fundingAmountRaw: options.fundingAmountRaw.toString() }
      : {}),
    beforeStakeRaw: baseline.stakeRaw,
    beforeBidRaw: baseline.bidRaw,
    beforeEpoch: baseline.epoch,
    beforeRewardsRaw: baseline.rewardsRaw,
    beforeCreditRaw: baseline.creditRaw,
  });

  const readOperationReadback = async (record: PendingGovMercOperation): Promise<GovMercReadback> => {
    const actorArg = app.chain.arg.hash160(record.actorHash);
    const [stakeRaw, bidRaw, epochRaw, rewardsRaw, creditRaw] = await Promise.all([
      app.chain.readRaw("stakeOf", [actorArg], { scriptHash: record.contractHash }),
      app.chain.readRaw("bidOf", [app.chain.arg.integer(record.epoch), actorArg], { scriptHash: record.contractHash }),
      app.chain.readRaw("currentEpoch", [], { scriptHash: record.contractHash }),
      app.chain.readRaw("pendingRewards", [actorArg], { scriptHash: record.contractHash }),
      app.chain.readRaw("gasCreditOf", [actorArg], { scriptHash: record.contractHash }),
    ]);
    return {
      stakeRaw: requireUnsignedRaw(stakeRaw, "stakeOf").toString(),
      bidRaw: requireUnsignedRaw(bidRaw, "bidOf").toString(),
      epoch: requireSafeNumber(requireUnsignedRaw(epochRaw, "currentEpoch"), "currentEpoch"),
      rewardsRaw: requireUnsignedRaw(rewardsRaw, "pendingRewards").toString(),
      creditRaw: requireUnsignedRaw(creditRaw, "gasCreditOf").toString(),
    };
  };

  const immediateOutcome = (
    record: PendingGovMercOperation,
    event: unknown,
  ): GovMercTransactionOutcome => ({
    state: "halt",
    notifications: [{
      contract: record.contractHash,
      eventName: record.eventName,
      values: [0, 1, 2, 3].map((index) => eventValue(event, index)),
    }],
  });

  const confirmObserved = async (
    record: PendingGovMercOperation,
    outcome: GovMercTransactionOutcome,
  ): Promise<"confirmed" | "credit-held" | "pending" | "fault"> => {
    if (outcome.state === "fault") {
      clearPending();
      transactionStatus.set("fault");
      return "fault";
    }
    let readback: GovMercReadback | null = null;
    try {
      readback = await readOperationReadback(record);
    } catch (error) {
      warnIfUnexpectedReadFailure("[useGovMerc] transaction readback failed:", error);
    }
    if (!readback || outcome.state !== "halt" || !govMercEventMatches(record, outcome) ||
      !govMercReadbackSatisfied(record, readback)) {
      transactionStatus.set("pending");
      return "pending";
    }

    if (record.kind === "bid" && record.stage === "payment") {
      const expectedBid = BigInt(record.beforeBidRaw) + BigInt(record.amountRaw);
      if (BigInt(readback.bidRaw ?? "0") < expectedBid) {
        clearPending();
        transactionStatus.set("credit-held");
        await loadData();
        return "credit-held";
      }
    }
    clearPending();
    transactionStatus.set("confirmed");
    await loadData();
    return "confirmed";
  };

  const recoverPendingOperation = async () => {
    const record = pendingOperation.get() ?? restorePendingOperation();
    if (!record || isRecovering.get()) return "idle" as const;
    isRecovering.set(true);
    activeAction.set("recover");
    try {
      try {
        const context = await requireExactGovMercContext(app);
        if (context.network !== record.network || context.contractHash !== record.contractHash) {
          transactionStatus.set("pending");
          return "pending" as const;
        }
      } catch {
        transactionStatus.set("pending");
        return "pending" as const;
      }
      const outcome = await transactionReader(record);
      return await confirmObserved(record, outcome);
    } finally {
      activeAction.set("");
      isRecovering.set(false);
    }
  };

  const finishBroadcast = async (
    record: PendingGovMercOperation,
    result: { txid?: string; event?: unknown; success?: boolean; verified?: boolean },
  ) => {
    if (!result.txid || result.success === false) throw new Error(t("transactionNotBroadcast"));
    if (result.txid.toLowerCase() !== record.txid) {
      transactionStatus.set("pending");
      throw new Error(t("transactionIdentityChanged"));
    }
    try {
      const after = await requireExactGovMercContext(app);
      const walletAfter = normalizeGovMercAccount(app.chain.address.get() ?? address.get());
      if (
        after.network !== record.network ||
        after.contractHash !== record.contractHash ||
        walletAfter !== record.actorHash
      ) {
        transactionStatus.set("pending");
        throw new Error(t("transactionBindingChanged"));
      }
    } catch (error) {
      transactionStatus.set("pending");
      if (error instanceof Error && error.message === t("transactionBindingChanged")) throw error;
      throw new Error(t("transactionBindingChanged"));
    }
    let outcome: GovMercTransactionOutcome;
    if (result.verified === true && result.event) {
      outcome = immediateOutcome(record, result.event);
    } else {
      outcome = await transactionReader(record);
    }
    const confirmation = await confirmObserved(record, outcome);
    if (confirmation === "fault") throw new Error(t("transactionFaulted"));
    if (confirmation === "credit-held") throw new Error(t("bidDepositHeld"));
    if (confirmation !== "confirmed") throw new Error(t("transactionPendingConfirmation"));
  };

  const runDirectWrite = async (input: {
    action: string;
    kind: GovMercOperationKind;
    operation: string;
    args: Parameters<typeof app.chain.invoke>[1];
    draft: PendingGovMercDraft;
    waitForEvent: string;
    scriptHash?: string;
  }) => {
    let record: PendingGovMercOperation | null = null;
    activeAction.set(input.action);
    isProcessing.set(true);
    try {
      const result = await app.chain.invoke(input.operation, input.args, {
        ...(input.scriptHash ? { scriptHash: input.scriptHash } : {}),
        waitForEvent: input.waitForEvent,
        waitTimeoutMs: 45_000,
        onTransactionSent: (txid) => {
          record = buildPendingGovMercOperation(input.draft, txid);
          persistPending(record);
        },
      });
      if (!record) {
        record = buildPendingGovMercOperation(input.draft, result.txid);
        persistPending(record);
      }
      await finishBroadcast(record, result);
      return result;
    } finally {
      activeAction.set("");
      isProcessing.set(false);
    }
  };

  // ── Staking (NEO — integer, never scaled) ──────────────────────────────

  /**
   * Stake NEO into the shared pool. The transfer IS the stake: a NEO NEP-17
   * transfer to the contract with the "govmerc:stake" memo, amount = the whole
   * NEO integer (NO ×1e8 — NEO is indivisible). There is no separate stake call.
   */
  const depositNeo = async () => {
    if (isBusy.get()) return;
    const neoInt = neoToInteger(depositAmount.get());
    if (neoInt <= 0n) throw new Error(t("enterNeoAmount"));
    const { actorHash, context } = await authorizeWrite();
    const baseline = await readFreshBaselines(actorHash);
    const draft = pendingDraft("deposit", actorHash, context.contractHash, context.network, baseline, neoInt);
    await runDirectWrite({
      action: "deposit",
      kind: "deposit",
      operation: "transfer",
      args: [
        app.chain.arg.hash160(actorHash),
        app.chain.arg.hash160(context.contractHash),
        app.chain.arg.integer(neoInt),
        app.chain.arg.string(STAKE_MEMO),
      ],
      draft,
      waitForEvent: "Staked",
      scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH,
    });
    depositAmount.set("");
  };

  /**
   * Withdraw staked NEO via withdrawStake(user, amount). Amount is the whole NEO
   * integer (NO ×1e8). Validated against the connected wallet's own stake so an
   * over-withdrawal gives clear feedback instead of an opaque contract fault.
   */
  const withdrawNeo = async () => {
    if (isBusy.get()) return;
    const neoInt = neoToInteger(withdrawAmount.get());
    if (neoInt <= 0n) throw new Error(t("enterNeoAmount"));
    const { actorHash, context } = await authorizeWrite();
    const baseline = await readFreshBaselines(actorHash);
    if (neoInt > BigInt(baseline.stakeRaw)) throw new Error(t("withdrawExceeds"));
    const draft = pendingDraft("withdraw", actorHash, context.contractHash, context.network, baseline, neoInt);
    await runDirectWrite({
      action: "withdraw",
      kind: "withdraw",
      operation: "withdrawStake",
      args: [app.chain.arg.hash160(actorHash), app.chain.arg.integer(neoInt)],
      draft,
      waitForEvent: "Unstaked",
      scriptHash: context.contractHash,
    });
    withdrawAmount.set("");
  };

  // ── Bidding (GAS — base units, deposit-then-act) ───────────────────────

  /**
   * Place / raise a GAS bid for the current epoch (deposit-then-act via
   * app.funds.payAndCall).
   *
   * Two signed steps, both by the bidder:
   *   1. DEPOSIT — only when gasCreditOf(bidder) < addBase, payAndCall
   *      transfers the bid amount in GAS to the contract with the
   *      "govmerc:bid" memo so OnNEP17Payment credits the bidder's GAS bid
   *      balance, and waits for the deposit to confirm in a block. The amount
   *      is in BASE UNITS here (scaled once, no floats).
   *   2. bid(bidder, addBase) — raises the bidder's epoch bid from their credit.
   *      The first bid for an epoch must be >= 1 GAS.
   *
   * If step 1 lands but step 2 reverts, payAndCall surfaces a
   * FrameworkPrepaidActionError: the credit persists on the contract as
   * reusable prepaid bid credit (reclaimable via withdraw) — no GAS is lost.
   */
  const placeBid = async () => {
    if (isBusy.get()) return;
    const addBase = gasToBaseUnits(bidAmount.get());
    if (addBase <= 0n) throw new Error(t("enterAmount"));
    const { actorHash, context } = await authorizeWrite();
    const baseline = await readFreshBaselines(actorHash);
    const isFirstBid = BigInt(baseline.bidRaw) === 0n;
    if (isFirstBid && addBase < MIN_BID_BASE) {
      throw new Error(t("minBid", { amount: MIN_BID, tokenGas: t("tokenGas") }));
    }

    // A fresh deadline read is mandatory before moving GAS. A stale/failed UI
    // read must never be interpreted as an unopened window.
    const deadlineRaw = await app.chain.readRaw(
      "epochDeadline",
      [app.chain.arg.integer(baseline.epoch)],
      { scriptHash: context.contractHash },
    );
    const freshDeadline = requireSafeNumber(requireUnsignedRaw(deadlineRaw, "epochDeadline"), "epochDeadline");
    if (epochWindowPhase(freshDeadline, Date.now()) === "closed") {
      throw new Error(t("biddingClosed"));
    }

    const existingCredit = BigInt(baseline.creditRaw);
    const fundingBase = addBase > existingCredit ? addBase - existingCredit : 0n;
    const draft = pendingDraft(
      "bid",
      actorHash,
      context.contractHash,
      context.network,
      baseline,
      addBase,
      { fundingAmountRaw: fundingBase },
    );
    const bidArgs = [app.chain.arg.hash160(actorHash), app.chain.arg.integer(addBase)];

    if (fundingBase === 0n) {
      try {
        await runDirectWrite({
          action: "bid",
          kind: "bid",
          operation: "bid",
          args: bidArgs,
          draft,
          waitForEvent: "BidPlaced",
          scriptHash: context.contractHash,
        });
      } catch (bidError) {
        if (windowRevertKey(bidError) === "biddingClosed") {
          throw new Error(t("biddingClosed"));
        }
        throw bidError;
      }
      bidAmount.set("");
      return;
    }

    let paymentTxid = "";
    let record: PendingGovMercOperation | null = null;
    activeAction.set("bid");
    isProcessing.set(true);
    try {
      try {
        const result = await app.funds.payAndCall({
          amountFixed8: fundingBase,
          memo: BID_MEMO,
          operation: "bid",
          args: bidArgs,
          waitForEvent: "BidPlaced",
          waitTimeoutMs: 45_000,
          notify: "silent",
          onPaymentSent: (txid) => {
            paymentTxid = txid;
            record = buildPendingGovMercOperation(draft, txid, { stage: "payment", paymentTxid: txid });
            persistPending(record);
          },
          onTransactionSent: (txid) => {
            record = buildPendingGovMercOperation(draft, txid, { paymentTxid });
            persistPending(record);
          },
        });
        if (!record) {
          record = buildPendingGovMercOperation(draft, result.txid, { paymentTxid });
          persistPending(record);
        }
        await finishBroadcast(record, result);
      } catch (bidErr) {
        const depositSettled = bidErr instanceof FrameworkPrepaidActionError;
        if (depositSettled) {
          paymentTxid = bidErr.txid || paymentTxid;
          if (paymentTxid) {
            const paymentRecord = buildPendingGovMercOperation(draft, paymentTxid, {
              stage: "payment",
              paymentTxid,
            });
            persistPending(paymentRecord);
          }
        }
        if (windowRevertKey(bidErr) === "biddingClosed") {
          throw new Error(t(depositSettled ? "biddingClosedCreditHeld" : "biddingClosed"));
        }
        if (depositSettled) throw new Error(t("bidDepositHeld"));
        // messageOf keeps chain/RPC failures on the localized family copy
        // instead of rethrowing the raw English wallet/VM string.
        throw new Error(app.errors.messageOf(bidErr, t("error")));
      }

      bidAmount.set("");
    } finally {
      activeAction.set("");
      isProcessing.set(false);
    }
  };

  // ── Settlement (permissionless) ────────────────────────────────────────

  /**
   * Settle the live epoch via settleEpoch(). PERMISSIONLESS: the top bidder wins
   * (paid by the contract regardless of who signs), their bid is distributed
   * pro-rata to stakers, and the epoch advances. Reverts "no bids to settle" if
   * there are none — the canSettle gate prevents that path. The v2 contract
   * additionally reverts "epoch not ended" before the bidding deadline; that is
   * mirrored locally (when the deadline is known) and mapped to a friendly
   * message when the contract still rejects.
   */
  const settleEpoch = async () => {
    if (isBusy.get()) return;
    const { actorHash, context } = await authorizeWrite();
    const baseline = await readFreshBaselines(actorHash);
    const [highestRaw, deadlineRaw] = await Promise.all([
      app.chain.readRaw("highestBid", [app.chain.arg.integer(baseline.epoch)], { scriptHash: context.contractHash }),
      app.chain.readRaw("epochDeadline", [app.chain.arg.integer(baseline.epoch)], { scriptHash: context.contractHash }),
    ]);
    const highestBase = requireUnsignedRaw(highestRaw, "highestBid");
    if (highestBase <= 0n) throw new Error(t("settleNoBids"));
    const deadline = requireSafeNumber(requireUnsignedRaw(deadlineRaw, "epochDeadline"), "epochDeadline");
    if (deadline <= 0 || Date.now() < deadline) throw new Error(t("epochNotEnded"));
    const draft = pendingDraft("settle", actorHash, context.contractHash, context.network, baseline, highestBase);
    try {
      await runDirectWrite({
        action: "settle",
        kind: "settle",
        operation: "settleEpoch",
        args: [],
        draft,
        waitForEvent: "EpochSettled",
        scriptHash: context.contractHash,
      });
    } catch (settleErr) {
      const mapped = windowRevertKey(settleErr);
      if (mapped) throw new Error(t(mapped));
      throw settleErr;
    }
  };

  // ── Claim rewards (staker GAS revenue) ─────────────────────────────────

  /**
   * Claim the connected staker's accrued GAS rewards via claimRewards(user). The
   * contract pays the banked + unrealized rewards in GAS. Reverts "no rewards"
   * when there is nothing to claim — the affordance is only shown when pending
   * rewards are positive.
   */
  const claimRewards = async () => {
    if (isBusy.get()) return;
    const { actorHash, context } = await authorizeWrite();
    const baseline = await readFreshBaselines(actorHash);
    const claimAmount = BigInt(baseline.rewardsRaw);
    if (claimAmount <= 0n) throw new Error(t("noRewards"));
    const draft = pendingDraft("claim", actorHash, context.contractHash, context.network, baseline, claimAmount);
    await runDirectWrite({
      action: "claim",
      kind: "claim",
      operation: "claimRewards",
      args: [app.chain.arg.hash160(actorHash)],
      draft,
      waitForEvent: "RewardsClaimed",
      scriptHash: context.contractHash,
    });
  };

  // ── Reclaim losing bid ─────────────────────────────────────────────────

  /**
   * Reclaim the connected wallet's losing bid from a settled epoch via
   * reclaimBid(bidder, epoch). The contract refunds the bid straight to the
   * bidder's wallet; the winner cannot reclaim (their bid funded the payout).
   */
  const reclaimBid = async (settledEpoch: number) => {
    if (isBusy.get()) return;
    const epoch = Math.trunc(Number(settledEpoch));
    if (!Number.isInteger(epoch) || epoch < 0) throw new Error(t("error"));
    const { actorHash, context } = await authorizeWrite();
    const baseline = await readFreshBaselines(actorHash);
    if (epoch >= baseline.epoch) throw new Error(t("reclaimNotSettled"));
    const actorArg = app.chain.arg.hash160(actorHash);
    const [bidRaw, winnerRaw] = await Promise.all([
      app.chain.readRaw("bidOf", [app.chain.arg.integer(epoch), actorArg], { scriptHash: context.contractHash }),
      app.chain.readRaw("settlementWinner", [app.chain.arg.integer(epoch)], { scriptHash: context.contractHash }),
    ]);
    const targetBid = requireUnsignedRaw(bidRaw, "bidOf");
    if (targetBid <= 0n) throw new Error(t("reclaimUnavailable"));
    if (addressMatches(String(winnerRaw ?? ""), actorHash)) throw new Error(t("winnerCannotReclaim"));
    const targetBaseline = { ...baseline, bidRaw: targetBid.toString() };
    const draft = pendingDraft(
      "reclaim",
      actorHash,
      context.contractHash,
      context.network,
      targetBaseline,
      targetBid,
      { epoch },
    );
    await runDirectWrite({
      action: "reclaim",
      kind: "reclaim",
      operation: "reclaimBid",
      args: [actorArg, app.chain.arg.integer(epoch)],
      draft,
      waitForEvent: "BidReclaimed",
      scriptHash: context.contractHash,
    });
  };

  // ── Withdraw unused GAS bid credit ─────────────────────────────────────

  /**
   * Reclaim any unused prepaid GAS bid credit via withdraw(account). Used when a
   * deposit landed but the bid never completed, or after over-funding a bid.
   */
  const withdrawCredit = async () => {
    if (isBusy.get()) return;
    const { actorHash, context } = await authorizeWrite();
    const baseline = await readFreshBaselines(actorHash);
    const credit = BigInt(baseline.creditRaw);
    if (credit <= 0n) throw new Error(t("noCredit"));
    const draft = pendingDraft("withdraw-credit", actorHash, context.contractHash, context.network, baseline, credit);
    await runDirectWrite({
      action: "withdraw-credit",
      kind: "withdraw-credit",
      operation: "withdraw",
      args: [app.chain.arg.hash160(actorHash)],
      draft,
      waitForEvent: "CreditWithdrawn",
      scriptHash: context.contractHash,
    });
  };

  // ── Derived display values ─────────────────────────────────────────────
  const hasRewards = createDerived(() => pendingRewards.get() > 0, [pendingRewards]);
  const hasCredit = createDerived(() => gasCredit.get() > 0, [gasCredit]);
  const hasReclaimable = createDerived(() => reclaimableBids.get().length > 0, [reclaimableBids]);

  return {
    // ── Inputs ────────────────────────────────────────────────────────
    depositAmount,
    withdrawAmount,
    bidAmount,

    // ── On-chain state ────────────────────────────────────────────────
    totalPool,
    userDeposits,
    currentEpoch,
    epochDeadline,
    epochDurationMs,
    bids,
    hasLiveBid,
    highestBid,
    lastSettlement,
    pendingRewards,
    gasCredit,
    reclaimableBids,

    // ── Read availability ────────────────────────────────────────────
    marketAvailable,
    windowAvailable,
    highestBidAvailable,
    walletAvailable,
    bidsAvailable,
    settlementAvailable,
    reclaimableAvailable,
    readError,

    // ── Flags ─────────────────────────────────────────────────────────
    dataLoading,
    loaded,
    isBusy,
    isRecovering,
    address,
    activeAction,
    pendingOperation,
    pendingTxid,
    transactionStatus,
    storageHealthy,

    // ── Derived ───────────────────────────────────────────────────────
    hasRewards,
    hasCredit,
    hasReclaimable,

    // ── Helpers ───────────────────────────────────────────────────────
    formatNum,

    // ── Actions ───────────────────────────────────────────────────────
    depositNeo,
    withdrawNeo,
    placeBid,
    settleEpoch,
    claimRewards,
    reclaimBid,
    withdrawCredit,
    recoverPendingOperation,
    loadData,
    setAddress,
    dispose: () => {
      isMounted = false;
    },
  };
}

export type UseGovMercReturn = ReturnType<typeof useGovMerc>;
