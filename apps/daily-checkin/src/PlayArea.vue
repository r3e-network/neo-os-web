<template>
  <div class="checkin-play-area" :class="{ 'streak-active': currentStreak > 0 }">
    <div class="flame-bg-effects">
      <div class="ember ember-1"></div>
      <div class="ember ember-2"></div>
      <div class="ember ember-3"></div>
    </div>

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

    <!-- Reward Preview -->
    <div v-if="canCheckIn" class="reward-preview">
      <span class="reward-preview-label">{{ t("checkInNow") }}</span>
      <div class="reward-preview-amount">
        <AppIcon name="star" :size="16" class="reward-icon" aria-hidden="true" />
        <span>+{{ nextRewardAmount }} {{ t("tokenGas") }}</span>
      </div>
      <span class="reward-preview-hint">{{ t("dayStreak") }} {{ currentStreak + 1 }}</span>
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

    <!-- Confetti burst on success -->
    <div v-if="showConfetti" class="confetti-container" aria-hidden="true">
      <span v-for="i in 20" :key="i" class="confetti-piece" :style="confettiStyle(i)" /></div>

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
import { computed, inject, ref, watch } from "vue";
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

// ── Reward preview ──────────────────────────────────────────────────
const nextRewardAmount = computed(() => {
  const streak = currentStreak.value + 1;
  // Base 1 GAS per day, bonus at milestones
  if (streak >= 30) return 5;
  if (streak >= 14) return 3;
  if (streak >= 7) return 2;
  return 1;
});

// ── Confetti ────────────────────────────────────────────────────────
const showConfetti = ref(false);
const confettiColors = ["#ff6b35", "#fbbf24", "#34d399", "#ff8a5c", "#c41e3a", "#ffd700"];

const confettiStyle = (i: number) => ({
  left: `${5 + Math.random() * 90}%`,
  animationDelay: `${Math.random() * 0.5}s`,
  animationDuration: `${1.5 + Math.random() * 1.5}s`,
  backgroundColor: confettiColors[i % confettiColors.length],
  width: `${6 + Math.random() * 6}px`,
  height: `${6 + Math.random() * 6}px`,
  borderRadius: Math.random() > 0.5 ? "50%" : "2px",
  transform: `rotate(${Math.random() * 360}deg)`,
});

// Watch for check-in success (canCheckIn goes from true to false while not loading)
watch(canCheckIn, (newVal, oldVal) => {
  if (oldVal === true && newVal === false) {
    showConfetti.value = true;
    setTimeout(() => { showConfetti.value = false; }, 3000);
  }
});

// ── Action dispatch ──────────────────────────────────────────────────
const actions = inject(MINIAPP_ACTIONS_KEY, new Map());

const handleCheckIn = async () => {
  const handler = actions.get("doCheckIn");
  if (handler) await handler();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;
@import url("https://fonts.googleapis.com/css2?family=Fredoka:wght@400;500;600;700&display=swap");

.checkin-play-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  padding: 20px 12px;
  min-height: 300px;
  text-align: center;
  position: relative;
  overflow: hidden;
  background: radial-gradient(ellipse at 50% 0%, rgba(255, 107, 53, 0.15) 0%, transparent 60%),
    radial-gradient(ellipse at 50% 100%, rgba(196, 30, 58, 0.1) 0%, transparent 50%);
  font-family: "Fredoka", sans-serif;

  &.streak-active {
    background: radial-gradient(ellipse at 50% 0%, rgba(255, 107, 53, 0.25) 0%, transparent 60%),
      radial-gradient(ellipse at 50% 100%, rgba(196, 30, 58, 0.15) 0%, transparent 50%);
  }
}

/* Floating ember particles */
.flame-bg-effects {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
  z-index: 0;
}

.ember {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ff6b35;
  opacity: 0;
  animation: ember-float 4s ease-in-out infinite;
}

.ember-1 {
  left: 20%;
  bottom: -10px;
  animation-delay: 0s;
  box-shadow: 0 0 8px rgba(255, 107, 53, 0.6);
}

.ember-2 {
  left: 55%;
  bottom: -10px;
  animation-delay: 1.5s;
  width: 4px;
  height: 4px;
  background: #ffa726;
  box-shadow: 0 0 6px rgba(255, 167, 38, 0.6);
}

.ember-3 {
  left: 80%;
  bottom: -10px;
  animation-delay: 3s;
  width: 5px;
  height: 5px;
  box-shadow: 0 0 10px rgba(255, 107, 53, 0.8);
}

@keyframes ember-float {
  0% {
    opacity: 0;
    transform: translateY(0) scale(1);
  }
  20% {
    opacity: 0.8;
  }
  80% {
    opacity: 0.3;
  }
  100% {
    opacity: 0;
    transform: translateY(-400px) scale(0.3);
  }
}

.countdown-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  position: relative;
  z-index: 1;
}

.utc-clock {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(255, 107, 53, 0.08);
  border: 1px solid rgba(255, 107, 53, 0.2);
  border-radius: 20px;
  backdrop-filter: blur(8px);
}

.clock-icon {
  font-size: 14px;
  color: #ff6b35;
}

.clock-display {
  @include mono-number(13px);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: #ff8a5c;
}

.clock-utc-label {
  font-size: 8px;
  font-weight: 800;
  color: rgba(255, 107, 53, 0.5);
  letter-spacing: 0.1em;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  font-family: "Fredoka", sans-serif;
  background: rgba(196, 30, 58, 0.12);
  color: #e57373;
  border: 1px solid rgba(196, 30, 58, 0.2);
  transition: all 0.3s ease;
  position: relative;
  z-index: 1;

  &.ready {
    background: rgba(255, 107, 53, 0.15);
    color: #ff6b35;
    border-color: rgba(255, 107, 53, 0.3);
    box-shadow: 0 0 20px rgba(255, 107, 53, 0.2), 0 0 40px rgba(255, 107, 53, 0.1);
    animation: pulse-flame 2s ease-in-out infinite;
  }
}

@keyframes pulse-flame {
  0%,
  100% {
    box-shadow: 0 0 20px rgba(255, 107, 53, 0.2), 0 0 40px rgba(255, 107, 53, 0.1);
  }
  50% {
    box-shadow: 0 0 30px rgba(255, 107, 53, 0.35), 0 0 60px rgba(255, 107, 53, 0.15);
  }
}

.action-card {
  width: 100%;
  max-width: 400px;
  background: rgba(255, 107, 53, 0.05);
  border: 1px solid rgba(255, 107, 53, 0.15);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(8px);
  position: relative;
  z-index: 1;
}

.checkin-btn {
  margin-top: 16px;

  :deep(.neo-btn) {
    background: linear-gradient(135deg, #ff6b35 0%, #c41e3a 100%);
    color: #fff;
    font-weight: 700;
    font-family: "Fredoka", sans-serif;
    border-radius: 14px;
    transition: all 0.3s ease;
    box-shadow: 0 4px 15px rgba(255, 107, 53, 0.3);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
    letter-spacing: 0.02em;

    &:hover:not(:disabled) {
      box-shadow: 0 8px 30px rgba(255, 107, 53, 0.45), 0 0 60px rgba(255, 107, 53, 0.15);
      transform: translateY(-2px);
    }

    &:disabled {
      background: linear-gradient(135deg, #5a3a2e 0%, #4a2030 100%);
      color: rgba(255, 255, 255, 0.4);
      box-shadow: none;
    }
  }
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  font-weight: 700;
  text-transform: uppercase;
  font-size: 18px;
  font-family: "Fredoka", sans-serif;
}

/* Ensure child components sit above bg effects */
:deep(.checkin-calendar),
:deep(.streak-display),
:deep(.rewards-section),
:deep(.countdown-timer) {
  position: relative;
  z-index: 1;
}

/* Reward Preview */
.reward-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 12px 20px;
  background: rgba(255, 107, 53, 0.08);
  border: 1px dashed rgba(255, 107, 53, 0.25);
  border-radius: 14px;
  position: relative;
  z-index: 1;
  animation: preview-breathe 2s ease-in-out infinite;
}

.reward-preview-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: rgba(255, 107, 53, 0.6);
}

.reward-preview-amount {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 22px;
  font-weight: 900;
  font-family: "Fredoka", sans-serif;
  background: linear-gradient(135deg, #fbbf24, #ff6b35);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.reward-icon {
  color: #fbbf24;
  filter: drop-shadow(0 0 6px rgba(251, 191, 36, 0.5));
}

.reward-preview-hint {
  font-size: 10px;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.4);
}

@keyframes preview-breathe {
  0%, 100% { box-shadow: 0 0 10px rgba(255, 107, 53, 0.1); }
  50% { box-shadow: 0 0 20px rgba(255, 107, 53, 0.2); }
}

/* Confetti Effect */
.confetti-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 999;
  overflow: hidden;
}

.confetti-piece {
  position: absolute;
  top: -10px;
  opacity: 0;
  animation: confetti-fall 2.5s ease-out forwards;
}

@keyframes confetti-fall {
  0% { opacity: 1; top: -10px; transform: translateX(0) rotate(0deg); }
  25% { opacity: 1; }
  100% { opacity: 0; top: 100vh; transform: translateX(calc(-50px + 100px * var(--r, 0.5))) rotate(720deg); }
}

@media (prefers-reduced-motion: reduce) {
  .status-pill {
    animation: none;
    transition: none;
  }
  .ember {
    animation: none;
    display: none;
  }
  .confetti-container {
    display: none;
  }
  .reward-preview {
    animation: none;
  }
}
</style>
