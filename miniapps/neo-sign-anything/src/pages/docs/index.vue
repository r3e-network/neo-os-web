<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :title="t('docs')"
    :show-top-nav="true"
    show-back
    @back="goBack"
  >
    <view class="docs-container">
      <view class="section">
        <text class="section-title">{{ t('aboutTitle') }}</text>
        <text class="section-text">
          {{ t('aboutText') }}
        </text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('howItWorksTitle') }}</text>
        <text class="section-text">
          1. {{ t('step1') }}
        </text>
        <text class="section-text">
          2. {{ t('step2') }}
        </text>
        <text class="section-text">
          3. {{ t('step3') }}
        </text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('securityTitle') }}</text>
        <text class="section-text">
          {{ t('securityText') }}
        </text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('broadcastTitle') }}</text>
        <text class="section-text">
          {{ t('broadcastText') }}
        </text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('verifyTitle') }}</text>
        <text class="section-text">
          {{ t('verifyText') }}
        </text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('privacyTitle') }}</text>
        <text class="section-text">
          {{ t('privacyText') }}
        </text>
      </view>

      <view class="section">
        <text class="section-title">{{ t('networkTitle') }}</text>
        <text class="section-text">
          {{ t('networkText') }}
        </text>
      </view>
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ResponsiveLayout } from "@shared/components";
import { useI18n } from '@/composables/useI18n';

const { t } = useI18n();

const goBack = () => {
  uni.navigateBack();
};
</script>

<style lang="scss" scoped>
.docs-container {
  padding: 24px;
}

.section {
  margin-bottom: 32px;
}

.section-title {
  font-size: 18px;
  font-weight: 800;
  color: var(--text-primary);
  margin-bottom: 12px;
  display: block;
}

.section-text {
  font-size: 14px;
  color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  line-height: 1.6;
  margin-bottom: 8px;
  display: block;
}
</style>
