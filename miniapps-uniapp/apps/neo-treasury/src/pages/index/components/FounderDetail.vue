<template>
  <view v-if="category" class="founder-detail">
    <!-- Category Hero -->
    <NeoCard class="mb-6" variant="erobo">
      <view class="hero-body">
        <view class="hero-info">
          <view class="founder-badge">
            <AppIcon name="user" :size="24" />
            <text class="badge-text">{{ category.name }}</text>
          </view>
          <text class="hero-usd">${{ formatNum(category.totalUsd) }}</text>
        </view>

        <view class="hero-tokens">
          <view class="hero-token-item">
            <text class="token-label">NEO</text>
            <text class="token-val">{{ formatNum(category.totalNeo) }}</text>
          </view>
          <view class="v-divider"></view>
          <view class="hero-token-item">
            <text class="token-label">GAS</text>
            <text class="token-val">{{ formatNum(category.totalGas, 2) }}</text>
          </view>
        </view>
      </view>
    </NeoCard>

    <!-- Wallet List Header -->
    <view class="list-header">
      <text class="section-title">{{ t("walletList") }}</text>
      <text class="count-badge">{{ category.wallets.length }} {{ t("addresses") }}</text>
    </view>

    <!-- Wallet List -->
    <view class="wallet-list">
      <view
        v-for="(wallet, idx) in category.wallets"
        :key="wallet.address"
        class="wallet-item"
        :class="{ expanded: expandedIdx === idx }"
        @click="toggleWallet(idx)"
      >
        <view class="wallet-main">
          <view class="wallet-prefix">
            <text class="idx">#{{ idx + 1 }}</text>
            <text class="addr">{{ shortAddr(wallet.address) }}</text>
          </view>
          <view class="wallet-right">
            <text class="addr-usd">${{ formatNum(walletUsd(wallet)) }}</text>
            <AppIcon name="chevron-right" :size="16" :class="['arrow', { rotated: expandedIdx === idx }]" />
          </view>
        </view>

        <!-- Expanded Details -->
        <view v-if="expandedIdx === idx" class="wallet-details">
          <view class="detail-section">
            <text class="d-label">{{ t("fullAddress") }}</text>
            <view class="d-value-box">
              <text class="d-value-long">{{ wallet.address }}</text>
            </view>
          </view>

          <view class="detail-section">
            <text class="d-label">{{ t("breakdown") }}</text>
            <view class="breakdown-grid">
              <view class="break-item">
                <text class="b-sym">NEO</text>
                <text class="b-amt">{{ formatNum(wallet.neo) }}</text>
                <text class="b-usd">≈ ${{ formatNum(wallet.neo * prices.neo.usd) }}</text>
              </view>
              <view class="break-item">
                <text class="b-sym">GAS</text>
                <text class="b-amt">{{ formatNum(wallet.gas, 2) }}</text>
                <text class="b-usd">≈ ${{ formatNum(wallet.gas * prices.gas.usd) }}</text>
              </view>
            </view>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { AppIcon, NeoCard } from "@shared/components";
import type { CategoryBalance, PriceData } from "@/utils/treasury";

const props = defineProps<{
  category: CategoryBalance | null;
  prices: PriceData;
  t: (key: string, ...args: unknown[]) => string;
}>();

const expandedIdx = ref<number | null>(null);

function formatNum(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function shortAddr(addr: string): string {
  if (!addr) return "";
  return addr.slice(0, 10) + "..." + addr.slice(-8);
}

function walletUsd(wallet: { neo: number; gas: number }): number {
  return wallet.neo * props.prices.neo.usd + wallet.gas * props.prices.gas.usd;
}

function toggleWallet(idx: number) {
  expandedIdx.value = expandedIdx.value === idx ? null : idx;
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.mb-6 {
  margin-bottom: 24px;
}

.founder-detail {
  padding-bottom: 20px;
}

.hero-body {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.hero-info {
  text-align: center;
}

.founder-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: rgba(0, 229, 153, 0.1);
  color: var(--treasury-neo-green);
  padding: 6px 16px;
  border: 1px solid rgba(0, 229, 153, 0.2);
  border-radius: 99px;
  margin-bottom: 12px;
  backdrop-filter: blur(4px);
  box-shadow: 0 0 15px rgba(0, 229, 153, 0.1);
}

.badge-text {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.hero-usd {
  display: block;
  font-size: 40px;
  font-weight: 800;
  font-family: $font-family;
  text-shadow: 0 0 30px rgba(0, 229, 153, 0.4);
  color: var(--text-primary);
  margin-top: 8px;
  line-height: 1;
}

.hero-tokens {
  @include card-base(16px, 16px);
  display: flex;
  justify-content: space-between;
  align-items: center;
  backdrop-filter: blur(10px);
}

.hero-token-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
}

.token-label {
  @include stat-label;
  font-weight: 600;
  margin-bottom: 4px;
}

.token-val {
  font-size: 20px;
  font-weight: 700;
  font-family: $font-family;
  color: var(--text-primary);
  text-shadow: 0 0 10px rgba(255, 255, 255, 0.1);
}

.v-divider {
  width: 1px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  margin-top: 24px;
}

.section-title {
  @include stat-label;
  display: block;
}

.count-badge {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  text-transform: uppercase;
  background: var(--bg-card, rgba(255, 255, 255, 0.05));
  padding: 4px 8px;
  border-radius: 6px;
}

.wallet-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.wallet-item {
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.02) 100%);
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 12px;
  margin-bottom: 8px;
  overflow: hidden;
  transition: all 0.2s;
  backdrop-filter: blur(10px);

  &:active {
    transform: scale(0.99);
  }

  &.expanded {
    background: linear-gradient(135deg, rgba(0, 229, 153, 0.08) 0%, rgba(0, 179, 119, 0.05) 100%);
    border-color: rgba(0, 229, 153, 0.3);
    box-shadow: 0 10px 30px -10px rgba(0, 229, 153, 0.15);
  }
}

.wallet-main {
  padding: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.wallet-prefix {
  display: flex;
  align-items: center;
  gap: 12px;
}

.idx {
  font-size: 10px;
  font-weight: 700;
  font-family: $font-mono;
  color: var(--text-muted, rgba(255, 255, 255, 0.3));
}

.addr {
  font-size: 14px;
  font-weight: 600;
  font-family: $font-mono;
  color: var(--text-primary);
}

.wallet-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.addr-usd {
  font-size: 15px;
  font-weight: 700;
  font-family: $font-mono;
  color: var(--treasury-neo-green);
}

.arrow {
  transition: transform 0.2s;
  opacity: 0.4;
  color: var(--text-primary);

  &.rotated {
    transform: rotate(90deg);
    opacity: 1;
    color: var(--treasury-neo-green);
  }
}

.wallet-details {
  padding: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  background: rgba(0, 0, 0, 0.2);
}

.detail-section {
  margin-bottom: 20px;
  &:last-child {
    margin-bottom: 0;
  }
}

.d-label {
  @include stat-label;
  font-size: 10px;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
  margin-bottom: 8px;
  display: block;
  letter-spacing: 0.05em;
}

.d-value-box {
  background: rgba(0, 0, 0, 0.3);
  padding: 12px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  border-radius: 8px;
}

.d-value-long {
  font-family: $font-mono;
  font-size: 12px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  word-break: break-all;
}

.breakdown-grid {
  @include grid-layout(2, 12px);
}

.break-item {
  @include card-base(12px, 16px);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.b-sym {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  margin-bottom: 4px;
}

.b-amt {
  font-size: 16px;
  font-weight: 700;
  font-family: $font-mono;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.b-usd {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted, rgba(255, 255, 255, 0.4));
}
</style>
