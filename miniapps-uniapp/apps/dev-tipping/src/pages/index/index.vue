<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Dev Tipping</text>
      <text class="subtitle">Support developers</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Top Developers</text>
      <view v-for="dev in developers" :key="dev.id" class="dev-item" @click="selectDev(dev)">
        <view class="dev-avatar">👨‍💻</view>
        <view class="dev-info">
          <text class="dev-name">{{ dev.name }}</text>
          <text class="dev-projects">{{ dev.projects }} projects</text>
        </view>
        <text class="dev-tips">{{ dev.tips }} GAS</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Send Tip</text>
      <uni-easyinput v-model="recipientAddress" placeholder="Developer address" />
      <uni-easyinput v-model="tipAmount" type="number" placeholder="Tip amount (GAS)" />
      <uni-easyinput v-model="tipMessage" placeholder="Optional message" />
      <view class="action-btn" @click="sendTip">
        <text>{{ isLoading ? "Sending..." : "Send Tip" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-devtipping";
const { payGAS, isLoading } = usePayments(APP_ID);

const recipientAddress = ref("");
const tipAmount = ref("");
const tipMessage = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const developers = ref([
  { id: "1", name: "Alice.neo", projects: 12, tips: "150" },
  { id: "2", name: "Bob.neo", projects: 8, tips: "89" },
  { id: "3", name: "Charlie.neo", projects: 5, tips: "45" },
]);

const selectDev = (dev: any) => {
  recipientAddress.value = `N${dev.name.slice(0, 3)}...xyz`;
  status.value = { msg: `Selected ${dev.name}`, type: "success" };
};

const sendTip = async () => {
  if (!recipientAddress.value || !tipAmount.value || isLoading.value) return;
  try {
    await payGAS(tipAmount.value, `tip:${recipientAddress.value.slice(0, 10)}`);
    status.value = { msg: "Tip sent successfully!", type: "success" };
    recipientAddress.value = "";
    tipAmount.value = "";
    tipMessage.value = "";
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
  color: $color-social;
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
  color: $color-social;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}
.dev-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-social, 0.1);
  border-radius: 10px;
  margin-bottom: 8px;
}
.dev-avatar {
  font-size: 2em;
  margin-right: 12px;
}
.dev-info {
  flex: 1;
}
.dev-name {
  display: block;
  font-weight: bold;
}
.dev-projects {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.dev-tips {
  color: $color-social;
  font-weight: bold;
}
.action-btn {
  background: linear-gradient(135deg, $color-social 0%, darken($color-social, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  margin-top: 12px;
}
</style>
