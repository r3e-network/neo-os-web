<template>
  <view class="market-detail">
    <view
      class="back-button"
      role="button"
      tabindex="0"
      @click="emit('back')"
      @keydown.enter="emit('back')"
      @keydown.space.prevent="emit('back')"
    >
      <text class="back-icon">←</text>
      <text>{{ t("markets") }}</text>
    </view>

    <view class="market-shell">
      <view class="left-column">
        <view class="hero-card">
          <view class="hero-topline">
            <text class="hero-category">{{ getCategoryLabel(market.category) }}</text>
            <text class="hero-status" :class="`status-${market.status}`">{{ statusLabel }}</text>
          </view>

          <text class="hero-question">{{ market.question }}</text>
          <text class="hero-description">{{ market.description || t("marketDescriptionFallback") }}</text>

          <view class="hero-meta">
            <view class="meta-chip">
              <text class="meta-label">{{ t("endTime") }}</text>
              <text class="meta-value">{{ formatEndTime(market.endTime) }}</text>
            </view>
            <view class="meta-chip">
              <text class="meta-label">{{ t("resolutionSource") }}</text>
              <text class="meta-value">{{ shortenAddress(market.oracle) }}</text>
            </view>
            <view class="meta-chip">
              <text class="meta-label">{{ t("totalVolume") }}</text>
              <text class="meta-value">{{ formatGas(market.totalVolume) }} GAS</text>
            </view>
          </view>

          <view class="odds-grid">
            <view class="odds-card yes-card">
              <text class="odds-label">{{ t("yesShares") }}</text>
              <text class="odds-value">{{ formatPercent(market.yesPrice) }}</text>
            </view>
            <view class="odds-card no-card">
              <text class="odds-label">{{ t("noShares") }}</text>
              <text class="odds-value">{{ formatPercent(market.noPrice) }}</text>
            </view>
          </view>
        </view>

        <view class="content-card">
          <text class="section-title">{{ t("coreLogicTitle") }}</text>
          <view class="logic-list">
            <view class="logic-item">
              <text class="logic-label">{{ t("logicResolutionRule") }}</text>
              <text class="logic-value">{{ market.description || t("marketDescriptionFallback") }}</text>
            </view>
            <view class="logic-item">
              <text class="logic-label">{{ t("logicSettlementAt") }}</text>
              <text class="logic-value">{{ formatEndTime(market.endTime) }}</text>
            </view>
            <view class="logic-item">
              <text class="logic-label">{{ t("logicOracle") }}</text>
              <text class="logic-value">{{ shortenAddress(market.oracle) }}</text>
            </view>
          </view>
        </view>

        <view class="content-card">
          <view class="section-row">
            <text class="section-title">{{ t("yourOrders") }}</text>
            <text class="section-count">{{ marketOrders.length }}</text>
          </view>

          <view v-if="marketOrders.length === 0" class="empty-state">
            <text>{{ t("noOrders") }}</text>
          </view>
          <view v-else class="order-list">
            <view v-for="order in marketOrders" :key="order.id" class="order-item">
              <view class="order-main">
                <text class="order-type" :class="order.orderType">
                  {{ order.orderType.toUpperCase() }} · {{ order.outcome.toUpperCase() }}
                </text>
                <text class="order-detail">{{ order.shares.toFixed(2) }} @ {{ formatPercent(order.price) }}</text>
              </view>

              <view
                v-if="order.status !== 'cancelled'"
                class="cancel-pill"
                role="button"
                tabindex="0"
                @click="emit('cancel-order', order.id)"
                @keydown.enter="emit('cancel-order', order.id)"
                @keydown.space.prevent="emit('cancel-order', order.id)"
              >
                <text>{{ t("cancelOrder") }}</text>
              </view>
            </view>
          </view>

          <view class="positions-section">
            <view class="section-row">
              <text class="section-title">{{ t("yourPositions") }}</text>
              <text class="section-count">{{ marketPositions.length }}</text>
            </view>

            <view v-if="marketPositions.length === 0" class="empty-state compact">
              <text>{{ t("noPositions") }}</text>
            </view>
            <view v-else class="position-list">
              <view v-for="position in marketPositions" :key="`${position.marketId}-${position.outcome}`" class="position-item">
                <text class="position-outcome">{{ position.outcome.toUpperCase() }}</text>
                <text class="position-meta">{{ position.shares.toFixed(2) }} {{ t("shares") }}</text>
                <text class="position-meta">Avg {{ formatPercent(position.avgPrice) }}</text>
              </view>
            </view>
          </view>
        </view>

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

          <view
            v-else
            :id="reviewsPanelId"
            class="review-panel"
            role="tabpanel"
            :aria-labelledby="reviewsTabId"
          >
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
      </view>

      <view class="right-column">
        <view class="trade-panel">
          <text class="panel-title">{{ t("operationPanelTitle") }}</text>
          <text class="panel-subtitle">{{ t("operationPanelHint") }}</text>

          <view class="panel-badges">
            <view class="panel-badge">
              <text>{{ t("txNetwork") }}: Neo N3</text>
            </view>
            <view class="panel-badge">
              <text>{{ t("txContract") }}: {{ t("txContractValue") }}</text>
            </view>
          </view>

          <view class="workflow-strip">
            <view class="workflow-step active"><text>{{ t("workflowStepConfig") }}</text></view>
            <view class="workflow-step"><text>{{ t("workflowStepReview") }}</text></view>
            <view class="workflow-step"><text>{{ t("workflowStepSign") }}</text></view>
          </view>

          <view class="control-group">
            <text class="control-label">{{ t("orderType") }}</text>
            <view class="segment-row">
              <view
                class="segment"
                :class="{ active: tradeForm.orderType === 'buy' }"
                role="button"
                tabindex="0"
                :aria-pressed="tradeForm.orderType === 'buy'"
                @click="tradeForm.orderType = 'buy'"
                @keydown.enter="tradeForm.orderType = 'buy'"
                @keydown.space.prevent="tradeForm.orderType = 'buy'"
              >
                <text>{{ t("buy") }}</text>
              </view>
              <view
                class="segment"
                :class="{ active: tradeForm.orderType === 'sell' }"
                role="button"
                tabindex="0"
                :aria-pressed="tradeForm.orderType === 'sell'"
                @click="tradeForm.orderType = 'sell'"
                @keydown.enter="tradeForm.orderType = 'sell'"
                @keydown.space.prevent="tradeForm.orderType = 'sell'"
              >
                <text>{{ t("sell") }}</text>
              </view>
            </view>
          </view>

          <view class="control-group">
            <text class="control-label">{{ t("chooseOutcome") }}</text>
            <view class="segment-row">
              <view
                class="segment"
                :class="['yes', { active: tradeForm.outcome === 'yes' }]"
                role="button"
                tabindex="0"
                :aria-pressed="tradeForm.outcome === 'yes'"
                @click="tradeForm.outcome = 'yes'"
                @keydown.enter="tradeForm.outcome = 'yes'"
                @keydown.space.prevent="tradeForm.outcome = 'yes'"
              >
                <text>{{ t("yesShares") }} {{ formatPercent(market.yesPrice) }}</text>
              </view>
              <view
                class="segment"
                :class="['no', { active: tradeForm.outcome === 'no' }]"
                role="button"
                tabindex="0"
                :aria-pressed="tradeForm.outcome === 'no'"
                @click="tradeForm.outcome = 'no'"
                @keydown.enter="tradeForm.outcome = 'no'"
                @keydown.space.prevent="tradeForm.outcome = 'no'"
              >
                <text>{{ t("noShares") }} {{ formatPercent(market.noPrice) }}</text>
              </view>
            </view>
          </view>

          <view class="control-group">
            <text class="control-label">{{ t("amount") }} ({{ t("shares") }})</text>
            <input v-model.number="tradeForm.shares" class="trade-input" type="number" :placeholder="'10'" min="0" />
            <view class="preset-row shares">
              <view
                class="preset-chip"
                role="button"
                tabindex="0"
                @click="setSharePreset(1)"
                @keydown.enter="setSharePreset(1)"
                @keydown.space.prevent="setSharePreset(1)"
              >
                +1
              </view>
              <view
                class="preset-chip"
                role="button"
                tabindex="0"
                @click="setSharePreset(10)"
                @keydown.enter="setSharePreset(10)"
                @keydown.space.prevent="setSharePreset(10)"
              >
                +10
              </view>
              <view
                class="preset-chip"
                role="button"
                tabindex="0"
                @click="setSharePreset(50)"
                @keydown.enter="setSharePreset(50)"
                @keydown.space.prevent="setSharePreset(50)"
              >
                +50
              </view>
              <view
                class="preset-chip"
                role="button"
                tabindex="0"
                @click="setSharePreset(100)"
                @keydown.enter="setSharePreset(100)"
                @keydown.space.prevent="setSharePreset(100)"
              >
                +100
              </view>
            </view>
          </view>

          <view class="control-group">
            <text class="control-label">{{ t("orderPrice") }} (%)</text>
            <input
              v-model.number="tradeForm.price"
              class="trade-input"
              type="number"
              :max="100"
              :min="0"
              step="0.1"
            />
            <view class="preset-row">
              <view
                class="preset-chip"
                role="button"
                tabindex="0"
                @click="setPricePreset(10)"
                @keydown.enter="setPricePreset(10)"
                @keydown.space.prevent="setPricePreset(10)"
              >
                10%
              </view>
              <view
                class="preset-chip"
                role="button"
                tabindex="0"
                @click="setPricePreset(25)"
                @keydown.enter="setPricePreset(25)"
                @keydown.space.prevent="setPricePreset(25)"
              >
                25%
              </view>
              <view
                class="preset-chip"
                role="button"
                tabindex="0"
                @click="setPricePreset(50)"
                @keydown.enter="setPricePreset(50)"
                @keydown.space.prevent="setPricePreset(50)"
              >
                50%
              </view>
              <view
                class="preset-chip"
                role="button"
                tabindex="0"
                @click="setPricePreset(75)"
                @keydown.enter="setPricePreset(75)"
                @keydown.space.prevent="setPricePreset(75)"
              >
                75%
              </view>
            </view>
          </view>

          <view class="preview-card">
            <text class="preview-title">{{ t("txPreview") }}</text>
            <view class="preview-row">
              <text>{{ t("txMethod") }}</text>
              <text>{{ txMethod }}</text>
            </view>
            <view class="preview-row">
              <text>{{ t("txNetwork") }}</text>
              <text>Neo N3</text>
            </view>
            <view class="preview-row">
              <text>{{ t("txSubtotal") }}</text>
              <text>{{ formatGas(tradeTotal) }} GAS</text>
            </view>
            <view class="preview-row">
              <text>{{ t("txFee") }}</text>
              <text>{{ formatGas(estimatedFee) }} GAS</text>
            </view>
            <view class="preview-row delta" :class="{ positive: priceDelta > 0, negative: priceDelta < 0 }">
              <text>{{ t("txEdge") }}</text>
              <text>{{ formatSignedPercent(priceDelta) }}</text>
            </view>
            <view class="preview-row total">
              <text>{{ t("txTotal") }}</text>
              <text>{{ formatGas(tradeTotal + estimatedFee) }} GAS</text>
            </view>
            <view class="preview-row">
              <text>{{ t("txMaxPayout") }}</text>
              <text>{{ formatGas(maxPayout) }} GAS</text>
            </view>
            <view class="call-data-box">
              <text class="call-data-label">{{ t("txCallData") }}</text>
              <text class="call-data-value">{{ callDataPreview }}</text>
            </view>
          </view>

          <button class="submit-button" :disabled="isTrading || !canSubmitTrade" @click="submitTrade">
            <text>{{ isTrading ? t("loading") : t("signAndSubmit") }}</text>
          </button>
          <text class="panel-footnote">{{ t("txFootnote") }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import type { PredictionMarket } from "@/composables/usePredictionMarkets";
import type { MarketOrder as TradingOrder, MarketPosition } from "@/composables/usePredictionTrading";

interface Props {
  market: PredictionMarket;
  yourOrders: ViewOrder[];
  yourPositions: MarketPosition[];
  isTrading: boolean;
  t?: (key: string, args?: Record<string, string | number>) => string;
}

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

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: "back"): void;
  (e: "trade", payload: { outcome: "yes" | "no"; orderType: "buy" | "sell"; price: number; shares: number }): void;
  (e: "cancel-order", orderId: number): void;
}>();

const { t: i18nT } = useI18n();
const t = (key: string, args?: Record<string, string | number>) => {
  if (props.t) return props.t(key, args);
  return i18nT(key as never, args);
};

const getDefaultPrice = (outcome: "yes" | "no") => {
  const sourcePrice = outcome === "yes" ? props.market.yesPrice : props.market.noPrice;
  return Number((sourcePrice * 100).toFixed(1));
};

const tradeForm = reactive<{
  orderType: "buy" | "sell";
  outcome: "yes" | "no";
  shares: number;
  price: number;
}>({
  orderType: "buy",
  outcome: "yes",
  shares: 10,
  price: getDefaultPrice("yes"),
});

watch(
  () => props.market.id,
  () => {
    tradeForm.orderType = "buy";
    tradeForm.outcome = "yes";
    tradeForm.shares = 10;
    tradeForm.price = getDefaultPrice("yes");
    draftComment.value = "";
    localComments.value = [];
    activeFeed.value = "comments";
  }
);

watch(
  () => tradeForm.outcome,
  (outcome) => {
    tradeForm.price = getDefaultPrice(outcome);
  }
);

const marketOrders = computed(() => props.yourOrders.filter((order) => order.marketId === props.market.id));
const marketPositions = computed(() => props.yourPositions.filter((position) => position.marketId === props.market.id));

const tradeTotal = computed(() => (tradeForm.shares * tradeForm.price) / 100);
const estimatedFee = computed(() => tradeTotal.value * 0.003);
const maxPayout = computed(() => tradeForm.shares);
const outcomeMarketPrice = computed(() =>
  tradeForm.outcome === "yes" ? props.market.yesPrice : props.market.noPrice
);
const priceDelta = computed(() => tradeForm.price / 100 - outcomeMarketPrice.value);

const canSubmitTrade = computed(() => {
  return (
    props.market.status === "open" &&
    Number.isFinite(tradeForm.shares) &&
    Number.isFinite(tradeForm.price) &&
    tradeForm.shares > 0 &&
    tradeForm.shares <= 100000 &&
    tradeForm.price > 0 &&
    tradeForm.price <= 100
  );
});

const txMethod = computed(() => {
  if (tradeForm.orderType === "sell") {
    return tradeForm.outcome === "yes" ? "SellYes" : "SellNo";
  }
  return tradeForm.outcome === "yes" ? "BuyYes" : "BuyNo";
});

const callDataPreview = computed(() => {
  const normalizedPrice = (tradeForm.price / 100).toFixed(3);
  return `${txMethod.value}(marketId=${props.market.id}, outcome=${tradeForm.outcome}, shares=${tradeForm.shares}, price=${normalizedPrice})`;
});

const activeFeed = ref<"comments" | "reviews">("comments");
const commentsTabId = computed(() => `feed-tab-comments-${props.market.id}`);
const reviewsTabId = computed(() => `feed-tab-reviews-${props.market.id}`);
const commentsPanelId = computed(() => `feed-panel-comments-${props.market.id}`);
const reviewsPanelId = computed(() => `feed-panel-reviews-${props.market.id}`);
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
  const positionReviews = marketPositions.value.map((position) => ({
    id: `position-${position.marketId}-${position.outcome}`,
    title: `${position.outcome.toUpperCase()} · ${t("reviewPositionTitle")}`,
    body: t("reviewPositionBody", {
      shares: position.shares.toFixed(2),
      avgPrice: formatPercent(position.avgPrice),
    }),
  }));

  const orderReviews = marketOrders.value.slice(0, 2).map((order) => ({
    id: `order-${order.id}`,
    title: `${order.orderType.toUpperCase()} ${order.outcome.toUpperCase()} · ${t("reviewOrderTitle")}`,
    body: t("reviewOrderBody", {
      shares: order.shares.toFixed(2),
      price: formatPercent(order.price),
    }),
  }));

  return [...positionReviews, ...orderReviews];
});

const categoryLabelMap = {
  crypto: "categoryCrypto",
  sports: "categorySports",
  politics: "categoryPolitics",
  economics: "categoryEconomics",
  entertainment: "categoryEntertainment",
  other: "categoryOther",
} as const;

const statusLabelMap = {
  open: "statusOpen",
  closed: "statusClosed",
  resolved: "statusResolved",
  cancelled: "statusCancelled",
} as const;

const statusLabel = computed(() => {
  const statusKey = statusLabelMap[props.market.status as keyof typeof statusLabelMap] ?? "statusOpen";
  return t(statusKey);
});

const getCategoryLabel = (category: string) => {
  const key = categoryLabelMap[category as keyof typeof categoryLabelMap] ?? "categoryOther";
  return t(key);
};

const formatEndTime = (endTime: number) => {
  const date = new Date(endTime);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatPercent = (price: number) => `${(price * 100).toFixed(1)}%`;

const formatSignedPercent = (value: number) => {
  const normalized = Number(value.toFixed(4));
  if (normalized === 0) return "0.0%";
  const sign = normalized > 0 ? "+" : "-";
  return `${sign}${Math.abs(normalized * 100).toFixed(1)}%`;
};

const formatGas = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return value.toFixed(3);
};

const shortenAddress = (address: string) => {
  if (!address) return "--";
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
};

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

const setSharePreset = (value: number) => {
  tradeForm.shares = value;
};

const setPricePreset = (value: number) => {
  tradeForm.price = value;
};

const submitTrade = () => {
  if (!canSubmitTrade.value) return;

  emit("trade", {
    outcome: tradeForm.outcome,
    orderType: tradeForm.orderType,
    price: tradeForm.price / 100,
    shares: tradeForm.shares,
  });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../prediction-market-theme.scss";

.market-detail {
  display: flex;
  flex-direction: column;
  gap: 18px;
  width: 100%;
  max-width: 1380px;
  margin: 0 auto;

  @media (min-width: 1024px) {
    padding: 0 12px 24px;
  }

  @media (min-width: 1440px) {
    padding: 0 20px 28px;
  }
}

.back-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--predict-accent);
  font-weight: 600;
  cursor: pointer;

  .back-icon {
    font-size: 18px;
  }
}

.back-button,
.feed-tab,
.segment,
.preset-chip,
.cancel-pill,
.publish-button,
.submit-button {
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;
}

.back-button:hover,
.feed-tab:hover,
.segment:hover,
.preset-chip:hover,
.cancel-pill:hover,
.publish-button:not(:disabled):hover,
.submit-button:not(:disabled):hover {
  transform: translateY(-1px);
}

.back-button:active,
.feed-tab:active,
.segment:active,
.preset-chip:active,
.cancel-pill:active,
.publish-button:not(:disabled):active,
.submit-button:not(:disabled):active {
  transform: translateY(0);
}

.back-button:focus-visible,
.feed-tab:focus-visible,
.segment:focus-visible,
.preset-chip:focus-visible,
.cancel-pill:focus-visible,
.publish-button:focus-visible,
.submit-button:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.45);
  outline-offset: 2px;
}

.back-button:hover {
  color: var(--predict-btn-primary-hover);
}

.feed-tab:hover,
.segment:hover,
.preset-chip:hover {
  border-color: rgba(59, 130, 246, 0.35);
  color: var(--predict-text-primary);
}

.cancel-pill:hover {
  box-shadow: 0 8px 18px -14px rgba(220, 38, 38, 0.9);
}

.publish-button:not(:disabled):hover,
.submit-button:not(:disabled):hover {
  box-shadow: 0 12px 24px -18px rgba(37, 99, 235, 0.9);
}

.market-shell {
  display: grid;
  gap: 20px;
}

@media (min-width: 1024px) {
  .market-shell {
    grid-template-columns: minmax(0, 1.85fr) minmax(380px, 420px);
    gap: 24px;
    align-items: start;
  }
}

@media (min-width: 1280px) {
  .market-shell {
    grid-template-columns: minmax(0, 1.9fr) minmax(400px, 440px);
  }
}

@media (min-width: 1440px) {
  .market-shell {
    grid-template-columns: minmax(0, 2fr) minmax(420px, 460px);
  }
}

.left-column {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.right-column {
  min-width: 0;

  @media (min-width: 1024px) {
    position: sticky;
    top: 20px;
    max-height: calc(100vh - 40px);
    overflow: auto;
    padding-right: 4px;
    scrollbar-width: thin;
    scrollbar-color: rgba(148, 163, 184, 0.35) transparent;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(148, 163, 184, 0.35);
      border-radius: 999px;
    }
  }
}

.hero-card,
.content-card,
.trade-panel {
  background: var(--predict-card-bg);
  border: 1px solid var(--predict-card-border);
  border-radius: 18px;
  padding: 20px;
  box-shadow: var(--predict-card-shadow);
}

.trade-panel {
  position: relative;

  &::before {
    content: "";
    position: absolute;
    left: 20px;
    right: 20px;
    top: 0;
    height: 1px;
    background: linear-gradient(90deg, rgba(59, 130, 246, 0), rgba(59, 130, 246, 0.5), rgba(59, 130, 246, 0));
  }
}

.hero-topline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.hero-category,
.hero-status {
  display: inline-flex;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.4px;
}

.hero-category {
  background: rgba(59, 130, 246, 0.14);
  color: var(--predict-accent);
}

.hero-status {
  color: var(--predict-text-primary);
  background: rgba(156, 163, 175, 0.14);

  &.status-open {
    background: var(--predict-success-bg);
    color: var(--predict-success);
  }

  &.status-closed {
    background: var(--predict-warning-bg);
    color: var(--predict-warning);
  }

  &.status-resolved {
    background: rgba(59, 130, 246, 0.14);
    color: var(--predict-accent);
  }

  &.status-cancelled {
    background: var(--predict-danger-bg);
    color: var(--predict-danger);
  }
}

.hero-question {
  font-size: 26px;
  font-weight: 750;
  line-height: 1.32;
  color: var(--predict-text-primary);
  margin-bottom: 12px;
  display: block;

  @media (min-width: 1024px) {
    font-size: 32px;
  }
}

.hero-description {
  font-size: 15px;
  line-height: 1.62;
  color: var(--predict-text-secondary);
  display: block;
}

.hero-meta {
  display: grid;
  gap: 10px;
  margin-top: 16px;

  @media (min-width: 760px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.meta-chip {
  background: var(--predict-bg-secondary);
  border: 1px solid var(--predict-card-border);
  border-radius: 12px;
  padding: 10px 12px;
}

.meta-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.4px;
  color: var(--predict-text-muted);
  margin-bottom: 4px;
}

.meta-value {
  display: block;
  font-size: 13px;
  color: var(--predict-text-primary);
  font-weight: 600;
}

.odds-grid {
  margin-top: 14px;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.odds-card {
  border-radius: 12px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;

  &.yes-card {
    background: var(--predict-bid-bg);
    color: var(--predict-bid-text);
  }

  &.no-card {
    background: var(--predict-ask-bg);
    color: var(--predict-ask-text);
  }
}

.odds-label {
  font-size: 12px;
  font-weight: 600;
}

.odds-value {
  font-size: 30px;
  font-weight: 800;
}

.section-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--predict-text-primary);
  display: block;
}

.section-count {
  font-size: 12px;
  color: var(--predict-text-muted);
  background: rgba(148, 163, 184, 0.16);
  border-radius: 999px;
  padding: 4px 9px;
}

.logic-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.logic-item {
  border: 1px solid var(--predict-card-border);
  border-radius: 10px;
  background: var(--predict-bg-secondary);
  padding: 12px;
}

.logic-label {
  display: block;
  font-size: 12px;
  font-weight: 600;
  color: var(--predict-text-muted);
  margin-bottom: 6px;
}

.logic-value {
  display: block;
  font-size: 13px;
  line-height: 1.45;
  color: var(--predict-text-secondary);
}

.empty-state {
  border: 1px dashed var(--predict-card-border);
  border-radius: 10px;
  background: var(--predict-bg-secondary);
  color: var(--predict-text-muted);
  text-align: center;
  padding: 14px;
  font-size: 13px;

  &.compact {
    padding: 10px;
  }
}

.order-list,
.position-list,
.comment-list,
.review-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.order-item,
.position-item,
.comment-item,
.review-item {
  border: 1px solid var(--predict-card-border);
  background: var(--predict-bg-secondary);
  border-radius: 10px;
  padding: 11px 12px;
}

.order-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
}

.order-main {
  min-width: 0;
}

.order-type {
  display: block;
  font-size: 12px;
  font-weight: 700;

  &.buy {
    color: var(--predict-bid-text);
  }

  &.sell {
    color: var(--predict-ask-text);
  }
}

.order-detail {
  display: block;
  color: var(--predict-text-secondary);
  font-size: 12px;
  margin-top: 3px;
}

.cancel-pill {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--predict-danger-bg);
  color: var(--predict-danger);
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
}

.positions-section {
  margin-top: 14px;
}

.position-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.position-outcome {
  font-size: 12px;
  font-weight: 700;
  color: var(--predict-accent);
}

.position-meta {
  font-size: 12px;
  color: var(--predict-text-secondary);
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

.publish-button,
.submit-button {
  width: 100%;
  margin-top: 10px;
  border: none;
  border-radius: 10px;
  padding: 12px;
  color: #fff;
  background: linear-gradient(135deg, var(--predict-btn-primary), var(--predict-btn-primary-hover));
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }
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

.panel-title {
  display: block;
  font-size: 22px;
  color: var(--predict-text-primary);
  font-weight: 800;
}

.panel-subtitle {
  display: block;
  margin-top: 6px;
  margin-bottom: 14px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--predict-text-secondary);
}

.panel-badges {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}

.panel-badge {
  border: 1px solid var(--predict-card-border);
  background: rgba(148, 163, 184, 0.08);
  border-radius: 999px;
  padding: 5px 10px;
  color: var(--predict-text-secondary);
  font-size: 11px;
  font-weight: 600;
}

.workflow-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 16px;
}

.workflow-step {
  border: 1px solid var(--predict-card-border);
  background: var(--predict-bg-secondary);
  border-radius: 999px;
  padding: 7px 8px;
  text-align: center;
  color: var(--predict-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.2px;

  &.active {
    border-color: rgba(59, 130, 246, 0.45);
    color: var(--predict-accent);
    background: rgba(59, 130, 246, 0.1);
  }
}

.control-group {
  margin-bottom: 16px;
}

.control-label {
  display: block;
  margin-bottom: 8px;
  font-size: 11px;
  font-weight: 700;
  color: var(--predict-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.45px;
}

.segment-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.segment {
  padding: 12px 10px;
  border-radius: 11px;
  border: 1px solid var(--predict-input-border);
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: var(--predict-text-secondary);
  cursor: pointer;
  transition: all 0.2s;

  &.active {
    border-color: var(--predict-accent);
    background: rgba(59, 130, 246, 0.14);
    color: var(--predict-accent);
  }

  &.yes.active {
    border-color: var(--predict-success);
    color: var(--predict-success);
    background: var(--predict-success-bg);
  }

  &.no.active {
    border-color: var(--predict-danger);
    color: var(--predict-danger);
    background: var(--predict-danger-bg);
  }
}

.trade-input {
  width: 100%;
  border-radius: 11px;
  border: 1px solid var(--predict-input-border);
  background: var(--predict-input-bg);
  color: var(--predict-text-primary);
  font-size: 14px;
  padding: 12px;
}

.preset-row {
  margin-top: 9px;
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
}

.preset-row.shares .preset-chip {
  min-width: 52px;
  text-align: center;
}

.preset-chip {
  padding: 6px 9px;
  border-radius: 999px;
  border: 1px solid var(--predict-input-border);
  color: var(--predict-text-secondary);
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
}

.preview-card {
  border: 1px solid var(--predict-card-border);
  border-radius: 14px;
  background: var(--predict-bg-secondary);
  padding: 14px;
}

.preview-title {
  display: block;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.4px;
  text-transform: uppercase;
  color: var(--predict-text-muted);
  margin-bottom: 8px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  color: var(--predict-text-secondary);
  padding: 6px 0;

  &.delta.positive {
    color: var(--predict-success);
  }

  &.delta.negative {
    color: var(--predict-danger);
  }

  text:last-child {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    letter-spacing: 0.2px;
  }

  &.total {
    border-top: 1px solid var(--predict-card-border);
    margin-top: 4px;
    padding-top: 9px;
    font-weight: 700;
    color: var(--predict-text-primary);
  }
}

.call-data-box {
  margin-top: 10px;
  border-top: 1px dashed var(--predict-card-border);
  padding-top: 10px;
  background: rgba(148, 163, 184, 0.06);
  border-radius: 10px;
  padding: 10px;
  overflow: hidden;
}

.call-data-label {
  display: block;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.35px;
  color: var(--predict-text-muted);
  margin-bottom: 6px;
}

.call-data-value {
  display: block;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  color: var(--predict-text-primary);
  line-height: 1.5;
  word-break: break-word;
  overflow-wrap: anywhere;
}

.panel-footnote {
  display: block;
  margin-top: 10px;
  font-size: 11px;
  color: var(--predict-text-muted);
  line-height: 1.45;
}

@media (prefers-reduced-motion: reduce) {
  .back-button,
  .feed-tab,
  .segment,
  .preset-chip,
  .cancel-pill,
  .publish-button,
  .submit-button {
    transition: none;
  }

  .back-button:hover,
  .feed-tab:hover,
  .segment:hover,
  .preset-chip:hover,
  .cancel-pill:hover,
  .publish-button:not(:disabled):hover,
  .submit-button:not(:disabled):hover,
  .back-button:active,
  .feed-tab:active,
  .segment:active,
  .preset-chip:active,
  .cancel-pill:active,
  .publish-button:not(:disabled):active,
  .submit-button:not(:disabled):active {
    transform: none;
  }
}
</style>
