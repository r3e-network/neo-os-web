/**
 * useLastSurvivor — Domain logic for the Last Survivor (doomsday clock) miniapp.
 *
 * Talks DIRECTLY to the app's standalone on-chain contract
 * (MiniAppLastSurvivor) via ctx.services.chain. The earlier path routed
 * buy/settle through the OS game/payment/leaderboard/storage/badge kernel
 * proxies, which never actually held a pot or paid a winner — buys funded GAS
 * that was never distributed and "rollover" was a no-op. This composable now
 * drives the dedicated contract, a FOMO-style pot game where each key extends a
 * countdown, the pot grows on a rising bonding curve, and the LAST buyer wins
 * the entire pot — paid ATOMICALLY when settle() runs (permissionless, no
 * oracle, no off-chain keeper required).
 *
 * Contract interaction model (verified against MiniAppLastSurvivor.cs / ABI):
 *
 *   READS (chain.read / chain.readArray, default app contract script hash):
 *     currentRoundId()                 -> Integer (rounds are 1-based)
 *     creditOf(player)                 -> Integer (prepaid GAS credit, base units)
 *     playerKeys(roundId, player)      -> Integer (keys held by the player)
 *     currentKeyCost(count)            -> Integer (cost of `count` keys NOW)
 *     keyCost(totalKeys, count)        -> Integer (cost given a round total)
 *     getCurrentRound()                -> Map{roundId,pot,totalKeys,lastBuyer,
 *                                           endTime(ms),settled,active,
 *                                           remainingTime(seconds)}
 *     getRound(id)                     -> Map{...same...}
 *
 *   MUTATIONS (chain.invoke):
 *     1. DEPOSIT (fund a buy) — a GAS transfer to the contract with the memo
 *        "miniapp-lastsurvivor:buy" so OnNEP17Payment credits the sender's
 *        prepaid balance:
 *          transfer(from, CONTRACT, costBaseUnits, "miniapp-lastsurvivor:buy")
 *          { scriptHash: GAS_HASH }
 *     2. buyKeys(player, count) -> cost. Consumes the prepaid credit at the
 *        rising bonding-curve price, adds the cost to the round pot, makes the
 *        player the last buyer, and extends the countdown. If buyKeys fails
 *        after a successful deposit the credit simply remains on the contract as
 *        reusable prepaid credit for the next buy — the deposit nets against any
 *        existing creditOf(player), and a stranded balance is reclaimable via
 *        withdraw (no funds are lost).
 *     settle() -> pot. PERMISSIONLESS. Once the round's countdown has expired it
 *        pays the recorded last buyer the entire pot atomically and advances to
 *        a fresh round. Anyone may call it; the on-chain last buyer is always the
 *        winner, regardless of who triggers the settle.
 *     withdraw(account) -> credit. Pays the whole unused prepaid buy-credit back
 *        to the wallet ("CreditWithdrawn" event, state[1] = amount) — the
 *        recovery path when a deposit landed but buyKeys never completed.
 *
 * AMOUNT CONVENTION: the contract takes/returns BASE UNITS. GAS = human × 1e8.
 * getCurrentRound.endTime is MILLISECONDS (Runtime.Time units); remainingTime is
 * already SECONDS. The contract's key-cost math is IDENTICAL to the frontend's
 * calculateKeyCostFormula (BASE_KEY_PRICE = 10_000_000 base units, +0.1% per
 * key), so the on-screen estimate equals exactly what the contract charges.
 *
 * The composable still owns:
 *   - Reactive state (observables + derived) for manifest/PlayArea bindings
 *   - Countdown timer logic (danger level, pulse, etc.)
 *   - Key cost formula (pure frontend math, mirrors the contract)
 *   - Loading/buying/settling UI flags (double-submit guards)
 *   - Formatted display values
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { ChainService } from "@shared/services/ChainService";
import { formatNumber, formatAddress, fromFixed8 } from "@shared/utils/format";
import { eventValue } from "@shared/utils/chain-events";
import { addressToScriptHash } from "@shared/utils/neo";
import { parseBigInt } from "@shared/utils/parsers";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// HistoryEvent type (extracted from HistoryList component)
export interface HistoryEvent {
  id: string | number;
  title: string;
  details: string;
  date: string;
  /**
   * Numeric, newest-first ordering key. Derived from the round id so the
   * settled-round winner entries sort deterministically (highest round first).
   */
  sortKey: number;
}

// ============================================================================
// Constants
// ============================================================================

/** Base key price in GAS base units (0.1 GAS). Mirrors BASE_KEY_PRICE. */
const BASE_KEY_PRICE = 10000000n;
/** +0.1% of base per key already sold. Mirrors COMMON_DIFF (10 bps). */
const KEY_PRICE_INCREMENT_BPS = 10n;

/** GAS base units per whole GAS (1e8). */
const GAS_DECIMALS_MULTIPLIER = 100_000_000n;

/** Memo the contract requires on the buy-funding transfer. */
const BUY_MEMO = "miniapp-lastsurvivor:buy";

/**
 * 24h cap on the displayed danger meter, in seconds. Mirrors the contract's
 * MAX_DURATION_MS (86_400_000 ms).
 */
const MAX_DURATION_SECONDS = 86400;

/** The zero script hash a fresh round carries for lastBuyer (UInt160.Zero). */
const ZERO_HASH = "0x0000000000000000000000000000000000000000";

/** How many past rounds to rebuild into the history list (newest first). */
const MAX_HISTORY_ROUNDS = 30;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

/**
 * Convert a contract base-unit Integer to whole GAS as a number. Base units
 * are an integer count of 1e-8 GAS; dividing by 1e8 yields human GAS.
 */
const fromBaseUnits = (base: bigint): number => Number(base) / 1e8;

/**
 * Is a parsed Hash160 / address value the zero address (a fresh round's
 * lastBuyer)? Treats "", the 0x-zero hash, and the base58 zero form as empty.
 */
const isZeroAddress = (value: string): boolean => {
  if (!value) return true;
  const v = value.trim();
  if (v === ZERO_HASH) return true;
  // A 0x-hash of all zeros (case/length tolerant).
  if (/^0x0{40}$/i.test(v)) return true;
  return false;
};

// ============================================================================
// Types
// ============================================================================

export interface UseLastSurvivorOptions {
  /** Shared chain service from ctx.services.chain. */
  chain: ChainService;
  /** Translation function. */
  t: (key: string, params?: Record<string, string | number>) => string;
}

/**
 * Normalized current-round snapshot read from getCurrentRound(). Amount fields
 * are kept in their contract scale (pot in base units, remainingTime seconds).
 */
interface RoundSnapshot {
  roundId: number;
  potBase: bigint;
  totalKeys: bigint;
  lastBuyer: string;
  endTimeMs: number;
  settled: boolean;
  active: boolean;
  remainingSeconds: number;
}

// ============================================================================
// Round map parsing
// ============================================================================

/**
 * Map a getCurrentRound / getRound Map (returned by chain.read as a plain
 * object) into a RoundSnapshot. Returns null for an unknown / empty result.
 */
function parseRound(raw: unknown): RoundSnapshot | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const v = raw as Record<string, unknown>;
  const lastBuyerRaw = String(v.lastBuyer ?? "");
  return {
    roundId: Number(parseBigInt(v.roundId)),
    potBase: parseBigInt(v.pot),
    totalKeys: parseBigInt(v.totalKeys),
    lastBuyer: isZeroAddress(lastBuyerRaw) ? "" : lastBuyerRaw,
    endTimeMs: Number(parseBigInt(v.endTime)),
    settled: Boolean(v.settled),
    active: Boolean(v.active),
    remainingSeconds: Number(parseBigInt(v.remainingTime)),
  };
}

// ============================================================================
// Composable
// ============================================================================

export function useLastSurvivor({ chain, t }: UseLastSurvivorOptions) {
  // ── Game State ──────────────────────────────────────────────────────
  const roundId = createObservable(0);
  const totalPot = createObservable(0);
  const isRoundActive = createObservable(false);
  const lastBuyer = createObservable<string | null>(null);
  const userKeys = createObservable(0);
  const keyCount = createObservable("1");
  const keyValidationError = createObservable<string | null>(null);
  const history = createObservable<HistoryEvent[]>([]);
  const isBuyingKeys = createObservable(false);
  const isSettling = createObservable(false);
  const isLoading = createObservable(false);
  const totalKeysInRound = createObservable(0n);
  const roundDataAvailable = createObservable(false);
  const serviceNotice = createObservable("");
  /** Connected wallet's unused prepaid buy-credit (human GAS). */
  const prepaidCredit = createObservable(0);

  // Connected wallet address (synced from main.tsx / chain).
  const address = createObservable<string | null>(chain.address.get() ?? null);

  const setAddress = (addr: string | null) => {
    address.set(addr ?? null);
  };

  // ── Timer State ─────────────────────────────────────────────────────
  const endTime = createObservable(0);
  const now = createObservable(Date.now());

  const timeRemainingSeconds = createDerived(() => {
    if (!endTime.get()) return 0;
    return Math.max(0, Math.floor((endTime.get() - now.get()) / 1000));
  }, [now, endTime]);

  const countdown = createDerived(() => {
    const total = timeRemainingSeconds.get();
    const hours = String(Math.floor(total / 3600)).padStart(2, "0");
    const mins = String(Math.floor((total % 3600) / 60)).padStart(2, "0");
    const secs = String(total % 60).padStart(2, "0");
    return `${hours}:${mins}:${secs}`;
  }, [timeRemainingSeconds]);

  const dangerLevel = createDerived(() => {
    const seconds = timeRemainingSeconds.get();
    if (seconds > 7200) return "low";
    if (seconds > 3600) return "medium";
    if (seconds > 600) return "high";
    return "critical";
  }, [timeRemainingSeconds]);

  const dangerLevelText = createDerived(() => {
    switch (dangerLevel.get()) {
      case "low": return t("dangerLow");
      case "medium": return t("dangerMedium");
      case "high": return t("dangerHigh");
      case "critical": return t("dangerCritical");
      default: return t("dangerLow");
    }
  }, [dangerLevel]);

  const dangerProgress = createDerived(() => {
    if (!timeRemainingSeconds.get()) return 0;
    return Math.min(100, (timeRemainingSeconds.get() / MAX_DURATION_SECONDS) * 100);
  }, [timeRemainingSeconds]);

  const shouldPulse = createDerived(() => timeRemainingSeconds.get() <= 600, [timeRemainingSeconds]);

  const updateNow = () => { now.set(Date.now()); };

  // ── Formatted display values ──────────────────────────────────────
  const lastBuyerLabel = createDerived(() => lastBuyer.get() ? formatAddress(lastBuyer.get() ?? "") : t("notAvailable"), []);
  const formattedRound = createDerived(() => `#${roundId.get()}`, []);
  const totalPotDisplay = createDerived(() => `${formatNumber(totalPot.get(), 2)} ${t("tokenGas")}`, []);
  const roundStatusDisplay = createDerived(() => isRoundActive.get() ? t("activeRound") : t("inactiveRound"), []);

  // Round-total keys as a plain number for binding (the raw value is a bigint
  // tracked in `totalKeysInRound`, used by the cost formula). This is the
  // number of keys SOLD in the round — distinct from the buy-selector
  // `keyCount` picker, which is only used to estimate purchase cost.
  const totalKeysDisplay = createDerived(
    () => Number(totalKeysInRound.get()),
    [totalKeysInRound],
  );

  // The user's share of the round, as a percentage of the round's real total
  // keys. Guards divide-by-zero (returns 0 when no keys have been sold yet).
  const userSharePercent = createDerived(() => {
    const total = Number(totalKeysInRound.get());
    if (total <= 0) return 0;
    return (userKeys.get() / total) * 100;
  }, [totalKeysInRound, userKeys]);

  // The round has ended on chain (timer expired with a recorded last buyer and a
  // non-empty pot) and still needs settle() to pay the winner and roll forward.
  // The PlayArea surfaces this as the settle affordance.
  const needsLifecycleSync = createDerived(() => {
    return (
      !isRoundActive.get() &&
      !!lastBuyer.get() &&
      totalPot.get() > 0
    );
  }, []);

  /** True when the connected wallet has unused prepaid buy-credit to withdraw. */
  const hasCredit = createDerived(() => prepaidCredit.get() > 0, [prepaidCredit]);

  // ── Key cost formula (pure frontend math, mirrors the contract) ────
  const calculateKeyCostFormula = (count: bigint, currentTotalKeys: bigint): bigint => {
    if (count <= 0n) return 0n;
    const commonDiff = (BASE_KEY_PRICE * KEY_PRICE_INCREMENT_BPS) / 10000n;
    const firstKeyPrice = BASE_KEY_PRICE + currentTotalKeys * commonDiff;
    const baseCost = count * firstKeyPrice;
    const incrementCost = ((count * (count - 1n)) / 2n) * commonDiff;
    return baseCost + incrementCost;
  };

  const estimatedCostRaw = createDerived(() => {
    const count = BigInt(Math.max(0, Math.floor(Number(keyCount.get()) || 0)));
    return calculateKeyCostFormula(count, totalKeysInRound.get());
  }, [keyCount, totalKeysInRound]);

  const estimatedCost = createDerived(() => fromBaseUnits(estimatedCostRaw.get()).toFixed(2), [estimatedCostRaw]);

  // ── Data Loading (direct chain reads) ──────────────────────────────

  /**
   * Load the current round straight from getCurrentRound(). Maps the contract
   * Map into the observables the UI binds; returns the remaining time in
   * seconds (already the contract's unit) so loadAll can derive endTime.
   */
  const loadRoundData = async (): Promise<number> => {
    try {
      const raw = await chain.read("getCurrentRound", []);
      const round = parseRound(raw);
      if (round) {
        roundId.set(round.roundId);
        // pot is in base units (1e8) — scale to whole GAS for display.
        totalPot.set(fromBaseUnits(round.potBase));
        // A round is buyable while active. A fresh round (no keys) is always
        // active; an expired round reports active=false and remainingTime 0.
        isRoundActive.set(round.active);
        lastBuyer.set(round.lastBuyer || "");
        totalKeysInRound.set(round.totalKeys);
        roundDataAvailable.set(true);
        serviceNotice.set("");
        return round.remainingSeconds;
      }
      roundDataAvailable.set(false);
      serviceNotice.set(t("roundStateUnavailable"));
      return 0;
    } catch (e) {
      roundDataAvailable.set(false);
      serviceNotice.set(t("roundStateUnavailable"));
      console.warn("[useLastSurvivor] loadRoundData failed:", errorMessage(e));
      return 0;
    }
  };

  /**
   * Load the connected wallet's key count for the current round via
   * playerKeys(roundId, player). A missing wallet / round yields 0.
   */
  const loadUserKeys = async () => {
    const currentRound = roundId.get();
    const walletAddr = address.get();
    const walletHash = walletAddr ? addressToScriptHash(walletAddr) || null : null;
    if (!currentRound || !walletHash) {
      userKeys.set(0);
      return;
    }
    try {
      const keys = await chain.read("playerKeys", [
        { type: "Integer", value: String(currentRound) },
        { type: "Hash160", value: walletHash },
      ]);
      userKeys.set(Number(parseBigInt(keys)));
    } catch (e) {
      console.warn("[useLastSurvivor] loadUserKeys failed:", errorMessage(e));
      userKeys.set(0);
    }
  };

  /**
   * Refresh the connected wallet's unused prepaid buy-credit from
   * creditOf(account). Base units → human GAS. A missing wallet yields 0; a read
   * failure leaves the last known value (the withdraw path re-reads before
   * acting anyway).
   */
  const loadCredit = async () => {
    const walletAddr = address.get();
    const walletHash = walletAddr ? addressToScriptHash(walletAddr) || null : null;
    if (!walletHash) {
      prepaidCredit.set(0);
      return;
    }
    try {
      const raw = await chain.read("creditOf", [
        { type: "Hash160", value: walletHash },
      ]);
      prepaidCredit.set(fromFixed8(parseBigInt(raw)));
    } catch (e) {
      console.warn("[useLastSurvivor] creditOf read failed:", errorMessage(e));
    }
  };

  /**
   * Rebuild the history list from past rounds. Rounds 1..currentRoundId-1 are
   * already finished; each settled round with a pot yields a "winnerDeclared"
   * entry (winner = lastBuyer, prize = pot). Newest first, capped at
   * MAX_HISTORY_ROUNDS. This replaces the leaderboard/storage event sources.
   */
  const loadHistory = async () => {
    try {
      const current = roundId.get();
      if (current <= 1) {
        history.set([]);
        return;
      }

      // Scan the most recent finished rounds (current-1 down to the cap), newest
      // first. Round ids are 1-based; the current round is still in progress.
      const start = Math.max(1, current - MAX_HISTORY_ROUNDS);
      const ids: number[] = [];
      for (let id = current - 1; id >= start; id -= 1) ids.push(id);

      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const raw = await chain.read("getRound", [
              { type: "Integer", value: String(id) },
            ]);
            return parseRound(raw);
          } catch (e) {
            console.warn(
              "[useLastSurvivor] getRound failed for",
              id,
              ":",
              errorMessage(e),
            );
            return null;
          }
        }),
      );

      const items: HistoryEvent[] = [];
      for (const round of results) {
        if (!round) continue;
        // A finished round with a winner + pot is a settled win. A round with no
        // keys / no buyer never produced a winner and is skipped.
        if (round.totalKeys <= 0n || !round.lastBuyer || round.potBase <= 0n) continue;
        const prizeGas = fromBaseUnits(round.potBase);
        items.push({
          id: `round-${round.roundId}`,
          title: t("winnerDeclared"),
          details: `#${round.roundId} • ${formatAddress(round.lastBuyer)} • ${prizeGas.toFixed(2)} ${t("tokenGas")}`,
          date: "",
          sortKey: round.roundId,
        });
      }

      // Newest round first.
      history.set(items.sort((a, b) => b.sortKey - a.sortKey));
    } catch (e) {
      console.warn("[useLastSurvivor] loadHistory failed:", errorMessage(e));
      history.set([]);
    }
  };

  const validateKeyCount = (count: string): string | null => {
    const num = parseInt(count, 10);
    if (isNaN(num) || num <= 0) return t("invalidKeyCount");
    if (num > 1000) return t("maxKeyCountExceeded");
    return null;
  };

  /**
   * Load all data. Called by defineMiniApp on mount and wallet reconnect.
   */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      setAddress(chain.address.get() ?? address.get() ?? null);
      const remainingSeconds = await loadRoundData();
      const endTimeMs = remainingSeconds > 0 ? Date.now() + remainingSeconds * 1000 : 0;
      endTime.set(endTimeMs);
      await loadUserKeys();
      await loadCredit();
      await loadHistory();
    } finally {
      isLoading.set(false);
    }
  };

  // ── Actions (direct chain invocations) ─────────────────────────────

  /**
   * Buy `count` keys against the standalone contract.
   *
   * Two signed steps, both by the player:
   *   1. DEPOSIT — transfer the cost in GAS to the contract with the
   *      "miniapp-lastsurvivor:buy" memo, crediting the player's prepaid
   *      balance. The cost is the rising bonding-curve price for `count` keys at
   *      the round's current total (frontend formula == contract math).
   *   2. buyKeys(player, count) — consumes that credit, adds the cost to the
   *      pot, makes the player the last buyer, and extends the countdown.
   *
   * If step 1 succeeds but step 2 fails, the prepaid credit simply remains on
   * the contract under the player and is reused on the next buy — there is no
   * refund call (and none is needed; funds are not lost). When the round has
   * already ended (timer expired with keys), the contract rejects the buy with
   * "round ended; settle first"; we surface that the round must be settled
   * before buying rather than letting the buy fault opaquely.
   */
  const buyKeys = async (count: string) => {
    if (isBuyingKeys.get()) return;
    const validation = validateKeyCount(count);
    if (validation) {
      keyValidationError.set(validation);
      throw new Error(validation);
    }
    keyValidationError.set(null);
    const numKeys = Math.max(0, Math.floor(Number(count) || 0));
    if (numKeys <= 0) throw new Error(t("invalidKeyCount"));

    // A round that has keys but a zero clock has ended and must be settled
    // first; surface that cleanly before prompting the wallet.
    if (
      totalKeysInRound.get() > 0n &&
      !isRoundActive.get() &&
      timeRemainingSeconds.get() <= 0
    ) {
      throw new Error(t("settleBeforeBuy"));
    }

    const playerAddr = address.get() || (await chain.ensureWallet());
    const playerHash = addressToScriptHash(playerAddr || "");
    if (!playerAddr || !playerHash) throw new Error(t("walletNotConnected"));
    setAddress(playerAddr);

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    isBuyingKeys.set(true);
    try {
      // Cost for `count` keys at the round's current total. Prefer the on-chain
      // currentKeyCost read (authoritative); fall back to the local formula
      // (identical math) if the read is unavailable.
      let costBase = calculateKeyCostFormula(BigInt(numKeys), totalKeysInRound.get());
      try {
        const onChain = parseBigInt(
          await chain.read("currentKeyCost", [
            { type: "Integer", value: String(numKeys) },
          ]),
        );
        if (onChain > 0n) costBase = onChain;
      } catch (e) {
        console.warn("[useLastSurvivor] currentKeyCost read failed, using local formula:", errorMessage(e));
      }
      if (costBase <= 0n) throw new Error(t("invalidKeyCount"));

      // Step 1: DEPOSIT — top up only the SHORTFALL beyond any prepaid credit
      // left from a previous aborted buy, so stale credit is consumed instead of
      // accumulating. When the existing credit already covers the cost the
      // deposit is skipped entirely.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("creditOf", [{ type: "Hash160", value: playerHash }]),
        );
      } catch {
        credit = 0n;
      }

      if (credit < costBase) {
        // Wait for the contract's "Credited" event so the deposit is confirmed
        // in a block before buyKeys consumes it — an unconfirmed deposit lets the
        // buy execute first and fault on "insufficient deposit credit" with the
        // funds already in flight (the shared invokeWithPayment path exists
        // precisely because intra-block ordering is fee/hash-based).
        await chain.invoke(
          "transfer",
          [
            { type: "Hash160", value: playerHash },
            { type: "Hash160", value: contractHash },
            { type: "Integer", value: (costBase - credit).toString() },
            { type: "String", value: BUY_MEMO },
          ],
          { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH, waitForEvent: "Credited" },
        );
      }

      // Step 2: buyKeys — consumes the prepaid credit. If this fails the credit
      // persists on the contract under the player and is reusable on the next
      // buy (or withdrawable via withdrawCredit; funds are not lost).
      try {
        await chain.invoke(
          "buyKeys",
          [
            { type: "Hash160", value: playerHash },
            { type: "Integer", value: String(numKeys) },
          ],
          { waitForEvent: "KeysBought" },
        );
      } catch (buyErr) {
        const raw = errorMessage(buyErr);
        console.error(
          "[useLastSurvivor] buyKeys failed after deposit succeeded:",
          raw,
        );
        // A round that ended between the round read and the buy faults with
        // "round ended; settle first" — surface the settle requirement; any
        // other failure leaves the deposit as reusable prepaid credit.
        if (/settle first|round ended/i.test(raw)) {
          throw new Error(t("settleBeforeBuy"));
        }
        throw new Error(t("keyPurchaseDepositHeld"));
      }

      await loadAll();
      return numKeys;
    } finally {
      isBuyingKeys.set(false);
    }
  };

  /**
   * Settle the current round against the standalone contract.
   *
   * settle() is PERMISSIONLESS: once the round's countdown has expired it pays
   * the recorded last buyer (NOT the caller) the entire pot atomically and
   * advances to a fresh round. Anyone may trigger it; the winner is paid by the
   * contract regardless of who signs. The UI surfaces this through the
   * needsLifecycleSync affordance once a round has ended with a pot.
   */
  const settleRound = async () => {
    if (isSettling.get()) return;

    const contractHash = chain.contractAddress.get();
    if (!contractHash) throw new Error(t("missingContract"));

    // The signer just triggers the settle; ensure a wallet is available to sign.
    const callerAddr = address.get() || (await chain.ensureWallet());
    if (!callerAddr) throw new Error(t("walletNotConnected"));
    setAddress(callerAddr);

    isSettling.set(true);
    try {
      await chain.invoke("settle", [], { waitForEvent: "RoundSettled" });
      await loadAll();
    } finally {
      isSettling.set(false);
    }
  };

  /**
   * Withdraw the connected wallet's unused prepaid buy-credit via
   * withdraw(account). The contract pays the WHOLE credit back to the wallet —
   * the recovery path when a deposit landed but buyKeys never completed. Returns
   * the withdrawn amount in human GAS (from the "CreditWithdrawn" event,
   * state[1] = amount).
   */
  const withdrawCredit = async (): Promise<{ amount: number }> => {
    if (isLoading.get()) return { amount: 0 };

    const accountAddr = address.get() || (await chain.ensureWallet());
    const accountHash = addressToScriptHash(accountAddr || "");
    if (!accountAddr || !accountHash) throw new Error(t("walletNotConnected"));
    setAddress(accountAddr);

    isLoading.set(true);
    try {
      // Read the live credit first — the contract reverts "no credit" on an empty
      // balance, so surface a clean message before prompting the wallet.
      let credit = 0n;
      try {
        credit = parseBigInt(
          await chain.read("creditOf", [{ type: "Hash160", value: accountHash }]),
        );
      } catch {
        credit = 0n;
      }
      if (credit <= 0n) throw new Error(t("noCredit"));

      const result = await chain.invoke(
        "withdraw",
        [{ type: "Hash160", value: accountHash }],
        { waitForEvent: "CreditWithdrawn" },
      );

      // OnCreditWithdrawn(account, amount) — amount is state index 1.
      const amountBase = parseBigInt(eventValue(result.event, 1));
      const amount = amountBase > 0n ? fromFixed8(amountBase) : fromFixed8(credit);

      await loadAll();
      return { amount };
    } finally {
      isLoading.set(false);
    }
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    roundId,
    totalPot,
    isRoundActive,
    lastBuyer,
    userKeys,
    keyCount,
    keyValidationError,
    history,
    isBuyingKeys,
    isSettling,
    isLoading,
    roundDataAvailable,
    serviceNotice,
    totalKeysInRound,
    prepaidCredit,
    hasCredit,
    address,

    // ── Timer State ─────────────────────────────────────────────────
    countdown,
    dangerLevel,
    dangerLevelText,
    dangerProgress,
    shouldPulse,
    timeRemainingSeconds,
    updateNow,

    // ── Formatted values ────────────────────────────────────────────
    lastBuyerLabel,
    formattedRound,
    totalPotDisplay,
    roundStatusDisplay,
    totalKeysDisplay,
    userSharePercent,
    needsLifecycleSync,
    estimatedCost,
    estimatedCostRaw,

    // ── Actions ─────────────────────────────────────────────────────
    setAddress,
    buyKeys,
    settleRound,
    withdrawCredit,
    loadAll,
    loadUserKeys,
    loadCredit,
  };
}

export type UseLastSurvivorReturn = ReturnType<typeof useLastSurvivor>;
