<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Compound Capsule</text>
      <text class="subtitle">Auto-compounding savings</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"><text>{{ status.msg }}</text></view>

    <view class="card">
      <text class="card-title">Vault Stats</text>
      <view class="row"><text>APY</text><text class="v">{{ vault.apy }}%</text></view>
      <view class="row"><text>TVL</text><text class="v">{{ fmt(vault.tvl, 0) }} GAS</text></view>
      <view class="row"><text>Compound freq</text><text class="v">{{ vault.compoundFreq }}</text></view>
    </view>

    <view class="card">
      <text class="card-title">Your Position</text>
      <view class="row"><text>Deposited</text><text class="v">{{ fmt(position.deposited, 2) }} GAS</text></view>
      <view class="row"><text>Earned</text><text class="v">+{{ fmt(position.earned, 4) }} GAS</text></view>
      <view class="row"><text>Est. 30d</text><text class="v">{{ fmt(position.est30d, 2) }} GAS</text></view>
    </view>

    <view class="card">
      <text class="card-title">Manage</text>
      <uni-easyinput v-model="amount" type="number" placeholder="Amount (GAS)" />
      <view class="action-btn" @click="deposit"><text>{{ isLoading ? "Processing..." : "Deposit" }}</text></view>
      <text class="note">Mock deposit fee: {{ depositFee }} GAS</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Vault = { apy: number; tvl: number; compoundFreq: string };
type Position = { deposited: number; earned: number; est30d: number };

const APP_ID = "miniapp-compound-capsule";
const { payGAS, isLoading } = usePayments(APP_ID);

const vault = ref<Vault>({ apy: 18.5, tvl: 125000, compoundFreq: "Every 6h" });
const position = ref<Position>({ deposited: 100, earned: 1.2345, est30d: 1.54 });
const amount = ref<string>("");
const depositFee = "0.010";
const status = ref<Status | null>(null);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const deposit = async (): Promise<void> => {
  if (isLoading.value) return;
  const amt = parseFloat(amount.value);
  if (!(amt > 0)) return void (status.value = { msg: "Enter a valid amount", type: "error" });
  try {
    await payGAS((amt + parseFloat(depositFee)).toFixed(3), `compound:deposit:${amt}`);
    position.value.deposited += amt;
    status.value = { msg: `Deposited ${amt} GAS`, type: "success" };
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
