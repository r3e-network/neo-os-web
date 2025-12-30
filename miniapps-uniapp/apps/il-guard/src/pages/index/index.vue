<template>
  <view class="app-container">
    <view class="header">
      <text class="title">IL Guard</text>
      <text class="subtitle">Impermanent loss protection</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"
      ><text>{{ status.msg }}</text></view
    >

    <view class="card">
      <text class="card-title">Pool Info</text>
      <view class="row"
        ><text>Pair</text><text class="v">{{ pool.pair }}</text></view
      >
      <view class="row"
        ><text>TVL</text><text class="v">{{ fmt(pool.tvl, 0) }} GAS</text></view
      >
      <view class="row"
        ><text>IL Risk</text><text class="v risk">{{ pool.ilRisk }}%</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Your Position</text>
      <view class="row"
        ><text>Deposited</text><text class="v">{{ fmt(position.deposited, 2) }} GAS</text></view
      >
      <view class="row"
        ><text>Current value</text><text class="v">{{ fmt(position.currentValue, 2) }} GAS</text></view
      >
      <view class="row"
        ><text>IL Amount</text><text class="v loss">-{{ fmt(position.ilAmount, 2) }} GAS</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Activate Protection</text>
      <uni-easyinput v-model="protectionAmount" type="number" placeholder="Amount to protect" />
      <view class="fee-row">
        <text>Protection fee (2%)</text>
        <text class="fee">{{ (parseFloat(protectionAmount || "0") * 0.02).toFixed(3) }} GAS</text>
      </view>
      <view class="action-btn" @click="activateProtection"
        ><text>{{ isLoading ? "Processing..." : "Activate IL Guard" }}</text></view
      >
      <text class="note">Coverage: 90% of IL up to {{ protectionAmount || "0" }} GAS</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Pool = { pair: string; tvl: number; ilRisk: number };
type Position = { deposited: number; currentValue: number; ilAmount: number };

const APP_ID = "miniapp-il-guard";
const { payGAS, isLoading } = usePayments(APP_ID);

const pool = ref<Pool>({ pair: "NEO/GAS", tvl: 125000, ilRisk: 8.3 });
const position = ref<Position>({ deposited: 1000, currentValue: 917, ilAmount: 83 });
const protectionAmount = ref<string>("");
const status = ref<Status | null>(null);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const activateProtection = async (): Promise<void> => {
  if (isLoading.value) return;
  const amount = parseFloat(protectionAmount.value);
  if (!(amount > 0 && amount <= position.value.deposited))
    return void (status.value = { msg: `Enter 0.01-${position.value.deposited}`, type: "error" });
  const fee = (amount * 0.02).toFixed(3);
  try {
    await payGAS(fee, `ilguard:${pool.value.pair}:${amount}`);
    status.value = { msg: `IL protection activated for ${fmt(amount, 2)} GAS`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e?.message || "Payment failed", type: "error" };
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
  font-weight: 800;
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
  border-radius: 10px;
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
  padding: 18px;
  margin-bottom: 16px;
}
.card-title {
  color: $color-defi;
  font-size: 1.05em;
  font-weight: 800;
  display: block;
  margin-bottom: 10px;
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: rgba($color-defi, 0.1);
  border-radius: 10px;
  margin-bottom: 8px;
}
.v {
  color: $color-defi;
  font-weight: 800;
}
.risk {
  color: #f59e0b;
}
.loss {
  color: $color-error;
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
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: 800;
}
.note {
  display: block;
  margin-top: 10px;
  font-size: 0.85em;
  color: $color-text-secondary;
}
</style>
