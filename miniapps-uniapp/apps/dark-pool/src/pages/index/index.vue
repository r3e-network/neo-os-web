<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Dark Pool</text>
      <text class="subtitle">Anonymous large-block trading</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"><text>{{ status.msg }}</text></view>

    <view class="card">
      <text class="card-title">Pool Stats</text>
      <view class="row"><text>24h volume</text><text class="v">{{ fmt(pool.volume24h, 0) }} GAS</text></view>
      <view class="row"><text>Avg. block size</text><text class="v">{{ fmt(pool.avgBlockSize, 0) }} GAS</text></view>
      <view class="row"><text>Privacy level</text><text class="v">{{ pool.privacyLevel }}</text></view>
    </view>

    <view class="card">
      <text class="card-title">Your Order</text>
      <view class="row"><text>Type</text><text class="v">{{ orderType || "Buy" }}</text></view>
      <view class="row"><text>Amount</text><text class="v">{{ amount || "0" }} GAS</text></view>
      <view class="row"><text>Slippage</text><text class="v">{{ slippage || "0.5" }}%</text></view>
    </view>

    <view class="card">
      <text class="card-title">Place Order</text>
      <uni-easyinput v-model="orderType" placeholder="Type (Buy/Sell)" />
      <uni-easyinput v-model="amount" type="number" placeholder="Amount (min 1000 GAS)" />
      <uni-easyinput v-model="slippage" type="number" placeholder="Max slippage %" />
      <view class="action-btn" @click="placeOrder"><text>{{ isLoading ? "Processing..." : "Place Dark Order" }}</text></view>
      <text class="note">Mock privacy fee: {{ privacyFee }} GAS</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Pool = { volume24h: number; avgBlockSize: number; privacyLevel: string };

const APP_ID = "miniapp-dark-pool";
const { payGAS, isLoading } = usePayments(APP_ID);

const pool = ref<Pool>({ volume24h: 850000, avgBlockSize: 5000, privacyLevel: "High (ZK)" });
const orderType = ref<string>("Buy");
const amount = ref<string>("");
const slippage = ref<string>("0.5");
const privacyFee = "0.050";
const status = ref<Status | null>(null);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const placeOrder = async (): Promise<void> => {
  if (isLoading.value) return;
  const amt = parseFloat(amount.value), slip = parseFloat(slippage.value);
  if (!(amt >= 1000 && slip > 0 && slip <= 5)) return void (status.value = { msg: "Min 1000 GAS, slippage 0-5%", type: "error" });
  try {
    await payGAS(privacyFee, `darkpool:${orderType.value}:${amt}:${slip}`);
    status.value = { msg: `Dark order placed: ${orderType.value} ${amt} GAS`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e?.message || "Payment failed", type: "error" };
  }
};
</script>

<style lang="scss">
@import "@/shared/styles/theme.scss";
.app-container { min-height: 100vh; background: linear-gradient(135deg, $color-bg-primary 0%, $color-bg-secondary 100%); color: #fff; padding: 20px; }
.header { text-align: center; margin-bottom: 24px; }
.title { font-size: 1.8em; font-weight: 800; color: $color-defi; }
.subtitle { color: $color-text-secondary; font-size: 0.9em; margin-top: 8px; }
.status-msg { text-align: center; padding: 12px; border-radius: 10px; margin-bottom: 16px;
  &.success { background: rgba($color-success, 0.15); color: $color-success; }
  &.error { background: rgba($color-error, 0.15); color: $color-error; }
}
.card { background: $color-bg-card; border: 1px solid $color-border; border-radius: 16px; padding: 18px; margin-bottom: 16px; }
.card-title { color: $color-defi; font-size: 1.05em; font-weight: 800; display: block; margin-bottom: 10px; }
.row { display: flex; justify-content: space-between; padding: 12px; background: rgba($color-defi, 0.1); border-radius: 10px; margin-bottom: 8px; }
.v { color: $color-defi; font-weight: 800; }
.action-btn { background: linear-gradient(135deg, $color-defi 0%, darken($color-defi, 10%) 100%); padding: 14px; border-radius: 12px; text-align: center; font-weight: 800; margin-top: 12px; }
.note { display: block; margin-top: 10px; font-size: 0.85em; color: $color-text-secondary; }
</style>
