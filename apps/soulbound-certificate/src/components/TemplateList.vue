<template>
  <NeoCard variant="erobo" class="template-list">
    <div class="templates-header">
      <span class="section-title">{{ t("yourTemplates") }}</span>
      <NeoButton size="sm" variant="secondary" :loading="refreshing" @click="$emit('refresh')">
        {{ t("refresh") }}
      </NeoButton>
    </div>

    <div v-if="!hasAddress" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center">
        <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
        <NeoButton size="sm" variant="primary" @click="$emit('connect')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </div>

    <ItemList
      v-else
      :items="templates as unknown as Record<string, unknown>[]"
      item-key="id"
      :empty-text="t('emptyTemplates')"
      :aria-label="t('ariaTemplates')"
    >
      <template #empty>
        <NeoCard variant="erobo" class="p-6 text-center opacity-70">
          <span class="text-xs">{{ t("emptyTemplates") }}</span>
        </NeoCard>
      </template>
      <template #item="{ item }">
        <TemplateCard
          :template="item as unknown as TemplateItem"
          :toggling-id="togglingId"
          @issue="$emit('issue', $event)"
          @toggle="$emit('toggle', $event)"
        />
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, ItemList } from "@shared/components";
import TemplateCard from "./TemplateCard.vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { TemplateItem } from "@/types";

defineProps<{
  templates: TemplateItem[];
  refreshing: boolean;
  togglingId: string | null;
  hasAddress: boolean;
}>();

defineEmits<{
  refresh: [];
  connect: [];
  issue: [template: TemplateItem];
  toggle: [template: TemplateItem];
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
.templates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.template-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
