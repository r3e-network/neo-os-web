<template>
  <view class="app-container">
    <view class="header">
      <text class="title">ZK Badge</text>
      <text class="subtitle">Zero-knowledge credentials</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <text class="card-title">My Badges</text>
      <view v-for="badge in badges" :key="badge.id" class="badge-row">
        <view class="badge-icon">{{ badge.icon }}</view>
        <view class="badge-info">
          <text class="badge-name">{{ badge.name }}</text>
          <text class="badge-desc">{{ badge.description }}</text>
        </view>
        <view class="badge-status" :class="badge.verified ? 'verified' : 'pending'">
          <text>{{ badge.verified ? "✓" : "⏳" }}</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Claim Badge</text>
      <uni-easyinput v-model="badgeType" placeholder="Badge type (e.g., developer)" class="input" />
      <uni-easyinput v-model="proof" placeholder="ZK proof hash" class="input" />
      <view class="action-btn" @click="claimBadge">
        <text>Submit Claim</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";

const APP_ID = "miniapp-zk-badge";

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  verified: boolean;
}

const badges = ref<Badge[]>([
  { id: "1", name: "Developer", description: "Verified code contributor", icon: "💻", verified: true },
  { id: "2", name: "Early Adopter", description: "Platform pioneer", icon: "🚀", verified: true },
  { id: "3", name: "Governance", description: "Active voter", icon: "🗳️", verified: false },
]);

const badgeType = ref("");
const proof = ref("");
const status = ref<{ msg: string; type: string } | null>(null);

const claimBadge = () => {
  if (!badgeType.value || !proof.value) {
    status.value = { msg: "Please fill all fields", type: "error" };
    return;
  }
  badges.value.push({
    id: String(Date.now()),
    name: badgeType.value,
    description: "Pending verification",
    icon: "🎖️",
    verified: false,
  });
  status.value = { msg: "Badge claim submitted for verification", type: "success" };
  badgeType.value = "";
  proof.value = "";
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
  color: $color-utility;
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
  color: $color-utility;
  font-size: 1.1em;
  font-weight: bold;
  display: block;
  margin-bottom: 12px;
}
.badge-row {
  display: flex;
  align-items: center;
  padding: 12px;
  background: rgba($color-utility, 0.1);
  border-radius: 8px;
  margin-bottom: 8px;
}
.badge-icon {
  font-size: 2em;
  margin-right: 12px;
}
.badge-info {
  flex: 1;
}
.badge-name {
  font-weight: bold;
  display: block;
  margin-bottom: 4px;
}
.badge-desc {
  color: $color-text-secondary;
  font-size: 0.85em;
}
.badge-status {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.2em;
  &.verified {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }
  &.pending {
    background: rgba($color-warning, 0.2);
    color: $color-warning;
  }
}
.input {
  margin-bottom: 12px;
}
.action-btn {
  background: linear-gradient(135deg, $color-utility 0%, darken($color-utility, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}
</style>
