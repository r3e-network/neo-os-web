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
      <HeroSection
        :title="canCheckIn ? t('ready') : t('checkedInToday')"
        :icon="canCheckIn ? '✨' : '✅'"
        variant="erobo"
        compact
      >
        <template #stats>
          <view class="utc-clock" role="timer" aria-live="polite" :aria-label="t('utcClock')">
            <text class="clock-label">{{ t("utcClock") }}</text>
            <text class="clock-time">{{ utcTimeDisplay }}</text>
          </view>
        </template>
        <CountdownTimer :target-time="nextUtcMidnight" :total-duration="MS_PER_DAY" :label="t('nextCheckin')" />
        <view class="status-card" :class="{ glow: canCheckIn }">
          <view class="status-icon-box" :class="{ 'glow-icon': canCheckIn }">
            <AppIcon :name="canCheckIn ? 'star' : 'check'" :size="24" />
          </view>
          <view class="status-info">
            <text class="status-main">{{ canCheckIn ? t("notCheckedIn") : t("checkedInToday") }}</text>
            <text class="status-sub">{{ canCheckIn ? t("statusReady") : t("statusDone") }}</text>
          </view>
        </view>
      </HeroSection>

      <StreakDisplay :current-streak="currentStreak" :highest-streak="highestStreak" />
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
      <StatsTab
        :grid-items="globalStatsGridItems"
        :grid-columns="3"
        :row-items="userStatsRowItems"
        :rows-title="t('yourStatsTitle')"
      >
        <NeoCard :title="t('recentCheckins')" variant="erobo">
          <view v-if="checkinHistory.length === 0" class="empty-state">
            <text>{{ t("noCheckins") }}</text>
          </view>
          <view v-else class="history-list">
            <view v-for="(item, idx) in checkinHistory" :key="idx" class="history-item">
              <view class="history-icon">🔥</view>
              <view class="history-info">
                <text class="history-day">{{ t("day") }} {{ item.streak }}</text>
                <text class="history-time">{{ item.time }}</text>
              </view>
              <text v-if="item.reward > 0" class="history-reward">+{{ formatGas(item.reward) }} GAS</text>
            </view>
          </view>
        </NeoCard>
      </StatsTab>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { messages } from "@/locale/messages";
import { MiniAppPage, HeroSection } from "@shared/components";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useCheckinPage } from "./composables/useCheckinPage";

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
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;
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

.utc-clock {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.clock-label {
  font-size: 9px;
  font-weight: 700;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin-bottom: 2px;
  letter-spacing: 0.05em;
}

.clock-time {
  @include mono-number(14px);
  font-weight: 600;
  color: var(--text-primary, white);
}

.status-card {
  @include card-base(16px, 16px);
  width: 100%;
  display: flex;
  align-items: center;
  gap: 16px;
  transition: all 0.3s;
  backdrop-filter: blur(10px);
  margin-top: 16px;

  &.glow {
    background: linear-gradient(90deg, rgba(255, 222, 89, 0.05) 0%, rgba(255, 222, 89, 0.01) 100%);
    border-color: rgba(255, 222, 89, 0.2);
  }
}

.status-icon-box {
  width: 48px;
  height: 48px;
  background: var(--bg-card, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));

  &.glow-icon {
    background: rgba(255, 222, 89, 0.1);
    color: var(--sunrise-ready);
    box-shadow: 0 0 15px rgba(255, 222, 89, 0.2);
  }
}

.status-info {
  flex: 1;
}

.status-main {
  display: block;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, white);
  margin-bottom: 2px;
  text-transform: uppercase;
}

.status-sub {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}
</style>
