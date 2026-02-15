<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
      <view class="input-section">
        <text class="input-label-glass">{{ t("selectDeveloper") }}</text>
        <view class="dev-selector">
          <view
            v-for="dev in developers"
            :key="dev.id"
            :class="['dev-select-item-glass', { active: modelValue === dev.id }]"
            @click="$emit('update:modelValue', dev.id)"
          >
            <text class="dev-select-name-glass">{{ dev.name }}</text>
            <text class="dev-select-role-glass">{{ dev.role }}</text>
          </view>
        </view>
      </view>

      <view class="input-section">
        <text class="input-label-glass">{{ t("tipAmount") }}</text>
        <view class="preset-amounts">
          <view
            v-for="preset in presetAmounts"
            :key="preset"
            :class="['preset-btn-glass', { active: amount === preset.toString() }]"
            @click="$emit('update:amount', preset.toString())"
          >
            <text class="preset-value-glass">{{ preset }}</text>
            <text class="preset-unit-glass">GAS</text>
          </view>
        </view>
        <NeoInput
          :modelValue="amount"
          @update:modelValue="$emit('update:amount', $event)"
          type="number"
          :placeholder="t('customAmount')"
          suffix="GAS"
        />
      </view>

      <view class="input-section">
        <text class="input-label-glass">{{ t("optionalMessage") }}</text>
        <NeoInput
          :modelValue="message"
          @update:modelValue="$emit('update:message', $event)"
          :placeholder="t('messagePlaceholder')"
        />
      </view>

      <view class="input-section">
        <text class="input-label-glass">{{ t("tipperName") }}</text>
        <NeoInput
          :modelValue="tipperName"
          @update:modelValue="$emit('update:tipperName', $event)"
          :placeholder="t('tipperNamePlaceholder')"
          :disabled="anonymous"
        />
      </view>

      <view class="input-section">
        <text class="input-label-glass">{{ t("anonymousLabel") }}</text>
        <view class="toggle-row">
          <NeoButton size="sm" :variant="anonymous ? 'primary' : 'secondary'" @click="$emit('update:anonymous', true)">
            {{ t("anonymousOn") }}
          </NeoButton>
          <NeoButton size="sm" :variant="anonymous ? 'secondary' : 'primary'" @click="$emit('update:anonymous', false)">
            {{ t("anonymousOff") }}
          </NeoButton>
        </view>
      </view>

      <NeoButton variant="primary" size="lg" block :loading="isLoading" :disabled="!canSubmit" @click="$emit('submit')">
        <text v-if="!isLoading">💚 {{ t("sendTipBtn") }}</text>
        <text v-else>{{ t("sending") }}</text>
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { Developer } from "../composables/useDevTippingStats";

const { t } = createUseI18n(messages)();

interface Props {
  developers: Developer[];
  modelValue: number | null;
  amount: string;
  message: string;
  tipperName: string;
  anonymous: boolean;
  isLoading: boolean;
}

const props = defineProps<Props>();

defineEmits<{
  "update:modelValue": [value: number];
  "update:amount": [value: string];
  "update:message": [value: string];
  "update:tipperName": [value: string];
  "update:anonymous": [value: boolean];
  submit: [];
}>();

const presetAmounts = [1, 2, 5, 10];

const canSubmit = computed(() => {
  return props.modelValue !== null && props.amount && !props.isLoading;
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.input-label-glass {
  @include stat-label;
  color: var(--cafe-text);
  letter-spacing: 0.05em;
  margin-bottom: 6px;
  display: block;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-section {
  display: flex;
  flex-direction: column;
}

.toggle-row {
  display: flex;
  gap: 10px;
}

.dev-selector {
  max-height: 200px;
  overflow-y: auto;
}

.dev-select-item-glass {
  padding: 12px;
  background: var(--cafe-input-bg);
  border-radius: 8px;
  margin-bottom: 8px;
  border: 1px solid transparent;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;

  &.active {
    border-color: var(--cafe-neon);
    background: var(--cafe-panel-hover);
  }
}

.dev-select-name-glass {
  @include mono-number;
  color: var(--cafe-text-strong);
}

.dev-select-role-glass {
  color: var(--cafe-muted);
  font-size: 10px;
}

.preset-amounts {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 12px;
}

.preset-btn-glass {
  flex: 1;
  background: var(--cafe-input-bg);
  border: 1px solid var(--cafe-panel-border);
  border-radius: 8px;
  padding: 10px;
  text-align: center;

  &.active {
    background: var(--cafe-neon);
    border-color: var(--cafe-neon);
    color: var(--cafe-preset-active-text);
    box-shadow: var(--cafe-neon-glow);
    .preset-value-glass,
    .preset-unit-glass {
      color: var(--cafe-preset-active-text);
    }
  }
}

.preset-value-glass {
  font-size: 16px;
  font-weight: bold;
  color: var(--cafe-text-strong);
}

.preset-unit-glass {
  font-size: 10px;
  color: var(--cafe-muted);
}
</style>
