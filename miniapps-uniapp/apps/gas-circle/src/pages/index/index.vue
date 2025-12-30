<template>
  <view class="app-container">
    <view class="header">
      <text class="title">GAS Circle</text>
      <text class="subtitle">Rotating savings group</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]"><text>{{ status.msg }}</text></view>

    <view class="card">
      <text class="card-title">Active Circle</text>
      <view class="row"><text>Members</text><text class="v">{{ circle.members }}/{{ circle.maxMembers }}</text></view>
      <view class="row"><text>Contribution</text><text class="v">{{ circle.contribution }} GAS</text></view>
      <view class="row"><text>Next payout</text><text class="v">{{ circle.nextPayout }}</text></view>
    </view>

    <view class="card">
      <text class="card-title">Your Status</text>
      <view class="row"><text>Position</text><text class="v">#{{ userStatus.position }}</text></view>
      <view class="row"><text>Contributed</text><text class="v">{{ userStatus.contributed }}/{{ circle.contribution }} GAS</text></view>
      <view class="row"><text>Received</text><text class="v">{{ userStatus.received ? "Yes" : "Pending" }}</text></view>
    </view>

    <view class="card">
      <text class="card-title">Join Circle</text>
      <uni-easyinput v-model="contribution" type="number" placeholder="Monthly contribution (GAS)" />
      <uni-easyinput v-model="duration" type="number" placeholder="Duration (months)" />
      <view class="action-btn" @click="join"><text>{{ isLoading ? "Processing..." : "Join Circle" }}</text></view>
      <text class="note">Mock setup fee: {{ setupFee }} GAS</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

type StatusType = "success" | "error";
type Status = { msg: string; type: StatusType };
type Circle = { members: number; maxMembers: number; contribution: number; nextPayout: string };
type UserStatus = { position: number; contributed: number; received: boolean };

const APP_ID = "miniapp-gas-circle";
const { payGAS, isLoading } = usePayments(APP_ID);

const circle = ref<Circle>({ members: 8, maxMembers: 12, contribution: 50, nextPayout: "3 days" });
const userStatus = ref<UserStatus>({ position: 5, contributed: 50, received: false });
const contribution = ref<string>("50");
const duration = ref<string>("12");
const setupFee = "0.005";
const status = ref<Status | null>(null);

const join = async (): Promise<void> => {
  if (isLoading.value) return;
  const contrib = parseFloat(contribution.value), dur = parseInt(duration.value, 10);
  if (!(contrib > 0 && dur >= 3 && dur <= 24)) return void (status.value = { msg: "Invalid parameters", type: "error" });
  try {
    await payGAS(setupFee, `circle:join:${contrib}:${dur}`);
    status.value = { msg: `Joined circle (${contrib} GAS/month)`, type: "success" };
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
