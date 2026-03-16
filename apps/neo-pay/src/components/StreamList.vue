<template>
  <div class="vaults-list">
    <div class="section-header">
      <span class="section-label">{{ label }}</span>
      <span class="count-badge">{{ streams.length }}</span>
    </div>

    <ItemList
      :items="streams as unknown as Record<string, unknown>[]"
      item-key="id"
      :empty-text="emptyText"
      :aria-label="t('ariaStreams')"
    >
      <template #empty>
        <NeoCard variant="erobo" class="p-6 text-center opacity-70">
          <span class="text-xs">{{ emptyText }}</span>
        </NeoCard>
      </template>
      <template #item="{ item }">
        <StreamCard :stream="item as unknown as StreamItem" :is-creator="type === 'created'">
          <template #actions="{ stream: s }">
            <slot name="actions" :stream="s" :type="type" />
          </template>
        </StreamCard>
      </template>
    </ItemList>
  </div>
</template>

<script setup lang="ts">
import { ItemList, NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { StreamItem } from "@/types";
import StreamCard from "./StreamCard.vue";

defineProps<{
  streams: StreamItem[];
  label: string;
  emptyText: string;
  type: "created" | "beneficiary";
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
.vaults-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--stream-text);
}

.count-badge {
  padding: 2px 10px;
  border-radius: 999px;
  background: rgba(56, 189, 248, 0.18);
  color: var(--stream-accent);
  font-size: 11px;
  font-weight: 700;
}

.empty-state {
  margin-top: 10px;
}
</style>
