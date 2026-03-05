<template>
  <NeoCard variant="erobo">
    <text class="section-title">{{ title }}</text>
    <ItemList :items="items" item-key="id" :empty-text="emptyText">
      <template #empty>
        <view class="empty-state">
          <text class="empty-text">{{ emptyText }}</text>
        </view>
      </template>
      <template #item="{ item }">
        <view :class="['proposal-item', selectedId === item.id && 'active']" @click="$emit('select', item.id)">
          <view class="item-header">
            <text class="item-id">#{{ item.id }}</text>
            <text :class="['item-status', item.active ? 'active' : 'inactive']">
              {{ item.active ? t("active") : t("inactive") }}
            </text>
          </view>
          <text v-if="item.identityHash" class="item-hash mono">{{ item.identityHash }}</text>
          <text v-if="item.title" class="item-title">{{ item.title }}</text>
          <text class="item-time">{{ item.createdAt }}</text>
        </view>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

interface Item {
  id: string;
  identityHash?: string;
  title?: string;
  active: boolean;
  createdAt: string;
}

interface Props {
  items: Item[];
  selectedId: string | null;
  title: string;
  emptyText: string;
}

defineProps<Props>();

defineEmits<{
  select: [id: string];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.section-title {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: var(--mask-gold);
  margin-bottom: 16px;
  display: block;
  text-align: center;
  font-family: "Cinzel", serif;
}

.empty-state {
  text-align: center;
  padding: 32px;
  background: var(--mask-empty-bg);
  border-radius: 8px;
}

.empty-text {
  font-size: 12px;
  opacity: 0.5;
  font-style: italic;
}

.proposal-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.proposal-item {
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--mask-list-border);
  background: var(--mask-list-bg);
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    border-color: var(--mask-purple);
    background: var(--mask-active-bg);
    box-shadow: var(--mask-active-shadow);
  }

  &:hover:not(.active) {
    background: var(--mask-list-hover);
  }
}

.item-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}

.item-id {
  font-weight: 700;
  color: var(--mask-gold);
  font-family: "Cinzel", serif;
}

.item-status {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 700;
}

.item-status.active {
  background: var(--mask-success-bg);
  color: var(--mask-success-text);
}

.item-status.inactive {
  background: var(--mask-error-bg);
  color: var(--mask-error-text);
}

.item-hash {
  font-size: 10px;
  word-break: break-all;
  color: var(--mask-muted);
}

.item-title {
  font-size: 12px;
  color: var(--mask-text);
  margin-top: 4px;
}

.item-time {
  margin-top: 8px;
  font-size: 10px;
  color: var(--mask-subtle);
}

.mono {
  font-family: "Fira Code", monospace;
}
</style>
