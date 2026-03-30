/**
 * useBurnLeague — Domain logic for the Burn League miniapp (OS Services)
 *
 * Migrated to OS service proxies. All contract interaction is delegated to
 * OS services (GameProxy, NFTProxy, LeaderboardProxy, BadgeProxy) via
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
 *     nftService.burn(tokenId)                      — burn tokens
 *     badgeService.updateStat(user, "burned", ...)  — track burn amounts
 *     badgeService.award(badgeId, user)             — award achievements
 *
 * The composable still owns:
 *   - Reactive state (refs + computed) for manifest bindings
 *   - Loading/burning UI flags
 *   - Formatted display values
 *   - Leaderboard preview computation
 */

import { ref, computed } from "vue";
import type { GameProxy } from "@shared/services/os/GameProxy";
import type { NFTProxy } from "@shared/services/os/NFTProxy";
import type { LeaderboardProxy, LeaderboardEntry } from "@shared/services/os/LeaderboardProxy";
import type { BadgeProxy } from "@shared/services/os/BadgeProxy";
import { formatNumber } from "@shared/utils/format";

// ============================================================================
// Constants
// ============================================================================

/** Minimum burn amount in GAS */
export const MIN_BURN = 1;

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
  /** OS NFTProxy instance from ctx.os.nft */
  nftService: NFTProxy;
  /** OS LeaderboardProxy instance from ctx.os.leaderboard */
  leaderboardService: LeaderboardProxy;
  /** OS BadgeProxy instance from ctx.os.badge */
  badgeService: BadgeProxy;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useBurnLeague({
  gameService,
  nftService,
  leaderboardService,
  badgeService,
  t,
}: UseBurnLeagueOptions) {
  // ── State ────────────────────────────────────────────────────────────
  const totalBurned = ref(0);
  const rewardPool = ref(0);
  const userBurned = ref(0);
  const rank = ref(0);
  const burnCount = ref(0);
  const leaderboard = ref<LeaderEntry[]>([]);
  const isBurning = ref(false);
  const isLoading = ref(false);

  // ── Local UI state managed by the composable ─────────────────────────
  const burnAmount = ref("1");

  // ── Formatted display values ─────────────────────────────────────────
  // These are consumed by the manifest stat/sidebar bindings via the
  // state object returned from defineMiniApp's setup().
  const totalBurnedDisplay = computed(() => `${formatNumber(totalBurned.value, 2)} ${t("tokenGas")}`);
  const userBurnedDisplay = computed(() => `${formatNumber(userBurned.value, 2)} ${t("tokenGas")}`);
  const rewardPoolDisplay = computed(() => `${formatNumber(rewardPool.value, 2)} ${t("tokenGas")}`);
  const formattedRank = computed(() => rank.value > 0 ? `#${rank.value}` : "--");
  const leaderboardSize = computed(() => leaderboard.value.length);

  // ── Derived values for PlayArea ─────────────────────────────────────
  /** Estimated reward based on current burn amount (0.1x multiplier) */
  const estimatedReward = computed(() => {
    const amount = parseFloat(burnAmount.value);
    return Number.isFinite(amount) && amount > 0 ? amount * 0.1 : 0;
  });

  /** Top 10 entries for the leaderboard preview */
  const leaderboardPreview = computed(() => leaderboard.value.slice(0, 10));

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
        totalBurned.value = Number(state.totalBurned ?? state.totalBets ?? 0);
        rewardPool.value = Number(state.rewardPool ?? 0);
        userBurned.value = Number(state.userBurned ?? 0);
        burnCount.value = Number(state.burnCount ?? state.playerCount ?? 0);
      }
    } catch (e) {
      console.warn("[useBurnLeague] loadStats failed:", e instanceof Error ? e.message : String(e));
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
        const mapped = entries.map((entry: LeaderboardEntry, idx: number) => ({
          rank: idx + 1,
          address: entry.user,
          burned: Number(entry.score || 0),
          isUser: false, // Edge function marks the current user server-side
        }));

        leaderboard.value = mapped;

        // Find user's rank from the leaderboard
        const userEntry = mapped.find((entry) => entry.burned === userBurned.value && userBurned.value > 0);
        rank.value = userEntry ? userEntry.rank : 0;
      }
    } catch (e) {
      console.warn("[useBurnLeague] loadLeaderboard failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Load all data (stats + leaderboard).
   * Called by defineMiniApp on mount and when the wallet connects.
   */
  const loadAll = async () => {
    isLoading.value = true;
    try {
      await Promise.all([loadStats(), loadLeaderboard()]);
    } finally {
      isLoading.value = false;
    }
  };

  // ── Actions (via OS services) ───────────────────────────────────────

  /**
   * Burn GAS tokens.
   *
   * Flow:
   * 1. Validate the burn amount (minimum 1 GAS)
   * 2. Burn via NFTProxy (the edge function handles wallet connection,
   *    GAS transfer to the contract, and burnGas invocation)
   * 3. Update burn stats via BadgeProxy
   * 4. Reload all data
   *
   * @param burnAmountInput - Amount of GAS to burn (as a string).
   *   If omitted, uses the composable's reactive burnAmount ref.
   * @returns The validated burn amount (for UI reset on success)
   */
  const burnTokens = async (burnAmountInput?: string) => {
    const amountStr = burnAmountInput ?? burnAmount.value;
    const amount = parseFloat(amountStr);
    if (!Number.isFinite(amount) || amount < MIN_BURN) {
      throw new Error(t("minBurn", { amount: MIN_BURN, tokenGas: t("tokenGas") }));
    }

    if (isBurning.value) return;

    isBurning.value = true;
    try {
      // Step 1: Burn via NFTProxy — the edge function handles wallet
      // connection, GAS transfer to contract, and burnGas invocation
      await nftService.burn(amountStr);

      // Step 2: Update burn stat via BadgeProxy (fire-and-forget)
      badgeService.updateStat("", "totalBurned", amountStr).catch(() => {});

      // Step 3: Award badge for first burn (fire-and-forget)
      if (burnCount.value === 0) {
        badgeService.award("first-burn", "").catch(() => {});
      }

      // Step 4: Submit score to leaderboard
      await leaderboardService.submitScore(amountStr);

      await loadAll();

      // Reset the burn amount input on success
      burnAmount.value = "1";

      return amount;
    } catch (e) {
      throw e;
    } finally {
      isBurning.value = false;
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

    // ── Local UI state ──────────────────────────────────────────────
    burnAmount,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    totalBurnedDisplay,
    userBurnedDisplay,
    rewardPoolDisplay,
    formattedRank,
    leaderboardSize,

    // ── Derived values (for PlayArea presentation) ──────────────────
    estimatedReward,
    leaderboardPreview,

    // ── Actions ─────────────────────────────────────────────────────
    burnTokens,
    loadAll,
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
