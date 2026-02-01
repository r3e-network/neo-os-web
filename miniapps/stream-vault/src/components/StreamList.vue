<template>
  <view class="vaults-list">
    <view class="section-header">
      <text class="section-label">{{ label }}</text>
      <text class="count-badge">{{ streams.length }}</text>
    </view>

    <view v-if="streams.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <text class="text-xs">{{ emptyText }}</text>
      </NeoCard>
    </view>

    <StreamCard
      v-for="stream in streams"
      :key="`${type}-${stream.id}`"
      :stream="stream"
      :is-creator="type === 'created'"
    >
      <template #actions="{ stream: s }">
        <slot name="actions" :stream="s" :type="type" />
      </template>
    </StreamCard>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";
import type { StreamItem } from "./StreamCard.vue";
import StreamCard from "./StreamCard.vue";

defineProps<{
  streams: StreamItem[];
  label: string;
  emptyText: string;
  type: "created" | "beneficiary";
}>();

const { t } = useI18n();
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
