<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Secret Vote</text>
      <text class="subtitle">Anonymous on-chain voting</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Active Proposals</text>
      <view v-for="p in proposals" :key="p.id" class="proposal-item" @click="selected = p">
        <text class="proposal-title">{{ p.title }}</text>
        <view class="vote-bar">
          <view class="yes-bar" :style="{ width: p.yesPercent + '%' }"></view>
        </view>
        <view class="vote-stats">
          <text>Yes: {{ p.yesPercent }}%</text>
          <text>No: {{ 100 - p.yesPercent }}%</text>
        </view>
      </view>
    </view>
    <uni-popup ref="popup" type="bottom">
      <view class="vote-modal" v-if="selected">
        <text class="modal-title">{{ selected.title }}</text>
        <view class="vote-btns">
          <view class="vote-btn yes" @click="vote(true)"><text>Vote Yes</text></view>
          <view class="vote-btn no" @click="vote(false)"><text>Vote No</text></view>
        </view>
      </view>
    </uni-popup>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";

const proposals = ref([
  { id: "1", title: "Increase staking rewards", yesPercent: 65 },
  { id: "2", title: "Add new trading pair", yesPercent: 42 },
]);
const selected = ref<any>(null);
const status = ref<{ msg: string; type: string } | null>(null);

const vote = (yes: boolean) => {
  status.value = { msg: `Voted ${yes ? "Yes" : "No"} anonymously!`, type: "success" };
  selected.value = null;
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
  color: $color-governance;
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
}
.card {
  background: $color-bg-card;
  border: 1px solid $color-border;
  border-radius: 16px;
  padding: 20px;
}
.card-title {
  color: $color-governance;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}
.proposal-item {
  padding: 14px;
  background: rgba($color-governance, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
}
.proposal-title {
  font-weight: bold;
  display: block;
  margin-bottom: 10px;
}
.vote-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
}
.yes-bar {
  height: 100%;
  background: $color-governance;
}
.vote-stats {
  display: flex;
  justify-content: space-between;
  margin-top: 8px;
  font-size: 0.85em;
  color: $color-text-secondary;
}
.vote-modal {
  background: $color-bg-secondary;
  padding: 24px;
  border-radius: 16px 16px 0 0;
}
.modal-title {
  font-size: 1.2em;
  font-weight: bold;
  display: block;
  margin-bottom: 16px;
  text-align: center;
}
.vote-btns {
  display: flex;
  gap: 12px;
}
.vote-btn {
  flex: 1;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  &.yes {
    background: $color-governance;
  }
  &.no {
    background: rgba(255, 255, 255, 0.1);
  }
}
</style>
