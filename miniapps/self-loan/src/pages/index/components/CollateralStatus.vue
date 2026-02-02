<template>
  <NeoCard variant="erobo" class="collateral-card">
    <view class="collateral-visual">
      <view class="bar-container-glass">
        <view class="bar-fill-glass" :style="{ width: collateralUtilization + '%' }">
          <view class="bar-shine"></view>
          <text class="bar-text-glass">{{ collateralUtilization }}%</text>
        </view>
      </view>
      
      <view class="info-grid-glass">
        <view class="info-box-glass">
          <text class="info-label">{{ t("locked") }}</text>
          <text class="info-value locked">{{ fmt(loan.collateralLocked, 2) }} NEO</text>
        </view>
        <view class="info-box-glass">
          <text class="info-label">{{ t("available") }}</text>
          <text class="info-value available">{{ fmt(availableCollateral, 2) }} NEO</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { formatNumber } from "@shared/utils/format";
import { NeoCard } from "@shared/components";

const props = defineProps<{
  loan: any;
  availableCollateral: number;
  collateralUtilization: number;
  t: (key: string) => string;
}>();

const fmt = (n: number, d = 2) => formatNumber(n, d);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.collateral-visual {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.bar-container-glass {
  height: 24px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 99px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  position: relative;
}

.bar-fill-glass {
  height: 100%;
  background: linear-gradient(90deg, #059669, #00e599);
  border-radius: 99px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 8px;
  position: relative;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 40px;
}

.bar-shine {
  position: absolute;
  top: 0; left: 0; bottom: 0; right: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
  transform: skewX(-20deg) translateX(-150%);
  animation: shine 2.5s infinite;
}

.bar-text-glass {
  font-size: 10px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.7);
  z-index: 2;
}

.info-grid-glass {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.info-box-glass {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.info-label {
  font-size: 10px;
  color: var(--text-secondary);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.info-value {
  font-size: 14px;
  font-weight: 700;
  font-family: $font-mono;
  &.locked { color: #fde047; }
  &.available { color: #00e599; }
}

@keyframes shine {
  0% { transform: skewX(-20deg) translateX(-150%); }
  50% { transform: skewX(-20deg) translateX(250%); }
  100% { transform: skewX(-20deg) translateX(250%); }
}
</style>
