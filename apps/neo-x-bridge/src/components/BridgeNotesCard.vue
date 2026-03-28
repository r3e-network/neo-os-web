<template>
  <NeoCard variant="erobo-neo" class="notes-card">
    <span class="notes-title">{{ t("bridgeNotes") }}</span>
    <p class="notes-text">{{ t("bridgeNotesText") }}</p>
    <p class="notes-text">{{ t("walletNoticeText") }}</p>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
}>();
</script>

<style lang="scss" scoped>
.notes-card {
  width: 100%;
}

.notes-title {
  display: block;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.notes-text {
  font-size: 13px;
  line-height: 1.6;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 8px;

  &:last-child {
    margin-bottom: 0;
  }
}
</style>
