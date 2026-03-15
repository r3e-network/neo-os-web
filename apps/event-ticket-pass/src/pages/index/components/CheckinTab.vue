<template>
  <div class="tab-content">
    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="text-center">
      <span class="font-bold">{{ status.msg }}</span>
    </NeoCard>

    <NeoCard variant="erobo-neo">
      <div class="form-group">
        <NeoInput v-model="localTokenId" :label="t('checkinTokenId')" :placeholder="t('checkinTokenIdPlaceholder')" />
        <div class="checkin-actions">
          <NeoButton size="sm" variant="secondary" :loading="isLookingUp" @click="$emit('lookup')">
            {{ isLookingUp ? t("lookingUp") : t("lookup") }}
          </NeoButton>
          <NeoButton size="sm" variant="primary" :loading="isCheckingIn" @click="$emit('checkin')">
            {{ isCheckingIn ? t("checkingIn") : t("checkIn") }}
          </NeoButton>
        </div>
      </div>
    </NeoCard>

    <NeoCard v-if="lookup" variant="erobo" class="lookup-card">
      <div class="ticket-card__header">
        <div>
          <span class="ticket-title">{{ lookup.eventName || `#${lookup.eventId}` }}</span>
          <span class="ticket-subtitle">{{ lookup.venue || t("venueFallback") }}</span>
        </div>
        <span :class="['status-pill', lookup.used ? 'used' : 'active']">
          {{ lookup.used ? t("ticketUsed") : t("ticketValid") }}
        </span>
      </div>
      <div class="ticket-meta">
        <span class="meta-label">{{ t("eventSchedule") }}</span>
        <span class="meta-value">{{ formatSchedule(lookup.startTime, lookup.endTime) }}</span>
      </div>
      <span class="detail-row">{{ t("ticketSeat") }}: {{ lookup.seat || t("seatFallback") }}</span>
      <span class="detail-row">{{ t("ticketTokenId") }}: {{ lookup.tokenId }}</span>
    </NeoCard>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { TicketItem } from "@/types";

const props = defineProps<{
  tokenId: string;
  lookup: TicketItem | null;
  isLookingUp: boolean;
  isCheckingIn: boolean;
  status: { msg: string; type: "success" | "error" } | null;
}>();

const { t } = createUseI18n(messages)();

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
@use "@shared/styles/mixins.scss" as *;

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
  @include stat-label;
  font-size: 10px;
  letter-spacing: 0.08em;
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
    color: var(--ticket-danger);
  }
}
</style>
