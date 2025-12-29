<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Candidate Vote</text>
      <text class="subtitle">Vote & Earn GAS Rewards</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <text class="card-title">Current Epoch</text>
      <view class="stats-grid">
        <view class="stat-box">
          <text class="stat-value">{{ currentEpoch }}</text>
          <text class="stat-label">Epoch</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ formatGas(epochRewards) }}</text>
          <text class="stat-label">Pool (GAS)</text>
        </view>
        <view class="stat-box">
          <text class="stat-value">{{ countdown }}</text>
          <text class="stat-label">Ends In</text>
        </view>
      </view>
    </view>

    <view class="card strategy-card">
      <text class="card-title">Voting Strategy</text>
      <view :class="['strategy-badge', currentStrategy]">
        <text>{{ strategyLabel }}</text>
      </view>
      <view class="strategy-info">
        <text class="strategy-desc">{{ strategyDesc }}</text>
      </view>
      <view class="threshold-info">
        <text class="threshold-label">Threshold: {{ formatNeo(threshold) }} NEO</text>
        <text class="threshold-current">Current: {{ formatNeo(totalVotes) }} NEO</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Your Vote</text>
      <view class="vote-info">
        <text class="vote-label">NEO Voting Power</text>
        <text class="vote-value">{{ formatNeo(myVoteWeight) }} NEO</text>
      </view>
      <view class="vote-info">
        <text class="vote-label">Est. Reward</text>
        <text class="vote-value highlight">{{ formatGas(pendingReward) }} GAS</text>
      </view>
      <view class="action-btn" @click="registerVote" :style="{ opacity: isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Processing..." : "Register Vote" }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Claim Rewards</text>
      <view v-if="claimableEpochs.length === 0" class="empty">
        <text>No rewards to claim</text>
      </view>
      <view v-for="ep in claimableEpochs" :key="ep.id" class="claim-row">
        <view class="claim-info">
          <text class="claim-epoch">Epoch {{ ep.id }}</text>
          <text class="claim-amount">{{ formatGas(ep.reward) }} GAS</text>
        </view>
        <view class="claim-btn" @click="claimReward(ep.id)">
          <text>Claim</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useWallet } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-candidate-vote";
const { getAddress, invokeContract, isLoading } = useWallet(APP_ID);

interface ClaimableEpoch {
  id: number;
  reward: number;
}

const currentEpoch = ref(1);
const epochRewards = ref(0);
const epochEndTime = ref(0);
const myVoteWeight = ref(0);
const pendingReward = ref(0);
const claimableEpochs = ref<ClaimableEpoch[]>([]);
const status = ref<{ msg: string; type: string } | null>(null);
const currentStrategy = ref("neoburger");
const threshold = ref(500000000000);
const totalVotes = ref(0);

const countdown = computed(() => {
  const now = Date.now();
  const diff = epochEndTime.value - now;
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  return `${days}d ${hours}h`;
});

const formatGas = (val: number) => (val / 100000000).toFixed(2);
const formatNeo = (val: number) => (val / 100000000).toFixed(0);

const strategyLabel = computed(() => (currentStrategy.value === "self" ? "Self Candidate" : "NeoBurger"));

const strategyDesc = computed(() =>
  currentStrategy.value === "self"
    ? "Voting as platform candidate - direct GAS rewards"
    : "Delegating to NeoBurger - bNEO rewards distributed",
);

const showStatus = (msg: string, type: string) => {
  status.value = { msg, type };
  setTimeout(() => (status.value = null), 5000);
};

const registerVote = async () => {
  if (isLoading.value) return;
  try {
    showStatus("Registering vote...", "loading");
    const address = await getAddress();
    await invokeContract({
      scriptHash: "CONTRACT_HASH",
      operation: "RegisterVote",
      args: [
        { type: "Hash160", value: address },
        { type: "Integer", value: myVoteWeight.value },
      ],
    });
    showStatus("Vote registered!", "success");
  } catch (e: any) {
    showStatus(e.message || "Failed", "error");
  }
};

const claimReward = async (epochId: number) => {
  try {
    showStatus("Claiming...", "loading");
    const address = await getAddress();
    await invokeContract({
      scriptHash: "CONTRACT_HASH",
      operation: "ClaimRewards",
      args: [
        { type: "Hash160", value: address },
        { type: "Integer", value: epochId },
      ],
    });
    showStatus("Claimed!", "success");
    claimableEpochs.value = claimableEpochs.value.filter((e) => e.id !== epochId);
  } catch (e: any) {
    showStatus(e.message || "Failed", "error");
  }
};

onMounted(() => {
  epochEndTime.value = Date.now() + 3 * 86400000;
  epochRewards.value = 50000000000;
  myVoteWeight.value = 100000000;
  pendingReward.value = 500000000;
  totalVotes.value = 300000000000; // 3000 NEO
  threshold.value = 500000000000; // 5000 NEO
  currentStrategy.value = "neoburger";
});
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
  &.loading {
    background: rgba($color-info, 0.15);
    color: $color-info;
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

.vote-info {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid $color-border;
}

.vote-label {
  color: $color-text-secondary;
}

.vote-value {
  color: $color-text-primary;
  font-weight: bold;
  &.highlight {
    color: $color-governance;
  }
}

.action-btn {
  background: linear-gradient(135deg, $color-governance 0%, darken($color-governance, 10%) 100%);
  color: #fff;
  padding: 14px;
  border-radius: 12px;
  text-align: center;
  font-weight: bold;
  margin-top: 16px;
}

.empty {
  color: $color-text-secondary;
  text-align: center;
  padding: 20px;
}

.claim-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba($color-governance, 0.1);
  border-radius: 8px;
  margin-bottom: 8px;
}

.claim-epoch {
  color: $color-text-primary;
  font-weight: bold;
}

.claim-amount {
  color: $color-governance;
  font-size: 0.9em;
}

.claim-btn {
  background: $color-governance;
  color: #fff;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: bold;
}

.strategy-card {
  border: 2px solid $color-governance;
}

.strategy-badge {
  display: inline-block;
  padding: 8px 16px;
  border-radius: 20px;
  font-weight: bold;
  margin-bottom: 12px;
  &.self {
    background: rgba($color-success, 0.2);
    color: $color-success;
  }
  &.neoburger {
    background: rgba($color-info, 0.2);
    color: $color-info;
  }
}

.strategy-desc {
  color: $color-text-secondary;
  font-size: 0.9em;
  display: block;
  margin-bottom: 12px;
}

.threshold-info {
  display: flex;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid $color-border;
}

.threshold-label,
.threshold-current {
  font-size: 0.85em;
  color: $color-text-secondary;
}
</style>
