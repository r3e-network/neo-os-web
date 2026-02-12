<template>
  <view class="tickets-header">
    <text class="section-title">{{ t("ticketsTab") }}</text>
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

  <view v-else-if="tickets.length === 0" class="empty-state">
    <NeoCard variant="erobo" class="p-6 text-center opacity-70">
      <text class="text-xs">{{ t("emptyTickets") }}</text>
    </NeoCard>
  </view>

  <view v-else class="ticket-grid">
    <view v-for="ticket in tickets" :key="`ticket-${ticket.tokenId}`" class="ticket-card">
      <view class="ticket-card__header">
        <view>
          <text class="ticket-title">{{ ticket.eventName || `#${ticket.eventId}` }}</text>
          <text class="ticket-subtitle">{{ ticket.venue || t("venueFallback") }}</text>
        </view>
        <text :class="['status-pill', ticket.used ? 'used' : 'active']">
          {{ ticket.used ? t("ticketUsed") : t("ticketValid") }}
        </text>
      </view>

      <view class="ticket-meta">
        <text class="meta-label">{{ t("eventSchedule") }}</text>
        <text class="meta-value">{{ formatSchedule(ticket.startTime, ticket.endTime) }}</text>
      </view>

      <view class="ticket-body">
        <view class="ticket-qr" v-if="ticketQrs[ticket.tokenId]">
          <image :src="ticketQrs[ticket.tokenId]" class="ticket-qr__img" mode="aspectFit" :alt="t('ticketQrCode')" />
        </view>
        <view class="ticket-details">
          <text class="detail-row">{{ t("ticketSeat") }}: {{ ticket.seat || t("seatFallback") }}</text>
          <text class="detail-row">{{ t("ticketTokenId") }}: {{ ticket.tokenId }}</text>
          <NeoButton size="sm" variant="secondary" class="copy-btn" @click="$emit('copy', ticket.tokenId)">
            {{ t("copyTokenId") }}
          </NeoButton>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import type { TicketItem } from "@/types";

const props = defineProps<{
  t: (key: string) => string;
  address: string | null;
  tickets: TicketItem[];
  ticketQrs: Record<string, string>;
  isRefreshing: boolean;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "connect"): void;
  (e: "copy", tokenId: string): void;
}>();

const formatSchedule = (startTime: number, endTime: number) => {
  if (!startTime || !endTime) return props.t("dateUnknown");
  const start = new Date(startTime * 1000);
  const end = new Date(endTime * 1000);
  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
};
</script>

<style lang="scss" scoped>
.tickets-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.ticket-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.ticket-card {
  background: var(--ticket-card-bg);
  border: 1px solid var(--ticket-card-border);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.ticket-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.ticket-title {
  font-size: 15px;
  font-weight: 700;
}

.ticket-subtitle {
  display: block;
  font-size: 11px;
  color: var(--ticket-muted);
  margin-top: 2px;
}

.ticket-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ticket-muted);
}

.meta-value {
  font-size: 12px;
}

.ticket-body {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
  align-items: center;
}

.ticket-qr {
  width: 110px;
  height: 110px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.ticket-qr__img {
  width: 100px;
  height: 100px;
}

.ticket-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  font-size: 12px;
  color: var(--ticket-muted);
}

.copy-btn {
  align-self: flex-start;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(245, 158, 11, 0.2);
  color: var(--ticket-accent);
}

.status-pill.used {
  background: rgba(239, 68, 68, 0.2);
  color: var(--ticket-danger);
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
