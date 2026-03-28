<template>
  <NeoCard variant="erobo" :title="t('quickActions')">
    <NeoButton size="sm" variant="primary" class="op-btn" type="button" @click="$emit('create')">
      {{ t("createProposal") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  create: [];
}>();
</script>

<style lang="scss" scoped>
.op-btn {
  width: 100%;
}
</style>
