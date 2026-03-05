<template>
  <HeroSectionShared variant="danger" :subtitle="t('totalBurned')" :title="formatNum(totalBurned)" suffix="GAS">
    <template #background>
      <view class="fire-container" aria-hidden="true">
        <view class="flame flame-1"></view>
        <view class="flame flame-2"></view>
        <view class="flame flame-3"></view>
      </view>
    </template>
  </HeroSectionShared>
</template>

<script setup lang="ts">
import { HeroSection as HeroSectionShared } from "@shared/components";
import { formatNumber } from "@shared/utils/format";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  totalBurned: number;
}>();

const formatNum = (n: number) => formatNumber(n, 2);
</script>

<style lang="scss" scoped>
.fire-container {
  position: absolute;
  bottom: -20px;
  left: 0;
  right: 0;
  height: 120px;
  display: flex;
  justify-content: center;
  align-items: flex-end;
  pointer-events: none;
  opacity: 0.6;
  filter: blur(10px);
}

.flame {
  width: 40px;
  height: 60px;
  background: radial-gradient(circle at bottom, var(--burn-flame-orange), transparent 70%);
  border-radius: 50% 50% 20% 20%;
  animation: neo-flicker 2s infinite alternate ease-in-out;
  margin: 0 -10px;
  opacity: 0.7;

  &.flame-1 {
    animation-delay: 0s;
    height: 70px;
    background: radial-gradient(circle at bottom, var(--burn-flame-red), transparent 70%);
  }
  &.flame-2 {
    animation-delay: 0.5s;
    height: 90px;
    background: radial-gradient(circle at bottom, var(--burn-flame-amber), transparent 70%);
    z-index: 1;
  }
  &.flame-3 {
    animation-delay: 1s;
    height: 60px;
    background: radial-gradient(circle at bottom, var(--burn-flame-red), transparent 70%);
  }
}

@keyframes neo-flicker {
  0% {
    transform: scaleY(1) translateY(0);
    opacity: 0.5;
  }
  100% {
    transform: scaleY(1.2) translateY(-10px);
    opacity: 0.8;
  }
}
</style>
