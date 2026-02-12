<template>
  <view class="campaign-card" role="button" tabindex="0" :aria-label="campaign.title" @click="$emit('click')">
    <view class="card-header">
      <view class="campaign-category">{{ getCategoryLabel(campaign.category) }}</view>
      <view class="campaign-status" :class="`status-${campaign.status}`">
        {{ getStatusLabel(campaign.status) }}
      </view>
    </view>

    <view class="campaign-title">{{ campaign.title }}</view>
    <view class="campaign-organizer">{{ t("organizer") }}: {{ formatAddress(campaign.organizer) }}</view>

    <view class="progress-section">
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }" />
      </view>
      <view class="progress-labels">
        <text class="progress-raised">{{ formatAmount(campaign.raisedAmount) }} GAS</text>
        <text class="progress-target">of {{ formatAmount(campaign.targetAmount) }} GAS</text>
      </view>
    </view>

    <view class="card-stats">
      <view class="stat">
        <text class="stat-value">{{ campaign.donorCount }}</text>
        <text class="stat-label">{{ t("donorCount") }}</text>
      </view>
      <view class="stat">
        <text class="stat-value">{{ getTimeRemaining(campaign.endTime) }}</text>
        <text class="stat-label">{{ t("daysRemaining") }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatAddress } from "@shared/utils/format";
import { getCategoryLabel } from "@/utils/labels";
import type { CharityCampaign } from "@/types";

interface Props {
  campaign: CharityCampaign;
  t: (key: string) => string;
}

const props = defineProps<Props>();

defineEmits<{
  click: [];
}>();

const progressPercent = computed(() => {
  const percent = (props.campaign.raisedAmount / props.campaign.targetAmount) * 100;
  return Math.min(percent, 100);
});

const formatAmount = (amount: number): string => {
  if (amount >= 1000) return (amount / 1000).toFixed(1) + "k";
  return amount.toFixed(2);
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    active: "Active",
    completed: "Completed",
    withdrawn: "Withdrawn",
    cancelled: "Cancelled",
  };
  return labels[status] || status;
};

const getTimeRemaining = (endTime: number): string => {
  const diff = endTime - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return days > 0 ? String(days) : "0";
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../charity-vault-theme.scss";

.campaign-card {
  background: var(--charity-card-bg);
  border: 1px solid var(--charity-card-border);
  border-radius: 12px;
  padding: 16px;
  box-shadow: var(--charity-card-shadow);
  cursor: pointer;
  transition:
    transform 0.2s,
    box-shadow 0.2s;

  &:active {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.3);
  }
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.campaign-category {
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(245, 158, 11, 0.15);
  color: var(--charity-accent);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.campaign-status {
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 600;

  &.status-active {
    background: var(--charity-success-bg);
    color: var(--charity-success);
  }

  &.status-completed {
    background: var(--charity-info-bg);
    color: var(--charity-info);
  }
}

.campaign-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--charity-text-primary);
  line-height: 1.4;
  margin-bottom: 4px;
}

.campaign-organizer {
  font-size: 12px;
  color: var(--charity-text-muted);
  margin-bottom: 16px;
}

.progress-section {
  margin-bottom: 16px;
}

.progress-bar {
  height: 8px;
  background: var(--charity-progress-bg);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
}

.progress-fill {
  height: 100%;
  background: var(--charity-progress-fill);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
}

.progress-raised {
  color: var(--charity-success);
  font-weight: 600;
}

.progress-target {
  color: var(--charity-text-muted);
}

.card-stats {
  display: flex;
  justify-content: space-around;
  padding-top: 12px;
  border-top: 1px solid var(--charity-card-border);
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--charity-text-primary);
  display: block;
}

.stat-label {
  font-size: 11px;
  color: var(--charity-text-muted);
}
</style>
