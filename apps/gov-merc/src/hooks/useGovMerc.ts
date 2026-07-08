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
}

// ============================================================================
// Composable
// ============================================================================

export function useGovMerc({ app, t }: UseGovMercOptions) {
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

  // ── UI flags ──────────────────────────────────────────────────────────
  const dataLoading = createObservable(false);
  const isProcessing = createObservable(false);
  const address = createObservable("");

  const isBusy: Observable<boolean> = combineBusy(isProcessing, dataLoading);

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
    const [totalStakedRaw, epochRaw] = await Promise.all([
      app.chain.readRaw("totalStaked", []),
      app.chain.readRaw("currentEpoch", []),
    ]);

    // totalStaked is WHOLE NEO — Number() directly, NO ÷1e8.
    totalPool.set(Math.max(0, Number(parseBigInt(totalStakedRaw))));
    const epoch = Math.max(0, Number(parseBigInt(epochRaw)));
    currentEpoch.set(epoch);

    // v2: the first bid of an epoch opens a fixed bidding window. Read the live
    // epoch's deadline (0 until that first bid) and the window length so the UI
    // can show a countdown / closed state. A failed read degrades to "unopened"
    // — the contract stays the authority via its own reverts.
    try {
      const [deadlineRaw, durationRaw] = await Promise.all([
        app.chain.readRaw("epochDeadline", [app.chain.arg.integer(epoch)]),
        app.chain.readRaw("epochDuration", []),
      ]);
      epochDeadline.set(Math.max(0, Number(parseBigInt(deadlineRaw))));
      const duration = Number(parseBigInt(durationRaw));
      epochDurationMs.set(duration > 0 ? duration : EPOCH_DURATION_FALLBACK_MS);
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] bidding-window read failed:", e);
      epochDeadline.set(0);
    }

    // Read highestBid(epoch) directly — the contract's own settle precondition —
    // so the Route Governance button can enable even if the BidPlaced events
    // feed is empty/stale (the leaderboard alone could wrongly disable settle
    // while highestBid > 0 proves the epoch is settleable).
    try {
      const highestRaw = await app.chain.readRaw("highestBid", [
        app.chain.arg.integer(epoch),
      ]);
      const highestBase = parseBigInt(highestRaw);
      hasLiveBid.set(highestBase > 0n);
      // Surface the live top bid (whole GAS) so bidders see the prize to beat and
      // stakers see the incoming yield without scanning the leaderboard.
      highestBid.set(gasFromBaseUnits(highestBase));
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] highestBid read failed:", e);
      hasLiveBid.set(false);
      highestBid.set(0);
    }

    const hashArg = myHashArg();
    if (hashArg) {
      const [stakeRaw, pendingRaw, creditRaw] = await Promise.all([
        app.chain.readRaw("stakeOf", [hashArg]),
        app.chain.readRaw("pendingRewards", [hashArg]),
        app.chain.readRaw("gasCreditOf", [hashArg]),
      ]);
      // stakeOf is WHOLE NEO — NO ÷1e8.
      userDeposits.set(Math.max(0, Number(parseBigInt(stakeRaw))));
      // pendingRewards / gasCredit are GAS base units — ÷1e8 for display.
      pendingRewards.set(gasFromBaseUnits(parseBigInt(pendingRaw)));
      gasCredit.set(gasFromBaseUnits(parseBigInt(creditRaw)));
    } else {
      userDeposits.set(0);
      pendingRewards.set(0);
      gasCredit.set(0);
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
    try {
      const events = await app.chain.events("BidPlaced", { limit: BID_EVENTS_LIMIT });
      const latestByBidder = new Map<string, number>();
      for (const event of events) {
        const evtEpoch = Number(parseBigInt(eventValue(event, 0)));
        if (evtEpoch !== epoch) continue;
        const bidder = String(eventValue(event, 1) ?? "").trim();
        if (!bidder) continue;
        if (latestByBidder.has(bidder)) continue; // newest total already kept
        latestByBidder.set(bidder, gasFromBaseUnits(parseBigInt(eventValue(event, 2))));
      }
      bids.set(
        Array.from(latestByBidder.entries())
          .map(([addr, amount]) => ({ address: addr, amount }))
          .filter((b) => b.amount > 0)
          .sort((a, b) => b.amount - a.amount),
      );
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] loadBids failed:", e);
      bids.set([]);
    }
  };

  /**
   * Resolve the most recently settled epoch (the one before the live epoch) from
   * the contract's settlement reads. Winner is a Hash160 (zero until settled);
   * the amount is GAS base units → ÷1e8.
   */
  const loadSettlement = async () => {
    const epoch = currentEpoch.get();
    if (epoch <= 0) {
      lastSettlement.set(null);
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
        return;
      }
      lastSettlement.set({
        epoch: settledEpoch,
        winner,
        amount: gasFromBaseUnits(parseBigInt(amountRaw)),
      });
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] loadSettlement failed:", e);
      lastSettlement.set(null);
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
    if (!hashArg || epoch <= 0) {
      reclaimableBids.set([]);
      return;
    }
    try {
      const startEpoch = Math.max(0, epoch - RECLAIM_LOOKBACK);
      const epochs: number[] = [];
      for (let e = startEpoch; e < epoch; e += 1) epochs.push(e);

      const results = await Promise.all(
        epochs.map(async (e): Promise<ReclaimableBid | null> => {
          try {
            const bidRaw = await app.chain.readRaw("bidOf", [
              app.chain.arg.integer(e),
              hashArg,
            ]);
            const bidBase = parseBigInt(bidRaw);
            if (bidBase <= 0n) return null; // never bid, or already reclaimed
            const winnerRaw = await app.chain.readRaw("settlementWinner", [
              app.chain.arg.integer(e),
            ]);
            const winner = String(winnerRaw ?? "").trim();
            // The winner cannot reclaim; their bid funds the staker payout.
            if (addressMatches(winner, address.get())) return null;
            return { epoch: e, amount: gasFromBaseUnits(bidBase) };
          } catch {
            return null;
          }
        }),
      );

      reclaimableBids.set(
        results
          .filter((r): r is ReclaimableBid => r !== null)
          .sort((a, b) => b.epoch - a.epoch),
      );
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] loadReclaimable failed:", e);
      reclaimableBids.set([]);
    }
  };

  const loadData = async () => {
    if (!isMounted) return;
    dataLoading.set(true);
    try {
      await loadStats();
      if (!isMounted) return;
      // Bids, settlement and reclaimable lookups all depend on the epoch read by
      // loadStats, so they run after it.
      await Promise.all([loadBids(), loadSettlement(), loadReclaimable()]);
    } catch (e) {
      warnIfUnexpectedReadFailure("[useGovMerc] loadData failed:", e);
    } finally {
      dataLoading.set(false);
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

    const addr = address.get() || (await app.chain.ensureWallet());
    if (!addr) throw new Error(t("walletStatusIdle"));
    setAddress(addr);
    const bidderArg = safeHash160Arg(addr);
    if (!bidderArg) throw new Error(t("walletStatusIdle"));

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isProcessing.set(true);
    try {
      // NEO transfer carries the WHOLE integer — no scaling.
      await app.chain.invoke(
        "transfer",
        [
          bidderArg,
          app.chain.arg.hash160(contractHash),
          app.chain.arg.integer(neoInt),
          app.chain.arg.string(STAKE_MEMO),
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.NEO_HASH, waitForEvent: "Staked" },
      );
      depositAmount.set("");
      await loadData();
    } finally {
      isProcessing.set(false);
    }
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
    if (Number(neoInt) > userDeposits.get()) throw new Error(t("withdrawExceeds"));

    const addr = address.get() || (await app.chain.ensureWallet());
    if (!addr) throw new Error(t("walletStatusIdle"));
    setAddress(addr);
    const userArg = safeHash160Arg(addr);
    if (!userArg) throw new Error(t("walletStatusIdle"));

    isProcessing.set(true);
    try {
      await app.chain.invoke(
        "withdrawStake",
        [
          userArg,
          app.chain.arg.integer(neoInt),
        ],
        { waitForEvent: "Unstaked" },
      );
      withdrawAmount.set("");
      await loadData();
    } finally {
      isProcessing.set(false);
    }
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

    const addr = address.get() || (await app.chain.ensureWallet());
    if (!addr) throw new Error(t("walletStatusIdle"));
    setAddress(addr);
    const bidderArg = safeHash160Arg(addr);
    if (!bidderArg) throw new Error(t("walletStatusIdle"));

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    const epoch = currentEpoch.get();
    const existingBid = bids.get().find((b) => addressMatches(b.address, address.get()));
    // The contract enforces MIN_BID only on the FIRST bid of an epoch. Mirror it
    // here so a too-small opening bid fails before any GAS moves.
    const isFirstBid = !existingBid || existingBid.amount <= 0;
    if (isFirstBid && addBase < MIN_BID_BASE) {
      throw new Error(t("minBid", { amount: MIN_BID, tokenGas: t("tokenGas") }));
    }

    // v2: bids must land BEFORE the epoch's bidding deadline. Mirror the
    // contract's "bidding closed" revert locally so no GAS moves after the
    // window has ended (a deadline of 0 means the window hasn't opened yet —
    // this bid would be the one that opens it).
    if (epochWindowPhase(epochDeadline.get(), Date.now()) === "closed") {
      throw new Error(t("biddingClosed"));
    }

    isProcessing.set(true);
    try {
      // DEPOSIT precheck — only top up when existing bid credit can't cover
      // the amount. The contract scales nothing; the amount is BASE UNITS here.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await app.chain.readRaw("gasCreditOf", [bidderArg]),
        );
      } catch {
        credit = 0n;
      }

      const bidArgs = [bidderArg, app.chain.arg.integer(addBase)];
      try {
        if (credit < addBase) {
          // Deposit-then-act (S3): payAndCall transfers the GAS to the
          // contract with the bid memo, waits for the deposit to confirm in a
          // block, then fires bid() — an unconfirmed deposit would let the bid
          // execute first and fault with "insufficient prepaid asset".
          // notify:'silent' because this composable owns the revert→i18n copy
          // below and main.tsx's guard owns the toasts.
          await app.funds.payAndCall({
            amountFixed8: addBase,
            memo: BID_MEMO,
            operation: "bid",
            args: bidArgs,
            waitForEvent: "BidPlaced",
            notify: "silent",
          });
        } else {
          // Existing credit covers the bid — no deposit this round.
          await app.chain.invoke("bid", bidArgs, { waitForEvent: "BidPlaced" });
        }
      } catch (bidErr) {
        // Deposit CONFIRMED but bid() reverted: the credit persists as
        // reusable prepaid bid credit (reclaimable via withdraw) — surface
        // that distinctly. FrameworkPrepaidActionError is identity-stable
        // (framework class, re-exported by @shared/react).
        const depositSettled = bidErr instanceof FrameworkPrepaidActionError;
        // v2: the bid can race the deadline — map the contract's
        // "bidding closed" revert to a friendly message. When the deposit
        // already landed, say explicitly that the GAS is held as credit.
        if (windowRevertKey(bidErr) === "biddingClosed") {
          throw new Error(t(depositSettled ? "biddingClosedCreditHeld" : "biddingClosed"));
        }
        if (depositSettled) throw new Error(t("bidDepositHeld"));
        throw new Error(errorMessage(bidErr) || t("error"));
      }

      // Defensive: keep the leaderboard honest if the epoch advanced between read
      // and write (the event-derived board will be authoritative on reload).
      void epoch;

      bidAmount.set("");
      await loadData();
    } finally {
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
    if (bids.get().length === 0) throw new Error(t("settleNoBids"));

    // v2: settlement only succeeds AFTER the bidding deadline. Only pre-block
    // when a deadline is actually known (>0) — otherwise let the contract rule.
    const deadline = epochDeadline.get();
    if (deadline > 0 && Date.now() < deadline) throw new Error(t("epochNotEnded"));

    const addr = address.get() || (await app.chain.ensureWallet());
    if (!addr) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    const contractHash = app.chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isProcessing.set(true);
    try {
      try {
        await app.chain.invoke("settleEpoch", [], { waitForEvent: "EpochSettled" });
      } catch (settleErr) {
        const mapped = windowRevertKey(settleErr);
        if (mapped) throw new Error(t(mapped));
        throw settleErr;
      }
      await loadData();
    } finally {
      isProcessing.set(false);
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
    if (pendingRewards.get() <= 0) throw new Error(t("noRewards"));

    const addr = address.get() || (await app.chain.ensureWallet());
    if (!addr) throw new Error(t("walletStatusIdle"));
    setAddress(addr);
    const userArg = safeHash160Arg(addr);
    if (!userArg) throw new Error(t("walletStatusIdle"));

    isProcessing.set(true);
    try {
      await app.chain.invoke(
        "claimRewards",
        [userArg],
        { waitForEvent: "RewardsClaimed" },
      );
      await loadData();
    } finally {
      isProcessing.set(false);
    }
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

    const addr = address.get() || (await app.chain.ensureWallet());
    if (!addr) throw new Error(t("walletStatusIdle"));
    setAddress(addr);
    const userArg = safeHash160Arg(addr);
    if (!userArg) throw new Error(t("walletStatusIdle"));

    isProcessing.set(true);
    try {
      await app.chain.invoke(
        "reclaimBid",
        [
          userArg,
          app.chain.arg.integer(epoch),
        ],
        { waitForEvent: "BidReclaimed" },
      );
      await loadData();
    } finally {
      isProcessing.set(false);
    }
  };

  // ── Withdraw unused GAS bid credit ─────────────────────────────────────

  /**
   * Reclaim any unused prepaid GAS bid credit via withdraw(account). Used when a
   * deposit landed but the bid never completed, or after over-funding a bid.
   */
  const withdrawCredit = async () => {
    if (isBusy.get()) return;
    if (gasCredit.get() <= 0) throw new Error(t("noCredit"));

    const addr = address.get() || (await app.chain.ensureWallet());
    if (!addr) throw new Error(t("walletStatusIdle"));
    setAddress(addr);
    const userArg = safeHash160Arg(addr);
    if (!userArg) throw new Error(t("walletStatusIdle"));

    isProcessing.set(true);
    try {
      await app.chain.invoke(
        "withdraw",
        [userArg],
        { waitForEvent: "CreditWithdrawn" },
      );
      await loadData();
    } finally {
      isProcessing.set(false);
    }
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

    // ── Flags ─────────────────────────────────────────────────────────
    dataLoading,
    isBusy,
    address,

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
    loadData,
    setAddress,
    dispose: () => {
      isMounted = false;
    },
  };
}

export type UseGovMercReturn = ReturnType<typeof useGovMerc>;
