<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Gas Sponsor</text>
      <text class="subtitle">Free Gas for New Users</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <text class="card-title">Your Status</text>
      <view v-if="loading" class="loading">
        <text>Checking eligibility...</text>
      </view>
      <view v-else>
        <view class="info-row">
          <text class="info-label">Wallet Address</text>
          <text class="info-value">{{ shortenAddress(userAddress) }}</text>
        </view>
        <view class="info-row">
          <text class="info-label">GAS Balance</text>
          <text class="info-value">{{ formatBalance(gasBalance) }} GAS</text>
        </view>
        <view class="info-row">
          <text class="info-label">Eligibility</text>
          <text :class="['info-value', isEligible ? 'eligible' : 'not-eligible']">
            {{ isEligible ? "✓ Eligible" : "✗ Not Eligible" }}
          </text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Daily Quota</text>
      <view class="quota-display">
        <view class="quota-bar">
          <view class="quota-fill" :style="{ width: quotaPercent + '%' }"></view>
        </view>
        <text class="quota-text">{{ formatBalance(usedQuota) }} / {{ formatBalance(dailyLimit) }} GAS</text>
      </view>
      <view class="info-row">
        <text class="info-label">Remaining Today</text>
        <text class="info-value">{{ formatBalance(remainingQuota) }} GAS</text>
      </view>
      <view class="info-row">
        <text class="info-label">Resets In</text>
        <text class="info-value">{{ resetTime }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Request Sponsored Gas</text>
      <view v-if="!isEligible" class="not-eligible-msg">
        <text>Your GAS balance exceeds 0.1 GAS.</text>
        <text>This service is for new users only.</text>
      </view>
      <view v-else-if="remainingQuota <= 0" class="not-eligible-msg">
        <text>Daily quota exhausted.</text>
        <text>Please try again tomorrow.</text>
      </view>
      <view v-else>
        <view class="input-group">
          <text class="input-label">Amount (GAS)</text>
          <input type="digit" v-model="requestAmount" placeholder="0.01" class="input-field" :max="maxRequestAmount" />
        </view>
        <view class="action-btn" @click="requestSponsorship" :style="{ opacity: isRequesting ? 0.6 : 1 }">
          <text>{{ isRequesting ? "Processing..." : "Request Gas" }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">How It Works</text>
      <view class="help-item">
        <text class="help-num">1</text>
        <text class="help-text">New users with less than 0.1 GAS are eligible</text>
      </view>
      <view class="help-item">
        <text class="help-num">2</text>
        <text class="help-text">Request up to 0.1 GAS per day for free</text>
      </view>
      <view class="help-item">
        <text class="help-num">3</text>
        <text class="help-text">Use sponsored gas to pay transaction fees</text>
      </view>
      <view class="help-item">
        <text class="help-num">4</text>
        <text class="help-text">Once you have enough GAS, help others!</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet, useGasSponsor } from "@neo/uniapp-sdk";

const { address, connect } = useWallet();
const { isLoading: isRequesting, checkEligibility, requestSponsorship: apiRequest } = useGasSponsor();

const ELIGIBILITY_THRESHOLD = 0.1;

const userAddress = ref("");
const gasBalance = ref("0");
const usedQuota = ref("0");
const dailyLimit = ref("0.1");
const resetsAt = ref("");
const loading = ref(true);
const requestAmount = ref("0.01");
const status = ref<{ msg: string; type: string } | null>(null);

const isEligible = computed(() => parseFloat(gasBalance.value) < parseFloat(ELIGIBILITY_THRESHOLD));
const remainingQuota = computed(() => Math.max(0, parseFloat(dailyLimit.value) - parseFloat(usedQuota.value)));
const quotaPercent = computed(() => (parseFloat(usedQuota.value) / parseFloat(dailyLimit.value)) * 100);
const maxRequestAmount = computed(() => Math.min(remainingQuota.value, 0.05).toString());

const resetTime = computed(() => {
  if (!resetsAt.value) return "--";
  const resetDate = new Date(resetsAt.value);
  const now = new Date();
  const diff = resetDate.getTime() - now.getTime();
  if (diff <= 0) return "Now";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
});

const shortenAddress = (addr: string) => (addr ? `${addr.slice(0, 6)}...${addr.slice(-4)}` : "Not connected");
const formatBalance = (val: string | number) => parseFloat(String(val)).toFixed(4);

const showStatus = (msg: string, type: string) => {
  status.value = { msg, type };
  setTimeout(() => (status.value = null), 5000);
};

const loadUserData = async () => {
  loading.value = true;
  try {
    await connect();
    userAddress.value = address.value || "";

    // Call API to check eligibility and quota
    const status = await checkEligibility();
    gasBalance.value = status.gas_balance;
    usedQuota.value = status.used_today;
    dailyLimit.value = status.daily_limit;
    resetsAt.value = status.resets_at;
  } catch (e: any) {
    showStatus(e.message || "Failed to load data", "error");
  } finally {
    loading.value = false;
  }
};

const requestSponsorship = async () => {
  if (!isEligible.value || remainingQuota.value <= 0) return;

  const amount = parseFloat(requestAmount.value);
  if (isNaN(amount) || amount <= 0 || amount > remainingQuota.value) {
    showStatus("Invalid amount", "error");
    return;
  }

  try {
    showStatus("Requesting sponsored gas...", "loading");

    // Call backend API
    const result = await apiRequest(requestAmount.value);

    showStatus(`Request submitted! ID: ${result.request_id.slice(0, 8)}...`, "success");
    requestAmount.value = "0.01";

    // Refresh data
    await loadUserData();
  } catch (e: any) {
    showStatus(e.message || "Sponsorship request failed", "error");
  }
};

onMounted(() => {
  loadUserData();
});
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";

.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: $color-text-primary;
  padding: 20px;
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.title {
  font-size: 1.8em;
  font-weight: bold;
  color: $color-success;
}

.subtitle {
  color: $color-text-secondary;
  font-size: 0.9em;
  margin-top: 8px;
}

.status-msg {
  text-align: center;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
  &.success {
    background: rgba($color-success, 0.15);
    color: $color-success;
  }
  &.error {
    background: rgba($color-error, 0.15);
    color: $color-error;
  }
  &.loading {
    background: rgba($color-info, 0.15);
    color: $color-info;
  }
}

.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}

.card-title {
  color: $color-success;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}

.loading {
  text-align: center;
  padding: 20px;
  color: $color-text-secondary;
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid $color-border;
  &:last-child {
    border-bottom: none;
  }
}

.info-label {
  color: $color-text-secondary;
}

.info-value {
  color: $color-text-primary;
  font-weight: bold;
  &.eligible {
    color: $color-success;
  }
  &.not-eligible {
    color: $color-error;
  }
}

.quota-display {
  margin-bottom: 12px;
}

.quota-bar {
  height: 8px;
  background: rgba($color-success, 0.2);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.quota-fill {
  height: 100%;
  background: $color-success;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.quota-text {
  font-size: 0.85em;
  color: $color-text-secondary;
  text-align: center;
  display: block;
}

.not-eligible-msg {
  text-align: center;
  padding: 20px;
  color: $color-text-secondary;
  text {
    display: block;
    margin-bottom: 8px;
  }
}

.input-group {
  margin-bottom: 16px;
}

.input-label {
  display: block;
  color: $color-text-secondary;
  margin-bottom: 8px;
  font-size: 0.9em;
}

.input-field {
  width: 100%;
  padding: 12px;
  background: rgba($color-success, 0.1);
  border: 1px solid $color-border;
  border-radius: 8px;
  color: $color-text-primary;
  font-size: 1em;
}

.action-btn {
  background: linear-gradient(135deg, $color-success 0%, darken($color-success, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}

.help-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 0;
}

.help-num {
  width: 24px;
  height: 24px;
  background: rgba($color-success, 0.2);
  color: $color-success;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85em;
  font-weight: bold;
  flex-shrink: 0;
}

.help-text {
  color: $color-text-secondary;
  font-size: 0.9em;
  line-height: 1.4;
}
</style>
