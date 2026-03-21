<template>
  <NeoCard variant="erobo-neo">
    <div class="form-group">
      <div class="input-section">
        <span class="input-label-glass">{{ t("selectDeveloper") }}</span>
        <div class="dev-selector">
          <button
            type="button"
            v-for="dev in developers"
            :key="dev.id"
            :class="['dev-select-item-glass', { active: modelValue === dev.id }]"
            :aria-label="dev.name + ' - ' + dev.role"
            @click="$emit('update:modelValue', dev.id)"
          >
            <span class="dev-select-name-glass">{{ dev.name }}</span>
            <span class="dev-select-role-glass">{{ dev.role }}</span>
          </button>
        </div>
      </div>

      <div class="input-section">
        <span class="input-label-glass">{{ t("tipAmount") }}</span>
        <div class="preset-amounts">
          <button
            type="button"
            v-for="preset in presetAmounts"
            :key="preset"
            :class="['preset-btn-glass', { active: amount === preset.toString() }]"
            :aria-label="preset + ' ' + t('tokenGas')"
            @click="$emit('update:amount', preset.toString())"
          >
            <span class="preset-value-glass">{{ preset }}</span>
            <span class="preset-unit-glass">{{ t("tokenGas") }}</span>
          </button>
        </div>
        <NeoInput
          :modelValue="amount"
          @update:modelValue="$emit('update:amount', $event)"
          type="number"
          :placeholder="t('customAmount')"
          :suffix="t('tokenGas')"
        />
      </div>

      <div class="input-section">
        <span class="input-label-glass">{{ t("optionalMessage") }}</span>
        <NeoInput
          :modelValue="message"
          @update:modelValue="$emit('update:message', $event)"
          :placeholder="t('messagePlaceholder')"
        />
      </div>

      <div class="input-section">
        <span class="input-label-glass">{{ t("tipperName") }}</span>
        <NeoInput
          :modelValue="tipperName"
          @update:modelValue="$emit('update:tipperName', $event)"
          :placeholder="t('tipperNamePlaceholder')"
          :disabled="anonymous"
        />
      </div>

      <div class="input-section">
        <span class="input-label-glass">{{ t("anonymousLabel") }}</span>
        <div class="toggle-row">
          <NeoButton size="sm" type="button" :variant="anonymous ? 'primary' : 'secondary'" :aria-label="t('anonymousOn')" @click="$emit('update:anonymous', true)">
            {{ t("anonymousOn") }}
          </NeoButton>
          <NeoButton size="sm" type="button" :variant="anonymous ? 'secondary' : 'primary'" :aria-label="t('anonymousOff')" @click="$emit('update:anonymous', false)">
            {{ t("anonymousOff") }}
          </NeoButton>
        </div>
      </div>

      <NeoButton variant="primary" size="lg" block type="button" :loading="isLoading" :disabled="!canSubmit" :aria-label="t('sendTipBtn')" @click="$emit('submit')">
        <span v-if="!isLoading"><span aria-hidden="true">💚</span> {{ t("sendTipBtn") }}</span>
        <span v-else>{{ t("sending") }}</span>
      </NeoButton>
    </div>
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

@media (max-width: 480px) {
  .dev-selector {
    max-height: 150px;
  }

  .preset-amounts {
    gap: 6px;
    flex-wrap: wrap;
  }

  .preset-btn-glass {
    flex: 1 1 calc(50% - 4px);
    min-width: 60px;
  }
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
  appearance: none;
  font-family: inherit;
  width: 100%;
  text-align: left;

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
  appearance: none;
  font-family: inherit;
  cursor: pointer;

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
