<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Flash Loan</text>
      <text class="subtitle">Instant uncollateralized loans</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Available Liquidity</text>
      <view class="liquidity-row">
        <text class="token">GAS</text>
        <text class="amount">{{ formatNum(gasLiquidity) }}</text>
      </view>
      <view class="liquidity-row">
        <text class="token">NEO</text>
        <text class="amount">{{ neoLiquidity }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Request Flash Loan</text>
      <uni-easyinput v-model="loanAmount" type="number" placeholder="Amount" />
      <view class="fee-row">
        <text>Fee (0.09%)</text>
        <text class="fee">{{ (parseFloat(loanAmount || "0") * 0.0009).toFixed(4) }} GAS</text>
      </view>
      <view class="action-btn" @click="requestLoan">
        <text>{{ isLoading ? "Processing..." : "Execute Flash Loan" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-flashloan";
const { payGAS, isLoading } = usePayments(APP_ID);

const gasLiquidity = ref(50000);
const neoLiquidity = ref(1000);
const loanAmount = ref("");
const status = ref<{ msg: string; type: string } | null>(null);

const formatNum = (n: number) => formatNumber(n, 0);

const requestLoan = async () => {
  if (isLoading.value) return;
  const amount = parseFloat(loanAmount.value);
  if (amount <= 0 || amount > gasLiquidity.value) {
    status.value = { msg: "Invalid amount", type: "error" };
    return;
  }
  try {
    const fee = (amount * 0.0009).toFixed(4);
    await payGAS(fee, `flashloan:${amount}`);
    status.value = { msg: `Flash loan executed: ${amount} GAS`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
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
  color: $color-defi;
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
  color: $color-defi;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}
.liquidity-row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba($color-defi, 0.1);
  border-radius: 8px;
  margin-bottom: 8px;
}
.token {
  color: $color-text-primary;
  font-weight: bold;
}
.amount {
  color: $color-defi;
  font-weight: bold;
}
.fee-row {
  display: flex;
  justify-content: space-between;
  margin: 16px 0;
  color: $color-text-secondary;
}
.fee {
  color: $color-defi;
}
.action-btn {
  background: linear-gradient(135deg, $color-defi 0%, darken($color-defi, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
</style>
