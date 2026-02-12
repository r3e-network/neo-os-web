<template>
  <view class="community-shell">
    <GradientCard variant="erobo" class="community-header">
      <text class="community-title">{{ t("communityReviews") }}</text>
      <text class="community-subtitle">{{ t("communityHint") }}</text>
    </GradientCard>

    <view class="reviews-list">
      <view v-for="review in reviewCards" :key="review.user" class="review-card">
        <view class="review-meta">
          <text class="review-user">{{ review.user }}</text>
          <text class="review-score">{{ review.score }}</text>
        </view>
        <text class="review-comment">{{ review.comment }}</text>
        <text class="review-tag">{{ review.tag }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { GradientCard } from "@shared/components";

interface Props {
  t: Function;
}

const props = defineProps<Props>();

const reviewCards = computed(() => [
  { user: "@neo-player", score: "\u2605\u2605\u2605\u2605\u2605", comment: "Game flow is crystal clear. Connect, open, settle \u2014 done.", tag: "Fast settlement" },
  { user: "@gas-hunter", score: "\u2605\u2605\u2605\u2605\u2606", comment: "Operation panel is easy to follow, no confusion on transaction steps.", tag: "Great UX" },
  { user: "@turtle-collector", score: "\u2605\u2605\u2605\u2605\u2605", comment: "Excellent mobile layout and clean desktop split-view for wallet actions.", tag: "Polished UI" },
]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.community-shell {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.community-header {
  border: 1px solid var(--turtle-primary-border);
}

.community-title {
  display: block;
  font-size: 20px;
  font-weight: 800;
  color: var(--turtle-text);
}

.community-subtitle {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.5;
  color: var(--turtle-text-subtle);
}

.reviews-list {
  display: grid;
  gap: 12px;
}

.review-card {
  padding: 14px;
  border-radius: 12px;
  background: var(--turtle-panel-bg);
  border: 1px solid var(--turtle-panel-border);
}

.review-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.review-user {
  font-size: 13px;
  font-weight: 700;
  color: var(--turtle-text);
}

.review-score {
  font-size: 12px;
  color: var(--turtle-primary);
}

.review-comment {
  display: block;
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--turtle-text-subtle);
}

.review-tag {
  display: inline-block;
  margin-top: 10px;
  font-size: 11px;
  color: var(--turtle-primary);
  padding: 4px 8px;
  border-radius: 999px;
  background: var(--turtle-primary-soft);
}

@media (max-width: 767px) {
  .community-shell {
    padding: 12px;
  }
}

@media (min-width: 1024px) {
  .community-shell {
    padding: 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
}
</style>
