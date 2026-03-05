<template>
  <NeoCard variant="erobo" class="recommendation-card">
    <text class="section-title">{{ t("sectionRecommendations") }}</text>
    <view v-if="recommendations.length === 0" class="recommendation-empty">
      <text class="text-xs">{{ t("allSet") }}</text>
    </view>
    <view v-else class="recommendation-list">
      <view v-for="rec in recommendations" :key="rec" class="recommendation-item">
        <view class="recommendation-dot" />
        <text class="recommendation-text">{{ rec }}</text>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

defineProps<{
  recommendations: string[];
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.recommendation-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.recommendation-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recommendation-item {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.recommendation-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--health-accent-strong);
  margin-top: 6px;
}

.recommendation-text {
  font-size: 12px;
  color: var(--health-muted);
  line-height: 1.5;
}

.recommendation-empty {
  text-align: center;
  padding: 16px;
}

@media (max-width: 767px) {
  .section-title {
    font-size: 16px;
  }
}
</style>
