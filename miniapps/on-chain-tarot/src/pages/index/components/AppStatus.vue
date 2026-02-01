<template>
  <NeoCard v-if="status" :variant="getVariant(status.type)" class="status-card mb-4 text-center">
    <text class="status-text-glass">{{ status.msg }}</text>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import type { CardVariant } from "@shared/components/NeoCard.vue";

const props = defineProps<{
  status: { msg: string; type: string } | null;
}>();

const getVariant = (type: string): CardVariant => {
  if (type === "error") return "danger";
  if (type === "loading") return "warning";
  return "erobo-neo";
};
</script>

<style lang="scss" scoped>
.status-text-glass {
  font-weight: 700;
  text-transform: uppercase;
  font-size: 14px;
  letter-spacing: 0.05em;
  color: var(--text-primary);
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
}
.mb-4 { margin-bottom: 16px; }
</style>
