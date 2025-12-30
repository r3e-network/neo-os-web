<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Bounty Hunter</text>
      <text class="subtitle">Bug bounty platform</text>
    </view>
    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>
    <view class="card">
      <text class="card-title">Active Bounties</text>
      <view v-for="bounty in bounties" :key="bounty.id" class="bounty-item" @click="selectBounty(bounty)">
        <view class="bounty-header">
          <text class="bounty-title">{{ bounty.title }}</text>
          <text class="bounty-reward">{{ bounty.reward }} GAS</text>
        </view>
        <text class="bounty-desc">{{ bounty.description }}</text>
        <view class="bounty-footer">
          <text class="bounty-severity" :class="bounty.severity">{{ bounty.severity }}</text>
          <text class="bounty-time">{{ bounty.timeLeft }}</text>
        </view>
      </view>
    </view>
    <view class="card">
      <text class="card-title">Submit Solution</text>
      <uni-easyinput v-model="solution" placeholder="Paste your solution URL..." />
      <view class="action-btn" @click="submitSolution">
        <text>{{ isLoading ? "Submitting..." : "Submit Solution" }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-bountyhunter";
const { payGAS, isLoading } = usePayments(APP_ID);

const solution = ref("");
const status = ref<{ msg: string; type: string } | null>(null);
const bounties = ref([
  {
    id: "1",
    title: "XSS Vulnerability",
    description: "Find XSS in user profile",
    reward: "50",
    severity: "high",
    timeLeft: "3d left",
  },
  {
    id: "2",
    title: "SQL Injection",
    description: "Database query exploit",
    reward: "100",
    severity: "critical",
    timeLeft: "5d left",
  },
  {
    id: "3",
    title: "CSRF Token Bypass",
    description: "Session handling issue",
    reward: "30",
    severity: "medium",
    timeLeft: "7d left",
  },
]);

const selectBounty = (bounty: any) => {
  status.value = { msg: `Selected: ${bounty.title}`, type: "success" };
};

const submitSolution = async () => {
  if (!solution.value.trim() || isLoading.value) return;
  try {
    await payGAS("1", `submit:${solution.value.slice(0, 20)}`);
    status.value = { msg: "Solution submitted for review!", type: "success" };
    solution.value = "";
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};
</script>

<style lang="scss">
@use "@/shared/styles/theme.scss" as *;
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
.bounty-item {
  padding: 14px;
  background: rgba($color-social, 0.1);
  border-radius: 10px;
  margin-bottom: 10px;
}
.bounty-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.bounty-title {
  font-weight: bold;
  font-size: 1em;
}
.bounty-reward {
  color: $color-social;
  font-weight: bold;
}
.bounty-desc {
  display: block;
  color: $color-text-secondary;
  font-size: 0.85em;
  margin-bottom: 8px;
}
.bounty-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.bounty-severity {
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75em;
  font-weight: bold;
  &.critical {
    background: rgba(220, 38, 38, 0.2);
    color: #ef4444;
  }
  &.high {
    background: rgba(249, 115, 22, 0.2);
    color: #f97316;
  }
  &.medium {
    background: rgba(234, 179, 8, 0.2);
    color: #eab308;
  }
}
.bounty-time {
  font-size: 0.8em;
  color: $color-text-secondary;
}
.action-btn {
  background: linear-gradient(135deg, $color-social 0%, #c13584 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  margin-top: 12px;
}
</style>
