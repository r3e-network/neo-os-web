<template>
  <div class="tickets-header">
    <span class="section-title">{{ t("ticketsTab") }}</span>
    <NeoButton size="sm" variant="secondary" type="button" :loading="isRefreshing" @click="$emit('refresh')">
      {{ t("refresh") }}
    </NeoButton>
  </div>

  <div v-if="!address" class="empty-state">
    <NeoCard variant="erobo" class="p-6 text-center">
      <span class="mb-3 block text-sm">{{ t("walletNotConnected") }}</span>
      <NeoButton size="sm" variant="primary" type="button" @click="$emit('connect')">
        {{ t("connectWallet") }}
      </NeoButton>
    </NeoCard>
  </div>

  <div v-else-if="tickets.length === 0" class="empty-state">
    <NeoCard variant="erobo" class="p-6 text-center opacity-70">
      <span class="text-xs">{{ t("emptyTickets") }}</span>
    </NeoCard>
  </div>

  <div v-else class="ticket-grid">
    <div v-for="ticket in tickets" :key="`ticket-${ticket.tokenId}`" class="ticket-card">
      <div class="ticket-card__header">
        <div>
          <span class="ticket-title">{{ ticket.eventName || `#${ticket.eventId}` }}</span>
          <span class="ticket-subtitle">{{ ticket.venue || t("venueFallback") }}</span>
        </div>
        <StatusBadge
          :status="ticket.used ? 'error' : 'active'"
          :label="ticket.used ? t('ticketUsed') : t('ticketValid')"
        />
      </div>

      <div class="ticket-meta">
        <span class="meta-label">{{ t("eventSchedule") }}</span>
        <span class="meta-value">{{ formatSchedule(ticket.startTime, ticket.endTime) }}</span>
      </div>

      <div class="ticket-body">
        <div class="ticket-qr" v-if="ticketQrs[ticket.tokenId]">
          <img :src="ticketQrs[ticket.tokenId]" class="ticket-qr__img" mode="aspectFit" :alt="t('ticketQrCode')" />
        </div>
        <div class="ticket-details">
          <span class="detail-row">{{ t("ticketSeat") }}: {{ ticket.seat || t("seatFallback") }}</span>
          <span class="detail-row">{{ t("ticketTokenId") }}: {{ ticket.tokenId }}</span>
          <NeoButton size="sm" variant="secondary" type="button" class="copy-btn" @click="$emit('copy', ticket.tokenId)">
            {{ t("copyTokenId") }}
          </NeoButton>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, StatusBadge } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { TicketItem } from "@/types";

const props = defineProps<{
  address: string | null;
  tickets: TicketItem[];
  ticketQrs: Record<string, string>;
  isRefreshing: boolean;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "connect"): void;
  (e: "copy", tokenId: string): void;
}>();

const formatSchedule = (startTime: number, endTime: number) => {
  if (!startTime || !endTime) return t("dateUnknown");
  const start = new Date(startTime * 1000);
  const end = new Date(endTime * 1000);
  return `${new Intl.DateTimeFormat("en").format(start)} - ${new Intl.DateTimeFormat("en").format(end)}`;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

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
  @include stat-label;
  font-size: 10px;
  letter-spacing: 0.08em;
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

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
