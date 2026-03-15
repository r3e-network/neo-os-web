<template>
  <NeoCard class="deposit-card" variant="erobo-neo">
    <div class="lock-period-selector">
      <span class="selector-label">{{ t("lockPeriod") }}</span>
      <div class="period-options">
        <div
          v-for="period in lockPeriods"
          :key="period.days"
          :class="['period-option-glass', { active: modelValue === period.days }]"
          @click="$emit('update:modelValue', period.days)"
        >
          <span class="period-days">{{ period.days }}{{ t("daysShort") }}</span>
        </div>
      </div>
    </div>

    <div class="projected-returns-glass">
      <span class="returns-label">{{ t("unlockDate") }}</span>
      <div class="returns-display">
        <span class="returns-value">{{ unlockDateLabel }}</span>
      </div>
    </div>

    <NeoInput v-model="amount" type="number" :placeholder="t('amountPlaceholder')" suffix="NEO" />
    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('create')">
      {{ isLoading ? t("processing") : t("deposit") }}
    </NeoButton>
    <span class="note">{{ t("minLock", { days: MIN_LOCK_DAYS }) }}</span>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const props = defineProps<{
  modelValue: number;
  isLoading: boolean;
  minLockDays: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
  (e: "create"): void;
}>();

const { t, locale } = createUseI18n(messages)();

const amount = ref("");
const lockPeriods = [{ days: 7 }, { days: 30 }, { days: 90 }, { days: 180 }];
const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_LOCK_DAYS = 7;

const resolveDateLocale = () => (locale.value === "zh" ? "zh-CN" : "en-US");
const unlockDateLabel = computed(() => {
  const unlockTime = Date.now() + props.modelValue * DAY_MS;
  return new Date(unlockTime).toLocaleDateString(resolveDateLocale(), {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
});
</script>
