<template>
  <NeoCard v-if="createdVaultId" variant="erobo" class="vault-created">
    <span class="vault-created-label">{{ t("vaultCreated") }}</span>
    <span class="vault-created-id">#{{ createdVaultId }}</span>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string, params?: Record<string, string | number>) => string;
  createdVaultId: string | number | null;
}>();
</script>

<style lang="scss" scoped>
.vault-created {
  text-align: center;
}

.vault-created-label {
  font-size: 12px;
  text-transform: uppercase;
  color: var(--vault-text-muted, rgba(255, 255, 255, 0.5));
}

.vault-created-id {
  font-size: 32px;
  font-weight: 800;
  color: var(--vault-text-strong, var(--text-primary));
  margin-top: 8px;
}
</style>
