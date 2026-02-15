<template>
  <NeoCard variant="erobo" class="round-list">
    <view class="rounds-header">
      <text class="section-title">{{ t("roundsTitle") }}</text>
      <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="emitRefresh">
        {{ t("refresh") }}
      </NeoButton>
    </view>

    <ItemList
      :items="rounds as unknown as Record<string, unknown>[]"
      item-key="id"
      :empty-text="t('emptyRounds')"
      :aria-label="t('ariaRounds')"
    >
      <template #empty>
        <NeoCard variant="erobo" class="p-6 text-center opacity-70">
          <text class="text-xs">{{ t("emptyRounds") }}</text>
        </NeoCard>
      </template>
      <template #item="{ item }">
        <view class="round-card">
          <view class="round-card__header">
            <view>
              <text class="round-title">{{
                (item as unknown as RoundItem).title || `#${(item as unknown as RoundItem).id}`
              }}</text>
              <text class="round-subtitle"
                >#{{ (item as unknown as RoundItem).id }} · {{ (item as unknown as RoundItem).assetSymbol }}</text
              >
            </view>
            <text :class="['status-pill', (item as unknown as RoundItem).status]">{{
              roundStatusLabel((item as unknown as RoundItem).status)
            }}</text>
          </view>

          <text class="round-desc">{{ (item as unknown as RoundItem).description || "--" }}</text>

          <view class="round-metrics">
            <view>
              <text class="metric-label">{{ t("matchingPool") }}</text>
              <text class="metric-value"
                >{{
                  formatAmount((item as unknown as RoundItem).assetSymbol, (item as unknown as RoundItem).matchingPool)
                }}
                {{ (item as unknown as RoundItem).assetSymbol }}</text
              >
            </view>
            <view>
              <text class="metric-label">{{ t("matchingRemaining") }}</text>
              <text class="metric-value"
                >{{
                  formatAmount(
                    (item as unknown as RoundItem).assetSymbol,
                    (item as unknown as RoundItem).matchingRemaining
                  )
                }}
                {{ (item as unknown as RoundItem).assetSymbol }}</text
              >
            </view>
            <view>
              <text class="metric-label">{{ t("totalContributed") }}</text>
              <text class="metric-value"
                >{{
                  formatAmount(
                    (item as unknown as RoundItem).assetSymbol,
                    (item as unknown as RoundItem).totalContributed
                  )
                }}
                {{ (item as unknown as RoundItem).assetSymbol }}</text
              >
            </view>
            <view>
              <text class="metric-label">{{ t("projectCount") }}</text>
              <text class="metric-value">{{ (item as unknown as RoundItem).projectCount.toString() }}</text>
            </view>
          </view>

          <view class="round-meta">
            <text class="meta-item"
              >{{ t("roundSchedule") }}:
              {{
                formatSchedule((item as unknown as RoundItem).startTime, (item as unknown as RoundItem).endTime)
              }}</text
            >
            <text class="meta-item"
              >{{ t("roundCreator") }}: {{ formatAddress((item as unknown as RoundItem).creator) }}</text
            >
          </view>

          <view class="round-actions">
            <NeoButton size="sm" variant="secondary" @click="emitSelect(item as unknown as RoundItem)">
              {{ selectedRoundId === (item as unknown as RoundItem).id ? t("selectedRound") : t("selectRound") }}
            </NeoButton>
          </view>
        </view>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
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

const emitRefresh = () => emit("refresh");
const emitSelect = (round: RoundItem) => emit("select", round);
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
  background: rgba(20, 184, 166, 0.2);
  color: var(--qf-accent);
}

.status-pill.upcoming {
  background: rgba(59, 130, 246, 0.2);
  color: var(--qf-info);
}

.status-pill.ended {
  background: rgba(251, 191, 36, 0.2);
  color: var(--qf-warn);
}

.status-pill.finalized {
  background: rgba(34, 197, 94, 0.2);
  color: var(--qf-success);
}

.status-pill.cancelled {
  background: rgba(239, 68, 68, 0.2);
  color: var(--qf-danger);
}

.empty-state {
  margin-top: 10px;
}
</style>
