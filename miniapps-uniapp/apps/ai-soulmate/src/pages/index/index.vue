<template>
  <view class="app-container">
    <view class="header">
      <text class="title">AI Soulmate</text>
      <text class="subtitle">Your AI companion</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Chat History</text>
      <view v-for="msg in messages" :key="msg.id" :class="['message', msg.from]">
        <text class="msg-text">{{ msg.text }}</text>
        <text class="msg-time">{{ msg.time }}</text>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Send Message</text>
      <uni-easyinput v-model="newMessage" placeholder="Type your message..." />
      <view class="action-btn" @click="sendMessage">
        <text>{{ isLoading ? "Sending..." : "Send Message" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-aisoulmate";
const { payGAS, isLoading } = usePayments(APP_ID);

const newMessage = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const messages = ref([
  { id: "1", from: "user", text: "Hello!", time: "10:30" },
  { id: "2", from: "ai", text: "Hi! How are you today?", time: "10:31" },
  { id: "3", from: "user", text: "Great! Tell me a story", time: "10:32" },
]);

const sendMessage = async () => {
  if (!newMessage.value.trim() || isLoading.value) return;
  try {
    const msg = newMessage.value;
    messages.value.push({
      id: Date.now().toString(),
      from: "user",
      text: msg,
      time: new Date().toLocaleTimeString().slice(0, 5),
    });
    newMessage.value = "";
    await payGAS("0.1", `chat:${msg.slice(0, 20)}`);
    setTimeout(() => {
      messages.value.push({
        id: (Date.now() + 1).toString(),
        from: "ai",
        text: "That's interesting! Tell me more...",
        time: new Date().toLocaleTimeString().slice(0, 5),
      });
    }, 1000);
    status.value = { msg: "Message sent!", type: "success" };
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
.message {
  padding: 10px 14px;
  border-radius: 12px;
  margin-bottom: 8px;
  max-width: 80%;
  &.user {
    background: rgba($color-social, 0.2);
    margin-left: auto;
  }
  &.ai {
    background: rgba(255, 255, 255, 0.1);
  }
}
.msg-text {
  display: block;
  margin-bottom: 4px;
}
.msg-time {
  font-size: 0.75em;
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
