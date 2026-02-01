<template>
  <view class="neo-doc">
    <view class="doc-header">
      <ScrollReveal animation="fade-down" :duration="1000">
        <view class="title-row">
          <view class="doc-badge">{{ t("docBadge") }}</view>
        </view>
        <text class="doc-title">{{ title }}</text>
        <text class="doc-subtitle">{{ subtitle }}</text>
      </ScrollReveal>
    </view>

    <view class="doc-content">
      <view class="doc-section">
        <ScrollReveal animation="fade-up" :delay="200">
          <text class="section-label">{{ t("docWhatItIs") }}</text>
          <text class="section-text">{{ description }}</text>
        </ScrollReveal>
      </view>

      <view class="doc-section">
        <ScrollReveal animation="fade-up" :delay="300">
          <text class="section-label">{{ t("docHowToUse") }}</text>
        </ScrollReveal>
        <view class="steps-list">
          <ScrollReveal
            v-for="(step, index) in steps"
            :key="index"
            :delay="400 + index * 100"
            animation="slide-left"
          >
            <view class="step-item">
              <view class="step-number">{{ index + 1 }}</view>
              <text class="step-text">{{ step }}</text>
            </view>
          </ScrollReveal>
        </view>
      </view>

      <view class="doc-section">
        <ScrollReveal animation="fade-up" :delay="400">
          <text class="section-label">{{ t("docOnChainFeatures") }}</text>
        </ScrollReveal>
        <view class="features-grid">
          <ScrollReveal
            v-for="(feature, index) in features"
            :key="feature.name"
            :delay="500 + index * 100"
            animation="scale-in"
            reversible
          >
            <view class="feature-card">
              <text class="feature-name">{{ feature.name }}</text>
              <text class="feature-desc">{{ feature.desc }}</text>
            </view>
          </ScrollReveal>
        </view>
      </view>
    </view>

    <view class="doc-footer">
      <ScrollReveal animation="fade-up" :delay="800">
        <text class="footer-text">{{ t("docFooter") }}</text>
      </ScrollReveal>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@shared/composables/useI18n";
import ScrollReveal from "./ScrollReveal.vue";

const { t } = useI18n();

interface Feature {
  name: string;
  desc: string;
}

defineProps<{
  title: string;
  subtitle: string;
  description: string;
  steps: string[];
  features: Feature[];
}>();
</script>

<style lang="scss" scoped>
@use "../styles/tokens.scss" as *;

.neo-doc {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 32px;
  color: var(--text-primary);
  min-height: 100%;
}

.doc-header {
  border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  padding-bottom: 24px;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}


.doc-badge {
  background: rgba(159, 157, 243, 0.12);
  color: var(--erobo-purple-dark);
  padding: 4px 12px;
  border: 1px solid rgba(159, 157, 243, 0.3);
  border-radius: 100px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1px;
  box-shadow: 0 0 10px rgba(159, 157, 243, 0.2);
}

.doc-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.25;
  margin: 6px 0 2px;
}

.doc-subtitle {
  font-size: 16px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.6));
  line-height: 1.6;
  font-weight: 400;
}

.doc-content {
  display: flex;
  flex-direction: column;
  gap: 32px;
}

.doc-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-label {
  font-size: 11px;
  font-weight: 700;
  color: var(--erobo-purple);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
  text-shadow: 0 0 10px rgba(159, 157, 243, 0.3);
}

.section-text {
  font-size: 15px;
  color: var(--text-primary, rgba(255, 255, 255, 0.8));
  line-height: 1.6;
}

.steps-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.step-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
}

.step-number {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--bg-card, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  color: var(--erobo-purple);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  box-shadow: 0 0 10px var(--shadow-color, rgba(0, 0, 0, 0.1));
}

.step-text {
  font-size: 15px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  flex: 1;
  line-height: 1.5;
}

.features-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.feature-card {
  padding: 24px;
  background: var(
    --erobo-gradient,
    linear-gradient(135deg, rgba(159, 157, 243, 0.12) 0%, rgba(247, 170, 199, 0.1) 100%)
  );
  border: 1px solid rgba(159, 157, 243, 0.2);
  border-radius: 20px;
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;

  &:active {
    transform: scale(0.98);
  }
}

.feature-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary, white);
  display: block;
  margin-bottom: 4px;
}

.feature-desc {
  font-size: 13px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.5));
  line-height: 1.4;
}

.doc-footer {
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--border-color, rgba(255, 255, 255, 0.05));
  text-align: center;
}

.footer-text {
  font-size: 11px;
  color: var(--text-muted, rgba(255, 255, 255, 0.3));
  text-transform: uppercase;
  letter-spacing: 2px;
}
</style>
