<template>
  <NeoCard variant="erobo-neo">
    <div class="type-selector">
      <button
        type="button"
        class="type-btn"
        :aria-label="t('typeSpreading')"
        :class="{ active: envelopeType === 'spreading' }"
        @click="$emit('update:envelopeType', 'spreading')"
      >
        {{ t("typeSpreading") }}
      </button>
      <button
        type="button"
        class="type-btn"
        :aria-label="t('typeLucky')"
        :class="{ active: envelopeType === 'lucky' }"
        @click="$emit('update:envelopeType', 'lucky')"
      >
        {{ t("typeLucky") }}
      </button>
    </div>

    <div class="flow-banner">
      <span class="flow-desc">
        {{ envelopeType === "lucky" ? t("typeLuckyDesc") : t("typeSpreadingDesc") }}
      </span>
      <span class="flow-steps">
        {{ envelopeType === "lucky" ? t("flowBannerLucky") : t("flowBannerSpreading") }}
      </span>
    </div>

    <div class="input-group">
      <NeoInput
        :modelValue="name"
        @update:modelValue="$emit('update:name', $event)"
        :placeholder="t('namePlaceholder')"
        :error="errors.name"
        required
        :aria-label="t('namePlaceholder')"
      />
      <NeoInput
        :modelValue="description"
        @update:modelValue="$emit('update:description', $event)"
        :placeholder="t('defaultBlessing')"
        :aria-label="t('defaultBlessing')"
      />
      <NeoInput
        :modelValue="amount"
        @update:modelValue="$emit('update:amount', $event)"
        type="number"
        :placeholder="t('totalGasPlaceholder')"
        :suffix="t('tokenGas')"
        :error="errors.amount"
        required
        :aria-label="t('totalGasPlaceholder')"
      />
      <NeoInput
        :modelValue="count"
        @update:modelValue="$emit('update:count', $event)"
        type="number"
        :placeholder="t('packetsPlaceholder')"
        :error="errors.count"
        required
        :aria-label="t('packetsPlaceholder')"
      />
      <NeoInput
        :modelValue="expiryHours"
        @update:modelValue="$emit('update:expiryHours', $event)"
        type="number"
        :placeholder="t('expiryPlaceholder')"
        :suffix="t('hoursSuffix')"
        :error="errors.expiryHours"
        required
        :aria-label="t('expiryPlaceholder')"
      />
      <div class="neo-gate-section">
        <span class="section-label">{{ t("neoRequirement") }}</span>
        <NeoInput
          :modelValue="minNeoRequired"
          @update:modelValue="$emit('update:minNeoRequired', $event)"
          type="number"
          :placeholder="t('minNeoPlaceholder')"
          :suffix="t('tokenNeo')"
          :aria-label="t('minNeoPlaceholder')"
        />
        <NeoInput
          :modelValue="minHoldDays"
          @update:modelValue="$emit('update:minHoldDays', $event)"
          type="number"
          :placeholder="t('minHoldDaysPlaceholder')"
          :suffix="t('daysSuffix')"
          :aria-label="t('minHoldDaysPlaceholder')"
        />
      </div>
    </div>
    <NeoButton variant="primary" size="lg" block type="button" :loading="isLoading" :disabled="!isValid || isLoading" @click="handleCreate" class="send-button">
      <div class="btn-content">
        <AppIcon name="envelope" :size="24" />
        <span class="button-text">{{ t("sendRedEnvelope") }}</span>
      </div>
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoInput, NeoButton, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

import type { EnvelopeType } from "@/composables/useRedEnvelopeOpen";

const props = defineProps<{
  name: string;
  description: string;
  amount: string;
  count: string;
  expiryHours: string;
  minNeoRequired: string;
  minHoldDays: string;
  envelopeType: EnvelopeType;
  isLoading: boolean;
}>();

const { t } = createUseI18n(messages)();

const errors = computed(() => {
  const errs: Record<string, string> = {};

  if (!props.name.trim()) {
    errs.name = t("nameRequired");
  }

  const amountNum = Number(props.amount);
  if (!props.amount || isNaN(amountNum) || amountNum <= 0) {
    errs.amount = t("amountRequired");
  }

  const countNum = Number(props.count);
  if (!props.count || isNaN(countNum) || countNum <= 0) {
    errs.count = t("countRequired");
  } else if (countNum > 100) {
    errs.count = t("countExceeded");
  }

  const expiryNum = Number(props.expiryHours);
  if (!props.expiryHours || isNaN(expiryNum) || expiryNum <= 0) {
    errs.expiryHours = t("expiryRequired");
  }

  return errs;
});

const isValid = computed(() => {
  return (
    props.name.trim().length > 0 &&
    Number(props.amount) > 0 &&
    Number(props.count) > 0 &&
    Number(props.count) <= 100 &&
    Number(props.expiryHours) > 0
  );
});

const emit = defineEmits<{
  (e: "update:envelopeType", value: "spreading" | "lucky"): void;
  (e: "update:name", value: string): void;
  (e: "update:description", value: string): void;
  (e: "update:amount", value: string): void;
  (e: "update:count", value: string): void;
  (e: "update:expiryHours", value: string): void;
  (e: "update:minNeoRequired", value: string): void;
  (e: "update:minHoldDays", value: string): void;
  (e: "create"): void;
}>();

const handleCreate = () => {
  // Trigger validation display by accessing errors
  if (!isValid.value) {
    return;
  }
  emit("create");
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.type-selector {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.type-btn {
  flex: 1;
  height: 44px;
  padding: 0 12px;
  border-radius: 10px;
  border: 1px solid var(--red-envelope-gold-border);
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;

  &:focus-visible {
    outline: 2px solid var(--envelope-gold);
    outline-offset: 2px;
    box-shadow: 0 0 0 4px rgba(255, 222, 89, 0.15);
  }

  &.active {
    background: linear-gradient(135deg, var(--envelope-gold) 0%, var(--envelope-gold-dark) 100%);
    color: var(--envelope-premium-red-dark);
    border-color: var(--envelope-gold);
    box-shadow: 0 2px 8px var(--red-envelope-gold-glow);
  }
}

.flow-banner {
  margin-bottom: 20px;
  padding: 12px 16px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 10px;
  border: 1px solid var(--red-envelope-gold-glow);
  text-align: center;
}

.flow-desc {
  display: block;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.6);
  margin-bottom: 6px;
}

.flow-steps {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--envelope-gold);
  letter-spacing: 0.02em;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 32px;
}

@media (max-width: 480px) {
  .input-group {
    gap: 16px;
    margin-bottom: 24px;
  }

  .type-selector {
    gap: 6px;
    margin-bottom: 12px;
  }

  .type-btn {
    padding: 8px 10px;
    font-size: 13px;
  }

  .flow-banner {
    padding: 10px 12px;
    margin-bottom: 16px;
  }

  .neo-gate-section {
    padding: 12px;
  }

  .button-text {
    font-size: 14px;
  }
}

.neo-gate-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid var(--red-envelope-gold-glow);
}

.section-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--envelope-gold);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

:deep(.neo-input) {
  background: rgba(255, 255, 255, 0.9) !important;
  border-color: transparent !important;
  color: var(--envelope-premium-red-dark) !important;

  &:focus-within {
    border-color: var(--envelope-gold) !important;
    box-shadow: 0 0 0 2px var(--red-envelope-gold-border) !important;
  }

  // Error state should show red border even when focused
  &.neo-input--error:focus-within {
    border-color: var(--input-error-color) !important;
    box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.2) !important;
  }
}

.send-button {
  background: linear-gradient(135deg, var(--envelope-gold) 0%, var(--envelope-gold-dark) 100%) !important;
  border: none !important;
  box-shadow: 0 4px 15px var(--red-envelope-gold-glow) !important;

  &:active {
    transform: translateY(2px);
    box-shadow: 0 2px 10px var(--red-envelope-gold-glow) !important;
  }
}

.btn-content {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--envelope-premium-red-dark); /* Contrast text on gold button */
}

.button-text {
  font-weight: 800;
  text-transform: uppercase;
  font-family: $font-family;
  letter-spacing: 0.05em;
  font-size: 16px;
  color: var(--envelope-premium-red-dark);
}
</style>
