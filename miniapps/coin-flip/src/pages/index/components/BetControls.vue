<template>
  <view class="premium-controls">
    <view class="choice-grid">
      <view
        v-for="side in ['heads', 'tails']"
        :key="side"
        :class="['choice-card', choice === side ? side : 'inactive']"
        @click="$emit('update:choice', side)"
      >
        <view class="card-glow" />
        <view class="card-inner">
          <view class="symbol-ring">
             <view v-if="side === 'heads'" class="neo-symbol">N</view>
             <view v-else class="gas-symbol">G</view>
          </view>
          <text class="choice-name">{{ t(side) }}</text>
        </view>
      </view>
    </view>

    <view class="wager-panel">
      <view class="panel-header">
        <text class="label">{{ t('wager') }}</text>
        <view class="balance-pill">
           <text class="val">0.1 - 100</text>
           <text class="unit">GAS</text>
        </view>
      </view>

      <view class="wager-grid">
        <view
          v-for="amount in ['1', '5', '10', '50']"
          :key="amount"
          :class="['wager-option', betAmount === amount ? 'selected' : '']"
          @click="$emit('update:betAmount', amount)"
        >
          <text class="amount-val">{{ amount }}</text>
          <text class="amount-unit">GAS</text>
        </view>
      </view>

      <view class="action-zone">
        <view class="flip-button-wrapper">
          <NeoButton
            variant="primary"
            size="lg"
            block
            :disabled="isFlipping || !canBet"
            :loading="isFlipping"
            @click="$emit('flip')"
            class="premium-flip-btn"
          >
            <view class="btn-content">
              <text v-if="!isFlipping">{{ t('flipCoin') }}</text>
              <text v-else>{{ t('flipping') }}</text>
            </view>
          </NeoButton>
          <view class="btn-shadow" />
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";

defineProps<{
  choice: "heads" | "tails";
  betAmount: string;
  isFlipping: boolean;
  canBet: boolean;
  t: (key: string) => string;
}>();

defineEmits(["update:choice", "update:betAmount", "flip"]);
</script>

<style lang="scss" scoped>
.premium-controls {
  display: flex;
  flex-direction: column;
  gap: 32px;
  width: 100%;
}

.choice-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.choice-card {
  position: relative;
  height: 140px;
  background: var(--coin-choice-bg);
  border: 1px solid var(--coin-choice-border);
  border-radius: 24px;
  overflow: hidden;
  transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  cursor: pointer;

  .card-inner {
    position: relative;
    z-index: 2;
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
  }

  .symbol-ring {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    border: 2px solid var(--coin-choice-ring);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 900;
    font-size: 24px;
    transition: all 0.3s ease;
  }

  &.heads.heads {
    background: linear-gradient(135deg, rgba(0, 229, 153, 0.2) 0%, rgba(0, 229, 153, 0.05) 100%);
    border-color: #00e599;
    box-shadow: 0 10px 30px rgba(0, 229, 153, 0.2);
    transform: scale(1.05);
    .symbol-ring { border-color: #00e599; color: #00e599; box-shadow: 0 0 15px rgba(0, 229, 153, 0.3); }
    .choice-name { color: #00e599; text-shadow: 0 0 10px rgba(0, 229, 153, 0.5); }
  }

  &.tails.tails {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(59, 130, 246, 0.05) 100%);
    border-color: #3b82f6;
    box-shadow: 0 10px 30px rgba(59, 130, 246, 0.2);
    transform: scale(1.05);
    .symbol-ring { border-color: #3b82f6; color: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }
    .choice-name { color: #3b82f6; text-shadow: 0 0 10px rgba(59, 130, 246, 0.5); }
  }

  &.inactive {
    opacity: 0.6;
    &:hover { opacity: 1; transform: translateY(-4px); }
  }
}

.choice-name {
  font-size: 14px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 2px;
  color: var(--coin-text-primary);
}

.wager-panel {
  background: var(--coin-panel-bg);
  padding: 24px;
  border-radius: 24px;
  border: 1px solid var(--coin-panel-border);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;

  .label { font-size: 12px; font-weight: 700; color: var(--coin-label); text-transform: uppercase; letter-spacing: 1px; }
}

.balance-pill {
  background: rgba(0, 229, 153, 0.1);
  padding: 4px 12px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 700;
  color: #00e599;
  border: 1px solid rgba(0, 229, 153, 0.2);
  .unit { opacity: 0.7; margin-left: 4px; }
}

.wager-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  margin-bottom: 32px;
}

.wager-option {
  background: var(--coin-wager-bg);
  border: 1px solid var(--coin-wager-border);
  padding: 16px 8px;
  border-radius: 16px;
  text-align: center;
  transition: all 0.3s ease;
  
  .amount-val { display: block; font-size: 18px; font-weight: 800; color: var(--coin-text-primary); }
  .amount-unit { font-size: 9px; opacity: 0.6; color: var(--coin-text-secondary); text-transform: uppercase; }

  &.selected {
    background: #00e599;
    border-color: #00e599;
    box-shadow: 0 0 20px rgba(0, 229, 153, 0.4);
    .amount-val, .amount-unit { color: #000; }
  }
}

.flip-button-wrapper {
  position: relative;
  
  .premium-flip-btn {
    height: 64px;
    font-size: 18px;
    font-weight: 900;
    text-transform: uppercase;
    letter-spacing: 2px;
    border-radius: 16px;
    background: linear-gradient(135deg, #00e599 0%, #008f5d 100%);
    box-shadow: 0 10px 30px rgba(0, 229, 153, 0.3);
    border: none;
    z-index: 2;
  }
  
  .btn-shadow {
    position: absolute;
    bottom: -6px;
    left: 4px;
    right: 4px;
    height: 20px;
    background: #005f3e;
    border-radius: 16px;
    z-index: 1;
  }

  &:active .premium-flip-btn {
    transform: translateY(4px);
    box-shadow: 0 4px 15px rgba(0, 229, 153, 0.2);
  }
}
</style>
