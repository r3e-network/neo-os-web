<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Dead Switch</text>
      <text class="subtitle">Dead man's switch protocol</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Active Switches</text>
      <view v-for="sw in switches" :key="sw.id" class="switch-item">
        <text class="switch-icon">{{ sw.active ? "⏰" : "⚠️" }}</text>
        <view class="switch-info">
          <text class="switch-name">{{ sw.name }}</text>
          <text class="switch-timer">{{ sw.active ? `Check-in: ${sw.daysLeft} days` : "TRIGGERED" }}</text>
        </view>
        <view v-if="sw.active" class="checkin-btn" @click="checkIn(sw)">
          <text>✓</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Create Switch</text>
      <uni-easyinput v-model="newSwitch.name" placeholder="Switch name" class="input-field" />
      <uni-easyinput v-model="newSwitch.recipient" placeholder="Recipient address" class="input-field" />
      <uni-easyinput v-model="newSwitch.amount" type="number" placeholder="Amount (GAS)" class="input-field" />
      <view class="interval-row">
        <text class="interval-label">Check-in interval:</text>
        <uni-easyinput v-model="newSwitch.interval" type="number" placeholder="30" class="interval-input" />
        <text class="interval-text">days</text>
      </view>
      <view class="create-btn" @click="create" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Creating..." : "Create Switch" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-deadswitch";
const { payGAS, isLoading } = usePayments(APP_ID);

interface Switch {
  id: string;
  name: string;
  recipient: string;
  amount: number;
  daysLeft: number;
  active: boolean;
}

const switches = ref<Switch[]>([
  { id: "1", name: "Emergency Fund", recipient: "NXXx...abc", amount: 100, daysLeft: 15, active: true },
  { id: "2", name: "Backup Wallet", recipient: "NXXx...def", amount: 50, daysLeft: 7, active: true },
]);
const newSwitch = ref({ name: "", recipient: "", amount: "", interval: "30" });
const status = ref<{ msg: string; type: string } | null>(null);

const checkIn = async (sw: Switch) => {
  try {
    status.value = { msg: "Checking in...", type: "loading" };
    await payGAS("0.1", `checkin:${sw.id}`);
    sw.daysLeft = parseInt(newSwitch.value.interval) || 30;
    status.value = { msg: "Check-in successful!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const create = async () => {
  if (isLoading.value || !newSwitch.value.name || !newSwitch.value.recipient || !newSwitch.value.amount) return;
  try {
    status.value = { msg: "Creating switch...", type: "loading" };
    await payGAS(newSwitch.value.amount, `create:${Date.now()}`);
    switches.value.push({
      id: Date.now().toString(),
      name: newSwitch.value.name,
      recipient: newSwitch.value.recipient,
      amount: parseFloat(newSwitch.value.amount),
      daysLeft: parseInt(newSwitch.value.interval),
      active: true,
    });
    status.value = { msg: "Switch created!", type: "success" };
    newSwitch.value = { name: "", recipient: "", amount: "", interval: "30" };
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
  color: $color-nft;
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
  color: $color-nft;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 16px;
}
.switch-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
}
.switch-icon {
  font-size: 1.5em;
  margin-right: 12px;
}
.switch-info {
  flex: 1;
}
.switch-name {
  display: block;
  font-weight: bold;
}
.switch-timer {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.checkin-btn {
  width: 36px;
  height: 36px;
  background: rgba($color-nft, 0.2);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $color-nft;
  font-size: 1.2em;
  font-weight: bold;
}
.input-field {
  margin-bottom: 12px;
}
.interval-row {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.interval-label {
  color: $color-text-secondary;
  margin-right: 12px;
}
.interval-input {
  width: 80px;
  margin-right: 8px;
}
.interval-text {
  color: $color-text-secondary;
}
.create-btn {
  background: linear-gradient(135deg, $color-nft 0%, darken($color-nft, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
</style>
