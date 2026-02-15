import { ref, computed, onMounted } from "vue";
import { useTicker } from "@shared/composables/useTicker";
import type { StatsDisplayItem } from "@shared/components";
import { formatGas } from "@shared/utils/format";
import { useCheckinContract } from "@/composables/useCheckinContract";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function useCheckinPage(t: (key: string) => string) {
  const {
    currentStreak,
    highestStreak,
    lastCheckInDay,
    unclaimedRewards,
    totalClaimed,
    totalUserCheckins,
    status,
    isClaiming,
    isLoading,
    globalStats,
    checkinHistory,
    sidebarItems,
    userStats,
    doCheckIn,
    claimRewards,
    loadAll,
  } = useCheckinContract(t);

  // Computed display data
  const appState = computed(() => ({
    currentStreak: currentStreak.value,
    highestStreak: highestStreak.value,
    totalUserCheckins: totalUserCheckins.value,
  }));

  const globalStatsGridItems = computed<StatsDisplayItem[]>(() => [
    { label: t("totalUsers"), value: globalStats.value.totalUsers, icon: "👥" },
    { label: t("totalCheckins"), value: globalStats.value.totalCheckins, icon: "✅" },
    { label: t("totalRewarded"), value: formatGas(globalStats.value.totalRewarded), icon: "💰" },
  ]);

  const userStatsRowItems = computed<StatsDisplayItem[]>(() =>
    userStats.value.map((s) => ({
      label: s.label,
      value: s.value,
      variant: s.variant as StatsDisplayItem["variant"],
    }))
  );

  // Reward milestones
  const milestones = [
    { day: 7, reward: 1, cumulative: 1 },
    { day: 14, reward: 1.5, cumulative: 2.5 },
    { day: 21, reward: 1.5, cumulative: 4 },
    { day: 28, reward: 1.5, cumulative: 5.5 },
  ];

  // Countdown timer
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

  // Lifecycle
  onMounted(async () => {
    countdownTicker.start();
    await loadAll();
  });

  return {
    // From useCheckinContract
    currentStreak,
    highestStreak,
    unclaimedRewards,
    totalClaimed,
    status,
    isClaiming,
    isLoading,
    checkinHistory,
    sidebarItems,
    doCheckIn,
    claimRewards,
    loadAll,
    // Computed
    appState,
    globalStatsGridItems,
    userStatsRowItems,
    milestones,
    // Countdown
    MS_PER_DAY,
    nextUtcMidnight,
    canCheckIn,
    utcTimeDisplay,
  };
}
