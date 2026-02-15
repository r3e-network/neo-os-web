<template>
  <NeoCard variant="erobo" class="event-list">
    <view class="events-header">
      <text class="section-title">{{ t("yourEvents") }}</text>
      <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="$emit('refresh')">
        {{ t("refresh") }}
      </NeoButton>
    </view>

    <view v-if="!address" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center">
        <text class="mb-3 block text-sm">{{ t("walletNotConnected") }}</text>
        <NeoButton size="sm" variant="primary" @click="$emit('connect')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </view>

    <template v-else>
      <ItemList :items="events" item-key="id" :empty-text="t('emptyEvents')">
        <template #empty>
          <NeoCard variant="erobo" class="p-6 text-center opacity-70">
            <text class="text-xs">{{ t("emptyEvents") }}</text>
          </NeoCard>
        </template>
        <template #item="{ item: event }">
          <EventDetails
            :event="event"
            :toggling-id="togglingId"
            @issue="$emit('issue', $event)"
            @toggle="$emit('toggle', $event)"
          />
        </template>
      </ItemList>
    </template>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { EventItem } from "@/types";

defineProps<{
  address: string | null;
  events: EventItem[];
  isRefreshing: boolean;
  togglingId: string | null;
}>();

const { t } = createUseI18n(messages)();

defineEmits<{
  (e: "refresh"): void;
  (e: "connect"): void;
  (e: "issue", event: EventItem): void;
  (e: "toggle", event: EventItem): void;
}>();
</script>

<style lang="scss" scoped>
.events-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.event-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.event-cards {
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
