<template>
  <NeoCard icon="folder">
    <div v-if="domains.length === 0" class="empty-state">
      <span>{{ t("noDomains") }}</span>
    </div>
    <div v-for="domain in domains" :key="domain.name" class="domain-item mb-4 border-b border-gray-200 pb-4">
      <div class="domain-card-header mb-2 flex justify-between">
        <div class="domain-info">
          <span class="domain-name text-lg font-bold">{{ domain.name }}</span>
          <span class="domain-expiry text-sm text-gray-500">{{ t("expires") }}: {{ formatDate(domain.expiry) }}</span>
        </div>
        <div class="domain-status-indicator active"></div>
      </div>
      <div class="domain-actions flex gap-2">
        <NeoButton size="sm" variant="secondary" @click="$emit('manage', domain)">{{ t("manage") }}</NeoButton>
        <NeoButton size="sm" variant="primary" @click="$emit('renew', domain)">{{ t("renew") }}</NeoButton>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { Domain } from "@/types";

defineProps<{
  domains: Domain[];
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  (e: "manage", domain: Domain): void;
  (e: "renew", domain: Domain): void;
}>();

const formatDate = (ts: number): string => {
  return new Date(ts).toLocaleDateString("en");
};
</script>

<style lang="scss" scoped>
.domain-item {
  padding: 20px;
  margin-bottom: 16px;
}
.domain-info {
  margin-bottom: 16px;
  border-left: 3px solid var(--dir-card-border);
  padding-left: 16px;
}
.domain-name {
  font-weight: 700;
  font-size: 20px;
  display: block;
  text-transform: uppercase;
  margin-bottom: 4px;
}
.domain-expiry {
  font-size: 12px;
  font-weight: 500;
  opacity: 0.8;
}
.domain-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}
.empty-state {
  text-align: center;
  padding: 48px;
  border: 1px dashed var(--dir-card-border);
}
</style>
