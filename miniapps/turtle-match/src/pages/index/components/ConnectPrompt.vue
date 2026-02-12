<template>
  <view class="connect-prompt">
    <GradientCard variant="erobo">
      <view class="connect-prompt__content">
        <view class="hero-turtle">
          <TurtleSprite :color="TurtleColor.Green" matched />
        </view>
        <text class="connect-prompt__title">{{ t("title") }}</text>
        <text class="connect-prompt__desc">{{ t("description") }}</text>
        <NeoButton variant="primary" size="lg" @click="$emit('connect')" :loading="loading">{{
          t("connectWallet")
        }}</NeoButton>
      </view>
    </GradientCard>
  </view>
</template>

<script setup lang="ts">
import { GradientCard, NeoButton } from "@shared/components";
import TurtleSprite from "./TurtleSprite.vue";
import { TurtleColor } from "@/composables/useTurtleGame";

interface Props {
  loading: boolean;
  t: Function;
}

defineProps<Props>();
defineEmits<{ connect: [] }>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.connect-prompt__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 40px 20px;
}

.hero-turtle {
  width: 180px;
  height: 180px;
  margin-bottom: 30px;
  filter: drop-shadow(0 20px 40px var(--turtle-primary-glow-strong));
  animation: hero-float 4s ease-in-out infinite;
}

@keyframes hero-float {
  0%,
  100% {
    transform: translateY(0) rotate(0);
  }
  50% {
    transform: translateY(-20px) rotate(5deg);
  }
}

.connect-prompt__title {
  font-size: 28px;
  font-weight: 900;
  color: var(--turtle-text);
  text-shadow: 0 2px 10px var(--turtle-title-shadow);
}

.connect-prompt__desc {
  font-size: 14px;
  color: var(--turtle-text-subtle);
  text-align: center;
  line-height: 1.6;
}

@media (max-width: 767px) {
  .hero-turtle {
    width: 120px;
    height: 120px;
  }
}
</style>
