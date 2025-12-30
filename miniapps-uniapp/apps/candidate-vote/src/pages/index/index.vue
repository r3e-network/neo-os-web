<template>
  <view class="app-container">
    <view class="header">
      <text class="title">Candidate Vote</text>
      <text class="subtitle">Neo Governance Voting</text>
    </view>

    <view v-if="status" :class="['status-msg', status.type]">
      <text>{{ status.msg }}</text>
    </view>

    <view class="card">
      <text class="card-title">Candidates</text>
      <view v-if="loadingCandidates" class="loading">
        <text>Loading candidates...</text>
      </view>
      <view v-else-if="candidates.length === 0" class="empty">
        <text>No candidates found</text>
      </view>
      <view v-else class="candidate-list">
        <view
          v-for="c in candidates"
          :key="c.address"
          :class="['candidate-row', { selected: selectedCandidate === c.address }]"
          @click="selectCandidate(c.address)"
        >
          <view class="candidate-info">
            <text class="candidate-name">{{ c.name || shortenAddress(c.address) }}</text>
            <text class="candidate-votes">{{ formatVotes(c.votes) }} votes</text>
          </view>
          <view v-if="c.active" class="active-badge">
            <text>Active</text>
          </view>
        </view>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Cast Your Vote</text>
      <view class="vote-info">
        <text class="vote-label">Selected Candidate</text>
        <text class="vote-value">{{ selectedCandidate ? shortenAddress(selectedCandidate) : "None" }}</text>
      </view>
      <view class="action-btn" @click="castVote" :style="{ opacity: !selectedCandidate || isLoading ? 0.6 : 1 }">
        <text>{{ isLoading ? "Processing..." : "Vote" }}</text>
      </view>
    </view>

    <view class="card">
      <text class="card-title">Network Info</text>
      <view class="info-row">
        <text class="info-label">Total Votes</text>
        <text class="info-value">{{ formatVotes(totalVotes) }}</text>
      </view>
      <view class="info-row">
        <text class="info-label">Block Height</text>
        <text class="info-value">{{ blockHeight }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useGovernance } from "@neo/uniapp-sdk";
import type { Candidate } from "@neo/uniapp-sdk";

const APP_ID = "miniapp-candidate-vote";
const { isLoading, getCandidates, vote } = useGovernance(APP_ID);

const candidates = ref<Candidate[]>([]);
const selectedCandidate = ref<string | null>(null);
const totalVotes = ref("0");
const blockHeight = ref(0);
const loadingCandidates = ref(true);
const status = ref<{ msg: string; type: string } | null>(null);

const shortenAddress = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
const formatVotes = (v: string) => parseInt(v).toLocaleString();

const showStatus = (msg: string, type: string) => {
  status.value = { msg, type };
  setTimeout(() => (status.value = null), 5000);
};

const selectCandidate = (address: string) => {
  selectedCandidate.value = address;
};

const loadCandidates = async () => {
  loadingCandidates.value = true;
  try {
    const res = await getCandidates();
    candidates.value = res.candidates;
    totalVotes.value = res.totalVotes;
    blockHeight.value = res.blockHeight;
  } catch (e: any) {
    showStatus(e.message || "Failed to load candidates", "error");
  } finally {
    loadingCandidates.value = false;
  }
};

const castVote = async () => {
  if (!selectedCandidate.value || isLoading.value) return;
  try {
    showStatus("Submitting vote...", "loading");
    await vote(selectedCandidate.value, "1", true);
    showStatus("Vote submitted!", "success");
    await loadCandidates();
  } catch (e: any) {
    showStatus(e.message || "Vote failed", "error");
  }
};

onMounted(() => {
  loadCandidates();
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

.loading,
.empty {
  text-align: center;
  padding: 20px;
  color: $color-text-secondary;
}

.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.candidate-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: rgba($color-governance, 0.05);
  border: 2px solid transparent;
  border-radius: 8px;
  cursor: pointer;
  &.selected {
    border-color: $color-governance;
    background: rgba($color-governance, 0.15);
  }
}

.candidate-name {
  font-weight: bold;
  color: $color-text-primary;
}

.candidate-votes {
  font-size: 0.85em;
  color: $color-text-secondary;
}

.active-badge {
  background: rgba($color-success, 0.2);
  color: $color-success;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.75em;
}

.vote-info,
.info-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid $color-border;
}

.vote-label,
.info-label {
  color: $color-text-secondary;
}

.vote-value,
.info-value {
  color: $color-text-primary;
  font-weight: bold;
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
</style>
