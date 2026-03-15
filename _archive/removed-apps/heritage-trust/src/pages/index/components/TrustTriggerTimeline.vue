<template>
  <div class="trigger-section">
    <div class="trigger-header">
      <span class="trigger-icon">⏱️</span>
      <span class="trigger-label">{{ t("triggerCondition") }}</span>
    </div>
    <div class="trigger-timeline">
      <div class="timeline-item">
        <div class="timeline-dot active"></div>
        <div class="timeline-content">
          <span class="timeline-title">{{ t("trustCreated") }}</span>
          <span class="timeline-date">{{ trust.createdTime }}</span>
        </div>
      </div>
      <div class="timeline-line"></div>
      <div v-if="!trust.executed" class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <span class="timeline-title">{{ t("inactivityPeriod") }}</span>
          <span class="timeline-date">
            {{ trust.daysRemaining > 0 ? `${trust.daysRemaining} ${t("days")}` : t("ready") }}
          </span>
        </div>
      </div>
      <div v-else class="timeline-item">
        <div class="timeline-dot active"></div>
        <div class="timeline-content">
          <span class="timeline-title">{{ t("releaseSchedule") }}</span>
          <div class="release-progress">
            <span class="progress-text">{{ t("readyToClaim") }}: {{ trust.accruedYield.toFixed(4) }} GAS</span>
          </div>
        </div>
      </div>
      <div class="timeline-line"></div>
      <div class="timeline-item">
        <div class="timeline-dot"></div>
        <div class="timeline-content">
          <span class="timeline-title">{{ t("trustActivates") }}</span>
          <span class="timeline-date">{{ trust.deadline }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { Trust } from "./TrustCard.vue";

defineProps<{
  trust: Trust;
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.trigger-section {
  background: rgba(255, 255, 255, 0.01);
  padding: 20px;
  border: 1px solid rgba(255, 255, 255, 0.03);
  border-radius: 16px;
  margin-bottom: 24px;
}

.trigger-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.trigger-label {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--text-secondary);
}

.trigger-timeline {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.timeline-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.timeline-dot {
  width: 10px;
  height: 10px;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 50%;

  &.active {
    background: var(--heritage-success);
    border-color: rgba(0, 229, 153, 0.4);
    box-shadow: 0 0 12px rgba(0, 229, 153, 0.3);
  }
}

.timeline-content {
  display: flex;
  justify-content: space-between;
  flex: 1;
}

.timeline-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-primary);
  opacity: 0.8;
}

.timeline-date {
  font-size: 11px;
  color: var(--heritage-gold);
  font-weight: 700;
}

.release-progress {
  margin-top: 4px;
}

.progress-text {
  font-size: 10px;
  color: var(--heritage-success);
  font-weight: 700;
}
</style>
