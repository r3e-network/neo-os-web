<template>
  <view class="market-stats">
    <text class="stats-title">{{ t("marketStats") }}</text>
    <view class="stat-item">
      <text class="stat-label">{{ t("totalMarkets") }}</text>
      <text class="stat-value">{{ totalMarkets }}</text>
    </view>
    <view class="stat-item">
      <text class="stat-label">{{ t("totalVolume") }}</text>
      <text class="stat-value">{{ formatCurrency(totalVolume) }} GAS</text>
    </view>
    <view class="stat-item">
      <text class="stat-label">{{ t("activeTraders") }}</text>
      <text class="stat-value">{{ activeTraders }}</text>
    </view>
    
    <text class="stats-title categories-title">{{ t("categories") }}</text>
    <view 
      v-for="cat in categories" 
      :key="cat.id"
      class="category-item"
      :class="{ active: selectedCategory === cat.id }"
      @click="$emit('selectCategory', cat.id)"
    >
      <text class="category-name">{{ cat.label }}</text>
      <text class="category-count">{{ getCategoryCount(cat.id) }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
interface Category {
  id: string;
  label: string;
}

interface Props {
  totalMarkets: number;
  totalVolume: number;
  activeTraders: number;
  categories: Category[];
  selectedCategory: string;
  t: Function;
  getCategoryCount: (id: string) => number;
  formatCurrency: (value: number) => string;
}

defineProps<Props>();

defineEmits<{
  selectCategory: [category: string];
}>();
</script>

<style lang="scss" scoped>
.market-stats {
  margin-bottom: 24px;
}

.stats-title {
  font-size: 12px;
  color: var(--pm-text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 16px;
  display: block;
}

.categories-title {
  margin-top: 24px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--pm-border);
  
  &:last-child {
    border-bottom: none;
  }
}

.stat-label {
  font-size: 14px;
  color: var(--pm-text-secondary);
}

.stat-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--pm-text);
}

.category-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  
  &:hover {
    background: rgba(255, 255, 255, 0.05);
  }
  
  &.active {
    background: rgba(99, 102, 241, 0.2);
    
    .category-name {
      color: var(--pm-primary);
    }
  }
}

.category-name {
  font-size: 14px;
  color: var(--pm-text);
}

.category-count {
  font-size: 12px;
  color: var(--pm-text-secondary);
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 8px;
  border-radius: 99px;
}
</style>
