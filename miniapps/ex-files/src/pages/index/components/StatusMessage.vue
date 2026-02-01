<template>
  <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
    <text class="status-msg font-bold">{{ status.msg }}</text>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  status: { msg: string; type: string } | null;
}>();
</script>

<style scoped>
.status-msg {
  color: var(--text-primary);
  text-transform: uppercase;
  font-size: 13px;
  letter-spacing: 0.05em;
}
</style>
