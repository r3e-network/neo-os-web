<template>
  <NeoCard variant="erobo" class="round-list">
    <view class="rounds-header">
      <text class="section-title">{{ t("roundsTitle") }}</text>
      <NeoButton size="sm" variant="secondary" :loading="isRefreshing" @click="emitRefresh">
        {{ t("refresh") }}
      </NeoButton>
    </view>

    <view v-if="rounds.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <text class="text-xs">{{ t("emptyRounds") }}</text>
      </NeoCard>
    </view>

    <view v-else class="round-cards">
      <view v-for="round in rounds" :key="`round-${round.id}`" class="round-card">
        <view class="round-card__header">
          <view>
            <text class="round-title">{{ round.title || `#${round.id}` }}</text>
            <text class="round-subtitle">#{{ round.id }} · {{ round.assetSymbol }}</text>
          </view>
          <text :class="['status-pill', round.status]">{{ roundStatusLabel(round.status) }}</text>
        </view>

        <text class="round-desc">{{ round.description || "--" }}</text>

        <view class="round-metrics">
          <view>
            <text class="metric-label">{{ t("matchingPool") }}</text>
            <text class="metric-value">{{ formatAmount(round.assetSymbol, round.matchingPool) }} {{ round.assetSymbol }}</text>
          </view>
          <view>
            <text class="metric-label">{{ t("matchingRemaining") }}</text>
            <text class="metric-value">{{ formatAmount(round.assetSymbol, round.matchingRemaining) }} {{ round.assetSymbol }}</text>
          </view>
          <view>
            <text class="metric-label">{{ t("totalContributed") }}</text>
            <text class="metric-value">{{ formatAmount(round.assetSymbol, round.totalContributed) }} {{ round.assetSymbol }}</text>
          </view>
          <view>
            <text class="metric-label">{{ t("projectCount") }}</text>
            <text class="metric-value">{{ round.projectCount.toString() }}</text>
          </view>
        </view>

        <view class="round-meta">
          <text class="meta-item">{{ t("roundSchedule") }}: {{ formatSchedule(round.startTime, round.endTime) }}</text>
          <text class="meta-item">{{ t("roundCreator") }}: {{ formatAddress(round.creator) }}</text>
        </view>

        <view class="round-actions">
          <NeoButton size="sm" variant="secondary" @click="emitSelect(round)">
            {{ selectedRoundId === round.id ? t("selectedRound") : t("selectRound") }}
          </NeoButton>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

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

const { t } = useI18n();

const emitRefresh = () => emit("refresh");
const emitSelect = (round: RoundItem) => emit("select", round);
</script>

<style lang="scss" scoped>
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
  font-size: 10px;
  color: var(--qf-muted);
  text-transform: uppercase;
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
  color: #60a5fa;
}

.status-pill.ended {
  background: rgba(251, 191, 36, 0.2);
  color: var(--qf-warn);
}

.status-pill.finalized {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-pill.cancelled {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.empty-state {
  margin-top: 10px;
}
</style>
