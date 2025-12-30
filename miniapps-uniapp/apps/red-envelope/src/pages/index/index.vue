<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Red Envelope</text>
      <text class="subtitle">Lucky red packets</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Create Envelope</text>
      <uni-easyinput v-model="amount" type="number" placeholder="Total GAS" />
      <uni-easyinput v-model="count" type="number" placeholder="Number of packets" />
      <view class="action-btn" @click="create">
        <text>{{ isLoading ? "Creating..." : "Send Red Envelope" }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Available Envelopes</text>
      <view v-for="env in envelopes" :key="env.id" class="envelope-item" @click="claim(env)">
        <text class="envelope-icon">🧧</text>
        <view class="envelope-info">
          <text class="envelope-from">From {{ env.from }}</text>
          <text class="envelope-remaining">{{ env.remaining }}/{{ env.total }} left</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-redenvelope";
const { payGAS, isLoading } = usePayments(APP_ID);

const amount = ref("");
const count = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const envelopes = ref([
  { id: "1", from: "NX8...abc", remaining: 3, total: 5, amount: 10 },
  { id: "2", from: "NY2...def", remaining: 1, total: 3, amount: 5 },
]);

const create = async () => {
  if (isLoading.value) return;
  try {
    await payGAS(amount.value, `redenvelope:${count.value}`);
    status.value = { msg: "Envelope sent!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const claim = async (env: any) => {
  status.value = { msg: `Claimed from ${env.from}!`, type: "success" };
  env.remaining--;
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
.action-btn {
  background: linear-gradient(135deg, $color-social 0%, darken($color-social, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  margin-top: 12px;
}
.envelope-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-social, 0.1);
  border-radius: 10px;
  margin-bottom: 8px;
}
.envelope-icon {
  font-size: 2em;
  margin-right: 12px;
}
.envelope-info {
  flex: 1;
}
.envelope-from {
  display: block;
  font-weight: bold;
}
.envelope-remaining {
  color: $color-text-secondary;
  font-size: 0.85em;
}
</style>
