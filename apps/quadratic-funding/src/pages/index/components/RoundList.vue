<template>
  <NeoCard variant="erobo" class="round-list">
    <div class="rounds-header">
      <span class="section-title">{{ t("roundsTitle") }}</span>
      <NeoButton size="sm" variant="secondary" type="button" :loading="isRefreshing" @click="emitRefresh">
        {{ t("refresh") }}
      </NeoButton>
    </div>

    <!--
      ItemList expects Record<string, unknown>[] but we have RoundItem[].
      The double-cast is needed because ItemList is not generically typed.
      The inner cast 'as unknown' is necessary to go from RoundItem[] to unknown first.
    -->
    <ItemList
      :items="(rounds as unknown) as Record<string, unknown>[]"
      item-key="id"
      :empty-text="t('emptyRounds')"
      :aria-label="t('ariaRounds')"
    >
      <template #empty>
        <NeoCard variant="erobo" class="p-6 text-center opacity-70">
          <span class="text-xs">{{ t("emptyRounds") }}</span>
        </NeoCard>
      </template>
      <template #item="{ item }">
        <div class="round-card">
          <div class="round-card__header">
            <div>
              <span class="round-title">{{
                (item as unknown as RoundItem).title || `#${(item as unknown as RoundItem).id}`
              }}</span>
              <span class="round-subtitle"
                >#{{ (item as unknown as RoundItem).id }} · {{ assetLabel }}</span
          >
            </div>
            <span :class="['status-pill', (item as unknown as RoundItem).status]">{{
              roundStatusLabel((item as unknown as RoundItem).status)
            }}</span>
          </div>

          <span class="round-desc">{{ (item as unknown as RoundItem).description || t("notAvailable") }}</span>

          <div class="round-metrics">
            <div>
              <span class="metric-label">{{ t("matchingPool") }}</span>
              <span class="metric-value"
                >{{
                  formatAmount((item as unknown as RoundItem).assetSymbol, (item as unknown as RoundItem).matchingPool)
                }}
                {{ assetLabel }}</span
          >
            </div>
            <div>
              <span class="metric-label">{{ t("matchingRemaining") }}</span>
              <span class="metric-value"
                >{{
                  formatAmount(
                    (item as unknown as RoundItem).assetSymbol,
                    (item as unknown as RoundItem).matchingRemaining
                  )
                }}
                {{ assetLabel }}</span
          >
            </div>
            <div>
              <span class="metric-label">{{ t("totalContributed") }}</span>
              <span class="metric-value"
                >{{
                  formatAmount(
                    (item as unknown as RoundItem).assetSymbol,
                    (item as unknown as RoundItem).totalContributed
                  )
                }}
                {{ assetLabel }}</span
          >
            </div>
            <div>
              <span class="metric-label">{{ t("projectCount") }}</span>
              <span class="metric-value">{{ (item as unknown as RoundItem).projectCount.toString() }}</span>
            </div>
          </div>

          <div class="round-meta">
            <span class="meta-item"
              >{{ t("roundSchedule") }}:
              {{
                formatSchedule((item as unknown as RoundItem).startTime, (item as unknown as RoundItem).endTime)
              }}</span
          >
            <span class="meta-item"
              >{{ t("roundCreator") }}: {{ formatAddress((item as unknown as RoundItem).creator) }}</span
          >
          </div>

          <div class="round-actions">
            <NeoButton size="sm" variant="secondary" type="button" @click="emitSelect(item as unknown as RoundItem)">
              {{ selectedRoundId === (item as unknown as RoundItem).id ? t("selectedRound") : t("selectRound") }}
            </NeoButton>
          </div>
        </div>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard, NeoButton, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

export interface RoundItem {
  id: string;
  creator: string;
  assetSymbol: string;
  matchingPool: bigint;
  matchingRemaining: bigint;
  totalContributed: bigint;
  projectCount: bigint;
  startTime: number;
  endTime: number;
  status: string;
  title: string;
  description: string;
}

const props = defineProps<{
  rounds: RoundItem[];
  selectedRoundId: string;
  isRefreshing: boolean;
  roundStatusLabel: (status: string) => string;
  formatAmount: (symbol: string, amount: bigint) => string;
  formatSchedule: (start: number, end: number) => string;
  formatAddress: (addr: string) => string;
}>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "select", round: RoundItem): void;
}>();

const { t } = createUseI18n(messages)();

// Maps on-chain assetSymbol (always "GAS") to i18n token label
const assetLabel = computed(() => t("tokenGas"));

const emitRefresh = () => emit("refresh");
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.round-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.rounds-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.round-cards {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.round-card {
  background: var(--qf-card-bg);
  border: 1px solid var(--qf-card-border);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.round-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.round-title {
  font-size: 15px;
  font-weight: 700;
}

.round-subtitle {
  display: block;
  font-size: 11px;
  color: var(--qf-muted);
  margin-top: 2px;
}

.round-desc {
  font-size: 12px;
  color: var(--qf-muted);
  line-height: 1.5;
}

.round-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
}

.metric-label {
  @include stat-label;
  font-size: 10px;
  color: var(--qf-muted);
  letter-spacing: 0.08em;
}

.metric-value {
  font-size: 15px;
  font-weight: 700;
  color: var(--qf-accent-strong);
}

.round-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-item {
  font-size: 11px;
  color: var(--qf-muted);
}

.round-actions {
  display: flex;
  gap: 10px;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: var(--qf-accent-soft, rgba(20, 184, 166, 0.2));
  color: var(--qf-accent);
}

.status-pill.upcoming {
  background: var(--qf-info-soft, rgba(59, 130, 246, 0.2));
  color: var(--qf-info);
}

.status-pill.ended {
  background: var(--qf-warn-soft, rgba(251, 191, 36, 0.2));
  color: var(--qf-warn);
}

.status-pill.finalized {
  background: var(--qf-success-soft, rgba(34, 197, 94, 0.2));
  color: var(--qf-success);
}

.status-pill.cancelled {
  background: var(--qf-danger-soft, rgba(239, 68, 68, 0.2));
  color: var(--qf-danger);
}

.empty-state {
  margin-top: 10px;
}
</style>
