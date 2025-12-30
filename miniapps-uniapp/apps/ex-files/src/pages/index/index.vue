<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Ex Files</text>
      <text class="subtitle">Shared memories vault</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Shared Memories</text>
      <view v-for="memory in memories" :key="memory.id" class="memory-item" @click="viewMemory(memory)">
        <view class="memory-icon">{{ memory.type === 'photo' ? '📷' : '📝' }}</view>
        <view class="memory-info">
          <text class="memory-title">{{ memory.title }}</text>
          <text class="memory-date">{{ memory.date }}</text>
        </view>
        <view class="memory-lock">🔒</view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Upload Memory</text>
      <uni-easyinput v-model="memoryTitle" placeholder="Memory title" />
      <uni-easyinput v-model="memoryContent" placeholder="Content or URL" />
      <view class="action-btn" @click="uploadMemory">
        <text>{{ isLoading ? "Uploading..." : "Upload Memory" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-exfiles";
const { payGAS, isLoading } = usePayments(APP_ID);

const memoryTitle = ref("");
const memoryContent = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const memories = ref([
  { id: "1", title: "First Date", type: "photo", date: "2023-06-15" },
  { id: "2", title: "Love Letter", type: "text", date: "2023-08-20" },
  { id: "3", title: "Anniversary", type: "photo", date: "2024-06-15" },
]);

const viewMemory = (memory: any) => {
  status.value = { msg: `Viewing: ${memory.title}`, type: "success" };
};

const uploadMemory = async () => {
  if (!memoryTitle.value || !memoryContent.value || isLoading.value) return;
  try {
    await payGAS("0.5", `upload:${memoryTitle.value.slice(0, 20)}`);
    status.value = { msg: "Memory uploaded securely!", type: "success" };
    memoryTitle.value = "";
    memoryContent.value = "";
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
.memory-item {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-social, 0.1);
  border-radius: 10px;
  margin-bottom: 8px;
}
.memory-icon {
  font-size: 2em;
  margin-right: 12px;
}
.memory-info {
  flex: 1;
}
.memory-title {
  display: block;
  font-weight: bold;
}
.memory-date {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.memory-lock {
  font-size: 1.2em;
  color: $color-social;
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
