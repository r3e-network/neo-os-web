<template>
  <view class="my-donations-view">
    <!-- Summary Card -->
    <view class="summary-card">
      <text class="summary-label">{{ t("totalDonated") }}</text>
      <text class="summary-value">{{ totalDonated.toFixed(2) }} GAS</text>
      <text class="summary-count">{{ donations.length }} {{ t("donationCount") }}</text>
    </view>

    <!-- Donations List -->
    <view class="donations-section">
      <view class="section-title">{{ t("myDonationsTab") }}</view>
      <view v-if="donations.length === 0" class="empty-state">
        <text>{{ t("noDonations") }}</text>
      </view>
      <view v-else class="donations-list">
        <view v-for="donation in sortedDonations" :key="donation.id" class="donation-card">
          <view class="donation-header">
            <text class="donation-amount">{{ formatAmount(donation.amount) }} GAS</text>
            <text class="donation-date">{{ formatDate(donation.timestamp) }}</text>
          </view>
          <view class="donation-campaign">Campaign #{{ donation.campaignId }}</view>
          <text v-if="donation.message" class="donation-message">"{{ donation.message }}"</text>
          <view class="donation-footer">
            <text class="tx-label">{{ t("viewOnChain") }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Donation {
  id: number;
  campaignId: number;
  amount: number;
  message: string;
  timestamp: number;
}

interface Props {
  donations: Donation[];
  totalDonated: number;
  t: (key: string) => string;
}

const props = defineProps<Props>();

const sortedDonations = computed(() => {
  return [...props.donations].sort((a, b) => b.timestamp - a.timestamp);
});

const formatAmount = (amount: number): string => {
  return amount.toFixed(4);
};

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleDateString();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../charity-vault-theme.scss";

.my-donations-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.summary-card {
  background: linear-gradient(135deg, var(--charity-accent), var(--charity-secondary));
  border-radius: 12px;
  padding: 24px;
  text-align: center;
}

.summary-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.9);
  display: block;
  margin-bottom: 8px;
}

.summary-value {
  font-size: 32px;
  font-weight: 700;
  color: white;
  display: block;
  margin-bottom: 4px;
}

.summary-count {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.8);
}

.donations-section {
  background: var(--charity-card-bg);
  border: 1px solid var(--charity-card-border);
  border-radius: 12px;
  padding: 16px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--charity-text-primary);
  margin-bottom: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: var(--charity-text-muted);
}

.donations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.donation-card {
  padding: 12px;
  background: var(--charity-bg-secondary);
  border-radius: 8px;
}

.donation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.donation-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--charity-success);
}

.donation-date {
  font-size: 12px;
  color: var(--charity-text-muted);
}

.donation-campaign {
  font-size: 13px;
  color: var(--charity-text-secondary);
  margin-bottom: 4px;
}

.donation-message {
  font-size: 13px;
  color: var(--charity-text-muted);
  font-style: italic;
  margin-bottom: 8px;
  display: block;
}

.donation-footer {
  padding-top: 8px;
  border-top: 1px solid var(--charity-card-border);
}

.tx-label {
  font-size: 12px;
  color: var(--charity-accent);
}
</style>
