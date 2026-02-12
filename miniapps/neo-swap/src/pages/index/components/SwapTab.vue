<template>
  <view class="swap-container">
    <!-- Animated Background -->
    <view class="animated-bg">
      <view class="glow-orb orb-1"></view>
      <view class="glow-orb orb-2"></view>
      <view class="grid-lines"></view>
    </view>

    <!-- Main Swap Card -->
    <view class="swap-card">
      <SwapForm
        :t="t"
        :token="fromToken"
        v-model="fromAmount"
        :label="t('from')"
        :placeholder="t('enterAmount')"
        show-max
        @select="openFromSelector"
        @max="setMaxAmount"
      />

      <!-- Swap Direction Button -->
      <view class="swap-direction">
        <view :class="['swap-btn', { rotating: isSwapping }]" role="button" :aria-label="t('tabSwap')" tabindex="0" @click="swapTokens" @keydown.enter="swapTokens">
          <text class="swap-icon" aria-hidden="true">&#x2193;&#x2191;</text>
        </view>
      </view>

      <SwapForm
        :t="t"
        :token="toToken"
        v-model="toAmount"
        :label="t('to')"
        :placeholder="t('enterAmount')"
        disabled
        @select="openToSelector"
      />
    </view>

    <!-- Rate Info Card -->
    <PriceChart
      :t="t"
      :exchange-rate="exchangeRate"
      :from-symbol="fromToken.symbol"
      :to-symbol="toToken.symbol"
      :slippage="slippage"
      :min-received="minReceived"
      :loading="rateLoading"
      @refresh="fetchExchangeRate"
    />

    <!-- Swap Action Button -->
    <view :class="['action-btn', { disabled: !canSwap || loading, loading: loading }]" role="button" :aria-label="swapButtonText" :aria-disabled="!canSwap || loading" tabindex="0" @click="executeSwap" @keydown.enter="executeSwap">
      <view v-if="loading" class="btn-loader" aria-hidden="true"></view>
      <text class="btn-text">{{ swapButtonText }}</text>
    </view>

    <!-- Status Message -->
    <view v-if="status" :class="['status-card', status.type]">
      <text class="status-text">{{ status.msg }}</text>
    </view>

    <!-- Token Selector Modal -->
    <TransactionHistory
      :t="t"
      :show="showSelector"
      :tokens="availableTokens"
      :current-symbol="selectorTarget === 'from' ? fromToken.symbol : toToken.symbol"
      @close="closeSelector"
      @select="selectToken"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SwapForm from "./SwapForm.vue";
import PriceChart from "./PriceChart.vue";
import TransactionHistory from "./TransactionHistory.vue";
import { useSwapEngine } from "@/composables/useSwapEngine";

const props = defineProps<{
  t: (key: string) => string;
}>();

const tRef = computed(() => props.t);

const {
  fromToken,
  toToken,
  fromAmount,
  toAmount,
  exchangeRate,
  rateLoading,
  loading,
  status,
  showSelector,
  selectorTarget,
  isSwapping,
  availableTokens,
  canSwap,
  swapButtonText,
  slippage,
  minReceived,
  setMaxAmount,
  fetchExchangeRate,
  swapTokens,
  openFromSelector,
  openToSelector,
  closeSelector,
  selectToken,
  executeSwap,
} = useSwapEngine(tRef);
</script>

<style lang="scss" scoped>
.swap-container {
  position: relative;
  padding: 20px;
  min-height: 100vh;
  background: var(--swap-bg-gradient);
  overflow: hidden;
}

// Animated Background
.animated-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  overflow: hidden;
}

.glow-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(80px);
  opacity: 0.4;
  animation: float 8s ease-in-out infinite;
}

.orb-1 {
  width: 300px;
  height: 300px;
  background: var(--swap-orb-one);
  top: -100px;
  right: -100px;
}

.orb-2 {
  width: 250px;
  height: 250px;
  background: var(--swap-orb-two);
  bottom: 100px;
  left: -80px;
  animation-delay: -4s;
}

.grid-lines {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(var(--swap-grid-line) 1px, transparent 1px),
    linear-gradient(90deg, var(--swap-grid-line) 1px, transparent 1px);
  background-size: 40px 40px;
}

@keyframes float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(20px, -30px) scale(1.1);
  }
}

// Main Swap Card
.swap-card {
  position: relative;
  background: var(--swap-card-bg);
  border: 1px solid var(--swap-card-border);
  border-radius: 24px;
  padding: 24px;
  backdrop-filter: blur(20px);
  box-shadow:
    0 0 40px var(--swap-card-glow),
    inset 0 1px 0 var(--swap-card-inset);
}

// Swap Direction Button
.swap-direction {
  display: flex;
  justify-content: center;
  margin: -20px 0;
  position: relative;
  z-index: 10;
}

.swap-btn {
  width: 48px;
  height: 48px;
  background: var(--swap-orb-one);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 4px 20px var(--swap-accent-glow);

  &:hover {
    transform: scale(1.1) rotate(180deg);
    box-shadow: 0 6px 30px var(--swap-accent-glow-strong);
  }

  &.rotating {
    transform: rotate(180deg);
  }
}

.swap-icon {
  font-size: 20px;
  font-weight: 800;
  color: var(--swap-action-text);
}

// Action Button
.action-btn {
  margin-top: 20px;
  padding: 20px;
  background: var(--swap-action-gradient);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 20px var(--swap-accent-glow);

  &:hover:not(.disabled) {
    transform: translateY(-2px);
    box-shadow: 0 8px 30px var(--swap-accent-glow-strong);
  }

  &.disabled {
    background: var(--swap-action-disabled-bg);
    box-shadow: none;
    cursor: not-allowed;

    .btn-text {
      color: var(--swap-action-disabled-text);
    }
  }

  &.loading {
    background: var(--swap-action-loading-bg);
  }
}

.btn-text {
  font-size: 16px;
  font-weight: 800;
  color: var(--swap-action-text);
  letter-spacing: 0.1em;
}

.btn-loader {
  width: 20px;
  height: 20px;
  border: 2px solid var(--swap-loader-border);
  border-top-color: var(--swap-action-text);
  border-radius: 50%;
  margin-right: 10px;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

// Status Card
.status-card {
  margin-top: 16px;
  padding: 16px;
  border-radius: 12px;
  text-align: center;

  &.success {
    background: var(--swap-status-success-bg);
    border: 1px solid var(--swap-status-success-border);
  }

  &.error {
    background: var(--swap-status-error-bg);
    border: 1px solid var(--swap-status-error-border);
  }
}

.status-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--swap-text);
}
</style>
