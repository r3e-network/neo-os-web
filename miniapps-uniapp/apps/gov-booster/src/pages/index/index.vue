<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Vote Booster</text>
      <text class="subtitle">Amplify your governance power</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <view class="stats-grid">
        <view class="stat-box">
          <text class="stat-value">{{ formatNum(votingPower) }}</text>
          <text class="stat-label">Voting Power</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ boostMultiplier }}x</text>
          <text class="stat-label">Boost</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ activeProposals }}</text>
          <text class="stat-label">Active</text>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Boost Your Vote</text>
      <uni-easyinput v-model="lockAmount" type="number" placeholder="Amount to lock" />
      <view class="duration-row">
        <view
          v-for="d in durations"
          :key="d.days"
          :class="['duration-btn', lockDuration === d.days && 'active']"
          @click="lockDuration = d.days"
        >
          <text class="duration-label">{{ d.label }}</text>
          <text class="duration-boost">{{ d.boost }}x</text>
        </view>
      </view>
      <view class="boost-btn" @click="boostVote" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Processing..." : "Lock & Boost" }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Active Proposals</text>
      <view class="proposals-list">
        <text v-if="proposals.length === 0" class="empty">No active proposals</text>
        <view v-for="(p, i) in proposals" :key="i" class="proposal-item" @click="voteOnProposal(p.id)">
          <text class="proposal-title">{{ p.title }}</text>
          <view class="proposal-meta">
            <text class="proposal-votes">{{ p.votes }} votes</text>
            <text class="proposal-ends">{{ p.endsIn }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { usePayments } from "@neo/uniapp-sdk";
import { formatNumber } from "@/shared/utils/format";

const APP_ID = "miniapp-gov-booster";

interface Proposal {
  id: number;
  title: string;
  votes: number;
  endsIn: string;
}

const { payGAS, isLoading } = usePayments(APP_ID);

const lockAmount = ref("10");
const lockDuration = ref(30);
const votingPower = ref(100);
const boostMultiplier = ref(1);
const activeProposals = ref(3);
const status = ref<{ msg: string; type: string } | null>(null);
const proposals = ref<Proposal[]>([
  { id: 1, title: "Increase block rewards", votes: 1250, endsIn: "2d" },
  { id: 2, title: "Lower gas fees", votes: 890, endsIn: "5d" },
  { id: 3, title: "Treasury allocation", votes: 650, endsIn: "7d" },
]);

const durations = [
  { days: 7, label: "1w", boost: 1.5 },
  { days: 30, label: "1m", boost: 2 },
  { days: 90, label: "3m", boost: 3 },
  { days: 180, label: "6m", boost: 5 },
];

const formatNum = (n: number) => formatNumber(n, 0);

const boostVote = async () => {
  if (isLoading.value) return;
  const amount = parseFloat(lockAmount.value);
  if (amount < 1) {
    status.value = { msg: "Min lock: 1 GAS", type: "error" };
    return;
  }
  try {
    status.value = { msg: "Locking tokens...", type: "loading" };
    await payGAS(lockAmount.value, `boost:${lockDuration.value}`);
    const boost = durations.find((d) => d.days === lockDuration.value)?.boost || 1;
    boostMultiplier.value = boost;
    votingPower.value += amount * boost;
    status.value = { msg: `Boosted ${boost}x for ${lockDuration.value} days!`, type: "success" };
  } catch (e: any) {
    status.value = { msg: e.message || "Error", type: "error" };
  }
};

const voteOnProposal = async (id: number) => {
  status.value = { msg: `Voting on proposal #${id}...`, type: "loading" };
  setTimeout(() => {
    status.value = { msg: "Vote cast successfully!", type: "success" };
  }, 1000);
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

.duration-row {
  display: flex;
  gap: 8px;
  margin: 16px 0;
}
.duration-btn {
  flex: 1;
  padding: 12px;
  text-align: center;
  background: rgba($color-governance, 0.1);
  border: 2px solid transparent;
  border-radius: 8px;
  &.active {
    border-color: $color-governance;
    background: rgba($color-governance, 0.2);
  }
}
.duration-label {
  display: block;
  color: $color-text-primary;
  font-size: 0.9em;
}
.duration-boost {
  display: block;
  color: $color-governance;
  font-weight: bold;
  font-size: 0.85em;
}

.boost-btn {
  background: linear-gradient(135deg, $color-governance 0%, darken($color-governance, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
}

.proposals-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.empty {
  color: $color-text-secondary;
  text-align: center;
}
.proposal-item {
  padding: 12px;
  background: rgba($color-governance, 0.1);
  border-radius: 8px;
}
.proposal-title {
  color: $color-text-primary;
  font-weight: bold;
  display: block;
  margin-bottom: 6px;
}
.proposal-meta {
  display: flex;
  justify-content: space-between;
  font-size: 0.85em;
}
.proposal-votes {
  color: $color-governance;
}
.proposal-ends {
  color: $color-text-secondary;
}
</style>
