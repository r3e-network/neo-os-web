<template>
  <view class="tab-content scrollable">
    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4">
      <text class="text-center font-bold">{{ status.msg }}</text>
    </NeoCard>

    <EpochOverview
      :current-epoch="currentEpoch"
      :epoch-end-time="epochEndTime"
      :epoch-total-votes="epochTotalVotes"
      :current-strategy="currentStrategy"
      :t="t as any"
    />

    <CandidateList
      :candidates="candidates"
      :selected-candidate="selectedCandidate"
      :total-votes="totalVotes"
      :is-loading="candidatesLoading"
      :t="t as any"
      @select="selectCandidate"
    />

    <RegisterVoteForm
      v-model:voteWeight="localVoteWeight"
      :selected-candidate="selectedCandidate"
      :is-loading="isLoading"
      :t="t as any"
      @register="$emit('registerVote')"
    />

    <RewardsPanel
      :pending-rewards-value="pendingRewardsValue"
      :has-claimed="hasClaimed"
      :is-loading="isLoading"
      :t="t as any"
      @claim="$emit('claimRewards')"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { NeoCard } from "@shared/components";
import type { Candidate } from "@neo/uniapp-sdk";
import EpochOverview from "./EpochOverview.vue";
import RegisterVoteForm from "./RegisterVoteForm.vue";
import RewardsPanel from "./RewardsPanel.vue";
import CandidateList from "./CandidateList.vue";

const props = defineProps<{
  status: { msg: string; type: string } | null;
  currentEpoch: number;
  epochEndTime: number;
  epochTotalVotes: number;
  currentStrategy: string;
  voteWeight: string;
  isLoading: boolean;
  pendingRewardsValue: number;
  hasClaimed: boolean;
  candidates: Candidate[];
  selectedCandidate: Candidate | null;
  totalVotes: string;
  candidatesLoading: boolean;
  t: (key: string) => string;
}>();

const emit = defineEmits(["registerVote", "claimRewards", "update:voteWeight", "selectCandidate"]);

const localVoteWeight = ref(props.voteWeight);

watch(
  () => props.voteWeight,
  (newVal) => {
    localVoteWeight.value = newVal;
  },
);

watch(localVoteWeight, (newVal) => {
  emit("update:voteWeight", newVal);
});

const selectCandidate = (candidate: Candidate) => {
  emit("selectCandidate", candidate);
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss";

.tab-content {
  padding: 20px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
</style>
