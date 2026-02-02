<template>
  <NeoCard variant="erobo" class="streak-card pt-6 pb-6 text-center">
    <view class="streak-flames">
      <text v-for="i in Math.min(currentStreak, 7)" :key="i" class="flame">🔥</text>
      <text v-if="currentStreak === 0" class="flame-empty">💤</text>
    </view>
    <text class="streak-count">{{ currentStreak }} {{ t("dayStreak") }}</text>
    <text class="streak-best">{{ t("bestStreak") }}: {{ highestStreak }} {{ t("days") }}</text>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

const { t } = useI18n();

defineProps<{
  currentStreak: number;
  highestStreak: number;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;



.streak-flames {
  font-size: 32px;
  margin-bottom: 16px;
  letter-spacing: 4px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.flame-empty { opacity: 0.5; }

.streak-count {
  display: block;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 4px;
  font-family: $font-family;
  text-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
}

.streak-best {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}
</style>
