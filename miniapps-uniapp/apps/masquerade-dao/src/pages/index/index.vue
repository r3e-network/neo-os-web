<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Masquerade DAO</text>
      <text class="subtitle">Vote behind the mask</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <view class="stats-grid">
        <view class="stat-box">
          <text class="stat-value">{{ maskCount }}</text>
          <text class="stat-label">Masks</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ reputation }}</text>
          <text class="stat-label">Rep</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ proposals }}</text>
          <text class="stat-label">Active</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Your Masks</text>
      <view class="masks-grid">
        <view
          v-for="(mask, i) in masks"
          :key="i"
          :class="['mask-item', selectedMask === i && 'active']"
          @click="selectedMask = i"
        >
          <text class="mask-icon">{{ mask.icon }}</text>
          <text class="mask-name">{{ mask.name }}</text>
          <text class="mask-power">{{ mask.power }} VP</text>
        </view>
      </view>
      <view class="create-btn" @click="createMask">
        <text>+ Create New Mask</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Proposals</text>
      <view class="proposals-list">
        <view v-for="(p, i) in proposalsList" :key="i" class="proposal-item">
          <text class="proposal-title">{{ p.title }}</text>
          <view class="vote-options">
            <view class="vote-btn yes" @click="vote(p.id, true)">
              <text>For {{ p.forVotes }}</text>
            </view>
            <view class="vote-btn no" @click="vote(p.id, false)">
              <text>Against {{ p.againstVotes }}</text>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-masquerade-dao";

interface Mask {
  icon: string;
  name: string;
  power: number;
}

interface Proposal {
  id: number;
  title: string;
  forVotes: number;
  againstVotes: number;
}

const { payGAS, isLoading } = usePayments(APP_ID);

const maskCount = ref(3);
const reputation = ref(85);
const proposals = ref(5);
const selectedMask = ref(0);
const status = ref<{ msg: string; type: string } | null>(null);

const masks = ref<Mask[]>([
  { icon: "🎭", name: "Shadow", power: 100 },
  { icon: "👺", name: "Demon", power: 250 },
  { icon: "🦊", name: "Fox", power: 150 },
]);

const proposalsList = ref<Proposal[]>([
  { id: 1, title: "Increase treasury allocation", forVotes: 450, againstVotes: 120 },
  { id: 2, title: "New governance model", forVotes: 380, againstVotes: 200 },
]);

const createMask = async () => {
  if (isLoading.value) return;
  try {
    status.value = { msg: "Creating mask...", type: "loading" };
    await payGAS("1", "create-mask");
    maskCount.value++;
    status.value = { msg: "Mask created!", type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const vote = async (id: number, support: boolean) => {
  if (selectedMask.value === null) {
    status.value = { msg: "Select a mask first", type: "error" };
    return;
  }
  try {
    status.value = { msg: "Voting...", type: "loading" };
    await payGAS("0.1", `vote:${id}:${support}`);
    status.value = { msg: "Vote cast!", type: "success" };
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
  color: $color-text-primary;
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
  color: $color-governance;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}

.stats-grid {
  display: flex;
  gap: 8px;
}
.stat-box {
  flex: 1;
  text-align: center;
  background: rgba($color-governance, 0.1);
  border-radius: 8px;
  padding: 12px;
}
.stat-value {
  color: $color-governance;
  font-size: 1.2em;
  font-weight: bold;
  display: block;
}
.stat-label {
  color: $color-text-secondary;
  font-size: 0.8em;
}

.masks-grid {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
}
.mask-item {
  flex: 1;
  text-align: center;
  padding: 16px 8px;
  background: rgba($color-governance, 0.1);
  border: 2px solid transparent;
  border-radius: 12px;
  &.active {
    border-color: $color-governance;
    background: rgba($color-governance, 0.2);
  }
}
.mask-icon {
  font-size: 2em;
  display: block;
  margin-bottom: 6px;
}
.mask-name {
  color: $color-text-primary;
  font-size: 0.9em;
  display: block;
  margin-bottom: 4px;
}
.mask-power {
  color: $color-governance;
  font-size: 0.8em;
  font-weight: bold;
}

.create-btn {
  background: rgba($color-governance, 0.2);
  color: $color-governance;
  padding: 12px;
  border-radius: 8px;
  text-align: center;
  border: 1px dashed $color-governance;
}

.proposals-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.proposal-item {
  padding: 12px;
  background: rgba($color-governance, 0.05);
  border-radius: 8px;
}
.proposal-title {
  color: $color-text-primary;
  font-weight: bold;
  display: block;
  margin-bottom: 10px;
}
.vote-options {
  display: flex;
  gap: 8px;
}
.vote-btn {
  flex: 1;
  padding: 10px;
  border-radius: 6px;
  text-align: center;
  font-size: 0.9em;
  &.yes {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }
  &.no {
    background: rgba($color-error, 0.2);
    color: $color-error;
  }
}
</style>
