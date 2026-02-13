<template>
  <view class="hero fade-up">
    <view class="hero-content">
      <image class="hero-logo" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('heroLogoAlt')" />
      <text class="hero-title">{{ t("heroTitle") }}</text>
      <text class="hero-subtitle">{{ t("heroSubtitle") }}</text>

      <view class="hero-bubbles">
        <view class="hero-bubble">
          <text class="bubble-title">{{ t("totalBneoSupply") }}</text>
          <text class="bubble-value">{{ totalStakedDisplay }}</text>
          <text class="bubble-subvalue">{{ totalStakedUsdText }}</text>
        </view>
        <view class="hero-bubble">
          <text class="bubble-title">{{ t("apr") }}</text>
          <text class="bubble-value">{{ aprDisplay }}</text>
          <text class="bubble-subvalue">{{ t("aprTag") }}</text>
        </view>
      </view>
    </view>

    <view class="hero-media">
      <image
        class="hero-background"
        src="/static/neoburger-placeholder.svg"
        mode="widthFix"
        :alt="t('heroBackgroundAlt')"
      />
      <image class="hero-gif" src="/static/neoburger-placeholder.svg" mode="widthFix" :alt="t('heroIntroAlt')" />
    </view>
  </view>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

defineProps<{
  totalStakedDisplay: string;
  totalStakedUsdText: string;
  aprDisplay: string;
}>();
</script>

<style lang="scss" scoped>
.hero {
  background: var(--burger-hero-gradient);
  border-radius: 28px;
  padding: 24px;
  color: var(--burger-hero-text);
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 18px;
  box-shadow: var(--burger-hero-shadow);
}

.hero::after {
  content: "";
  position: absolute;
  right: -80px;
  top: -80px;
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: var(--burger-hero-glow);
  filter: blur(2px);
}

.hero-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 1;
}

.hero-logo {
  width: 52px;
}

.hero-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 42px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hero-subtitle {
  font-size: 14px;
  max-width: 280px;
  line-height: 1.4;
  opacity: 0.9;
}

.hero-bubbles {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin-top: 6px;
}

.hero-bubble {
  background: var(--burger-hero-bubble-bg);
  border: 1px solid var(--burger-hero-bubble-border);
  border-radius: 16px;
  padding: 12px;
  backdrop-filter: blur(8px);
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.bubble-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  opacity: 0.75;
}

.bubble-value {
  font-size: 20px;
  font-weight: 700;
}

.bubble-subvalue {
  font-size: 12px;
  opacity: 0.7;
}

.hero-media {
  position: relative;
  z-index: 1;
}

.hero-background {
  position: absolute;
  right: -10px;
  bottom: -20px;
  width: 120%;
  opacity: 0.35;
}

.hero-gif {
  width: 100%;
  border-radius: 18px;
  box-shadow: var(--burger-hero-media-shadow);
}

@media (min-width: 768px) {
  .hero {
    grid-template-columns: 1.1fr 0.9fr;
    align-items: center;
  }
}

.fade-up {
  animation: fadeUp 0.8s ease both;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
