<template>
  <NeoCard variant="erobo" class="operation-box" :aria-label="t(config.titleKey)" role="region">
    <!-- Header -->
    <template #header>
      <view class="operation-box__header">
        <text class="operation-box__title">{{ t(config.titleKey) }}</text>
        <text v-if="config.descriptionKey" class="operation-box__desc">
          {{ t(config.descriptionKey) }}
        </text>
      </view>
    </template>

    <!-- Fields -->
    <view class="operation-box__fields">
      <template v-for="field in config.fields" :key="field.key">
        <!-- Toggle field -->
        <view v-if="field.type === 'toggle'" class="operation-box__toggle-group">
          <text class="operation-box__field-label">{{ t(field.labelKey) }}</text>
          <view class="toggle-options">
            <button
              v-for="opt in field.options"
              :key="opt.value"
              :class="['toggle-btn', { 'toggle-btn--active': form.values[field.key] === opt.value }]"
              :disabled="disabled"
              @click="form.setFieldValue(field.key, opt.value)"
            >
              {{ t(opt.labelKey) }}
            </button>
          </view>
          <text v-if="form.errors[field.key]" class="field-error">
            {{ t(form.errors[field.key]) }}
          </text>
        </view>

        <!-- Select field -->
        <view v-else-if="field.type === 'select'" class="operation-box__select-group">
          <text class="operation-box__field-label">{{ t(field.labelKey) }}</text>
          <select
            :value="form.values[field.key]"
            :disabled="disabled"
            class="operation-box__select"
            @change="form.setFieldValue(field.key, ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="opt in field.options" :key="opt.value" :value="opt.value">
              {{ t(opt.labelKey) }}
            </option>
          </select>
          <text v-if="form.errors[field.key]" class="field-error">
            {{ t(form.errors[field.key]) }}
          </text>
        </view>

        <!-- Amount / Number / Text / Address fields -->
        <NeoInput
          v-else
          :model-value="String(form.values[field.key] ?? '')"
          :label="t(field.labelKey)"
          :placeholder="field.placeholderKey ? t(field.placeholderKey) : undefined"
          :type="field.type === 'amount' || field.type === 'number' ? 'number' : 'text'"
          :suffix="field.type === 'amount' ? 'GAS' : undefined"
          :error="form.errors[field.key] ? t(form.errors[field.key]) : undefined"
          :disabled="disabled"
          @update:model-value="form.setFieldValue(field.key, $event)"
        />
      </template>
    </view>

    <!-- Summary -->
    <view v-if="config.summaryKeys?.length" class="operation-box__summary">
      <view v-for="row in config.summaryKeys" :key="row.labelKey" class="summary-row">
        <text class="summary-label">{{ t(row.labelKey) }}</text>
        <text class="summary-value">{{ formatSummaryValue(row) }}</text>
      </view>
    </view>

    <!-- Action -->
    <template #footer>
      <view class="operation-box__action">
        <!-- Idle / Confirming -->
        <NeoButton
          v-if="txState === 'idle' || txState === 'confirming'"
          variant="primary"
          block
          size="lg"
          :disabled="disabled || !form.isValid.value"
          @click="$emit('submit')"
        >
          {{ t(config.actionKey) }}
        </NeoButton>

        <!-- Pending -->
        <NeoButton v-else-if="txState === 'pending'" variant="primary" block size="lg" loading disabled>
          {{ t(config.actionKey) }}
        </NeoButton>

        <!-- Success -->
        <view v-else-if="txState === 'success'" class="tx-status tx-status--success">
          <text class="tx-status__icon">✓</text>
          <text class="tx-status__label">{{ t("confirmed") }}</text>
          <text v-if="txHash" class="tx-status__hash"> {{ txHash.slice(0, 8) }}...{{ txHash.slice(-6) }} </text>
          <NeoButton variant="ghost" size="sm" @click="$emit('reset')">
            {{ t("newTransaction") }}
          </NeoButton>
        </view>

        <!-- Error -->
        <view v-else-if="txState === 'error'" class="tx-status tx-status--error">
          <text class="tx-status__label">{{ txError }}</text>
          <NeoButton variant="danger" size="sm" @click="$emit('submit')">
            {{ t("retry") }}
          </NeoButton>
        </view>
      </view>
    </template>
  </NeoCard>
</template>

<script setup lang="ts">
import type { OperationBoxConfig, StatConfig } from "@shared/types/template-config";
import type { FormState } from "@shared/composables/useFormState";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";

const props = defineProps<{
  /** Operation box configuration */
  config: OperationBoxConfig;
  /** Form state from useOperationState */
  form: FormState<Record<string, unknown>>;
  /** Transaction lifecycle state */
  txState: string;
  /** Transaction hash on success */
  txHash: string;
  /** Transaction error message */
  txError: string;
  /** i18n translation function */
  t: (key: string) => string;
  /** App state for resolving summary values */
  state: Record<string, unknown>;
  /** Disable all inputs */
  disabled?: boolean;
}>();

defineEmits<{
  (e: "submit"): void;
  (e: "reset"): void;
}>();

const formatSummaryValue = (row: { valueKey: string; format?: StatConfig["format"] }) => {
  const raw = props.state[row.valueKey] ?? 0;
  switch (row.format) {
    case "currency":
      return `${Number(raw).toFixed(2)} GAS`;
    case "percent":
      return `${Number(raw).toFixed(1)}%`;
    case "number":
      return Number(raw).toLocaleString();
    default:
      return String(raw);
  }
};
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.operation-box {
  &__header {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  &__title {
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary, #fff);
  }

  &__desc {
    font-size: 12px;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    line-height: 1.4;
  }

  &__fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  &__field-label {
    font-size: 11px;
    font-weight: 700;
    color: var(--text-secondary, rgba(255, 255, 255, 0.6));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 6px;
    display: block;
  }

  &__toggle-group {
    display: flex;
    flex-direction: column;
  }

  &__select-group {
    display: flex;
    flex-direction: column;
  }

  &__select {
    height: 50px;
    padding: 0 16px;
    background: var(--bg-card, rgba(255, 255, 255, 0.05));
    border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
    border-radius: 18px;
    color: var(--text-primary, #fff);
    font-size: 14px;
    font-family: $font-family;
    cursor: pointer;

    &:focus {
      border-color: rgba(159, 157, 243, 0.6);
      outline: none;
    }

    option {
      background: #1b1b2f;
      color: #fff;
    }
  }

  &__summary {
    margin-top: 16px;
    padding: 12px 0;
    border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  &__action {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
}

.toggle-options {
  display: flex;
  gap: 8px;
}

.toggle-btn {
  flex: 1;
  height: 44px;
  border-radius: 12px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  background: var(--bg-card, rgba(255, 255, 255, 0.03));
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  font-size: 13px;
  font-weight: 600;
  font-family: $font-family;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.08);
    border-color: rgba(159, 157, 243, 0.3);
  }

  &--active {
    background: linear-gradient(135deg, rgba(159, 157, 243, 0.2) 0%, rgba(247, 170, 199, 0.15) 100%);
    border-color: rgba(159, 157, 243, 0.5);
    color: var(--text-primary, #fff);
    box-shadow: 0 0 15px rgba(159, 157, 243, 0.2);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}

.summary-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary, #fff);
}

.field-error {
  font-size: 11px;
  color: #ef4444;
  font-weight: 600;
  margin-top: 4px;
}

@media (prefers-reduced-motion: reduce) {
  .toggle-btn {
    transition: none;
  }
}

.tx-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px 0;

  &--success {
    .tx-status__icon {
      font-size: 24px;
      color: #10b981;
    }
    .tx-status__label {
      color: #10b981;
      font-weight: 600;
    }
  }

  &--error {
    .tx-status__label {
      color: #ef4444;
      font-size: 12px;
      text-align: center;
    }
  }

  &__hash {
    font-size: 11px;
    color: var(--text-muted, rgba(255, 255, 255, 0.4));
    font-family: monospace;
  }
}
</style>
