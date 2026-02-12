<template>
  <view class="market-list">
    <!-- Mobile Category Filter -->
    <view v-if="!isDesktop" class="mobile-filter">
      <scroll-view scroll-x class="category-scroll">
        <view
          v-for="cat in categories"
          :key="cat.id"
          class="category-chip"
          :class="{ active: selectedCategory === cat.id }"
          role="button"
          tabindex="0"
          :aria-label="cat.label"
          :aria-pressed="selectedCategory === cat.id"
          @click="$emit('selectCategory', cat.id)"
        >
          <text>{{ cat.label }}</text>
        </view>
      </scroll-view>
    </view>

    <view class="content-card">
      <view class="card-header">
        <text class="card-title">{{ t("activeMarkets") }}</text>
        <view class="sort-dropdown" role="button" tabindex="0" :aria-label="t('sortBy') || 'Sort'" @click="$emit('toggleSort')">
          <text>{{ sortLabel }}</text>
          <text class="chevron" aria-hidden="true">▼</text>
        </view>
      </view>
      
      <view v-if="loading" class="loading-state">
        <view class="spinner" />
        <text>{{ t("loading") }}</text>
      </view>
      
      <view v-else-if="markets.length === 0" class="empty-state">
        <text class="empty-icon">📊</text>
        <text class="empty-title">{{ t("noMarkets") }}</text>
        <text class="empty-subtitle">{{ t("checkBackLater") }}</text>
      </view>
      
      <view v-else class="market-grid">
        <MarketCard
          v-for="market in markets"
          :key="market.id"
          :market="market"
          :t="t"
          @click="$emit('select', market)"
        />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import MarketCard from "./MarketCard.vue";
import type { PredictionMarket, Category } from "@/types";

interface Props {
  markets: PredictionMarket[];
  categories: Category[];
  selectedCategory: string;
  sortLabel: string;
  loading: boolean;
  isDesktop: boolean;
  t: Function;
}

defineProps<Props>();

defineEmits<{
  select: [market: PredictionMarket];
  selectCategory: [category: string];
  toggleSort: [];
}>();
</script>

<style lang="scss" scoped>
.market-list {
  width: 100%;
}

.mobile-filter {
  margin-bottom: 16px;
}

.category-scroll {
  white-space: nowrap;
}

.category-chip {
  display: inline-flex;
  padding: 8px 16px;
  margin-right: 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--pm-border);
  border-radius: 99px;
  font-size: 13px;
  color: var(--pm-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  
  &.active {
    background: var(--pm-primary);
    border-color: var(--pm-primary);
    color: white;
  }
}

.content-card {
  background: var(--pm-card-bg);
  border: 1px solid var(--pm-border);
  border-radius: 16px;
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--pm-text);
}

.sort-dropdown {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  font-size: 13px;
  color: var(--pm-text-secondary);
  cursor: pointer;
  
  .chevron {
    font-size: 10px;
  }
}

.market-grid {
  display: grid;
  gap: 16px;
  
  @media (min-width: 768px) {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
}

.loading-state {
  text-align: center;
  padding: 48px;
  
  .spinner {
    width: 40px;
    height: 40px;
    border: 3px solid rgba(255, 255, 255, 0.1);
    border-top-color: var(--pm-primary);
    border-radius: 50%;
    margin: 0 auto 16px;
    animation: spin 1s linear infinite;
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 48px;
  
  .empty-icon {
    font-size: 48px;
    display: block;
    margin-bottom: 16px;
  }
  
  .empty-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--pm-text);
    margin-bottom: 8px;
    display: block;
  }
  
  .empty-subtitle {
    font-size: 14px;
    color: var(--pm-text-secondary);
  }
}
</style>
