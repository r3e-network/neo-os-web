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
        <text class="text-sm block mb-3">{{ t("walletNotConnected") }}</text>
        <NeoButton size="sm" variant="primary" @click="$emit('connect')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </view>

    <view v-else-if="events.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <text class="text-xs">{{ t("emptyEvents") }}</text>
      </NeoCard>
    </view>

    <view v-else class="event-cards">
      <EventDetails
        v-for="event in events"
        :key="`event-${event.id}`"
        :event="event"
        :t="t"
        :toggling-id="togglingId"
        @issue="$emit('issue', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import EventDetails from "./EventDetails.vue";
import type { EventItem } from "@/types";

defineProps<{
  t: (key: string) => string;
  address: string | null;
  events: EventItem[];
  isRefreshing: boolean;
  togglingId: string | null;
}>();

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
