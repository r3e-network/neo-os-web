<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Dark Radio</text>
      <text class="subtitle">Anonymous broadcasts</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Live Stations</text>
      <view v-for="station in stations" :key="station.id" class="station-item" @click="tuneIn(station)">
        <view class="station-icon">📻</view>
        <view class="station-info">
          <text class="station-name">{{ station.name }}</text>
          <text class="station-listeners">{{ station.listeners }} listening</text>
        </view>
        <view class="station-status" :class="{ active: currentStation?.id === station.id }">
          <text>{{ currentStation?.id === station.id ? '🔊' : '▶️' }}</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Broadcast Message</text>
      <uni-easyinput v-model="message" placeholder="Your anonymous message..." />
      <view class="action-btn" @click="broadcast">
        <text>{{ isLoading ? "Broadcasting..." : "Broadcast" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-darkradio";
const { payGAS, isLoading } = usePayments(APP_ID);

const message = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const currentStation = ref<any>(null);
const stations = ref([
  { id: "1", name: "Midnight Whispers", listeners: 42 },
  { id: "2", name: "Shadow Frequency", listeners: 28 },
  { id: "3", name: "Anonymous Echo", listeners: 15 },
]);

const tuneIn = (station: any) => {
  currentStation.value = station;
  status.value = { msg: `Tuned to ${station.name}`, type: "success" };
};

const broadcast = async () => {
  if (!message.value.trim() || isLoading.value) return;
  try {
    await payGAS("0.5", `broadcast:${message.value.slice(0, 20)}`);
    status.value = { msg: "Message broadcasted anonymously!", type: "success" };
    message.value = "";
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
.station-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-social, 0.1);
  border-radius: 10px;
  margin-bottom: 8px;
}
.station-icon {
  font-size: 2em;
  margin-right: 12px;
}
.station-info {
  flex: 1;
}
.station-name {
  display: block;
  font-weight: bold;
}
.station-listeners {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.station-status {
  font-size: 1.2em;
  &.active {
    color: $color-social;
  }
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
