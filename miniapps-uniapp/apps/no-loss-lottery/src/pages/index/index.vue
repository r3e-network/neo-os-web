<template>
  <view class="app-container">
    <view class="header">
      <text class="title">No-Loss Lottery</text>
      <text class="subtitle">Prize savings account</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"
      ><text>{{ status.msg }}</text></view
    >

    <view class="card">
      <text class="card-title">Pool Stats</text>
      <view class="row"
        ><text>Total deposits</text><text class="v">{{ fmt(pool.totalDeposits, 0) }} GAS</text></view
      >
      <view class="row"
        ><text>Prize pool</text><text class="v">{{ fmt(pool.prizePool, 2) }} GAS</text></view
      >
      <view class="row"
        ><text>Next draw</text><text class="v">{{ pool.nextDraw }}</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Your Stats</text>
      <view class="row"
        ><text>Deposit</text><text class="v">{{ fmt(user.deposit, 2) }} GAS</text></view
      >
      <view class="row"
        ><text>Tickets</text><text class="v">{{ user.tickets }}</text></view
      >
      <view class="row"
        ><text>Yield sacrificed</text><text class="v">{{ fmt(user.yieldSacrificed, 3) }} GAS</text></view
      >
    </view>

    <view class="card">
      <text class="card-title">Join Lottery</text>
      <uni-easyinput v-model="depositAmount" type="number" placeholder="Amount to deposit" />
      <view class="info-row">
        <text>Tickets earned</text>
        <text class="tickets">{{ Math.floor(parseFloat(depositAmount || "0") / 10) }}</text>
      </view>
      <view class="action-btn" @click="joinLottery"
        ><text>{{ isLoading ? "Processing..." : "Deposit & Get Tickets" }}</text></view
      >
      <text class="note">1 ticket per 10 GAS. Principal always withdrawable.</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Pool = { totalDeposits: number; prizePool: number; nextDraw: string };
type User = { deposit: number; tickets: number; yieldSacrificed: number };

const APP_ID = "miniapp-no-loss-lottery";
const { payGAS, isLoading } = usePayments(APP_ID);

const pool = ref<Pool>({ totalDeposits: 850000, prizePool: 127.5, nextDraw: "2d 14h" });
const user = ref<User>({ deposit: 500, tickets: 50, yieldSacrificed: 0.875 });
const depositAmount = ref<string>("");
const status = ref<Status | null>(null);
const fmt = (n: number, d = 2) => formatNumber(n, d);

const joinLottery = async (): Promise<void> => {
  if (isLoading.value) return;
  const amount = parseFloat(depositAmount.value);
  if (!(amount >= 10)) return void (status.value = { msg: "Minimum deposit: 10 GAS", type: "error" });
  try {
    await payGAS(amount.toFixed(2), `noloss:deposit:${amount}`);
    const tickets = Math.floor(amount / 10);
    status.value = { msg: `Deposited ${fmt(amount, 2)} GAS, earned ${tickets} tickets`, type: "success" };
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
.info-row {
  display: flex;
  justify-content: space-between;
  margin: 16px 0;
  color: $color-text-secondary;
}
.tickets {
  color: $color-success;
  font-weight: 800;
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
