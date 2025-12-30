<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Whisper Chain</text>
      <text class="subtitle">Anonymous messaging</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Message Chain</text>
      <view v-for="msg in chain" :key="msg.id" class="chain-item">
        <view class="chain-header">
          <text class="chain-author">Anonymous #{{ msg.author }}</text>
          <text class="chain-time">{{ msg.time }}</text>
        </view>
        <text class="chain-message">{{ msg.message }}</text>
        <text class="chain-hops">{{ msg.hops }} hops</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Add to Chain</text>
      <uni-easyinput v-model="newMessage" placeholder="Your anonymous message..." />
      <view class="action-btn" @click="addToChain">
        <text>{{ isLoading ? "Sending..." : "Add to Chain" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments, useRNG } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-whisperchain";
const { payGAS, isLoading } = usePayments(APP_ID);
const { generateRandom } = useRNG(APP_ID);

const newMessage = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const chain = ref([
  { id: "1", author: "7342", message: "The truth is out there...", hops: 5, time: "2h ago" },
  { id: "2", author: "9128", message: "Follow the white rabbit", hops: 3, time: "1h ago" },
  { id: "3", author: "4567", message: "Nothing is as it seems", hops: 1, time: "30m ago" },
]);

const addToChain = async () => {
  if (!newMessage.value.trim() || isLoading.value) return;
  try {
    const randomId = await generateRandom(1000, 9999);
    await payGAS("0.3", `chain:${newMessage.value.slice(0, 20)}`);
    chain.value.push({
      id: Date.now().toString(),
      author: randomId.toString(),
      message: newMessage.value,
      hops: 0,
      time: "Just now",
    });
    status.value = { msg: "Message added to chain!", type: "success" };
    newMessage.value = "";
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
.chain-item {
  padding: 14px;
  background: rgba($color-social, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
  border-left: 3px solid $color-social;
}
.chain-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.chain-author {
  font-weight: bold;
  color: $color-social;
}
.chain-time {
  font-size: 0.85em;
  color: $color-text-secondary;
}
.chain-message {
  display: block;
  margin-bottom: 6px;
  line-height: 1.4;
}
.chain-hops {
  font-size: 0.8em;
  color: $color-text-secondary;
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
