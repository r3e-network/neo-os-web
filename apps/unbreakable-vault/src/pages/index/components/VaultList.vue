<template>
  <NeoCard variant="erobo" class="recent-vaults">
    <span class="section-title">{{ title }}</span>
    <ItemList :items="vaults" item-key="id" :empty-text="emptyText">
      <template #item="{ item: vault }">
        <button
          type="button"
          class="vault-item"
          :aria-label="t('vaultLabel', { id: vault.id })"
          @click="$emit('select', vault.id)"
        >
          <div class="vault-meta">
            <span class="vault-id">#{{ vault.id }}</span>
            <span class="vault-bounty">{{ formatGas(vault.bounty) }} {{ t("tokenGas") }}</span>
          </div>
          <span class="vault-creator mono">{{
            vault.creator ? formatAddress(vault.creator) : formatDate(vault.created)
          }}</span>
        </button>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";
import { formatAddress, formatGas } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

interface Vault {
  id: string;
  creator?: string;
  bounty: number;
  created?: number;
}

defineProps<{
  title: string;
  emptyText: string;
  vaults: Vault[];
}>();

defineEmits<{
  (e: "select", id: string): void;
}>();

const { t } = createUseI18n(messages)();

const formatDate = (ts?: number): string => {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("en");
};
</script>

<style lang="scss" scoped>
.recent-vaults {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.section-title {
  font-size: 14px;
  font-weight: 800;
  margin-bottom: 8px;
}
.vault-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.vault-item {
  padding: 16px;
  border-radius: 16px;
  background: var(--vault-bg);
  cursor: pointer;
  transition: transform 0.1s;
  border: none;
  appearance: none;
  width: 100%;
  text-align: left;
}
.vault-meta {
  display: flex;
  justify-content: space-between;
  font-weight: 700;
}
.vault-id {
  font-size: 14px;
}
.vault-bounty {
  font-size: 14px;
  color: var(--vault-accent);
}
.vault-creator {
  font-size: 12px;
  color: var(--vault-text-subtle);
  margin-top: 6px;
}
.empty-state {
  text-align: center;
  padding: 24px;
  opacity: 0.5;
}
.empty-text {
  font-size: 13px;
  font-style: italic;
}
.mono {
  font-family: monospace;
}
</style>
