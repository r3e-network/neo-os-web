<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Unbreakable Vault</text>
      <text class="subtitle">Secure asset storage</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <text class="card-title">Vault Balance</text>
      <view class="balance-display">
        <text class="balance">{{ formatNum(vaultBalance) }}</text>
        <text class="balance-label">GAS</text>
      </view>
      <view class="security-row">
        <text class="security-label">Security Level</text>
        <text class="security-value">🔒 Maximum</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Deposit</text>
      <uni-easyinput v-model="depositAmount" type="number" placeholder="Amount to deposit" class="input" />
      <view class="action-btn" @click="deposit" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Processing..." : "Deposit to Vault" }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Withdraw</text>
      <uni-easyinput v-model="withdrawAmount" type="number" placeholder="Amount to withdraw" class="input" />
      <text class="warning-text">⚠ 24h time lock applies</text>
      <view class="action-btn secondary" @click="withdraw">
        <text>Request Withdrawal</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-unbreakable-vault";
const { payGAS, isLoading } = usePayments(APP_ID);

const vaultBalance = ref(1250.75);
const depositAmount = ref("");
const withdrawAmount = ref("");
const status = ref<{ msg: string; type: string } | null>(null);

const formatNum = (n: number) => formatNumber(n, 2);

const deposit = async () => {
  if (isLoading.value) return;
  const amount = parseFloat(depositAmount.value);
  if (!amount || amount <= 0) {
    status.value = { msg: "Invalid amount", type: "error" };
    return;
  }
  try {
    await payGAS(String(amount), `vault:deposit:${amount}`);
    vaultBalance.value += amount;
    status.value = { msg: `Deposited ${amount} GAS`, type: "success" };
    depositAmount.value = "";
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const withdraw = () => {
  const amount = parseFloat(withdrawAmount.value);
  if (!amount || amount <= 0 || amount > vaultBalance.value) {
    status.value = { msg: "Invalid amount", type: "error" };
    return;
  }
  status.value = { msg: "Withdrawal request submitted. Available in 24h", type: "success" };
  withdrawAmount.value = "";
};
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
  color: $color-utility;
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
  color: $color-utility;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}
.balance-display {
  text-align: center;
  padding: 20px;
  background: rgba($color-utility, 0.1);
  border-radius: 12px;
  margin-bottom: 12px;
}
.balance {
  font-size: 2.5em;
  font-weight: bold;
  color: $color-utility;
  display: block;
}
.balance-label {
  color: $color-text-secondary;
  font-size: 0.9em;
}
.security-row {
  display: flex;
  justify-content: space-between;
  padding: 10px;
}
.security-label {
  color: $color-text-secondary;
}
.security-value {
  color: $color-success;
  font-weight: bold;
}
.input {
  margin-bottom: 12px;
}
.warning-text {
  color: $color-warning;
  font-size: 0.85em;
  display: block;
  margin-bottom: 12px;
  text-align: center;
}
.action-btn {
  background: linear-gradient(135deg, $color-utility 0%, darken($color-utility, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  &.secondary {
    background: rgba($color-utility, 0.3);
  }
}
</style>
