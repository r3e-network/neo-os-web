/**
 * useCheckin — Simplified domain logic for the Daily Check-in miniapp
 *
 * This composable encapsulates all check-in business logic and provides
 * reactive state for the platform to bind to manifest-driven UI sections.
 *
 * Compared with the legacy useCheckinContract.ts:
 *
 *   BEFORE (legacy):
 *     - Manually wires useContractInteraction + useStatusMessage + useEvents
 *     - Builds sidebar items, formats error messages, polls for events
 *     - Contains ~240 lines of mixed infrastructure + business logic
 *
 *   AFTER (this file):
 *     - Receives ChainService + EventBus from PlatformServices
 *     - Contains ONLY check-in domain logic (load, check-in, claim)
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
import { formatGas } from "@shared/utils/format";
import { useTicker } from "@shared/composables/useTicker";
import { parseStackItem } from "@shared/utils/neo";

// ============================================================================
// Constants
// ============================================================================

const APP_ID = "miniapp-dailycheckin";

/** Milliseconds in one UTC day */
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Check-in fee: 0.001 GAS in base units (Fixed8 format: 1 GAS = 1e8) */
const CHECK_IN_FEE_BASE_UNITS = String(Math.round(0.001 * 1e8)); // "100000"

/** Reward milestones: day thresholds and their GAS payouts */
export const MILESTONES = [
  { day: 7, reward: 1, cumulative: 1 },
  { day: 14, reward: 2, cumulative: 3 },
] as const;

// ============================================================================
// Types
// ============================================================================

export interface CheckinHistoryItem {
  streak: number;
  time: string;
  reward: number;
}

export interface UseCheckinOptions {
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

export function useCheckin({ chain, eventBus, t }: UseCheckinOptions) {
  // ── User State ──────────────────────────────────────────────────────
  const currentStreak = ref(0);
  const highestStreak = ref(0);
  const lastCheckInDay = ref(0);
  const unclaimedRewards = ref(0);
  const totalClaimed = ref(0);
  const totalUserCheckins = ref(0);
  const isLoading = ref(false);
  const isClaiming = ref(false);

  // ── Global Stats ────────────────────────────────────────────────────
  const totalGlobalCheckins = ref(0);
  const totalGlobalUsers = ref(0);
  const totalGlobalRewarded = ref(0);

  // ── History ─────────────────────────────────────────────────────────
  const checkinHistory = ref<CheckinHistoryItem[]>([]);

  // ── Countdown Timer ─────────────────────────────────────────────────
  // The ticker automatically unregisters via Vue's onUnmounted.
  const now = ref(Date.now());
  const countdownTicker = useTicker(() => {
    now.value = Date.now();
  }, 1000);

  const currentUtcDay = computed(() => Math.floor(now.value / MS_PER_DAY));
  const nextUtcMidnight = computed(() => (currentUtcDay.value + 1) * MS_PER_DAY);

  const canCheckIn = computed(() => {
    if (lastCheckInDay.value === 0) return true;
    return currentUtcDay.value > lastCheckInDay.value;
  });

  const utcTimeDisplay = computed(() => {
    const utcDate = new Date(now.value);
    const h = String(utcDate.getUTCHours()).padStart(2, "0");
    const m = String(utcDate.getUTCMinutes()).padStart(2, "0");
    const s = String(utcDate.getUTCSeconds()).padStart(2, "0");
    return `${h}:${m}:${s}`;
  });

  // ── Formatted display values ────────────────────────────────────────
  // These are consumed by the manifest stat/sidebar bindings via the
  // state object returned from defineMiniApp's setup().
  const formattedCurrentStreak = computed(() => `${currentStreak.value} ${t("days")}`);
  const formattedHighestStreak = computed(() => `${highestStreak.value} ${t("days")}`);
  const formattedUnclaimed = computed(() => `${formatGas(unclaimedRewards.value)} ${t("tokenGas")}`);
  const formattedTotalClaimed = computed(() => `${formatGas(totalClaimed.value)} ${t("tokenGas")}`);
  const formattedTotalRewarded = computed(() => `${formatGas(totalGlobalRewarded.value)} ${t("tokenGas")}`);

  // ── Data Loading ────────────────────────────────────────────────────

  const loadUserStats = async () => {
    if (!chain.address.value) return;
    try {
      const data = await chain.read("GetUserStats", [
        { type: "Hash160", value: chain.address.value },
      ]);
      if (Array.isArray(data)) {
        currentStreak.value = Number(data[0] ?? 0);
        highestStreak.value = Number(data[1] ?? 0);
        lastCheckInDay.value = Number(data[2] ?? 0);
        unclaimedRewards.value = Number(data[3] ?? 0);
        totalClaimed.value = Number(data[4] ?? 0);
        totalUserCheckins.value = Number(data[5] ?? 0);
      }
    } catch (e) {
      console.warn("[useCheckin] loadUserStats failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadGlobalStats = async () => {
    try {
      const data = await chain.read("GetPlatformStats", []);
      if (Array.isArray(data)) {
        totalGlobalUsers.value = Number(data[0] ?? 0);
        totalGlobalCheckins.value = Number(data[1] ?? 0);
        totalGlobalRewarded.value = Number(data[2] ?? 0);
      }
    } catch (e) {
      console.warn("[useCheckin] loadGlobalStats failed:", e instanceof Error ? e.message : String(e));
    }
  };

  const loadHistory = async () => {
    if (!chain.address.value) return;
    try {
      const rawEvents = await chain.listEvents("CheckedIn", { limit: 10 });
      const currentAddress = chain.address.value;

      checkinHistory.value = rawEvents
        .filter((evt: unknown) => {
          const evtRecord = evt as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state)
            ? (evtRecord.state as unknown[]).map(parseStackItem)
            : [];
          return String(values[0] ?? "") === currentAddress;
        })
        .map((evt: unknown) => {
          const evtRecord = evt as Record<string, unknown>;
          const values = Array.isArray(evtRecord?.state)
            ? (evtRecord.state as unknown[]).map(parseStackItem)
            : [];
          return {
            streak: Number(values[1] ?? 0),
            time: new Intl.DateTimeFormat(undefined).format(
              new Date((evtRecord.created_at as string | number | Date) || Date.now()),
            ),
            reward: Number(values[2] ?? 0),
          };
        });
    } catch (e) {
      console.warn("[useCheckin] loadHistory failed:", e instanceof Error ? e.message : String(e));
    }
  };

  /**
   * Load all data (user stats, global stats, history).
   * Called by defineMiniApp on mount and when the wallet connects.
   */
  const loadAll = async () => {
    isLoading.value = true;
    try {
      await Promise.all([loadUserStats(), loadGlobalStats(), loadHistory()]);
    } finally {
      isLoading.value = false;
    }
  };

  // ── Actions ─────────────────────────────────────────────────────────

  /**
   * Perform a daily check-in.
   *
   * Flow:
   * 1. Ensure wallet is connected
   * 2. Transfer 0.001 GAS to the contract with memo "miniapp-dailycheckin:checkin"
   * 3. Wait for the CheckedIn event
   * 4. Emit success event (triggers fireworks via platform)
   * 5. Reload all data
   */
  const doCheckIn = async () => {
    if (!canCheckIn.value || isLoading.value) return;

    isLoading.value = true;
    try {
      await chain.ensureWallet();

      const result = await chain.invokeWithPayment(
        CHECK_IN_FEE_BASE_UNITS,
        `${APP_ID}:checkin`,
        "checkIn",
        [{ type: "Hash160", value: chain.address.value as string }],
        { waitForEvent: "CheckedIn" },
      );

      if (result.success) {
        eventBus.emit("checkin:success", { action: t("checkinSuccess") });
      }

      await loadAll();
    } catch (e) {
      eventBus.emit("checkin:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * Claim accumulated GAS rewards.
   *
   * This is a direct invoke (no payment required) — the contract
   * distributes the accumulated rewards to the caller's address.
   */
  const claimRewards = async () => {
    if (unclaimedRewards.value <= 0 || isClaiming.value) return;

    isClaiming.value = true;
    try {
      await chain.ensureWallet();

      const result = await chain.invoke(
        "claimRewards",
        [{ type: "Hash160", value: chain.address.value as string }],
        { waitForEvent: "RewardsClaimed" },
      );

      if (result.success) {
        eventBus.emit("checkin:claimed", { action: t("claimSuccess") });
      }

      await loadAll();
    } catch (e) {
      eventBus.emit("checkin:error", {
        message: e instanceof Error ? e.message : t("error"),
      });
      throw e;
    } finally {
      isClaiming.value = false;
    }
  };

  /**
   * Start the countdown timer. Called from setup after composable creation.
   * The ticker stops automatically via Vue's onUnmounted hook.
   */
  const startTimer = () => {
    countdownTicker.start();
  };

  return {
    // ── Raw State ───────────────────────────────────────────────────
    currentStreak,
    highestStreak,
    lastCheckInDay,
    unclaimedRewards,
    totalClaimed,
    totalUserCheckins,
    totalGlobalCheckins,
    totalGlobalUsers,
    totalGlobalRewarded,
    checkinHistory,
    isLoading,
    isClaiming,

    // ── Computed ─────────────────────────────────────────────────────
    canCheckIn,
    utcTimeDisplay,
    nextUtcMidnight,

    // ── Formatted values (for manifest stat/sidebar bindings) ────────
    formattedCurrentStreak,
    formattedHighestStreak,
    formattedUnclaimed,
    formattedTotalClaimed,
    formattedTotalRewarded,

    // ── Constants ───────────────────────────────────────────────────
    milestones: MILESTONES,
    MS_PER_DAY,

    // ── Actions ─────────────────────────────────────────────────────
    doCheckIn,
    claimRewards,
    loadAll,
    startTimer,
  };
}

/** Return type of useCheckin for use in inject/provide typing */
export type UseCheckinReturn = ReturnType<typeof useCheckin>;
