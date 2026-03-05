<template>
  <view class="content-card">
    <view class="feed-tabs" role="tablist" :aria-label="`${t('commentsTab')} / ${t('reviewsTab')}`">
      <view
        :id="commentsTabId"
        class="feed-tab"
        :class="{ active: activeFeed === 'comments' }"
        role="tab"
        :tabindex="activeFeed === 'comments' ? 0 : -1"
        :aria-selected="activeFeed === 'comments'"
        :aria-controls="commentsPanelId"
        @click="setActiveFeed('comments')"
        @keydown.enter="setActiveFeed('comments')"
        @keydown.space.prevent="setActiveFeed('comments')"
        @keydown.left.prevent="onFeedTabArrow('comments')"
        @keydown.right.prevent="onFeedTabArrow('comments')"
        @keydown.up.prevent="onFeedTabArrow('comments')"
        @keydown.down.prevent="onFeedTabArrow('comments')"
        @keydown.home.prevent="setActiveFeed('comments', true)"
        @keydown.end.prevent="setActiveFeed('reviews', true)"
      >
        <text>{{ t("commentsTab") }}</text>
      </view>
      <view
        :id="reviewsTabId"
        class="feed-tab"
        :class="{ active: activeFeed === 'reviews' }"
        role="tab"
        :tabindex="activeFeed === 'reviews' ? 0 : -1"
        :aria-selected="activeFeed === 'reviews'"
        :aria-controls="reviewsPanelId"
        @click="setActiveFeed('reviews')"
        @keydown.enter="setActiveFeed('reviews')"
        @keydown.space.prevent="setActiveFeed('reviews')"
        @keydown.left.prevent="onFeedTabArrow('reviews')"
        @keydown.right.prevent="onFeedTabArrow('reviews')"
        @keydown.up.prevent="onFeedTabArrow('reviews')"
        @keydown.down.prevent="onFeedTabArrow('reviews')"
        @keydown.home.prevent="setActiveFeed('comments', true)"
        @keydown.end.prevent="setActiveFeed('reviews', true)"
      >
        <text>{{ t("reviewsTab") }}</text>
      </view>
    </view>

    <view
      v-if="activeFeed === 'comments'"
      :id="commentsPanelId"
      class="comments-panel"
      role="tabpanel"
      :aria-labelledby="commentsTabId"
    >
      <view class="comment-composer">
        <textarea
          v-model="draftComment"
          class="comment-input"
          :placeholder="t('commentPlaceholder')"
          maxlength="240"
        ></textarea>
        <button class="publish-button" :disabled="!canPublishComment" @click="publishComment">
          <text>{{ t("publishComment") }}</text>
        </button>
      </view>

      <view class="comment-list">
        <view v-for="comment in commentFeed" :key="comment.id" class="comment-item">
          <view class="comment-header">
            <text class="comment-author">{{ comment.author }}</text>
            <text class="comment-time">{{ comment.time }}</text>
          </view>
          <text class="comment-body">{{ comment.body }}</text>
        </view>
      </view>
    </view>

    <view v-else :id="reviewsPanelId" class="review-panel" role="tabpanel" :aria-labelledby="reviewsTabId">
      <view v-if="reviewFeed.length === 0" class="empty-state">
        <text>{{ t("noReviewsYet") }}</text>
      </view>
      <view v-else class="review-list">
        <view v-for="review in reviewFeed" :key="review.id" class="review-item">
          <text class="review-title">{{ review.title }}</text>
          <text class="review-body">{{ review.body }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, ref } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { MarketOrder as TradingOrder, MarketPosition } from "@/composables/usePredictionTrading";

interface CommentItem {
  id: string;
  author: string;
  time: string;
  body: string;
}

interface ReviewItem {
  id: string;
  title: string;
  body: string;
}

type ViewOrder = TradingOrder & { status?: string };

interface Props {
  marketId: number;
  marketOrders: ViewOrder[];
  marketPositions: MarketPosition[];
}

const props = defineProps<Props>();

const { t } = createUseI18n(messages)();

const formatPercent = (price: number) => `${(price * 100).toFixed(1)}%`;

const activeFeed = ref<"comments" | "reviews">("comments");
const commentsTabId = computed(() => `feed-tab-comments-${props.marketId}`);
const reviewsTabId = computed(() => `feed-tab-reviews-${props.marketId}`);
const commentsPanelId = computed(() => `feed-panel-comments-${props.marketId}`);
const reviewsPanelId = computed(() => `feed-panel-reviews-${props.marketId}`);
const draftComment = ref("");
const localComments = ref<CommentItem[]>([]);

const setActiveFeed = (feed: "comments" | "reviews", shouldFocus = false) => {
  activeFeed.value = feed;

  if (!shouldFocus || typeof document === "undefined") return;

  const targetId = feed === "comments" ? commentsTabId.value : reviewsTabId.value;
  void nextTick(() => {
    document.getElementById(targetId)?.focus();
  });
};

const onFeedTabArrow = (currentFeed: "comments" | "reviews") => {
  const nextFeed = currentFeed === "comments" ? "reviews" : "comments";
  setActiveFeed(nextFeed, true);
};

const seededComments = computed<CommentItem[]>(() => [
  { id: "seed-1", author: "SignalSeeker", time: t("commentTimeHour"), body: t("commentSeedOne") },
  { id: "seed-2", author: "ChainMonk", time: t("commentTimeTwoHours"), body: t("commentSeedTwo") },
  { id: "seed-3", author: "DeltaHedge", time: t("commentTimeFourHours"), body: t("commentSeedThree") },
]);

const commentFeed = computed(() => [...localComments.value, ...seededComments.value]);
const canPublishComment = computed(() => draftComment.value.trim().length > 0);

const reviewFeed = computed<ReviewItem[]>(() => {
  const positionReviews = props.marketPositions.map((position) => ({
    id: `position-${position.marketId}-${position.outcome}`,
    title: `${position.outcome.toUpperCase()} · ${t("reviewPositionTitle")}`,
    body: t("reviewPositionBody", {
      shares: position.shares.toFixed(2),
      avgPrice: formatPercent(position.avgPrice),
    }),
  }));

  const orderReviews = props.marketOrders.slice(0, 2).map((order) => ({
    id: `order-${order.id}`,
    title: `${order.orderType.toUpperCase()} ${order.outcome.toUpperCase()} · ${t("reviewOrderTitle")}`,
    body: t("reviewOrderBody", {
      shares: order.shares.toFixed(2),
      price: formatPercent(order.price),
    }),
  }));

  return [...positionReviews, ...orderReviews];
});

const publishComment = () => {
  if (!canPublishComment.value) return;

  localComments.value.unshift({
    id: `local-${Date.now()}`,
    author: t("youLabel"),
    time: t("commentTimeNow"),
    body: draftComment.value.trim(),
  });

  draftComment.value = "";
};

const resetState = () => {
  draftComment.value = "";
  localComments.value = [];
  activeFeed.value = "comments";
};

defineExpose({ resetState });
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.content-card {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--predict-card-shadow);
}

.feed-tabs {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 14px;
  border-bottom: 1px solid var(--predict-card-border);
}

.feed-tab {
  padding: 2px 0 10px;
  text-align: center;
  border-bottom: 2px solid transparent;
  color: var(--predict-text-secondary);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    border-bottom-color: var(--predict-accent);
    color: var(--predict-accent);
  }
}

.feed-tab:hover {
  border-color: rgba(59, 130, 246, 0.35);
  color: var(--predict-text-primary);
}

.feed-tab:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.45);
  outline-offset: 2px;
}

.feed-tab:hover {
  transform: translateY(-1px);
}

.feed-tab:active {
  transform: translateY(0);
}

.comment-composer {
  margin-bottom: 10px;
}

.comment-input {
  width: 100%;
  min-height: 102px;
  padding: 12px;
  border-radius: 12px;
  border: 1px solid var(--predict-input-border);
  background: var(--predict-input-bg);
  color: var(--predict-text-primary);
  font-size: 13px;
}

.publish-button {
  width: 100%;
  margin-top: 10px;
  border: none;
  border-radius: 10px;
  padding: 12px;
  color: var(--predict-text-bright);
  background: linear-gradient(135deg, var(--predict-btn-primary), var(--predict-btn-primary-hover));
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
}

.publish-button:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 24px -18px rgba(37, 99, 235, 0.9);
}

.publish-button:not(:disabled):active {
  transform: translateY(0);
}

.publish-button:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.45);
  outline-offset: 2px;
}

.comment-list,
.review-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.comment-item,
.review-item {
  border: 1px solid var(--predict-card-border);
  background: var(--predict-bg-secondary);
  border-radius: 10px;
  padding: 11px 12px;
}

.comment-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 6px;
}

.comment-author {
  font-size: 12px;
  font-weight: 700;
  color: var(--predict-text-primary);
}

.comment-time {
  font-size: 11px;
  color: var(--predict-text-muted);
}

.comment-body,
.review-body {
  font-size: 13px;
  color: var(--predict-text-secondary);
  line-height: 1.55;
}

.review-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  color: var(--predict-text-primary);
  margin-bottom: 6px;
}

.empty-state {
  border: 1px dashed var(--predict-card-border);
  border-radius: 10px;
  background: var(--predict-bg-secondary);
  color: var(--predict-text-muted);
  text-align: center;
  padding: 14px;
  font-size: 13px;
}

@media (prefers-reduced-motion: reduce) {
  .feed-tab,
  .publish-button {
    transition: none;
  }

  .feed-tab:hover,
  .publish-button:not(:disabled):hover,
  .feed-tab:active,
  .publish-button:not(:disabled):active {
    transform: none;
  }
}
</style>
