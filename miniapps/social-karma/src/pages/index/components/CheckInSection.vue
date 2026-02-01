<template>
  <view class="checkin-section">
    <view class="content-card checkin-card">
      <view class="checkin-header">
        <text class="card-title">{{ t("dailyCheckIn") }}</text>
        <view v-if="streak > 0" class="streak-badge">
          <text>🔥 {{ streak }} {{ t("dayStreak") }}</text>
        </view>
      </view>
      
      <view class="checkin-body">
        <view class="reward-display">
          <text class="reward-amount">+{{ calculateReward() }}</text>
          <text class="reward-label">{{ t("karmaPoints") }}</text>
        </view>
        
        <button 
          class="action-button primary"
          :disabled="hasCheckedIn || isCheckingIn"
          @click="emitCheckIn"
        >
          <text v-if="isCheckingIn">{{ t("checkingIn") }}...</text>
          <text v-else-if="hasCheckedIn">✓ {{ t("checkedIn") }}</text>
          <text v-else>{{ t("checkInNow") }}</text>
        </button>
        
        <text v-if="hasCheckedIn" class="next-checkin">
          {{ t("nextCheckIn") }}: {{ nextTime }}
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useI18n } from "@/composables/useI18n";

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

const { t } = useI18n();

const calculateReward = () => {
  const base = props.baseReward;
  const bonus = Math.min(props.streak, 7);
  return base + bonus;
};

const emitCheckIn = () => emit("checkIn");
</script>

<style lang="scss" scoped>
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
