<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Geo Spotlight</text>
      <text class="subtitle">Location-based content</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Nearby Posts</text>
      <view v-for="post in posts" :key="post.id" class="post-item" @click="viewPost(post)">
        <view class="post-header">
          <text class="post-author">{{ post.author }}</text>
          <text class="post-distance">{{ post.distance }}m away</text>
        </view>
        <text class="post-content">{{ post.content }}</text>
        <view class="post-footer">
          <text class="post-likes">❤️ {{ post.likes }}</text>
          <text class="post-time">{{ post.time }}</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Create Post</text>
      <uni-easyinput v-model="postContent" placeholder="What's happening here?" />
      <view class="action-btn" @click="createPost">
        <text>{{ isLoading ? "Posting..." : "Post to Location" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-geospotlight";
const { payGAS, isLoading } = usePayments(APP_ID);

const postContent = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const posts = ref([
  { id: "1", author: "Anonymous", content: "Great coffee shop!", distance: 50, likes: 12, time: "5m ago" },
  { id: "2", author: "Local", content: "Free WiFi here", distance: 120, likes: 8, time: "15m ago" },
  { id: "3", author: "Traveler", content: "Beautiful sunset spot", distance: 200, likes: 24, time: "1h ago" },
]);

const viewPost = (post: any) => {
  status.value = { msg: `Viewing post by ${post.author}`, type: "success" };
};

const createPost = async () => {
  if (!postContent.value.trim() || isLoading.value) return;
  try {
    await payGAS("0.2", `post:${postContent.value.slice(0, 20)}`);
    status.value = { msg: "Post created at your location!", type: "success" };
    postContent.value = "";
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
.post-item {
  padding: 14px;
  background: rgba($color-social, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
}
.post-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
}
.post-author {
  font-weight: bold;
}
.post-distance {
  color: $color-social;
  font-size: 0.85em;
}
.post-content {
  display: block;
  margin-bottom: 8px;
  line-height: 1.4;
}
.post-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
  color: $color-text-secondary;
}
.post-likes {
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
