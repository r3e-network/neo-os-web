<template>
  <div class="health-dashboard">
    <StatsDisplay :items="stats" layout="grid" />

    <NeoCard variant="erobo" class="balance-card">
      <div class="section-header">
        <span class="section-title">{{ t("sectionBalances") }}</span>
        <NeoButton size="sm" variant="secondary" type="button" :loading="isRefreshing" @click="$emit('refresh')" :aria-label="t('refresh')">
          {{ t("refresh") }}
        </NeoButton>
      </div>

      <div class="balance-grid">
        <div class="balance-item">
          <span class="balance-label">{{ t("tokenNeo") }}</span>
          <span class="balance-value">{{ neoDisplay }}</span>
        </div>
        <div class="balance-item">
          <span class="balance-label">{{ t("tokenGas") }}</span>
          <span class="balance-value">{{ gasDisplay }}</span>
        </div>
      </div>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { StatsDisplay, NeoCard, NeoButton } from "@shared/components";
import type { StatsDisplayItem } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

defineProps<{
  stats: StatsDisplayItem[];
  neoDisplay: string;
  gasDisplay: string;
  isRefreshing: boolean;
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  (e: "refresh"): void;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.health-dashboard {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  @include section-header;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.balance-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.balance-grid {
  @include grid-layout(2, 12px);
}

.balance-item {
  background: var(--bg-card-subtle, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  border-radius: 16px;
  padding: 12px;
}

.balance-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--health-muted);
}

.balance-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--health-accent-strong);
}

@media (max-width: 767px) {
  .section-title {
    font-size: 16px;
  }
  .balance-grid {
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .balance-value {
    font-size: 16px;
  }
}

@media (max-width: 480px) {
  .balance-item {
    padding: 10px;
    border-radius: 12px;
  }

  .balance-value {
    font-size: 14px;
  }

  .balance-label {
    font-size: 10px;
  }
}
</style>
