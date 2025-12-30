<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Time Capsule</text>
      <text class="subtitle">Lock content until future date</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Your Capsules</text>
      <view v-for="cap in capsules" :key="cap.id" class="capsule-item">
        <text class="capsule-icon">{{ cap.locked ? "🔒" : "🔓" }}</text>
        <view class="capsule-info">
          <text class="capsule-name">{{ cap.name }}</text>
          <text class="capsule-date">{{ cap.locked ? `Unlocks: ${cap.unlockDate}` : "Unlocked" }}</text>
        </view>
        <view v-if="!cap.locked" class="open-btn" @click="open(cap)">
          <text>Open</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Create Capsule</text>
      <uni-easyinput v-model="newCapsule.name" placeholder="Capsule name" class="input-field" />
      <uni-easyinput v-model="newCapsule.content" placeholder="Secret message" class="input-field" />
      <view class="date-row">
        <text class="date-label">Unlock in:</text>
        <view class="date-picker">
          <uni-easyinput v-model="newCapsule.days" type="number" placeholder="Days" class="days-input" />
          <text class="days-text">days</text>
        </view>
      </view>
      <view class="create-btn" @click="create" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Creating..." : "Create Capsule (3 GAS)" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-timecapsule";
const { payGAS, isLoading } = usePayments(APP_ID);

interface Capsule {
  id: string;
  name: string;
  content: string;
  unlockDate: string;
  locked: boolean;
}

const capsules = ref<Capsule[]>([
  { id: "1", name: "2025 Memories", content: "Hidden", unlockDate: "2026-01-01", locked: true },
  { id: "2", name: "Birthday Gift", content: "Happy Birthday!", unlockDate: "2025-06-15", locked: false },
]);
const newCapsule = ref({ name: "", content: "", days: "30" });
const status = ref<{ msg: string; type: string } | null>(null);

const create = async () => {
  if (isLoading.value || !newCapsule.value.name || !newCapsule.value.content) return;
  try {
    status.value = { msg: "Creating capsule...", type: "loading" };
    await payGAS("3", `create:${Date.now()}`);
    const unlockDate = new Date();
    unlockDate.setDate(unlockDate.getDate() + parseInt(newCapsule.value.days));
    capsules.value.push({
      id: Date.now().toString(),
      name: newCapsule.value.name,
      content: newCapsule.value.content,
      unlockDate: unlockDate.toISOString().split("T")[0],
      locked: true,
    });
    status.value = { msg: "Capsule created!", type: "success" };
    newCapsule.value = { name: "", content: "", days: "30" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const open = (cap: Capsule) => {
  status.value = { msg: `Message: ${cap.content}`, type: "success" };
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
.capsule-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-nft, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
}
.capsule-icon {
  font-size: 1.5em;
  margin-right: 12px;
}
.capsule-info {
  flex: 1;
}
.capsule-name {
  display: block;
  font-weight: bold;
}
.capsule-date {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.open-btn {
  padding: 8px 16px;
  background: $color-nft;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9em;
}
.input-field {
  margin-bottom: 12px;
}
.date-row {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
}
.date-label {
  color: $color-text-secondary;
  margin-right: 12px;
}
.date-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}
.days-input {
  width: 80px;
}
.days-text {
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
