<template>
  <view class="card-voting">
    <text class="proposal-title">{{ data.proposalTitle }}</text>
    <view class="vote-bars">
      <view class="vote-bar yes">
        <view class="bar-fill" :style="{ width: yesPercent + '%' }" />
        <text class="bar-label">Yes {{ yesPercent }}%</text>
      </view>
      <view class="vote-bar no">
        <view class="bar-fill" :style="{ width: noPercent + '%' }" />
        <text class="bar-label">No {{ noPercent }}%</text>
      </view>
    </view>
    <view class="vote-footer">
      <text>{{ data.totalVotes }} votes</text>
      <text>{{ timeLeft }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { VotingData } from "../card-types";

const props = defineProps<{ data: VotingData }>();

const yesPercent = computed(() => Math.round((props.data.yesVotes / props.data.totalVotes) * 100));
const noPercent = computed(() => 100 - yesPercent.value);

const timeLeft = computed(() => {
  const diff = props.data.endTime - Math.floor(Date.now() / 1000);
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86400);
  return days > 0 ? `${days}d left` : `${Math.floor(diff / 3600)}h left`;
});
</script>

<style scoped lang="scss">
.card-voting {
  background: linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%);
  border-radius: 12px;
  padding: 14px;
  color: #fff;
}
.proposal-title {
  font-size: 0.9em;
  font-weight: 600;
  display: block;
  margin-bottom: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.vote-bars {
  margin-bottom: 8px;
}
.vote-bar {
  position: relative;
  height: 24px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  margin-bottom: 6px;
  overflow: hidden;
}
.bar-fill {
  height: 100%;
  transition: width 0.3s ease;
}
.yes .bar-fill {
  background: #10b981;
}
.no .bar-fill {
  background: #ef4444;
}
.bar-label {
  position: absolute;
  left: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.75em;
  font-weight: 600;
}
.vote-footer {
  display: flex;
  justify-content: space-between;
  font-size: 0.75em;
  opacity: 0.9;
}
</style>
