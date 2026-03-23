<template>
  <NeoCard variant="erobo" class="streak-card pt-6 pb-6 text-center">
    <div class="streak-flames">
      <span v-for="i in Math.min(currentStreak, 7)" :key="i" class="flame">
        <AppIcon name="flame" :size="32" aria-hidden="true" />
      </span>
      <span v-if="currentStreak === 0" class="flame-empty">
        <AppIcon name="sleeping" :size="32" aria-hidden="true" />
      </span>
    </div>
    <span class="streak-count">{{ currentStreak }} {{ t("dayStreak") }}</span>
    <span class="streak-best">{{ t("bestStreak") }}: {{ highestStreak }} {{ t("days") }}</span>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

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
