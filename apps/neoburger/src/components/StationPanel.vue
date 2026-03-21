<template>
  <div class="station fade-up delay-1">
    <div class="station-tabs">
      <button type="button" class="station-tab" :class="{ active: mode === 'burger' }" :aria-label="t('burgerStation')" @click="setMode('burger')">
        {{ t("burgerStation") }}
      </button>
      <button type="button" class="station-tab" :class="{ active: mode === 'jazz' }" :aria-label="t('jazzUp')" @click="setMode('jazz')">
        {{ t("jazzUp") }}
      </button>
    </div>

    <div v-if="mode === 'burger'" class="station-card">
      <div class="station-header">
        <span class="station-title">{{ t("burgerStation") }}</span>
        <button type="button" class="station-learn" :aria-label="t('learnMore')" @click="emit('learnMore')">
          <img class="learn-icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('learnMore')" />
          <span>{{ t("learnMore") }}</span>
        </button>
      </div>

      <slot name="swap-interface" />

      <span class="station-tip">{{ t("burgerTip") }}</span>

      <div class="station-actions">
        <div class="quick-amounts">
          <button type="button" class="chip" :aria-label="t('setAmountPercent25')" @click="emit('setAmount', 0.25)">{{ t("percent25") }}</button>
          <button type="button" class="chip" :aria-label="t('setAmountPercent50')" @click="emit('setAmount', 0.5)">{{ t("percent50") }}</button>
          <button type="button" class="chip" :aria-label="t('setAmountPercent75')" @click="emit('setAmount', 0.75)">{{ t("percent75") }}</button>
          <button type="button" class="chip" :aria-label="t('setAmountMax')" @click="emit('setAmount', 1)">{{ t("max") }}</button>
        </div>
        <NeoButton
          variant="primary"
          size="lg"
          block
          :disabled="walletConnected ? !canSubmit : false"
          :loading="loading"
          @click="emit('primaryAction')"
        >
          {{ loading ? t("processing") : primaryActionLabel }}
        </NeoButton>
      </div>
    </div>

    <div v-else class="station-card jazz-card">
      <div class="station-header">
        <span class="station-title">{{ t("jazzUp") }}</span>
        <span class="station-subtitle">{{ t("jazzSubtitle") }}</span>
      </div>

      <div class="jazz-grid">
        <div class="jazz-item">
          <span class="jazz-label">{{ t("dailyRewards") }}</span>
          <span class="jazz-value">{{ dailyRewards }} {{ t("tokenGas") }}</span>
        </div>
        <div class="jazz-item">
          <span class="jazz-label">{{ t("weeklyRewards") }}</span>
          <span class="jazz-value">{{ weeklyRewards }} {{ t("tokenGas") }}</span>
        </div>
        <div class="jazz-item">
          <span class="jazz-label">{{ t("monthlyRewards") }}</span>
          <span class="jazz-value">{{ monthlyRewards }} {{ t("tokenGas") }}</span>
        </div>
        <div class="jazz-item">
          <span class="jazz-label">{{ t("totalRewards") }}</span>
          <span class="jazz-value">{{ totalRewards }} {{ t("tokenGas") }}</span>
          <span class="jazz-subvalue">{{ totalRewardsUsdText }}</span>
        </div>
      </div>

      <span class="jazz-note">{{ t("jazzNote1") }}</span>
      <span class="jazz-note">{{ t("jazzNote2") }}</span>

      <NeoButton variant="success" size="lg" block :loading="loading" @click="emit('jazzAction')">
        {{ loading ? t("processing") : jazzActionLabel }}
      </NeoButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { NeoButton } from "@shared/components";

const { t } = createUseI18n(messages)();

const props = defineProps<{
  walletConnected: boolean;
  canSubmit: boolean;
  loading: boolean;
  primaryActionLabel: string;
  jazzActionLabel: string;
  dailyRewards: string;
  weeklyRewards: string;
  monthlyRewards: string;
  totalRewards: number;
  totalRewardsUsdText: string;
}>();

const emit = defineEmits<{
  (e: "update:mode", value: "burger" | "jazz"): void;
  (e: "learnMore"): void;
  (e: "setAmount", percentage: number): void;
  (e: "primaryAction"): void;
  (e: "jazzAction"): void;
}>();

const mode = ref<"burger" | "jazz">("burger");

function setMode(value: "burger" | "jazz") {
  mode.value = value;
  emit("update:mode", value);
}

defineExpose({
  mode,
  setMode,
});
</script>

<style lang="scss" scoped>
.station {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.station-tabs {
  background: var(--burger-surface);
  border-radius: 999px;
  padding: 6px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  box-shadow: var(--burger-shadow-soft);
}

.station-tab {
  border: none;
  background: transparent;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-weight: 700;
  padding: 10px 0;
  border-radius: 999px;
  color: var(--burger-text-muted);
  cursor: pointer;
}

.station-tab.active {
  background: var(--burger-accent);
  color: var(--burger-accent-text);
  box-shadow: var(--burger-accent-shadow-sm);
}

.station-card {
  background: var(--burger-surface);
  border-radius: 24px;
  padding: 20px;
  border: 1px solid var(--burger-border);
  box-shadow: var(--burger-card-shadow-strong);
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.station-header {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.station-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 28px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.station-subtitle {
  font-size: 13px;
  opacity: 0.7;
}

.station-learn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--burger-accent-deep);
  font-weight: 600;
  cursor: pointer;
  border: none;
  appearance: none;
  padding: 0;
  background: transparent;
}

.learn-icon {
  width: 16px;
}

.station-tip {
  font-size: 12px;
  color: var(--burger-text-muted);
}

.station-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-amounts {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
}

.chip {
  border-radius: 999px;
  border: 1px solid var(--burger-border);
  background: var(--burger-surface);
  font-size: 11px;
  font-weight: 700;
  padding: 6px 0;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.jazz-card {
  background: var(--burger-jazz-gradient);
}

.jazz-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.jazz-item {
  background: var(--burger-surface);
  border-radius: 14px;
  padding: 10px;
  border: 1px solid var(--burger-border);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.jazz-label {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--burger-text-muted);
}

.jazz-value {
  font-size: 14px;
  font-weight: 700;
}

.jazz-subvalue {
  font-size: 11px;
  opacity: 0.6;
}

.jazz-note {
  font-size: 12px;
  color: var(--burger-text-muted);
}

.fade-up {
  animation: fadeUp 0.8s ease both;
}

.delay-1 {
  animation-delay: 0.1s;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
