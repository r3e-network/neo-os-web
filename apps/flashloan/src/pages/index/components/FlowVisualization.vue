<template>
  <NeoCard variant="erobo-neo" class="flow-card">
    <div class="flow-diagram-glass">
      <!-- Step 1: Borrow -->
      <div class="flow-step">
        <div class="step-icon-container">
          <AppIcon name="money" :size="24" class="step-icon" aria-hidden="true" />
          <div class="step-ring"></div>
        </div>
        <span class="step-label">{{ t("borrow") }}</span>
      </div>

      <!-- Connector 1 -->
      <div class="flow-connector">
        <div class="connector-line">
          <div class="connector-pulse"></div>
        </div>
        <span class="connector-arrow">►</span>
      </div>

      <!-- Step 2: Execute -->
      <div class="flow-step">
        <div class="step-icon-container active">
          <AppIcon name="refresh" :size="24" class="step-icon" aria-hidden="true" />
          <div class="step-ring pulse"></div>
        </div>
        <span class="step-label highlight">{{ t("execute") }}</span>
      </div>

      <!-- Connector 2 -->
      <div class="flow-connector">
        <div class="connector-line">
          <div class="connector-pulse delay"></div>
        </div>
        <span class="connector-arrow">►</span>
      </div>

      <!-- Step 3: Repay -->
      <div class="flow-step">
        <div class="step-icon-container">
          <AppIcon name="success" :size="24" class="step-icon" aria-hidden="true" />
          <div class="step-ring"></div>
        </div>
        <span class="step-label">{{ t("repay") }}</span>
      </div>
    </div>

    <div class="flow-note-glass">
      <AppIcon name="info" :size="14" class="note-icon" aria-hidden="true" />
      <span class="note-text">{{ t("flowNote") }}</span>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, AppIcon } from "@shared/components"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.flow-title {
  font-size: 14px;
  font-weight: 800;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  display: block;
  margin-bottom: 20px;
  text-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
}

.flow-diagram-glass {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  position: relative;
  padding: 0 10px;
}

.flow-step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  z-index: 2;
}

.step-icon-container {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: rgba(20, 20, 30, 0.8);
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.3);

  &.active {
    border-color: var(--flash-success);
    background: radial-gradient(circle, rgba(0, 229, 153, 0.1) 0%, rgba(20, 20, 30, 0.9) 70%);
    box-shadow: 0 0 20px rgba(0, 229, 153, 0.2);
  }
}

.step-icon {
  font-size: 24px;
  position: relative;
  z-index: 2;
}

.step-ring {
  position: absolute;
  top: -4px;
  right: -4px;
  bottom: -4px;
  left: -4px;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 50%;

  &.pulse {
    border-color: rgba(0, 229, 153, 0.3);
    animation: ring-pulse 2s infinite;
  }
}

.step-label {
  @include stat-label;
  color: var(--text-secondary);

  &.highlight {
    color: var(--flash-success);
    text-shadow: 0 0 10px rgba(0, 229, 153, 0.4);
  }
}

.flow-connector {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin: 0 -10px;
  top: -14px; /* Align with icon center */
  z-index: 1;
}

.connector-line {
  height: 2px;
  width: 100%;
  background: rgba(255, 255, 255, 0.1);
  position: relative;
  overflow: hidden;
}

.connector-pulse {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  background: linear-gradient(90deg, transparent, var(--flash-success), transparent);
  animation: connector-flow 1.5s infinite linear;

  &.delay {
    animation-delay: 0.75s;
  }
}

.connector-arrow {
  color: var(--text-muted);
  font-size: 10px;
  margin-left: -4px;
}

.flow-note-glass {
  @include card-base(12px, 12px);
  display: flex;
  align-items: center;
  gap: 10px;
}

.note-icon {
  font-size: 14px;
}

.note-text {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.4;
  font-weight: 500;
}

@keyframes ring-pulse {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  50% {
    transform: scale(1.2);
    opacity: 0;
  }
  100% {
    transform: scale(1);
    opacity: 0;
  }
}

@keyframes connector-flow {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(200%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .step-ring.pulse,
  .connector-pulse {
    animation: none;
  }
}
</style>
