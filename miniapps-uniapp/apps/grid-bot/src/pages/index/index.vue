<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Grid Bot</text>
      <text class="subtitle">Automated range trading</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"><text>{{ status.msg }}</text></view>

    <view class="card">
      <text class="card-title">Market</text>
      <view class="row"><text>Pair</text><text class="v">{{ market.pair }}</text></view>
      <view class="row"><text>Last price</text><text class="v">{{ fmt(market.lastPrice, 3) }}</text></view>
      <view class="row"><text>Volatility</text><text class="v">{{ market.volatility }}%</text></view>
    </view>

    <view class="card">
      <text class="card-title">Bot Snapshot</text>
      <view class="row"><text>Range</text><text class="v">{{ priceLow || "10" }}–{{ priceHigh || "14" }}</text></view>
      <view class="row"><text>Grids</text><text class="v">{{ gridLevels || "20" }}</text></view>
      <view class="row"><text>Est. daily</text><text class="v">{{ fmt(bot.estDaily, 2) }} GAS</text></view>
    </view>

    <view class="card">
      <text class="card-title">Create Bot</text>
      <uni-easyinput v-model="priceLow" type="number" placeholder="Low price" />
      <uni-easyinput v-model="priceHigh" type="number" placeholder="High price" />
      <uni-easyinput v-model="gridLevels" type="number" placeholder="Grid levels" />
      <view class="action-btn" @click="startBot"><text>{{ isLoading ? "Processing..." : "Start Grid Bot" }}</text></view>
      <text class="note">Mock execution fee: {{ setupFee }} GAS</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Market = { pair: string; lastPrice: number; volatility: number };
type Bot = { estDaily: number };

const APP_ID = "miniapp-grid-bot";
const { payGAS, isLoading } = usePayments(APP_ID);

const market = ref<Market>({ pair: "NEO/GAS", lastPrice: 12.384, volatility: 3.2 });
const bot = ref<Bot>({ estDaily: 0.42 });
const priceLow = ref<string>("10");
const priceHigh = ref<string>("14");
const gridLevels = ref<string>("20");
const setupFee = "0.020";
const status = ref<Status | null>(null);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const startBot = async (): Promise<void> => {
  if (isLoading.value) return;
  const low = parseFloat(priceLow.value), high = parseFloat(priceHigh.value), grids = parseInt(gridLevels.value, 10);
  if (!(low > 0 && high > low && grids >= 5 && grids <= 200)) return void (status.value = { msg: "Invalid range or grid levels", type: "error" });
  try {
    await payGAS(setupFee, `gridbot:${market.value.pair}:${low}-${high}:${grids}`);
    status.value = { msg: `Grid bot started (${grids} grids)`, type: "success" };
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
