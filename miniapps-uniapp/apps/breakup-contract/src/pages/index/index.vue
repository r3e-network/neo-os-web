<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Breakup Contract</text>
      <text class="subtitle">Relationship stakes</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Create Contract</text>
      <uni-easyinput v-model="partnerAddress" placeholder="Partner's address" />
      <uni-easyinput v-model="stakeAmount" type="number" placeholder="Stake amount (GAS)" />
      <uni-easyinput v-model="duration" type="number" placeholder="Duration (days)" />
      <view class="action-btn" @click="createContract">
        <text>{{ isLoading ? "Creating..." : "Create Contract" }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Active Contracts</text>
      <view v-for="contract in contracts" :key="contract.id" class="contract-item">
        <view class="contract-header">
          <text class="contract-partner">{{ contract.partner }}</text>
          <text class="contract-stake">{{ contract.stake }} GAS</text>
        </view>
        <view class="contract-progress">
          <view class="progress-bar" :style="{ width: contract.progress + '%' }"></view>
        </view>
        <view class="contract-footer">
          <text class="contract-days">{{ contract.daysLeft }} days left</text>
          <view class="contract-btn" @click="claimReward(contract)">
            <text>Claim</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-breakupcontract";
const { payGAS, isLoading } = usePayments(APP_ID);

const partnerAddress = ref("");
const stakeAmount = ref("");
const duration = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const contracts = ref([
  { id: "1", partner: "NX8...abc", stake: "10", progress: 65, daysLeft: 105 },
  { id: "2", partner: "NY2...def", stake: "5", progress: 30, daysLeft: 210 },
]);

const createContract = async () => {
  if (!partnerAddress.value || !stakeAmount.value || isLoading.value) return;
  try {
    await payGAS(stakeAmount.value, `contract:${partnerAddress.value.slice(0, 10)}`);
    status.value = { msg: "Contract created!", type: "success" };
    partnerAddress.value = "";
    stakeAmount.value = "";
    duration.value = "";
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const claimReward = async (contract: any) => {
  if (contract.progress < 100) {
    status.value = { msg: "Contract not completed yet!", type: "error" };
    return;
  }
  status.value = { msg: `Claimed ${contract.stake} GAS!`, type: "success" };
};
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%);
  color: #fff;
  padding: 20px;
}
.header {
  text-align: center;
  margin-bottom: 24px;
}
.title {
  font-size: 1.8em;
  font-weight: bold;
  color: $color-social;
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
}
.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
  margin-bottom: 16px;
}
.card-title {
  color: $color-social;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}
.contract-item {
  padding: 14px;
  background: rgba($color-social, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
}
.contract-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.contract-partner {
  font-weight: bold;
}
.contract-stake {
  color: $color-social;
  font-weight: bold;
}
.contract-progress {
  height: 6px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 10px;
}
.progress-bar {
  height: 100%;
  background: $color-social;
}
.contract-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.contract-days {
  font-size: 0.85em;
  color: $color-text-secondary;
}
.contract-btn {
  padding: 6px 16px;
  background: $color-social;
  border-radius: 8px;
  font-size: 0.85em;
  font-weight: bold;
}
.action-btn {
  background: linear-gradient(135deg, $color-social 0%, darken($color-social, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  margin-top: 12px;
}
</style>
