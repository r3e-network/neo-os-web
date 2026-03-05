<template>
  <view class="app-container">
    <NeoCard variant="accent" class="glass-container">
      <view class="send-form">
        <text class="form-subtitle">{{ t("sendSubtitle") }}</text>
        <view class="input-section">
          <text class="input-label">{{ t("recipientAddress") }}</text>
          <NeoInput
            :model-value="recipient"
            @update:model-value="$emit('update:recipient', $event)"
            :placeholder="t('recipientPlaceholder')"
          />
        </view>
        <view class="input-section">
          <text class="input-label">{{ t("sendAmount") }}</text>
          <view class="preset-amounts">
            <view
              v-for="amt in presets"
              :key="amt"
              :class="['preset-btn glass-btn', { active: amount === amt.toString() }]"
              @click="$emit('update:amount', amt.toString())"
            >
              <text class="preset-value">{{ amt }}</text>
              <text class="preset-unit">GAS</text>
            </view>
          </view>
          <NeoInput
            :model-value="amount"
            @update:model-value="$emit('update:amount', $event)"
            type="number"
            placeholder="0.1"
            suffix="GAS"
          />
        </view>
        <NeoButton variant="primary" size="lg" block :loading="loading" @click="$emit('send')">
          {{ loading ? t("sending") : t("sendBtn") }}
        </NeoButton>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  recipient: string;
  amount: string;
  loading: boolean;
}>();

defineEmits<{
  "update:recipient": [value: string];
  "update:amount": [value: string];
  send: [];
}>();

const { t } = createUseI18n(messages)();
const presets = [0.05, 0.1, 0.2, 0.5];
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;
@import "../gas-sponsor-theme.scss";

.app-container {
  padding: 24px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 24px;
  background-color: var(--gas-bg);
  background-image:
    linear-gradient(var(--gas-grid) 1px, transparent 1px), linear-gradient(90deg, var(--gas-grid) 1px, transparent 1px);
  background-size: 40px 40px;
  box-shadow: inset 0 0 100px var(--gas-inset-shadow);
}

.send-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-subtitle {
  @include stat-label;
  font-weight: 800;
  font-size: 14px;
  color: var(--gas-accent);
  margin-bottom: 4px;
  text-shadow: 0 0 8px var(--gas-accent-glow);
}

.input-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  @include stat-label;
  font-size: 10px;
  color: var(--gas-accent-secondary);
  letter-spacing: 0.05em;
  text-shadow: var(--gas-status-shadow);
}

.preset-amounts {
  @include grid-layout(4, 12px);
  margin-bottom: 12px;
}

.preset-btn {
  padding: 16px 8px;
  background: var(--gas-preset-bg);
  border: 1px solid var(--gas-preset-border);
  border-radius: 4px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.25, 0.8, 0.25, 1);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  backdrop-filter: blur(5px);

  &:hover {
    background: var(--gas-preset-hover-bg);
    border-color: var(--gas-preset-hover-border);
    transform: translateY(-2px);
  }

  &.active {
    background: var(--gas-preset-active-bg);
    border-color: var(--gas-accent);
    box-shadow: var(--gas-preset-active-shadow);
    .preset-value {
      color: var(--gas-preset-active-text);
    }
  }
}

.preset-value {
  font-weight: 800;
  font-size: 18px;
  color: var(--gas-text);
  font-family: $font-mono;
}

.preset-unit {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  opacity: 0.7;
  color: var(--gas-accent-secondary);
}
</style>
