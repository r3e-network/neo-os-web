<template>
  <div class="checkin-section">
    <div class="content-card checkin-card">
      <div class="checkin-header">
        <span class="card-title">{{ t("dailyCheckIn") }}</span>
        <div v-if="streak > 0" class="streak-badge">
          <span>🔥 {{ streak }} {{ t("dayStreak") }}</span>
        </div>
      </div>

      <div class="checkin-body">
        <div class="reward-display">
          <span class="reward-amount">+{{ calculateReward() }}</span>
          <span class="reward-label">{{ t("karmaPoints") }}</span>
        </div>

        <button class="action-button primary" :disabled="hasCheckedIn || isCheckingIn" @click="emitCheckIn">
          <span v-if="isCheckingIn">{{ t("checkingIn") }}...</span>
          <span v-else-if="hasCheckedIn">✓ {{ t("checkedIn") }}</span>
          <span v-else>{{ t("checkInNow") }}</span>
        </button>

        <span v-if="hasCheckedIn" class="next-checkin"> {{ t("nextCheckIn") }}: {{ nextTime }} </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const props = defineProps<{
  streak: number;
  hasCheckedIn: boolean;
  isCheckingIn: boolean;
  nextTime: string;
  baseReward: number;
}>();

const emit = defineEmits<{
  (e: "checkIn"): void;
}>();

const { t } = createUseI18n(messages)();

const calculateReward = () => {
  const base = props.baseReward;
  const bonus = Math.min(props.streak, 7);
  return base + bonus;
};

const emitCheckIn = () => emit("checkIn");
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;
.checkin-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-card {
  background: var(--karma-card-bg);
  border: 1px solid var(--karma-border);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
}

.checkin-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--karma-text);
}

.streak-badge {
  padding: 6px 12px;
  background: rgba(245, 158, 11, 0.2);
  border-radius: 99px;
  font-size: 13px;
  color: var(--karma-primary);
  font-weight: 600;
}

.checkin-body {
  text-align: center;
  padding: 20px 0;
}

.reward-display {
  margin-bottom: 20px;
}

.reward-amount {
  font-size: 48px;
  font-weight: 800;
  background: linear-gradient(135deg, var(--karma-primary), var(--karma-secondary));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  display: block;
}

.reward-label {
  font-size: 14px;
  color: var(--karma-text-secondary);
}

.action-button {
  width: 100%;
  padding: 14px 24px;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &.primary {
    background: linear-gradient(135deg, var(--karma-primary), var(--karma-secondary));
    color: white;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);
    }
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.next-checkin {
  font-size: 13px;
  color: var(--karma-text-muted);
  margin-top: 12px;
  display: block;
}
</style>
