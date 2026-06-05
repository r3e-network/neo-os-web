/**
 * useGovMerc — Domain logic for the Gov Merc (mercenary governance market) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract (MiniAppGovMerc) via
 * ctx.services.chain. The earlier path kept NEO deposits and per-epoch GAS bids
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
 *   READS (chain.read, default app contract script hash):
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
 *
 *   EVENTS (chain.listEvents):
 *     BidPlaced(epoch, bidder, totalBid) — leaderboard source for the CURRENT
 *       epoch: state slots [0]=epoch, [1]=bidder(address), [2]=totalBid(GAS base
 *       units). Board is the LATEST totalBid per bidder for the current epoch,
 *       ranked desc.
 *     EpochSettled(epoch, winner, bid, distributed) — settlement source.
 *
 *   MUTATIONS (chain.invoke):
 *     STAKE — a NEO transfer to the contract with memo "govmerc:stake". The whole
 *       NEO integer is the amount; NEO is INDIVISIBLE so it is NEVER scaled.
 *         transfer(from, CONTRACT, neoInteger, "govmerc:stake") { scriptHash: NEO_HASH }
 *     withdrawStake(user, neoInteger) — returns NEO to the user (banks rewards first).
 *     BID (deposit-then-act) — a GAS transfer with memo "govmerc:bid" (only topped
 *       up when gasCreditOf(bidder) < addBase), then bid(bidder, addBase). GAS is
 *       in BASE UNITS (×1e8, scaled once, no floats); first bid >= 1 GAS.
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
import type { ChainService } from "@shared/services/ChainService";
import { formatNum } from "@shared/utils/format";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

/** GAS base units per whole GAS (1e8). */
const GAS_DECIMALS_MULTIPLIER = 100_000_000n;

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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error ?? "");
}

// ============================================================================
// Amount helpers (NEO integer vs GAS base units kept strictly separate)
// ============================================================================

/**
 * Convert a human-entered GAS amount string to contract BASE UNITS without
 * floats. Accepts up to 8 decimal places; returns 0n for any invalid /
 * non-positive input so callers can reject before touching the chain. This is
 * the SINGLE GAS scaling point — the contract scales nothing.
 */
const gasToBaseUnits = (raw: string): bigint => {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+(\.\d{1,8})?$/.test(trimmed)) return 0n;
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const paddedFraction = (fraction + "00000000").slice(0, 8);
  const base = BigInt(whole) * GAS_DECIMALS_MULTIPLIER + BigInt(paddedFraction);
  return base > 0n ? base : 0n;
};

/**
 * Parse a WHOLE NEO amount string to an integer bigint. NEO is INDIVISIBLE, so a
 * fractional value is rejected (returns 0n) — it is NEVER scaled by 1e8. Returns
 * 0n for any invalid / non-positive input.
 */
const neoToInteger = (raw: string): bigint => {
  const trimmed = String(raw ?? "").trim();
  if (!/^\d+$/.test(trimmed)) return 0n;
  const n = BigInt(trimmed);
  return n > 0n ? n : 0n;
};

/** Convert a GAS base-unit Integer to whole GAS as a number (÷ 1e8). */
const gasFromBaseUnits = (base: bigint): number => Number(base) / 1e8;

/** Is a parsed Hash160 / address the zero address (an unset contract slot)? */
const isZeroAddress = (value: string): boolean => {
  if (!value) return true;
  const v = value.trim();
  if (v === ZERO_HASH) return true;
  return /^0x0{40}$/i.test(v);
};

/** Case-insensitive address equality (base58 + hex script-hash forms). */
function addressMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b || a.toLowerCase() === b.toLowerCase();
}

/** Read a single state slot from a contract event payload (positional). */
function eventValue(entry: unknown, index: number): unknown {
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
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useGovMerc({ chain, t }: UseGovMercOptions) {
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
  /** Current-epoch leaderboard: { address, amount } where amount is whole GAS. */
  const bids = createObservable<{ address: string; amount: number }[]>([]);
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

  const isBusy: Observable<boolean> = {
    get: () => isProcessing.get() || dataLoading.get(),
    set: () => {},
    subscribe: (fn) => {
      const u1 = isProcessing.subscribe(fn);
      const u2 = dataLoading.subscribe(fn);
      return () => {
        u1();
        u2();
      };
    },
  };

  let isMounted = true;

  const setAddress = (addr: string) => {
    address.set(addr ?? "");
  };

  const myHash = (): string | null => {
    const addr = address.get();
    if (!addr) return null;
    return addressToScriptHash(addr) || null;
  };

  // ── Data loading (direct chain reads + events) ─────────────────────────

  /**
   * Read the authoritative market state: total NEO staked, current epoch, the
   * connected staker's stake/rewards/credit, and the last settlement. NEO values
   * are whole integers; GAS values are scaled from base units to whole GAS.
   */
  const loadStats = async () => {
    const [totalStakedRaw, epochRaw] = await Promise.all([
      chain.read("totalStaked", []),
      chain.read("currentEpoch", []),
    ]);

    // totalStaked is WHOLE NEO — Number() directly, NO ÷1e8.
    totalPool.set(Math.max(0, Number(parseBigInt(totalStakedRaw))));
    const epoch = Math.max(0, Number(parseBigInt(epochRaw)));
    currentEpoch.set(epoch);

    const hash = myHash();
    if (hash) {
      const [stakeRaw, pendingRaw, creditRaw] = await Promise.all([
        chain.read("stakeOf", [{ type: "Hash160", value: hash }]),
        chain.read("pendingRewards", [{ type: "Hash160", value: hash }]),
        chain.read("gasCreditOf", [{ type: "Hash160", value: hash }]),
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
      const events = await chain.listEvents("BidPlaced", { limit: BID_EVENTS_LIMIT });
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
      console.warn("[useGovMerc] loadBids failed:", errorMessage(e));
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
        chain.read("settlementWinner", [{ type: "Integer", value: String(settledEpoch) }]),
        chain.read("settlementAmount", [{ type: "Integer", value: String(settledEpoch) }]),
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
      console.warn("[useGovMerc] loadSettlement failed:", errorMessage(e));
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
    const hash = myHash();
    const epoch = currentEpoch.get();
    if (!hash || epoch <= 0) {
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
            const bidRaw = await chain.read("bidOf", [
              { type: "Integer", value: String(e) },
              { type: "Hash160", value: hash },
            ]);
            const bidBase = parseBigInt(bidRaw);
            if (bidBase <= 0n) return null; // never bid, or already reclaimed
            const winnerRaw = await chain.read("settlementWinner", [
              { type: "Integer", value: String(e) },
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
      console.warn("[useGovMerc] loadReclaimable failed:", errorMessage(e));
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
      console.warn("[useGovMerc] loadData failed:", errorMessage(e));
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

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isProcessing.set(true);
    try {
      // NEO transfer carries the WHOLE integer — no scaling.
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: hash },
          { type: "Hash160", value: contractHash },
          { type: "Integer", value: neoInt.toString() },
          { type: "String", value: STAKE_MEMO },
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

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    isProcessing.set(true);
    try {
      await chain.invoke(
        "withdrawStake",
        [
          { type: "Hash160", value: hash },
          { type: "Integer", value: neoInt.toString() },
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
   * Place / raise a GAS bid for the current epoch (deposit-then-act).
   *
   * Two signed steps, both by the bidder:
   *   1. DEPOSIT — only when gasCreditOf(bidder) < addBase, transfer the bid
   *      amount in GAS to the contract with the "govmerc:bid" memo so
   *      OnNEP17Payment credits the bidder's GAS bid balance. The amount is in
   *      BASE UNITS here (scaled once, no floats).
   *   2. bid(bidder, addBase) — raises the bidder's epoch bid from their credit.
   *      The first bid for an epoch must be >= 1 GAS.
   *
   * If step 1 lands but step 2 reverts, the credit persists on the contract as
   * reusable prepaid bid credit (reclaimable via withdraw) — no GAS is lost.
   */
  const placeBid = async () => {
    if (isBusy.get()) return;
    const addBase = gasToBaseUnits(bidAmount.get());
    if (addBase <= 0n) throw new Error(t("enterAmount"));

    const addr = address.get() || (await chain.ensureWallet());
    const bidderHash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !bidderHash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    const epoch = currentEpoch.get();
    const existingBid = bids.get().find((b) => addressMatches(b.address, address.get()));
    // The contract enforces MIN_BID only on the FIRST bid of an epoch. Mirror it
    // here so a too-small opening bid fails before any GAS moves.
    const isFirstBid = !existingBid || existingBid.amount <= 0;
    if (isFirstBid && addBase < MIN_BID_BASE) {
      throw new Error(t("minBid", { amount: MIN_BID, tokenGas: t("tokenGas") }));
    }

    isProcessing.set(true);
    let depositSettled = false;
    try {
      // Step 1: DEPOSIT — only top up when existing bid credit can't cover the
      // amount. The contract scales nothing; the amount is BASE UNITS here.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("gasCreditOf", [{ type: "Hash160", value: bidderHash }]),
        );
      } catch {
        credit = 0n;
      }

      if (credit < addBase) {
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: bidderHash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: addBase.toString() },
            { type: "String", value: BID_MEMO },
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
        );
        depositSettled = true;
      }

      // Step 2: bid — raises the epoch bid from credit. If the deposit landed but
      // this reverts, the credit persists as reusable prepaid bid credit
      // (reclaimable via withdraw); surface that distinctly.
      try {
        await chain.invoke(
          "bid",
          [
            { type: "Hash160", value: bidderHash },
            { type: "Integer", value: addBase.toString() },
          ],
          { waitForEvent: "BidPlaced" },
        );
      } catch (bidErr) {
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
   * there are none — the canSettle gate prevents that path.
   */
  const settleEpoch = async () => {
    if (isBusy.get()) return;
    if (bids.get().length === 0) throw new Error(t("settleNoBids"));

    const addr = address.get() || (await chain.ensureWallet());
    if (!addr) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isProcessing.set(true);
    try {
      await chain.invoke("settleEpoch", [], { waitForEvent: "EpochSettled" });
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

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    isProcessing.set(true);
    try {
      await chain.invoke(
        "claimRewards",
        [{ type: "Hash160", value: hash }],
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

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    isProcessing.set(true);
    try {
      await chain.invoke(
        "reclaimBid",
        [
          { type: "Hash160", value: hash },
          { type: "Integer", value: String(epoch) },
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

    const addr = address.get() || (await chain.ensureWallet());
    const hash = addr ? addressToScriptHash(addr) : null;
    if (!addr || !hash) throw new Error(t("walletStatusIdle"));
    setAddress(addr);

    isProcessing.set(true);
    try {
      await chain.invoke(
        "withdraw",
        [{ type: "Hash160", value: hash }],
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
    bids,
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
