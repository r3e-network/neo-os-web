<template>
  <div class="checkin-play-area">
    <CheckinCalendar :t="t" :current-streak="currentStreak" :can-check-in="canCheckIn" />

    <StreakDisplay :t="t" :current-streak="currentStreak" :highest-streak="highestStreak" />

    <!-- Countdown to Next UTC Midnight -->
    <div class="countdown-section">
      <div class="utc-clock" role="timer" aria-live="polite">
        <AppIcon name="clock" :size="18" class="clock-icon" aria-hidden="true" />
        <span class="clock-display">{{ utcTimeDisplay }}</span>
        <span class="clock-utc-label">{{ t("utcLabel") }}</span>
      </div>
      <CountdownTimer
        :target-time="nextUtcMidnight"
        :total-duration="MS_PER_DAY"
        :label="t('nextCheckin')"
      />
    </div>

    <!-- Status Pill -->
    <div class="status-pill" :class="{ ready: canCheckIn }">
      <AppIcon :name="canCheckIn ? 'star' : 'check'" :size="18" aria-hidden="true" />
      <span>{{ canCheckIn ? t("statusReady") : t("statusDone") }}</span>
    </div>

    <!-- Check-in Action -->
    <NeoCard variant="erobo" :title="t('checkInNow')" class="action-card">
      <NeoButton
        variant="primary"
        size="lg"
        block
        type="button"
        :disabled="!canCheckIn || isLoading"
        :loading="isLoading"
        class="checkin-btn"
        @click="handleCheckIn"
      >
        <div class="btn-content">
          <AppIcon :name="canCheckIn ? 'star' : 'clock'" :size="16" aria-hidden="true" />
          <span>{{ canCheckIn ? t("checkInNow") : t("waitForNext") }}</span>
        </div>
      </NeoButton>
    </NeoCard>

    <RewardsSection
      :t="t"
      :current-streak="currentStreak"
      :unclaimed-rewards="unclaimedRewards"
      :total-claimed="totalClaimed"
      :is-claiming="isClaiming"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from "vue";
import type { Ref } from "vue";
import { AppIcon, NeoCard, NeoButton } from "@shared/components";
import { MINIAPP_ACTIONS_KEY } from "@shared/utils/defineMiniApp";
import CountdownTimer from "./components/CountdownTimer.vue";
import CheckinCalendar from "./components/CheckinCalendar.vue";
import StreakDisplay from "./components/StreakDisplay.vue";
import RewardsSection from "./components/RewardsSection.vue";
import { MS_PER_DAY } from "./composables/useCheckin";

const props = defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  state: Record<string, Ref<unknown>>;
}>();

const t = (key: string, params?: Record<string, string | number>) => props.t(key, params);

// ── State bindings ────────────────────────────────────────────────────
const currentStreak = computed(() => Number(props.state.currentStreakRaw?.value ?? 0));
const highestStreak = computed(() => Number(props.state.highestStreakRaw?.value ?? 0));
const unclaimedRewards = computed(() => Number(props.state.unclaimedRewards?.value ?? 0));
const totalClaimed = computed(() => Number(props.state.totalClaimed?.value ?? 0));
const isLoading = computed(() => Boolean(props.state.isLoading?.value ?? false));
const isClaiming = computed(() => Boolean(props.state.isClaiming?.value ?? false));
const canCheckIn = computed(() => Boolean(props.state.canCheckIn?.value ?? false));
const utcTimeDisplay = computed(() => String(props.state.utcTimeDisplay?.value ?? "00:00:00"));
const nextUtcMidnight = computed(() => Number(props.state.nextUtcMidnight?.value ?? 0));

// ── Action dispatch ──────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleCheckIn = async () => {
  const handler = actions.get("doCheckIn");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.checkin-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 20px 12px;
  min-height: 300px;
  text-align: center;
}

.countdown-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.utc-clock {
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

.status-pill {
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
    color: var(--accent-warning, #fde047);
    box-shadow: 0 0 15px rgba(255, 222, 89, 0.15);
  }
}

.action-card {
  width: 100%;
  max-width: 400px;
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

@media (prefers-reduced-motion: reduce) {
  .status-pill {
    animation: none;
    transition: none;
  }
}
</style>
