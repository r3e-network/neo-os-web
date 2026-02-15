<template>
  <view class="campaign-detail">
    <!-- Back Button -->
    <view class="back-button" role="button" tabindex="0" :aria-label="t('campaigns')" @click="$emit('back')">
      <text class="back-icon" aria-hidden="true">←</text>
      <text>{{ t("campaigns") }}</text>
    </view>

    <!-- Campaign Header -->
    <view class="detail-header">
      <view class="detail-category">{{ categoryLabel }}</view>

      <view class="detail-title">{{ campaign.title }}</view>
      <view class="detail-organizer">{{ t("organizer") }}: {{ formatAddress(campaign.organizer) }}</view>

      <view class="progress-section">
        <view class="progress-bar">
          <view class="progress-fill" :style="{ width: progressPercent + '%' }" />
        </view>
        <view class="progress-info">
          <text class="raised">{{ formatAmount(campaign.raisedAmount) }} GAS</text>
          <text class="target">of {{ formatAmount(campaign.targetAmount) }} GAS</text>
          <text class="percent">{{ progressPercent.toFixed(0) }}%</text>
        </view>
      </view>
    </view>

    <!-- Campaign Story -->
    <view class="story-section">
      <view class="section-title">{{ t("story") }}</view>
      <text class="story-text">{{ campaign.story }}</text>
    </view>

    <!-- Recent Donations -->
    <view class="donations-section">
      <view class="section-title">{{ t("recentDonations") }}</view>
      <view v-if="recentDonations.length === 0" class="empty-state">
        <text>{{ t("noDonations") }}</text>
      </view>
      <view v-else class="donations-list">
        <view v-for="donation in recentDonations" :key="donation.id" class="donation-item">
          <view class="donor-info">
            <text class="donor-name">{{
              donation.donor === address ? t("youLabel") : formatAddress(donation.donor)
            }}</text>
            <text class="donation-amount">{{ formatAmount(donation.amount) }} GAS</text>
          </view>
          <text v-if="donation.message" class="donation-message">{{ donation.message }}</text>
          <text class="donation-time">{{ formatTime(donation.timestamp) }}</text>
        </view>
      </view>
    </view>

    <!-- Donation Form -->
    <FormCard
      v-if="campaign.status === 'active'"
      :title="t('makeDonation')"
      :submit-label="isDonating ? t('donationPending') : t('confirmDonation')"
      :submit-loading="isDonating"
      :submit-disabled="isDonating || !isValidDonation()"
      @submit="submitDonation"
    >
      <view class="quick-amounts">
        <view
          v-for="amount in [1, 5, 10, 50]"
          :key="amount"
          class="amount-chip"
          :class="{ active: donationForm.amount === amount }"
          role="button"
          tabindex="0"
          :aria-label="amount + ' GAS'"
          :aria-pressed="donationForm.amount === amount"
          @click="donationForm.amount = amount"
        >
          <text>{{ amount }} GAS</text>
        </view>
      </view>

      <view class="custom-amount">
        <input
          v-model.number="donationForm.amount"
          type="number"
          class="amount-input"
          :placeholder="t('customAmount')"
          min="0.1"
          step="0.1"
        />
      </view>

      <view class="message-input">
        <textarea
          v-model="donationForm.message"
          class="message-field"
          :placeholder="t('messagePlaceholder')"
          maxlength="200"
        />
      </view>

      <view class="donation-summary">
        <text class="summary-label">{{ t("donationAmount") }}:</text>
        <text class="summary-value">{{ donationForm.amount || 0 }} GAS</text>
      </view>
    </FormCard>
  </view>
</template>

<script setup lang="ts">
import { reactive, computed, inject } from "vue";
import { FormCard } from "@shared/components";
import { formatAddress } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { CharityCampaign, Donation } from "@/types";

interface Props {
  campaign: CharityCampaign;
  recentDonations: Donation[];
  isDonating: boolean;
}

const props = defineProps<Props>();

const { t } = createUseI18n(messages)();

const address = inject("address") as { value: string };

const emit = defineEmits<{
  back: [];
  donate: [data: { amount: number; message: string }];
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

const donationForm = reactive({
  amount: 10,
  message: "",
});

const progressPercent = computed(() => {
  const percent = (props.campaign.raisedAmount / props.campaign.targetAmount) * 100;
  return Math.min(percent, 100);
});

const formatAmount = (amount: number): string => {
  return amount.toFixed(2);
};

const formatTime = (timestamp: number): string => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / (1000 * 60));
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
};

const isValidDonation = (): boolean => {
  return donationForm.amount >= 0.1 && donationForm.amount <= 100000;
};

const submitDonation = () => {
  if (!isValidDonation()) return;
  emit("donate", {
    amount: donationForm.amount,
    message: donationForm.message,
  });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../charity-vault-theme.scss";

.campaign-detail {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.back-button {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 0;
  color: var(--charity-accent);
  font-weight: 500;
}

.detail-header {
  background: var(--charity-card-bg);
  border: 1px solid var(--charity-card-border);
  border-radius: 12px;
  padding: 16px;
}

.detail-category {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 12px;
  background: rgba(245, 158, 11, 0.15);
  color: var(--charity-accent);
  font-size: 11px;
  font-weight: 600;
  margin-bottom: 12px;
}

.detail-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--charity-text-primary);
  margin-bottom: 4px;
}

.detail-organizer {
  font-size: 12px;
  color: var(--charity-text-muted);
  margin-bottom: 16px;
}

.progress-section {
  margin-top: 12px;
}

.progress-bar {
  height: 12px;
  background: var(--charity-progress-bg);
  border-radius: 6px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--charity-progress-fill);
  border-radius: 6px;
  transition: width 0.3s ease;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 8px;
  font-size: 13px;
}

.raised {
  color: var(--charity-success);
  font-weight: 600;
}

.target {
  color: var(--charity-text-muted);
}

.percent {
  color: var(--charity-text-primary);
  font-weight: 700;
}

.story-section,
.donations-section,
.donation-form {
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

.story-text {
  font-size: 14px;
  color: var(--charity-text-secondary);
  line-height: 1.6;
}

.empty-state {
  text-align: center;
  padding: 24px;
  color: var(--charity-text-muted);
}

.donations-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.donation-item {
  padding: 12px;
  background: var(--charity-bg-secondary);
  border-radius: 8px;
}

.donor-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.donor-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--charity-text-primary);
}

.donation-amount {
  font-size: 14px;
  font-weight: 700;
  color: var(--charity-success);
}

.donation-message {
  font-size: 13px;
  color: var(--charity-text-secondary);
  font-style: italic;
  margin-top: 4px;
  display: block;
}

.donation-time {
  font-size: 11px;
  color: var(--charity-text-muted);
  margin-top: 8px;
  display: block;
}

.quick-amounts {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.amount-chip {
  padding: 8px 16px;
  background: var(--charity-bg-secondary);
  border: 1px solid var(--charity-input-border);
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  color: var(--charity-text-secondary);
  cursor: pointer;

  &.active {
    background: var(--charity-accent);
    border-color: var(--charity-accent);
    color: white;
  }
}

.custom-amount {
  margin-bottom: 12px;
}

.amount-input,
.message-field {
  width: 100%;
  background: var(--charity-input-bg);
  border: 1px solid var(--charity-input-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--charity-text-primary);
  font-size: 14px;
}

.message-field {
  min-height: 80px;
  resize: vertical;
}

.donation-summary {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--charity-bg-secondary);
  border-radius: 8px;
  margin-bottom: 12px;
}

.summary-label {
  font-size: 13px;
  color: var(--charity-text-secondary);
}

.summary-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--charity-success);
}

.donate-button {
  width: 100%;
  padding: 16px;
  background: var(--charity-btn-primary);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
