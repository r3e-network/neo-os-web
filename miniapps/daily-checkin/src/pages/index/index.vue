<template>
  <MiniAppTemplate
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    class="theme-daily-checkin"
  >
    <!-- Desktop Sidebar -->
    <template #desktop-sidebar>
      <SidebarPanel :title="t('overview')" :items="sidebarItems" />
    </template>

    <!-- LEFT panel: Timer + Streak -->
    <template #content>
      <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
        <CountdownHero
          :countdown-progress="countdownProgress"
          :countdown-label="countdownLabel"
          :can-check-in="canCheckIn"
          :utc-time-display="utcTimeDisplay"
        />

        <StreakDisplay :current-streak="currentStreak" :highest-streak="highestStreak" />
      </ErrorBoundary>
    </template>

    <!-- RIGHT panel: Check-in Action -->
    <template #operation>
      <NeoCard variant="erobo" :title="t('checkInNow')">
        <NeoButton
          variant="primary"
          size="lg"
          block
          :disabled="!canCheckIn || isLoading"
          :loading="isLoading"
          @click="doCheckIn(canCheckIn)"
          class="checkin-btn"
        >
          <view class="btn-content">
            <text class="btn-icon">{{ canCheckIn ? "✨" : "⏳" }}</text>
            <text>{{ canCheckIn ? t("checkInNow") : t("waitForNext") }}</text>
          </view>
        </NeoButton>
      </NeoCard>
    </template>

    <!-- Stats tab -->
    <template #tab-stats>
      <RewardProgress :milestones="milestones" :current-streak="currentStreak" />
      <UserRewards
        :unclaimed-rewards="unclaimedRewards"
        :total-claimed="totalClaimed"
        :is-claiming="isClaiming"
        @claim="claimRewards"
        class="mb-4"
      />
      <StatsTab :global-stats="globalStats" :user-stats="userStats" :checkin-history="checkinHistory" />
    </template>
  </MiniAppTemplate>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { MiniAppTemplate, NeoButton, NeoCard, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createTemplateConfig } from "@shared/utils/createTemplateConfig";
import CountdownHero from "./components/CountdownHero.vue";
import StreakDisplay from "./components/StreakDisplay.vue";
import RewardProgress from "./components/RewardProgress.vue";
import UserRewards from "./components/UserRewards.vue";
import StatsTab from "./components/StatsTab.vue";
import { useCheckinContract } from "@/composables/useCheckinContract";

const { t } = createUseI18n(messages)();
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

// Template configuration
const templateConfig = createTemplateConfig({
  tabs: [
    { key: "checkin", labelKey: "checkin", icon: "✅", default: true },
    { key: "stats", labelKey: "stats", icon: "📊" },
  ],
  fireworks: true,
});

// Reactive state bridge for template stat bindings
const appState = computed(() => ({
  currentStreak: currentStreak.value,
  highestStreak: highestStreak.value,
  totalUserCheckins: totalUserCheckins.value,
}));

// Reward structure: Day 7 = 1 GAS, Day 14+ = +1.5 GAS every 7 days (cumulative)
const milestones = [
  { day: 7, reward: 1, cumulative: 1 },
  { day: 14, reward: 1.5, cumulative: 2.5 },
  { day: 21, reward: 1.5, cumulative: 4 },
  { day: 28, reward: 1.5, cumulative: 5.5 },
];

// Countdown
const now = ref(Date.now());
let countdownInterval: ReturnType<typeof setInterval> | null = null;

// Global UTC countdown (same for all users)
const currentUtcDay = computed(() => Math.floor(now.value / MS_PER_DAY));
const nextUtcMidnight = computed(() => (currentUtcDay.value + 1) * MS_PER_DAY);

const canCheckIn = computed(() => {
  if (lastCheckInDay.value === 0) return true;
  return currentUtcDay.value > lastCheckInDay.value;
});

const remainingMs = computed(() => {
  return Math.max(0, nextUtcMidnight.value - now.value);
});

const countdownProgress = computed(() => {
  const circumference = 2 * Math.PI * 99; // 622
  const elapsed = MS_PER_DAY - remainingMs.value;
  const elapsedRatio = elapsed / MS_PER_DAY;
  return circumference * (1 - elapsedRatio);
});

const countdownLabel = computed(() => {
  const totalSeconds = Math.floor(remainingMs.value / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
});

const utcTimeDisplay = computed(() => {
  const utcDate = new Date(now.value);
  const h = String(utcDate.getUTCHours()).padStart(2, "0");
  const m = String(utcDate.getUTCMinutes()).padStart(2, "0");
  const s = String(utcDate.getUTCSeconds()).padStart(2, "0");
  return `${h}:${m}:${s}`;
});

const { handleBoundaryError } = useHandleBoundaryError("daily-checkin");
const resetAndReload = async () => {
  await loadAll();
};

onMounted(async () => {
  countdownInterval = setInterval(() => {
    now.value = Date.now();
  }, 1000);

  await loadAll();
});

onUnmounted(() => {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/page-common" as *;
@import "./daily-checkin-theme.scss";

@include page-background(
  var(--sunrise-bg),
  (
    font-family: var(--sunrise-font),
  )
);

.checkin-btn {
  margin-top: 16px;
  transform: scale(1.02);
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-weight: 900;
  text-transform: uppercase;
  font-size: 18px;
}

.btn-icon {
  font-size: 24px;
}
</style>
