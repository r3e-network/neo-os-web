<template>
  <view class="app-container">
    <view class="header">
      <text class="title">AI Trader</text>
      <text class="subtitle">Model-driven execution</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"><text>{{ status.msg }}</text></view>

    <view class="card">
      <text class="card-title">Performance</text>
      <view class="row"><text>Win rate</text><text class="v">{{ perf.winRate }}%</text></view>
      <view class="row"><text>30d ROI</text><text class="v">{{ perf.roi30d }}%</text></view>
      <view class="row"><text>Max drawdown</text><text class="v">{{ perf.maxDD }}%</text></view>
    </view>

    <view class="card">
      <text class="card-title">Strategy</text>
      <view class="row"><text>Selected</text><text class="v">{{ strategy || "Mean Reversion" }}</text></view>
      <view class="row"><text>Risk</text><text class="v">{{ risk || "Medium" }}</text></view>
      <view class="row"><text>Signal refresh</text><text class="v">{{ perf.refreshMins }}m</text></view>
    </view>

    <view class="card">
      <text class="card-title">Deploy</text>
      <uni-easyinput v-model="strategy" placeholder="Strategy (e.g., Momentum)" />
      <uni-easyinput v-model="risk" placeholder="Risk (Low/Medium/High)" />
      <uni-easyinput v-model="allocation" type="number" placeholder="Allocation (GAS)" />
      <view class="action-btn" @click="deploy"><text>{{ isLoading ? "Processing..." : "Deploy AI Trader" }}</text></view>
      <text class="note">Mock compute fee: {{ computeFee }} GAS</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Performance = { winRate: number; roi30d: number; maxDD: number; refreshMins: number };

const APP_ID = "miniapp-ai-trader";
const { payGAS, isLoading } = usePayments(APP_ID);

const perf = ref<Performance>({ winRate: 57, roi30d: 12.4, maxDD: 6.8, refreshMins: 5 });
const strategy = ref<string>("Mean Reversion");
const risk = ref<string>("Medium");
const allocation = ref<string>("50");
const computeFee = "0.015";
const status = ref<Status | null>(null);

const deploy = async (): Promise<void> => {
  if (isLoading.value) return;
  const amount = parseFloat(allocation.value);
  if (!(amount > 0)) return void (status.value = { msg: "Enter a valid allocation", type: "error" });
  try {
    await payGAS(computeFee, `ai:${strategy.value}:${risk.value}:${amount}`);
    status.value = { msg: `Deployed: ${strategy.value} (${risk.value})`, type: "success" };
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
