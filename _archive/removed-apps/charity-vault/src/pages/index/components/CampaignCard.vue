<template>
  <div class="campaign-card" role="button" tabindex="0" :aria-label="campaign.title" @click="$emit('click')">
    <div class="card-header">
      <div class="campaign-category">{{ categoryLabel }}</div>
      <StatusBadge
        :status="campaign.status === 'active' ? 'active' : campaign.status === 'completed' ? 'success' : 'inactive'"
        :label="getStatusLabel(campaign.status)"
      />
    </div>

    <div class="campaign-title">{{ campaign.title }}</div>
    <div class="campaign-organizer">{{ t("organizer") }}: {{ formatAddress(campaign.organizer) }}</div>

    <div class="progress-section">
      <div class="progress-bar">
        <div class="progress-fill" :style="{ width: progressPercent + '%' }" />
      </div>
      <div class="progress-labels">
        <span class="progress-raised">{{ formatAmount(campaign.raisedAmount) }} GAS</span>
        <span class="progress-target">of {{ formatAmount(campaign.targetAmount) }} GAS</span>
      </div>
    </div>

    <div class="card-stats">
      <div class="stat">
        <span class="stat-value">{{ campaign.donorCount }}</span>
        <span class="stat-label">{{ t("donorCount") }}</span>
      </div>
      <div class="stat">
        <span class="stat-value">{{ getTimeRemaining(campaign.endTime) }}</span>
        <span class="stat-label">{{ t("daysRemaining") }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatAddress } from "@shared/utils/format";
import { StatusBadge } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { CharityCampaign } from "@/types";

interface Props {
  campaign: CharityCampaign;
}

const props = defineProps<Props>();

const { t } = createUseI18n(messages)();

defineEmits<{
  click: [];
}>();

const CATEGORY_LOCALE_KEYS: Record<string, string> = {
  disaster: "categoryDisaster",
  education: "categoryEducation",
  health: "categoryHealth",
  environment: "categoryEnvironment",
  poverty: "categoryPoverty",
  animals: "categoryAnimals",
  other: "categoryOther",
};

const categoryLabel = computed(() => {
  const key = CATEGORY_LOCALE_KEYS[props.campaign.category] || "categoryOther";
  return t(key);
});

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
