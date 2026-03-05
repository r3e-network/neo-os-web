<template>
  <view class="sidebar-quick-actions">
    <text class="sidebar-section-title">{{ t("quickActions") }}</text>
    <button 
      class="sidebar-action-btn" 
      :class="{ checked: hasCheckedIn }"
      :disabled="hasCheckedIn || isCheckingIn"
      @click="emitCheckIn"
    >
      <text class="action-icon">📅</text>
      <text class="action-label">{{ hasCheckedIn ? t("checkedIn") : t("dailyCheckIn") }}</text>
    </button>
  </view>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  hasCheckedIn: boolean;
  isCheckingIn: boolean;
}>();

const emit = defineEmits<{
  (e: "checkIn"): void;
}>();

const { t } = createUseI18n(messages)();

const emitCheckIn = () => emit("checkIn");
</script>

<style lang="scss" scoped>
.sidebar-quick-actions {
  .sidebar-section-title {
    font-size: 12px;
    color: var(--karma-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 12px;
    display: block;
  }
}

.sidebar-action-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--karma-border);
  border-radius: 12px;
  color: var(--karma-text);
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    border-color: var(--karma-primary);
  }
  
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  &.checked {
    background: rgba(16, 185, 129, 0.2);
    border-color: var(--karma-success);
  }
  
  .action-icon {
    font-size: 20px;
  }
  
  .action-label {
    font-size: 14px;
    font-weight: 500;
  }
}
</style>
