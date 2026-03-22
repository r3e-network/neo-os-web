<template>
  <div class="event-card">
    <div class="event-card__header">
      <div>
        <span class="event-title">{{ event.name || `#${event.id}` }}</span>
        <span class="event-subtitle">{{ event.venue || t("venueFallback") }}</span>
      </div>
      <StatusBadge
        :status="event.active ? 'active' : 'inactive'"
        :label="event.active ? t('statusActive') : t('statusInactive')"
      />
    </div>

    <div class="event-meta">
      <span class="meta-label">{{ t("eventSchedule") }}</span>
      <span class="meta-value">{{ formatSchedule(event.startTime, event.endTime) }}</span>
    </div>

    <div class="event-metrics">
      <div>
        <span class="metric-label">{{ t("minted") }}</span>
        <span class="metric-value">{{ event.minted.toString() }}</span>
      </div>
      <div>
        <span class="metric-label">{{ t("maxSupply") }}</span>
        <span class="metric-value">{{ event.maxSupply.toString() }}</span>
      </div>
    </div>

    <div class="event-actions">
      <NeoButton
        size="sm"
        variant="primary"
        type="button"
        :disabled="!event.active || event.minted >= event.maxSupply"
        @click="$emit('issue', event)"
      >
        {{ event.minted >= event.maxSupply ? t("soldOut") : t("issueTicket") }}
      </NeoButton>
      <NeoButton size="sm" variant="secondary" type="button" :loading="togglingId === event.id" @click="$emit('toggle', event)">
        {{ event.active ? t("deactivate") : t("activate") }}
      </NeoButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NeoButton, StatusBadge } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { EventItem } from "@/types";

const props = defineProps<{
  event: EventItem;
  togglingId: string | null;
}>();

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "issue", event: EventItem): void;
  (e: "toggle", event: EventItem): void;
}>();

const formatSchedule = (startTime: number, endTime: number) => {
  if (!startTime || !endTime) return t("dateUnknown");
  const start = new Date(startTime * 1000);
  const end = new Date(endTime * 1000);
  return `${new Intl.DateTimeFormat(undefined).format(start)} - ${new Intl.DateTimeFormat(undefined).format(end)}`;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.event-card {
  background: var(--ticket-card-bg);
  border: 1px solid var(--ticket-card-border);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.event-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.event-title {
  font-size: 15px;
  font-weight: 700;
}

.event-subtitle {
  display: block;
  font-size: 11px;
  color: var(--ticket-muted);
  margin-top: 2px;
}

.event-meta {
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

.event-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.metric-label {
  @include stat-label;
  font-size: 10px;
  color: var(--ticket-muted);
  letter-spacing: 0.08em;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--ticket-accent-strong);
}

.event-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
</style>
