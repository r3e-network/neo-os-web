/**
 * useBurnLeague — Domain logic for the Burn League miniapp (OS Services)
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (GameProxy, LeaderboardProxy, BadgeProxy) via
 * edge functions, so this file contains zero contract hashes, parameter
 * encoding, or event parsing logic.
 *
 * Migration from direct chain calls to OS services:
 *
 *   BEFORE (chain):
 *     chain.read("totalBurned")
 *     chain.read("rewardPool")
 *     chain.read("getUserTotalBurned", [...])
 *     chain.invoke("transfer", [...], { scriptHash: GAS_HASH })
 *     chain.invoke("burnGas", [...], { waitForEvent: "GasBurned" })
 *     chain.listAllEvents("GasBurned")
 *
 *   AFTER (OS proxy):
 *     gameService.getPoolState("burn-league")       — load burn stats
 *     leaderboardService.get(100)                   — load leaderboard
 *     gameService.placeBet("burn-league", amount)  — submit burn entry intent
 *     badgeService.updateStat(user, "burned", ...)  — track burn amounts
 *     badgeService.award(badgeId, user)             — award achievements
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Loading/burning UI flags
 *   - Formatted display values
 *   - Leaderboard preview computation
 */

import { createObservable, createDerived } from "@shared/react/context";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { LeaderboardProxy, LeaderboardEntry } from "@shared/services/os/LeaderboardProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { formatNumber } from "@shared/utils/format";

// ============================================================================
// Constants
// ============================================================================

/** Minimum burn amount in GAS */
export const MIN_BURN = 1;
const MAX_BURN = 1_000;
const BURN_POOL_ID = "burn-league";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error ?? "");
}

function isOsBoundaryError(error: unknown) {
  return /OS service error|os-game-|os-leaderboard-|os-badge-|Not Found|function not allowed|not configured/i.test(
    errorMessage(error),
  );
}

function isWalletBoundaryError(error: unknown) {
  return /Wallet adapter|invokeWithConfirmation|Wallet address|required to submit|connect wallet|No wallet/i.test(
    errorMessage(error),
  );
}

// ============================================================================
// Types
// ============================================================================

export interface LeaderEntry {
  rank: number;
  address: string;
  burned: number;
  isUser: boolean;
}

/**
 * Shape of the pool state returned by GameProxy for Burn League.
 * The edge function translates contract reads into normalized data.
 */
interface BurnLeaguePoolState {
  poolId: string;
  appId: string;
  status: "open" | "active" | "settled" | "cancelled";
  playerCount: number;
  totalBets: string;
  // Game-specific extensions from edge function
  totalBurned?: number;
  rewardPool?: number;
  userBurned?: number;
  burnCount?: number;
}

export interface UseBurnLeagueOptions {
  /** OS GameProxy instance from ctx.os.game */
  gameService: GameProxy;
  /** OS LeaderboardProxy instance from ctx.os.leaderboard */
  leaderboardService: LeaderboardProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
  /**
   * Accessor for the connected wallet address (e.g. ctx.services.chain.address.get).
   * Used to resolve the current user's leaderboard rank by identity rather than
   * by burned-amount equality. Optional so the composable degrades gracefully
   * when no wallet is connected (rank stays 0 / "--").
   */
  getAddress?: () => string | null | undefined;
}

/** Case-insensitive address equality (handles base58 and hex script-hash forms). */
function addressMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return a === b || a.toLowerCase() === b.toLowerCase();
}

/**
 * Strict decimal parse for burn amounts.
 *
 * parseFloat is lenient — "5abc", " 5 ", "1e2", "0x5" all coerce to a clean
 * number, but the raw string is what would otherwise reach the OS/edge call.
 * This accepts only a canonical, trimmed, non-scientific decimal (optionally
 * with a fractional part) and returns NaN for anything else, so a malformed
 * value is rejected by validation instead of silently reaching a fund-moving
 * call as a non-canonical string.
 */
const DECIMAL_RE = /^\d+(\.\d+)?$/;
function parseBurnAmount(input: string | null | undefined): number {
  const trimmed = String(input ?? "").trim();
  if (!DECIMAL_RE.test(trimmed)) return NaN;
  return Number(trimmed);
}

// ============================================================================
// Composable
// ============================================================================

export function useBurnLeague({
  gameService,
  leaderboardService,
  badgeService,
  t,
  getAddress,
}: UseBurnLeagueOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const totalBurned = createObservable(0);
  const rewardPool = createObservable(0);
  const userBurned = createObservable(0);
  const rank = createObservable(0);
  const burnCount = createObservable(0);
  const leaderboard = createObservable<LeaderEntry[]>([]);
  const isBurning = createObservable(false);
  const isLoading = createObservable(false);
  const leagueDataAvailable = createObservable(false);
  const serviceNotice = createObservable("");
  const actionNotice = createObservable("");
  const burnValidationError = createObservable<string | null>(null);
  const lastSubmittedAmount = createObservable("");

  // ── Local UI state managed by the composable ─────────────────────────
  const burnAmount = createObservable("1");

  // ── Formatted display values ─────────────────────────────────────────
  // These are consumed by the manifest stat/sidebar bindings via the
  // state object returned from defineMiniApp's setup().
  const totalBurnedDisplay = createDerived(() => `${formatNumber(totalBurned.get(), 2)} ${t("tokenGas")}`, []);
  const userBurnedDisplay = createDerived(() => `${formatNumber(userBurned.get(), 2)} ${t("tokenGas")}`, []);
  const rewardPoolDisplay = createDerived(() => `${formatNumber(rewardPool.get(), 2)} ${t("tokenGas")}`, []);
  const formattedRank = createDerived(() => rank.get() > 0 ? `#${rank.get()}` : "--", []);
  const leaderboardSize = createDerived(() => leaderboard.get().length, []);

  // ── Derived values for PlayArea ─────────────────────────────────────
  /** Estimated reward based on current burn amount (0.1x multiplier) */
  const estimatedReward = createDerived(() => {
    const amount = parseFloat(burnAmount.get());
    const reward = Number.isFinite(amount) && amount > 0 ? amount * 0.1 : 0;
    return `${formatNumber(reward, 2)} ${t("tokenGas")}`;
  }, []);

  const projectedTotalBurnedDisplay = createDerived(() => {
    const amount = parseFloat(burnAmount.get());
    const projected = totalBurned.get() + (Number.isFinite(amount) ? Math.max(0, amount) : 0);
    return `${formatNumber(projected, 2)} ${t("tokenGas")}`;
  }, []);

  /** Top 10 entries for the leaderboard preview */
  const leaderboardPreview = createDerived(() => leaderboard.get().slice(0, 10), []);

  // ── Data Loading (via OS services) ──────────────────────────────────

  /**
   * Load burn stats via GameProxy.
   * The edge function translates getPoolState("burn-league") into
   * contract reads for totalBurned, rewardPool, and userBurned.
   */
  const loadStats = async () => {
    try {
      const state = await gameService.getPoolState("burn-league") as BurnLeaguePoolState;
      if (state && typeof state === "object") {
        totalBurned.set(Number(state.totalBurned ?? state.totalBets ?? 0));
        rewardPool.set(Number(state.rewardPool ?? 0));
        userBurned.set(Number(state.userBurned ?? 0));
        burnCount.set(Number(state.burnCount ?? state.playerCount ?? 0));
        leagueDataAvailable.set(true);
        serviceNotice.set("");
      }
    } catch (e) {
      leagueDataAvailable.set(false);
      if (isOsBoundaryError(e)) {
        serviceNotice.set(t("burnServiceUnavailable"));
        return;
      }
      console.warn("[useBurnLeague] loadStats failed:", errorMessage(e));
    }
  };

  /**
   * Load leaderboard via LeaderboardProxy.
   * The edge function aggregates burn events into a sorted leaderboard.
   */
  const loadLeaderboard = async () => {
    try {
      const entries = await leaderboardService.get(100);

      if (Array.isArray(entries)) {
        const myAddress = getAddress?.() ?? null;
        const mapped = entries.map((entry: LeaderboardEntry, idx: number) => ({
          rank: idx + 1,
          address: entry.user,
          burned: Number(entry.score || 0),
          // Resolve the current user by wallet identity, not by burned-amount
          // equality (which collides with other players and races loadStats).
          isUser: addressMatches(entry.user, myAddress),
        }));

        leaderboard.set(mapped);

        // Find the user's rank by address identity. Independent of userBurned,
        // so it no longer races the concurrent loadStats() call.
        const userEntry = mapped.find((entry) => entry.isUser);
        rank.set(userEntry ? userEntry.rank : 0);
      }
    } catch (e) {
      if (!isOsBoundaryError(e)) {
        console.warn("[useBurnLeague] loadLeaderboard failed:", errorMessage(e));
      }
    }
  };

  /**
   * Load all data (stats + leaderboard).
   * Called by defineMiniApp on mount and when the wallet connects.
   */
  const loadAll = async () => {
    isLoading.set(true);
    try {
      await Promise.all([loadStats(), loadLeaderboard()]);
    } finally {
      isLoading.set(false);
    }
  };

  // ── Actions (via OS services) ───────────────────────────────────────

  /**
   * Burn GAS tokens.
   *
   * Flow:
   * 1. Validate the burn amount (minimum 1 GAS)
   * 2. Submit an OS game-entry wallet intent for explicit confirmation
   * 3. Update burn stats via BadgeProxy
   * 4. Reload all data
   *
   * @param burnAmountInput - Amount of GAS to burn (as a string).
   *   If omitted, uses the composable's reactive burnAmount ref.
   * @returns The validated burn amount (for UI reset on success)
   */
  const validateBurnAmount = (burnAmountInput?: string) => {
    const amountStr = burnAmountInput ?? burnAmount.get();
    const amount = parseBurnAmount(amountStr);
    if (!Number.isFinite(amount) || amount < MIN_BURN) {
      return t("minBurn", { amount: MIN_BURN, tokenGas: t("tokenGas") });
    }
    if (amount > MAX_BURN) {
      return t("maxBurn", { amount: MAX_BURN, tokenGas: t("tokenGas") });
    }
    return null;
  };

  const burnTokens = async (burnAmountInput?: string) => {
    // Double-submit guard: gate entry before any await so a second invocation
    // (rapid clicks, re-dispatch) cannot start a parallel burn.
    if (isBurning.get()) return;

    const amountStr = burnAmountInput ?? burnAmount.get();
    const validation = validateBurnAmount(amountStr);
    if (validation) {
      burnValidationError.set(validation);
      throw new Error(validation);
    }
    burnValidationError.set(null);

    // Canonical, validated number — this is the value the user saw and that
    // passed range validation. We send the canonical string to every OS/edge
    // call instead of the raw input so the on-chain value can never diverge
    // from the validated one (no "5abc"/" 5 "/"1e2" reaching a fund call).
    const amount = parseBurnAmount(amountStr);
    const canonical = String(amount);

    actionNotice.set(t("burnPreparing", {
      amount: `${formatNumber(amount, 2)} ${t("tokenGas")}`,
    }));
    isBurning.set(true);
    let burnLanded = false;
    try {
      // Step 1: Submit the burn entry via the OS game service. The service
      // returns a wallet intent for explicit user confirmation. This is the
      // irreversible, fund-moving step — burns cannot be rolled back, so every
      // step after it is treated as best-effort and must not mask its success.
      await gameService.placeBet(BURN_POOL_ID, canonical);
      burnLanded = true;

      // Step 2: Update burn stat via BadgeProxy (fire-and-forget)
      badgeService.updateStat("", "totalBurned", canonical).catch(() => {});

      // Step 3: Award badge for first burn (fire-and-forget)
      if (burnCount.get() === 0) {
        badgeService.award("first-burn", "").catch(() => {});
      }

      // Step 4: Submit score to leaderboard (best-effort). A leaderboard
      // failure must not surface a successful burn as an error — the GAS is
      // already gone, so we swallow this and still report success below.
      try {
        await leaderboardService.submitScore(canonical);
      } catch (submitErr) {
        console.warn("[useBurnLeague] submitScore failed after burn:", errorMessage(submitErr));
      }

      // Reset the burn amount input on success
      burnAmount.set("1");
      lastSubmittedAmount.set(`${formatNumber(amount, 2)} ${t("tokenGas")}`);
      actionNotice.set(t("burnSubmitted"));

      return amount;
    } catch (e) {
      if (isOsBoundaryError(e)) {
        const normalized = new Error(t("burnActionUnavailable"));
        actionNotice.set(normalized.message);
        throw normalized;
      }
      if (isWalletBoundaryError(e)) {
        const normalized = new Error(t("burnWalletUnavailable"));
        actionNotice.set(normalized.message);
        throw normalized;
      }
      throw e;
    } finally {
      isBurning.set(false);
      // Always refresh once the burn has actually landed on chain, even if a
      // follow-up step threw — the UI must reflect the new balance/leaderboard
      // rather than getting stuck on stale pre-burn data.
      if (burnLanded) {
        await loadAll().catch((refreshErr) => {
          console.warn("[useBurnLeague] post-burn refresh failed:", errorMessage(refreshErr));
        });
      }
    }
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    totalBurned,
    rewardPool,
    userBurned,
    rank,
    burnCount,
    leaderboard,
    isBurning,
    isLoading,
    leagueDataAvailable,
    serviceNotice,
    actionNotice,
    burnValidationError,
    lastSubmittedAmount,

    // ── Local UI state ──────────────────────────────────────────────
    burnAmount,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    totalBurnedDisplay,
    userBurnedDisplay,
    rewardPoolDisplay,
    formattedRank,
    leaderboardSize,
    projectedTotalBurnedDisplay,

    // ── Derived values (for PlayArea presentation) ──────────────────
    estimatedReward,
    leaderboardPreview,

    // ── Actions ─────────────────────────────────────────────────────
    burnTokens,
    loadAll,
    validateBurnAmount,
  };
}

/** Return type of useBurnLeague for use in typing */
export type UseBurnLeagueReturn = ReturnType<typeof useBurnLeague>;

// ============================================================================
// Pure Helpers (exported for PlayArea presentation)
// ============================================================================

/** Format a number for display with 2 decimal places */
export const formatNum = (n: number): string => formatNumber(n, 2);

/** Get medal icon name for top-3 leaderboard ranks */
export const getMedalIcon = (rank: number): string => {
  if (rank === 1) return "medal_gold";
  if (rank === 2) return "medal_silver";
  if (rank === 3) return "medal_bronze";
  return "";
};
