<template>
  <div class="action-buttons">
    <NeoButton type="button" variant="primary" size="lg" block :loading="isLoading" :disabled="hasDrawn" @click="$emit('draw')">
      {{ t("drawingCards") }}
    </NeoButton>
    <NeoButton type="button" v-if="hasDrawn" variant="secondary" size="lg" block @click="$emit('reset')">
      {{ t("reset") }}
    </NeoButton>
  </div>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  isLoading: boolean;
  hasDrawn: boolean;
}>();

defineEmits<{
  draw: [];
  reset: [];
}>();
</script>

<style lang="scss" scoped>
.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 400px;
}
</style>
