<template>
  <NeoCard
    variant="danger"
    class="destruction-chamber-card"
    :style="{ borderColor: isDestroying ? 'var(--grave-danger)' : '' }"
  >
    <div class="hazard-stripes"></div>

    <div class="chamber-header-glass">
      <div class="icon-pulse">
        <AppIcon name="flame" :size="24" class="chamber-icon-glass" />
      </div>
    </div>

    <div class="input-container">
      <NeoInput
        :modelValue="assetHash"
        @update:modelValue="$emit('update:assetHash', $event)"
        :placeholder="t('assetHashPlaceholder')"
        type="text"
        class="mb-4"
      />
    </div>

    <div class="memory-type">
      <span class="memory-label">{{ t("memoryType") }}</span>
      <div class="memory-options">
        <div
          v-for="option in memoryTypeOptions"
          :key="option.value"
          :class="['memory-option', { active: option.value === memoryType }]"
          @click="$emit('update:memoryType', option.value)"
        >
          <span>{{ option.label }}</span>
        </div>
      </div>
    </div>

    <!-- Animated Warning -->
    <div class="warning-box-glass" :class="{ shake: showWarningShake }">
      <div class="warning-icon-container">
        <AppIcon name="warning" :size="24" class="warning-icon" />
      </div>
      <div class="warning-content">
        <span class="warning-title-glass">{{ t("warning") }}</span>
        <span class="warning-text-glass">{{ t("warningText") }}</span>
      </div>
    </div>

    <!-- Destruction Button with Fire Effect -->
    <div class="destroy-btn-container">
      <NeoButton
        variant="primary"
        size="lg"
        block
        type="button"
        :aria-label="isDestroying ? t('destroying') : t('destroyForever')"
        @click="$emit('initiate')"
        :loading="isDestroying"
        :class="['destroy-btn-glass', { 'is-destroying': isDestroying }]"
      >
        <div class="btn-fire-effect" v-if="isDestroying"></div>
        <AppIcon v-if="!isDestroying" name="skull" :size="16" class="btn-icon" />
        <span class="btn-text">{{ isDestroying ? t("destroying") : t("destroyForever") }}</span>
      </NeoButton>
    </div>

    <div class="hazard-stripes bottom"></div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoInput, NeoButton, AppIcon } from "@shared/components"; // eslint-disable-line @typescript-eslint/no-unused-vars
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  assetHash: string;
  memoryType: number;
  memoryTypeOptions: { value: number; label: string }[];
  isDestroying: boolean;
  showWarningShake: boolean;
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  (e: "update:assetHash", value: string): void;
  (e: "update:memoryType", value: number): void;
  (e: "initiate"): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.destruction-chamber-card {
  position: relative;
  overflow: hidden;
  transition: border-color 0.3s;
}

.hazard-stripes {
  height: 6px;
  background: repeating-linear-gradient(
    45deg,
    var(--grave-danger-soft, rgba(239, 68, 68, 0.4)),
    var(--grave-danger-soft, rgba(239, 68, 68, 0.4)) 10px,
    var(--grave-panel, rgba(0, 0, 0, 0.2)) 10px,
    var(--grave-panel, rgba(0, 0, 0, 0.2)) 20px
  );
  margin: -16px -16px 16px -16px;
  opacity: 0.7;

  &.bottom {
    margin: 16px -16px -16px -16px;
  }
}

.chamber-header-glass {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 1px solid var(--grave-danger-border, rgba(255, 68, 68, 0.2));
  padding-bottom: 12px;
}

.icon-pulse {
  animation: pulse-red 2s infinite;
}

.chamber-icon-glass {
  font-size: 24px;
}

.memory-type {
  margin-bottom: 20px;
}

.memory-label {
  @include stat-label;
  display: block;
  font-size: 10px;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
}

.memory-options {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 6px;
}

.memory-option {
  border: 1px solid var(--grave-panel-border);
  border-radius: 8px;
  padding: 6px 4px;
  text-align: center;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--text-secondary);
  background: var(--grave-panel-soft);
  transition: all 0.2s ease;
}

.memory-option.active {
  border-color: var(--grave-warning);
  color: var(--text-primary);
  background: var(--grave-panel-strong);
  box-shadow: 0 0 12px rgba(255, 222, 89, 0.3);
}

.warning-box-glass {
  display: flex;
  gap: 12px;
  background: var(--grave-danger-soft, rgba(239, 68, 68, 0.1));
  color: var(--grave-warning-text);
  padding: $spacing-4;
  border-radius: 12px;
  border: 1px solid var(--grave-danger-border, rgba(239, 68, 68, 0.3));
  margin-bottom: 24px;
  backdrop-filter: blur(4px);

  &.shake {
    animation: shake 0.5s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
    border-color: var(--grave-danger);
    box-shadow: 0 0 20px var(--grave-danger-glow, rgba(239, 68, 68, 0.4));
  }
}

.warning-icon {
  font-size: 24px;
}

.warning-title-glass {
  font-weight: 800;
  font-size: 12px;
  text-transform: uppercase;
  color: var(--grave-danger);
  display: block;
  margin-bottom: 4px;
  letter-spacing: 0.05em;
}

.warning-text-glass {
  font-size: 11px;
  line-height: 1.5;
  opacity: 0.9;
}

.destroy-btn-glass {
  position: relative;
  overflow: hidden;
  border: 1px solid var(--grave-danger-border, rgba(239, 68, 68, 0.5));
  transition: all 0.3s;

  &:hover {
    box-shadow: 0 0 30px var(--grave-danger-glow, rgba(239, 68, 68, 0.4));
    transform: scale(1.02);
  }

  &.is-destroying {
    background: var(--grave-bg);
    border-color: var(--grave-danger);
  }
}

.btn-fire-effect {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(0deg, var(--grave-danger), transparent);
  opacity: 0.5;
  animation: fire-flicker 0.1s infinite;
}

.btn-icon {
  margin-right: 8px;
  font-size: 16px;
}

.btn-text {
  position: relative;
  z-index: 1;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }
  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }
  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }
  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}

@keyframes pulse-red {
  0% {
    transform: scale(1);
    filter: drop-shadow(0 0 0 var(--grave-danger-glow, rgba(239, 68, 68, 0)));
  }
  50% {
    transform: scale(1.1);
    filter: drop-shadow(0 0 10px var(--grave-danger-glow, rgba(239, 68, 68, 0.5)));
  }
  100% {
    transform: scale(1);
    filter: drop-shadow(0 0 0 var(--grave-danger-glow, rgba(239, 68, 68, 0)));
  }
}

@keyframes fire-flicker {
  0% {
    opacity: 0.4;
    height: 100%;
  }
  50% {
    opacity: 0.6;
    height: 90%;
  }
  100% {
    opacity: 0.4;
    height: 100%;
  }
}

@media (prefers-reduced-motion: reduce) {
  .icon-pulse,
  .btn-fire-effect {
    animation: none;
  }
}
</style>
