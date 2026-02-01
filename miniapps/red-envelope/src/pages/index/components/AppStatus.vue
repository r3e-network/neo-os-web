<template>
  <NeoCard v-if="status" :variant="status.type === 'success' ? 'success' : 'danger'" class="status-card">
    <text class="status-text">{{ status.msg }}</text>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  status: { msg: string; type: "success" | "error" } | null;
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.status-card { 
  text-align: center; 
  margin-bottom: 24px; 
}
.status-text { 
  font-weight: 700; 
  font-size: 12px; 
  text-transform: uppercase; 
}
</style>
