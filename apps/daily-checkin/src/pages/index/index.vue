<template>
  <MiniAppPage
    name="daily-checkin"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :fireworks-active="status?.type === 'success'"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadAll"
  >
    <!-- LEFT panel: Timer + Streak -->
    <template #content>
      <div class="hero-container">
        <!-- 7-Day Calendar Row -->
        <div class="hero-week-row">
          <div
            v-for="day in 7"
            :key="day"
            :class="[
              'week-day-slot',
              {
                checked: day <= currentStreak % 7 || (currentStreak >= 7 && currentStreak % 7 === 0),
                today: day === (currentStreak % 7) + 1 || (currentStreak % 7 === 0 && day === 1),
                'today-done': !canCheckIn && day === (currentStreak % 7 || 7),
              },
            ]"
          >
            <span class="day-icon">{{ day <= (currentStreak % 7 || (currentStreak >= 7 ? 7 : 0)) ? "✅" : "⬜" }}</span>
            <span class="day-label">D{{ day }}</span>
          </div>
        </div>

        <!-- Streak Display -->
        <div class="hero-streak">
          <div class="streak-fire-ring" :class="{ active: currentStreak > 0 }">
            <span class="streak-number">{{ currentStreak }}</span>
          </div>
          <span class="streak-text">{{ t("dayStreak") }}</span>
          <span class="streak-best-text">{{ t("bestStreak") }}: {{ highestStreak }} {{ t("days") }}</span>
        </div>

        <!-- Countdown to Next -->
        <div class="hero-next-checkin">
          <div class="utc-clock-hero" role="timer" aria-live="polite">
            <span class="clock-icon">🕐</span>
            <span class="clock-display">{{ utcTimeDisplay }}</span>
            <span class="clock-utc-label">UTC</span>
          </div>
          <CountdownTimer :target-time="nextUtcMidnight" :total-duration="MS_PER_DAY" :label="t('nextCheckin')" />
        </div>

        <!-- Status Indicator -->
        <div class="hero-status-pill" :class="{ ready: canCheckIn }">
          <AppIcon :name="canCheckIn ? 'star' : 'check'" :size="18" />
          <span>{{ canCheckIn ? t("statusReady") : t("statusDone") }}</span>
        </div>
      </div>
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
          <div class="btn-content">
            <span class="btn-icon">{{ canCheckIn ? "✨" : "⏳" }}</span>
            <span>{{ canCheckIn ? t("checkInNow") : t("waitForNext") }}</span>
          </div>
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
      <StatsTab
        :grid-items="globalStatsGridItems"
        :grid-columns="3"
        :row-items="userStatsRowItems"
        :rows-title="t('yourStatsTitle')"
      >
        <NeoCard :title="t('recentCheckins')" variant="erobo">
          <div v-if="checkinHistory.length === 0" class="empty-state">
            <span>{{ t("noCheckins") }}</span>
          </div>
          <div v-else class="history-list">
            <div v-for="(item, idx) in checkinHistory" :key="idx" class="history-item">
              <div class="history-icon">🔥</div>
              <div class="history-info">
                <span class="history-day">{{ t("day") }} {{ item.streak }}</span>
                <span class="history-time">{{ item.time }}</span>
              </div>
              <span v-if="item.reward > 0" class="history-reward">+{{ formatGas(item.reward) }} GAS</span>
            </div>
          </div>
        </NeoCard>
      </StatsTab>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { messages } from "@/locale/messages";
import { MiniAppPage, StatsTab, NeoCard, NeoButton, AppIcon } from "@shared/components";
import { formatGas } from "@shared/utils/format";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useCheckinPage } from "./composables/useCheckinPage";
import CountdownTimer from "../../components/CountdownTimer.vue";
import RewardProgress from "./components/RewardProgress.vue";
import UserRewards from "./components/UserRewards.vue";

const { t, templateConfig, sidebarTitle, fallbackMessage, handleBoundaryError } = createMiniApp({
  name: "daily-checkin",
  messages,
  template: {
    tabs: [
      { key: "checkin", labelKey: "checkin", icon: "✅", default: true },
      { key: "stats", labelKey: "stats", icon: "📊" },
    ],
    fireworks: true,
  },
});

const {
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
  appState,
  globalStatsGridItems,
  userStatsRowItems,
  milestones,
  MS_PER_DAY,
  nextUtcMidnight,
  canCheckIn,
  utcTimeDisplay,
} = useCheckinPage(t);
</script>

<style lang="scss" scoped>
@use "@shared/styles/hero" as *;
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;
@use "@shared/styles/page-common" as *;
@use "./daily-checkin-theme.scss" as *;

@include page-background(
  var(--sunrise-bg),
  (
    font-family: var(--sunrise-font),
  )
);

.hero-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  text-align: center;
  padding: 20px 12px;
  gap: 20px;
}

/* ── 7-Day Calendar Row ── */
.hero-week-row {
  display: flex;
  gap: 6px;
  width: 100%;
  justify-content: center;
}

.week-day-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 6px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  min-width: 38px;
  transition: all 0.3s ease;

  &.checked {
    background: rgba(16, 185, 129, 0.08);
    border-color: rgba(16, 185, 129, 0.2);
  }

  &.today {
    background: rgba(255, 222, 89, 0.08);
    border-color: rgba(255, 222, 89, 0.3);
    box-shadow: 0 0 12px rgba(255, 222, 89, 0.15);
    animation: today-glow 2s ease-in-out infinite alternate;
  }

  &.today-done {
    background: rgba(16, 185, 129, 0.12);
    border-color: rgba(16, 185, 129, 0.3);
    box-shadow: 0 0 12px rgba(16, 185, 129, 0.15);
  }
}

.day-icon {
  font-size: 18px;
  line-height: 1;
}

.day-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.35);
  letter-spacing: 0.05em;
}

/* ── Streak Display ── */
.hero-streak {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.streak-fire-ring {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.3);
  border: 3px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.5s ease;

  &.active {
    border-color: rgba(251, 146, 60, 0.4);
    box-shadow:
      0 0 20px rgba(251, 146, 60, 0.2),
      0 0 40px rgba(251, 146, 60, 0.1);
    animation: fire-pulse 2s ease-in-out infinite alternate;
  }
}

.streak-number {
  font-size: 28px;
  font-weight: 900;
  font-family: $font-mono;
  background: linear-gradient(180deg, #fbbf24, #f97316);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 0 8px rgba(251, 191, 36, 0.4));
}

.streak-text {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.streak-best-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
  font-weight: 500;
}

/* ── Countdown Section ── */
.hero-next-checkin {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.utc-clock-hero {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
}

.clock-icon {
  font-size: 14px;
}

.clock-display {
  @include mono-number(13px);
  font-weight: 700;
  color: var(--text-primary);
}

.clock-utc-label {
  font-size: 8px;
  font-weight: 800;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.1em;
}

/* ── Status Pill ── */
.hero-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 20px;
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.08);
  font-size: 12px;
  font-weight: 700;
  color: rgba(255, 255, 255, 0.5);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  transition: all 0.3s ease;

  &.ready {
    background: rgba(255, 222, 89, 0.08);
    border-color: rgba(255, 222, 89, 0.25);
    color: #fde047;
    box-shadow: 0 0 15px rgba(255, 222, 89, 0.15);
  }
}

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

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  font-weight: 500;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.history-item {
  @include card-base(12px, 12px);
  display: flex;
  align-items: center;
  gap: 12px;
}
.history-icon {
  font-size: 20px;
}
.history-info {
  flex: 1;
}
.history-day {
  display: block;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-primary);
}
.history-time {
  display: block;
  font-size: 11px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}
.history-reward {
  @include mono-number(12px);
  color: var(--sunrise-reward);
}

@keyframes today-glow {
  0% {
    box-shadow: 0 0 8px rgba(255, 222, 89, 0.1);
  }
  100% {
    box-shadow: 0 0 18px rgba(255, 222, 89, 0.25);
  }
}

@keyframes fire-pulse {
  0% {
    box-shadow:
      0 0 15px rgba(251, 146, 60, 0.15),
      0 0 30px rgba(251, 146, 60, 0.08);
  }
  100% {
    box-shadow:
      0 0 25px rgba(251, 146, 60, 0.25),
      0 0 50px rgba(251, 146, 60, 0.12);
  }
}

@media (max-width: 480px) {
  .week-day-slot {
    min-width: 32px;
    padding: 6px 4px;
  }
  .day-icon {
    font-size: 14px;
  }
  .streak-fire-ring {
    width: 64px;
    height: 64px;
  }
  .streak-number {
    font-size: 22px;
  }
}
</style>
