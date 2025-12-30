<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Quantum Swap</text>
      <text class="subtitle">Atomic cross-chain swaps</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"
      ><text>{{ status.msg }}</text></view
    >

    <view class="card">
      <text class="card-title">Swap Route</text>
      <view class="row"
        ><text>From</text><text class="v">{{ route.fromChain }} / {{ route.fromToken }}</text></view
      >
      <view class="row"
        ><text>To</text><text class="v">{{ route.toChain }} / {{ route.toToken }}</text></view
      >
      <view class="row"
        ><text>Rate</text><text class="v">1 {{ route.fromToken }} = {{ route.rate }} {{ route.toToken }}</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Swap Details</text>
      <uni-easyinput v-model="swapAmount" type="number" placeholder="Amount to swap" />
      <view class="detail-row">
        <text>You receive</text>
        <text class="receive">{{ fmt(parseFloat(swapAmount || "0") * route.rate, 4) }} {{ route.toToken }}</text>
      </view>
      <view class="detail-row">
        <text>Bridge fee (0.3%)</text>
        <text class="fee">{{ (parseFloat(swapAmount || "0") * 0.003).toFixed(4) }} {{ route.fromToken }}</text>
      </view>
      <view class="detail-row">
        <text>Time lock</text>
        <text class="lock">{{ swap.timeLock }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Initiate Swap</text>
      <view class="action-btn" @click="initiateSwap"
        ><text>{{ isLoading ? "Processing..." : "Start Atomic Swap" }}</text></view
      >
      <text class="note">Trustless cross-chain exchange via HTLC</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Route = { fromChain: string; fromToken: string; toChain: string; toToken: string; rate: number };
type Swap = { timeLock: string };

const APP_ID = "miniapp-quantum-swap";
const { payGAS, isLoading } = usePayments(APP_ID);

const route = ref<Route>({ fromChain: "Neo N3", fromToken: "GAS", toChain: "Ethereum", toToken: "ETH", rate: 0.00042 });
const swap = ref<Swap>({ timeLock: "24 hours" });
const swapAmount = ref<string>("");
const status = ref<Status | null>(null);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const initiateSwap = async (): Promise<void> => {
  if (isLoading.value) return;
  const amount = parseFloat(swapAmount.value);
  if (!(amount > 0)) return void (status.value = { msg: "Enter valid amount", type: "error" });
  const fee = (amount * 0.003).toFixed(4);
  try {
    await payGAS(fee, `qswap:${route.value.fromChain}:${route.value.toChain}:${amount}`);
    const received = fmt(amount * route.value.rate, 4);
    status.value = {
      msg: `Swap initiated: ${fmt(amount, 2)} ${route.value.fromToken} → ${received} ${route.value.toToken}`,
      type: "success",
    };
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
.detail-row {
  display: flex;
  justify-content: space-between;
  margin: 12px 0;
  color: $color-text-secondary;
}
.receive {
  color: $color-success;
  font-weight: 800;
}
.fee {
  color: $color-defi;
}
.lock {
  color: #f59e0b;
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
