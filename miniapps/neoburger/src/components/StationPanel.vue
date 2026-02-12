<template>
  <view class="station fade-up delay-1">
    <view class="station-tabs">
      <button class="station-tab" :class="{ active: mode === 'burger' }" @click="setMode('burger')">
        {{ t("burgerStation") }}
      </button>
      <button class="station-tab" :class="{ active: mode === 'jazz' }" @click="setMode('jazz')">
        {{ t("jazzUp") }}
      </button>
    </view>

    <view v-if="mode === 'burger'" class="station-card">
      <view class="station-header">
        <text class="station-title">{{ t("burgerStation") }}</text>
        <view class="station-learn" role="button" tabindex="0" :aria-label="t('learnMore')" @click="emit('learnMore')">
          <image class="learn-icon" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('learnMore')" />
          <text>{{ t("learnMore") }}</text>
        </view>
      </view>

      <slot name="swap-interface" />

      <text class="station-tip">{{ t("burgerTip") }}</text>

      <view class="station-actions">
        <view class="quick-amounts">
          <button class="chip" @click="emit('setAmount', 0.25)">{{ t("percent25") }}</button>
          <button class="chip" @click="emit('setAmount', 0.5)">{{ t("percent50") }}</button>
          <button class="chip" @click="emit('setAmount', 0.75)">{{ t("percent75") }}</button>
          <button class="chip" @click="emit('setAmount', 1)">{{ t("max") }}</button>
        </view>
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
      </view>
    </view>

    <view v-else class="station-card jazz-card">
      <view class="station-header">
        <text class="station-title">{{ t("jazzUp") }}</text>
        <text class="station-subtitle">{{ t("jazzSubtitle") }}</text>
      </view>

      <view class="jazz-grid">
        <view class="jazz-item">
          <text class="jazz-label">{{ t("dailyRewards") }}</text>
          <text class="jazz-value">{{ dailyRewards }} {{ t("tokenGas") }}</text>
        </view>
        <view class="jazz-item">
          <text class="jazz-label">{{ t("weeklyRewards") }}</text>
          <text class="jazz-value">{{ weeklyRewards }} {{ t("tokenGas") }}</text>
        </view>
        <view class="jazz-item">
          <text class="jazz-label">{{ t("monthlyRewards") }}</text>
          <text class="jazz-value">{{ monthlyRewards }} {{ t("tokenGas") }}</text>
        </view>
        <view class="jazz-item">
          <text class="jazz-label">{{ t("totalRewards") }}</text>
          <text class="jazz-value">{{ totalRewards }} {{ t("tokenGas") }}</text>
          <text class="jazz-subvalue">{{ totalRewardsUsdText }}</text>
        </view>
      </view>

      <text class="jazz-note">{{ t("jazzNote1") }}</text>
      <text class="jazz-note">{{ t("jazzNote2") }}</text>

      <NeoButton variant="success" size="lg" block :loading="loading" @click="emit('jazzAction')">
        {{ loading ? t("processing") : jazzActionLabel }}
      </NeoButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useI18n } from "@/composables/useI18n";
import { NeoButton } from "@shared/components";

const { t } = useI18n();

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
