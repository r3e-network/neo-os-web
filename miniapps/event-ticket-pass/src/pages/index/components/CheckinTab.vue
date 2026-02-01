<template>
  <view class="tab-content">
    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="text-center">
      <text class="font-bold">{{ status.msg }}</text>
    </NeoCard>

    <NeoCard variant="erobo-neo">
      <view class="form-group">
        <NeoInput
          v-model="localTokenId"
          :label="t('checkinTokenId')"
          :placeholder="t('checkinTokenIdPlaceholder')"
        />
        <view class="checkin-actions">
          <NeoButton size="sm" variant="secondary" :loading="isLookingUp" @click="$emit('lookup')">
            {{ isLookingUp ? t("lookingUp") : t("lookup") }}
          </NeoButton>
          <NeoButton size="sm" variant="primary" :loading="isCheckingIn" @click="$emit('checkin')">
            {{ isCheckingIn ? t("checkingIn") : t("checkIn") }}
          </NeoButton>
        </view>
      </view>
    </NeoCard>

    <NeoCard v-if="lookup" variant="erobo" class="lookup-card">
      <view class="ticket-card__header">
        <view>
          <text class="ticket-title">{{ lookup.eventName || `#${lookup.eventId}` }}</text>
          <text class="ticket-subtitle">{{ lookup.venue || t("venueFallback") }}</text>
        </view>
        <text :class="['status-pill', lookup.used ? 'used' : 'active']">
          {{ lookup.used ? t("ticketUsed") : t("ticketValid") }}
        </text>
      </view>
      <view class="ticket-meta">
        <text class="meta-label">{{ t("eventSchedule") }}</text>
        <text class="meta-value">{{ formatSchedule(lookup.startTime, lookup.endTime) }}</text>
      </view>
      <text class="detail-row">{{ t("ticketSeat") }}: {{ lookup.seat || t("seatFallback") }}</text>
      <text class="detail-row">{{ t("ticketTokenId") }}: {{ lookup.tokenId }}</text>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";

interface TicketItem {
  tokenId: string;
  eventId: string;
  eventName: string;
  venue: string;
  startTime: number;
  endTime: number;
  seat: string;
  memo: string;
  issuedTime: number;
  used: boolean;
  usedTime: number;
}

const props = defineProps<{
  t: (key: string) => string;
  tokenId: string;
  lookup: TicketItem | null;
  isLookingUp: boolean;
  isCheckingIn: boolean;
  status: { msg: string; type: "success" | "error" } | null;
}>();

const emit = defineEmits<{
  (e: "update:tokenId", value: string): void;
  (e: "lookup"): void;
  (e: "checkin"): void;
}>();

const localTokenId = ref(props.tokenId);

watch(
  () => props.tokenId,
  (newVal) => {
    localTokenId.value = newVal;
  }
);

watch(localTokenId, (newVal) => {
  emit("update:tokenId", newVal);
});

const formatSchedule = (startTime: number, endTime: number) => {
  if (!startTime || !endTime) return "-";
  const start = new Date(startTime * 1000);
  const end = new Date(endTime * 1000);
  return `${start.toLocaleString()} - ${end.toLocaleString()}`;
};
</script>

<style lang="scss" scoped>
.tab-content {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.checkin-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.lookup-card {
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

.detail-row {
  font-size: 12px;
  color: var(--ticket-muted);
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

  &.used {
    background: rgba(239, 68, 68, 0.2);
    color: #f87171;
  }
}
</style>
