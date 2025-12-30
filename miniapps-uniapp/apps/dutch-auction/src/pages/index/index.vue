<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Dutch Auction</text>
      <text class="subtitle">Descending price discovery</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"
      ><text>{{ status.msg }}</text></view
    >

    <view class="card">
      <text class="card-title">Active Auction</text>
      <view class="row"
        ><text>Current price</text><text class="v">{{ fmt(auction.currentPrice, 3) }} GAS</text></view
      >
      <view class="row"
        ><text>Start price</text><text class="v">{{ fmt(auction.startPrice, 3) }} GAS</text></view
      >
      <view class="row"
        ><text>Time left</text><text class="v">{{ auction.timeLeft }}</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Auction Details</text>
      <view class="row"
        ><text>Item</text><text class="v">{{ auction.item }}</text></view
      >
      <view class="row"
        ><text>Quantity</text><text class="v">{{ auction.quantity }}</text></view
      >
      <view class="row"
        ><text>Price drop</text><text class="v">{{ auction.dropRate }}/min</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Bid Now</text>
      <uni-easyinput v-model="bidQuantity" type="number" placeholder="Quantity to buy" />
      <view class="price-display">
        <text>Total: {{ fmt(parseFloat(bidQuantity || "0") * auction.currentPrice, 3) }} GAS</text>
      </view>
      <view class="action-btn" @click="placeBid"
        ><text>{{ isLoading ? "Processing..." : "Accept Current Price" }}</text></view
      >
      <text class="note">Mock auction fee: {{ auctionFee }} GAS</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Auction = {
  currentPrice: number;
  startPrice: number;
  timeLeft: string;
  item: string;
  quantity: number;
  dropRate: string;
};

const APP_ID = "miniapp-dutch-auction";
const { payGAS, isLoading } = usePayments(APP_ID);

const auction = ref<Auction>({
  currentPrice: 8.5,
  startPrice: 12.0,
  timeLeft: "18m 42s",
  item: "NEO Tokens",
  quantity: 100,
  dropRate: "0.1 GAS",
});
const bidQuantity = ref<string>("");
const auctionFee = "0.008";
const status = ref<Status | null>(null);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const placeBid = async (): Promise<void> => {
  if (isLoading.value) return;
  const qty = parseInt(bidQuantity.value, 10);
  if (!(qty > 0 && qty <= auction.value.quantity))
    return void (status.value = { msg: `Enter 1-${auction.value.quantity}`, type: "error" });
  const total = (qty * auction.value.currentPrice + parseFloat(auctionFee)).toFixed(3);
  try {
    await payGAS(total, `auction:${auction.value.item}:${qty}:${auction.value.currentPrice}`);
    status.value = { msg: `Bid accepted: ${qty} @ ${fmt(auction.value.currentPrice, 3)} GAS`, type: "success" };
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
.price-display {
  text-align: center;
  padding: 12px;
  background: rgba($color-defi, 0.15);
  border-radius: 10px;
  margin: 12px 0;
  font-size: 1.1em;
  font-weight: 800;
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
