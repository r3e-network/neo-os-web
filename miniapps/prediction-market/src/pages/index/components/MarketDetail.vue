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
        <MarketHeroCard :market="market" :t="t" />

        <MarketOrderList
          :market-orders="marketOrders"
          :market-positions="marketPositions"
          :t="t"
          @cancel-order="(id) => emit('cancel-order', id)"
        />

        <MarketCommentFeed
          ref="commentFeedRef"
          :market-id="market.id"
          :market-orders="marketOrders"
          :market-positions="marketPositions"
          :t="t"
        />
      </view>

      <view class="right-column">
        <MarketTradeForm
          :market="market"
          :is-trading="isTrading"
          :t="t"
          @trade="(payload) => emit('trade', payload)"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "@/composables/useI18n";
import type { PredictionMarket } from "@/composables/usePredictionMarkets";
import type { MarketOrder as TradingOrder, MarketPosition } from "@/composables/usePredictionTrading";

import MarketHeroCard from "./MarketHeroCard.vue";
import MarketOrderList from "./MarketOrderList.vue";
import MarketCommentFeed from "./MarketCommentFeed.vue";
import MarketTradeForm from "./MarketTradeForm.vue";

type ViewOrder = TradingOrder & { status?: string };

interface Props {
  market: PredictionMarket;
  yourOrders: ViewOrder[];
  yourPositions: MarketPosition[];
  isTrading: boolean;
  t?: (key: string, args?: Record<string, string | number>) => string;
}

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

const commentFeedRef = ref<InstanceType<typeof MarketCommentFeed> | null>(null);

const marketOrders = computed(() => props.yourOrders.filter((order) => order.marketId === props.market.id));
const marketPositions = computed(() => props.yourPositions.filter((position) => position.marketId === props.market.id));

watch(
  () => props.market.id,
  () => {
    commentFeedRef.value?.resetState();
  }
);
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
  transition:
    transform 0.16s ease,
    box-shadow 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease,
    border-color 0.2s ease,
    opacity 0.2s ease;

  .back-icon {
    font-size: 18px;
  }
}

.back-button:hover {
  transform: translateY(-1px);
  color: var(--predict-btn-primary-hover);
}

.back-button:active {
  transform: translateY(0);
}

.back-button:focus-visible {
  outline: 2px solid rgba(59, 130, 246, 0.45);
  outline-offset: 2px;
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

@media (prefers-reduced-motion: reduce) {
  .back-button {
    transition: none;
  }

  .back-button:hover,
  .back-button:active {
    transform: none;
  }
}
</style>
