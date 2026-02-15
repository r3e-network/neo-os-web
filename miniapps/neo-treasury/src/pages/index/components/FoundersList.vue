<template>
  <view class="founders-section">
    <text class="section-title">{{ t("founders") }}</text>

    <ItemList :items="categories" item-key="name">
      <template #item="{ item: cat }">
        <view class="founder-item" role="button" tabindex="0" :aria-label="cat.name" @click="$emit('select', cat.name)">
          <view class="founder-main">
            <view class="founder-icon">
              <AppIcon name="user" :size="32" />
            </view>
            <view class="founder-info">
              <text class="founder-name">{{ cat.name }}</text>
              <text class="founder-wallets">{{ cat.wallets.length }} {{ t("wallets") }}</text>
            </view>
            <view class="founder-total">
              <text class="total-usd">${{ formatNum(cat.totalUsd) }}</text>
              <AppIcon name="chevron-right" :size="20" class="arrow" />
            </view>
          </view>

          <view class="founder-breakdown">
            <view class="breakdown-item">
              <text class="b-label">NEO</text>
              <text class="b-val">{{ formatNum(cat.totalNeo) }}</text>
            </view>
            <view class="breakdown-item">
              <text class="b-label">GAS</text>
              <text class="b-val">{{ formatNum(cat.totalGas, 2) }}</text>
            </view>
          </view>
        </view>
      </template>
    </ItemList>
  </view>
</template>

<script setup lang="ts">
import { AppIcon, ItemList } from "@shared/components";
import type { CategoryBalance } from "@/utils/treasury";

defineProps<{
  categories: CategoryBalance[];
  t: (key: string, ...args: unknown[]) => string;
}>();

defineEmits(["select"]);

const formatNum = (n: number, decimals = 0): string => {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.section-title {
  @include stat-label;
  margin-bottom: 16px;
  display: block;
}

.founder-item {
  background: linear-gradient(135deg, rgba(159, 157, 243, 0.05) 0%, rgba(123, 121, 209, 0.03) 100%);
  border: 1px solid rgba(159, 157, 243, 0.2);
  border-radius: 20px;
  margin-bottom: 24px;
  display: flex;
  flex-direction: column;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  backdrop-filter: blur(20px);
  cursor: pointer;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);

  &:hover {
    transform: translateY(-4px);
    border-color: rgba(159, 157, 243, 0.4);
    background: linear-gradient(135deg, rgba(159, 157, 243, 0.1) 0%, rgba(123, 121, 209, 0.06) 100%);
    box-shadow: 0 12px 40px rgba(159, 157, 243, 0.2);
  }

  &:active {
    transform: scale(0.98);
  }
}

.founder-main {
  display: flex;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.founder-icon {
  width: 64px;
  height: 64px;
  background: var(--bg-card, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 50%;
  color: var(--treasury-neo-green);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 20px;
  box-shadow: 0 0 20px rgba(0, 229, 153, 0.15);
}

.founder-info {
  flex: 1;
}

.founder-name {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  text-transform: uppercase;
  display: block;
  letter-spacing: 0.02em;
  margin-bottom: 6px;
}

.founder-wallets {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
}

.founder-total {
  display: flex;
  align-items: center;
  gap: 12px;
}

.total-usd {
  font-size: 20px;
  font-weight: 700;
  font-family: $font-family;
  color: var(--text-primary);
  text-shadow: 0 0 20px rgba(0, 229, 153, 0.3);
  letter-spacing: -0.02em;
}

.founder-breakdown {
  display: flex;
  background: rgba(0, 0, 0, 0.2);
}

.breakdown-item {
  flex: 1;
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;

  &:first-child {
    border-right: 1px solid rgba(255, 255, 255, 0.05);
  }
}

.b-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}

.b-val {
  font-size: 15px;
  font-weight: 600;
  font-family: $font-family;
  color: var(--text-primary);
}

.arrow {
  opacity: 0.5;
  color: var(--text-primary);
  transition: transform 0.2s;
}

.founder-item:hover .arrow {
  transform: translateX(4px);
  color: var(--treasury-neo-green);
  opacity: 1;
}

.mb-4 {
  margin-bottom: 24px;
}
</style>
