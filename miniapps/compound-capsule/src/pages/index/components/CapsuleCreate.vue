<template>
  <NeoCard class="deposit-card" variant="erobo-neo">
    <view class="lock-period-selector">
      <text class="selector-label">{{ t("lockPeriod") }}</text>
      <view class="period-options">
        <view
          v-for="period in lockPeriods"
          :key="period.days"
          :class="['period-option-glass', { active: modelValue === period.days }]"
          @click="$emit('update:modelValue', period.days)"
        >
          <text class="period-days">{{ period.days }}{{ t("daysShort") }}</text>
        </view>
      </view>
    </view>

    <view class="projected-returns-glass">
      <text class="returns-label">{{ t("unlockDate") }}</text>
      <view class="returns-display">
        <text class="returns-value">{{ unlockDateLabel }}</text>
      </view>
    </view>

    <NeoInput v-model="amount" type="number" :placeholder="t('amountPlaceholder')" suffix="NEO" />
    <NeoButton variant="primary" size="lg" block :loading="isLoading" @click="$emit('create')">
      {{ isLoading ? t("processing") : t("deposit") }}
    </NeoButton>
    <text class="note">{{ t("minLock", { days: MIN_LOCK_DAYS }) }}</text>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const props = defineProps<{
  modelValue: number;
  isLoading: boolean;
  minLockDays: number;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: number): void;
  (e: "create"): void;
}>();

const { t, locale } = useI18n();

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
