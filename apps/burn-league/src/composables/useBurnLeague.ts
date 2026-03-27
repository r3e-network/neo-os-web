/**
 * useBurnLeague — Simplified domain logic for the Burn League miniapp
 *
 * This composable encapsulates all burn-league business logic and provides
 * reactive state for the platform to bind to manifest-driven UI sections.
 *
 * Compared with the legacy useBurnLeague.ts:
 *
 *   BEFORE (legacy):
 *     - Manually wires useContractInteraction + useStatusMessage + useEvents
 *     - Builds sidebar items, formats error messages, polls for events
 *     - Contains mixed infrastructure + business logic
 *
 *   AFTER (this file):
 *     - Receives ChainService + EventBus from PlatformServices
 *     - Contains ONLY burn-league domain logic (load stats, leaderboard, burn)
 *     - Sidebar, stats, status messages are all driven by manifest + platform
 *     - Clean separation: business logic only, no infrastructure plumbing
 *
 * Key design decisions:
 *   - No onMounted/onUnmounted — lifecycle is managed by defineMiniApp
 *     which calls loadAll via the returned `loadData` callback
 *   - No usePlatformServices() inject — services are passed in explicitly
 *     so this composable works regardless of the component tree setup
 *   - Formatted values are provided as computed refs for manifest bindings
 *     (the platform reads these via the state object returned by setup)
 */

import { ref, computed } from "vue";
import type { ChainService, EventBus } from "@shared/services";
import { parseGas, toFixed8, formatGas, formatNumber } from "@shared/utils/format";
import { parseStackItem } from "@shared/utils/neo";
import { BLOCKCHAIN_CONSTANTS } from "@shared/constants";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-burn-league";

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

export interface UseBurnLeagueOptions {
  /** ChainService instance from PlatformServices */
  chain: ChainService;
  /** EventBus instance from PlatformServices */
  eventBus: EventBus;
  /** Translation function */
  t: (key: string, params?: Record<string, string | number>) => string;
}

// ============================================================================
// Composable
// ============================================================================

export function useBurnLeague({ chain, eventBus, t }: UseBurnLeagueOptions) {
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

  // ── Data Loading ─────────────────────────────────────────────────────

  const loadStats = async () => {
    try {
      const rawTotal = await chain.read("totalBurned");
      totalBurned.value = parseGas(rawTotal);

      const rawPool = await chain.read("rewardPool");
      rewardPool.value = parseGas(rawPool);

      if (chain.address.value) {
        const rawUser = await chain.read("getUserTotalBurned", [
          { type: "Hash160", value: chain.address.value },
        ]);
        userBurned.value = parseGas(rawUser);
      } else {
        userBurned.value = 0;
      }
    } catch (e) {
      console.warn("[useBurnLeague] loadStats failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadLeaderboard = async () => {
    try {
      const events = await chain.listAllEvents("GasBurned");
      const totals: Record<string, number> = {};
      let userBurns = 0;

      events.forEach((evt) => {
        const evtRecord = evt as unknown as Record<string, unknown>;
        const values = Array.isArray(evtRecord?.state)
          ? (evtRecord.state as unknown[]).map(parseStackItem)
          : [];
        const burner = String(values[0] ?? "");
        const amount = Number(values[1] ?? 0);
        if (!burner) return;
        totals[burner] = (totals[burner] || 0) + amount;
        if (chain.address.value && burner === chain.address.value) {
          userBurns += 1;
        }
      });

      const entries = Object.entries(totals)
        .map(([addr, amount]) => ({
          address: addr,
          burned: parseGas(amount),
          isUser: chain.address.value ? addr === chain.address.value : false,
        }))
        .sort((a, b) => b.burned - a.burned)
        .map((entry, idx) => ({ rank: idx + 1, ...entry }));

      leaderboard.value = entries;

      const userEntry = entries.find((entry) => entry.isUser);
      rank.value = userEntry ? userEntry.rank : 0;
      burnCount.value = userBurns;
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

  // ── Actions ──────────────────────────────────────────────────────────

  /**
   * Burn GAS tokens.
   *
   * Flow:
   * 1. Validate the burn amount (minimum 1 GAS)
   * 2. Ensure wallet is connected
   * 3. Transfer GAS to the contract with burn memo
   * 4. Call burnGas on the contract
   * 5. Wait for the GasBurned event
   * 6. Emit success event (triggers fireworks via platform)
   * 7. Reload all data
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
      await chain.ensureWallet();

      // Step 1: Transfer GAS to the contract with burn memo
      await chain.invoke(
        "transfer",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Hash160", value: chain.contractAddress.value as string },
          { type: "Integer", value: toFixed8(amountStr) },
          { type: "String", value: `${APP_ID}:burn` },
        ],
        { scriptHash: BLOCKCHAIN_CONSTANTS.GAS_HASH },
      );

      // Step 2: Wait for the credit to settle
      await new Promise((resolve) => setTimeout(resolve, 4000));

      // Step 3: Call burnGas on the contract
      const result = await chain.invoke(
        "burnGas",
        [
          { type: "Hash160", value: chain.address.value as string },
          { type: "Integer", value: toFixed8(amountStr) },
        ],
        { waitForEvent: "GasBurned" },
      );

      if (result.success) {
        eventBus.emit("burn:success", {
          action: `${t("burned")} ${amount} ${t("tokenGas")} ${t("success")}`,
        });
      }

      await loadAll();

      // Reset the burn amount input on success
      burnAmount.value = "1";

      return amount;
    } catch (e) {
      eventBus.emit("burn:error", {
        message: e instanceof Error ? e.message : t("loadFailed"),
      });
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
