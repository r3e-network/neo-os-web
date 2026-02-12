<template>
  <NeoCard
    :variant="rank === 1 ? 'erobo-neo' : 'erobo'"
    class="entrant-card-glass"
  >
    <view class="entrant-inner">
      <!-- Rank -->
      <view class="rank-glass" :class="'rank-' + rank">
        <text>#{{ rank }}</text>
      </view>

      <!-- Avatar -->
      <view class="avatar-glass">
        <text class="avatar-text-glass">{{ entrant.name.charAt(0) }}</text>
      </view>

      <!-- Info -->
      <view class="entrant-info">
        <text class="entrant-name-glass">{{ entrant.name }}</text>
        <view class="score-row">
          <text class="fire-glass">&#x1F525;</text>
          <text class="score-glass">{{ formattedScore }} GAS</text>
        </view>
      </view>

      <!-- Vote Button -->
      <NeoButton
        variant="primary"
        size="sm"
        :disabled="!!votingId"
        :loading="votingId === entrant.id"
        @click="$emit('vote', entrant)"
      >
        {{ boostLabel }}
      </NeoButton>
    </view>

    <!-- Progress Bar -->
    <view class="progress-track-glass">
      <view
        class="progress-bar-glass"
        :class="{ gold: rank === 1 }"
        :style="{ width: progressWidth }"
      >
        <view class="progress-glow" v-if="rank === 1"></view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoButton, NeoCard } from "@shared/components";
import { formatNumber } from "@shared/utils/format";

interface Entrant {
  id: string;
  name: string;
  category: string;
  score: number;
}

const props = defineProps<{
  entrant: Entrant;
  rank: number;
  topScore: number;
  votingId: string | null;
  boostLabel: string;
}>();

defineEmits<{
  vote: [entrant: Entrant];
}>();

const formattedScore = computed(() => formatNumber(props.entrant.score, 0));

const progressWidth = computed(() => {
  if (!props.entrant.score) return "0%";
  return `${(props.entrant.score / props.topScore) * 100}%`;
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.entrant-card-glass {
  margin-bottom: 0;
  padding: 24px;
}

.entrant-inner {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 16px;
}

.rank-glass {
  font-size: 24px;
  font-weight: 700;
  font-family: var(--hof-font);
  width: 40px;
  text-align: center;
  color: var(--text-muted);

  &.rank-1 {
    color: var(--hof-accent);
    font-size: 32px;
  }
  &.rank-2 {
    color: var(--text-muted);
    font-size: 28px;
  }
  &.rank-3 {
    color: var(--hof-bronze);
    font-size: 28px;
  }
}

.avatar-glass {
  width: 60px;
  height: 60px;
  background: var(--hof-avatar-bg);
  border: 2px solid var(--hof-avatar-border);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.avatar-text-glass {
  font-size: 24px;
  font-weight: 700;
  color: var(--hof-frame);
  font-family: var(--hof-font);
}

.entrant-info {
  flex: 1;
}

.entrant-name-glass {
  font-size: 20px;
  font-weight: 700;
  display: block;
  margin-bottom: 4px;
  color: var(--text-primary);
  font-family: var(--hof-font);
}

.score-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.score-glass {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-muted);
}

.progress-track-glass {
  height: 4px;
  background: var(--hof-progress-bg);
  border-radius: 2px;
  position: relative;
  overflow: hidden;
  margin-top: 12px;
}

.progress-bar-glass {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: var(--hof-progress);
  border-radius: 2px;

  &.gold {
    background: var(--hof-progress-top);
  }
}

.progress-glow {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, var(--hof-glow), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
}
</style>
