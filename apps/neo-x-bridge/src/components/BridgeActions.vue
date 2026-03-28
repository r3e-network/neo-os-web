<template>
  <div class="action-row">
    <NeoButton variant="primary" type="button" block @click="$emit('openBridge')">
      {{ t("officialBridge") }}
    </NeoButton>
    <NeoButton variant="secondary" type="button" block @click="$emit('addWallet')">
      {{ t("addWallet") }}
    </NeoButton>
    <NeoButton variant="secondary" type="button" block @click="$emit('openExplorer')">
      {{ t("openExplorer") }}
    </NeoButton>
    <NeoButton variant="secondary" type="button" block @click="$emit('openDocs')">
      {{ t("openDocs") }}
    </NeoButton>
  </div>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  openBridge: [];
  addWallet: [];
  openExplorer: [];
  openDocs: [];
}>();
</script>

<style lang="scss" scoped>
.action-row {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
