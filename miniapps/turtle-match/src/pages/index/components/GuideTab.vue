<template>
  <view class="insight-grid">
    <GradientCard variant="erobo" class="insight-card">
      <text class="insight-title">{{ t("coreLogicTitle") }}</text>
      <view class="insight-list">
        <view v-for="item in coreLogicPoints" :key="item" class="insight-item">
          <text class="insight-bullet">&bull;</text>
          <text class="insight-text">{{ item }}</text>
        </view>
      </view>
    </GradientCard>

    <GradientCard variant="erobo-neo" class="insight-card">
      <text class="insight-title">{{ t("operationPanelTitle") }}</text>
      <view class="insight-list">
        <view v-for="step in operationChecklist" :key="step" class="insight-item">
          <text class="insight-bullet">&bull;</text>
          <text class="insight-text">{{ step }}</text>
        </view>
      </view>
    </GradientCard>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { GradientCard } from "@shared/components";

interface Props {
  t: Function;
}

const props = defineProps<Props>();

const coreLogicPoints = computed(() => [props.t("docFeature1Desc"), props.t("docFeature2Desc"), props.t("docFeature3Desc")]);
const operationChecklist = computed(() => [props.t("docStep1"), props.t("docStep2"), props.t("docStep3"), props.t("docStep4")]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.insight-grid {
  padding: 20px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
}

.insight-card {
  border: 1px solid var(--turtle-panel-border);
}

.insight-title {
  display: block;
  margin-bottom: 12px;
  font-size: 18px;
  font-weight: 800;
  color: var(--turtle-text);
}

.insight-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.insight-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.insight-bullet {
  color: var(--turtle-primary);
  font-size: 14px;
  line-height: 1.4;
}

.insight-text {
  flex: 1;
  font-size: 13px;
  line-height: 1.6;
  color: var(--turtle-text-subtle);
}

@media (max-width: 767px) {
  .insight-grid {
    padding: 12px;
  }
}

@media (min-width: 1024px) {
  .insight-grid {
    padding: 24px;
    max-width: 1100px;
    margin: 0 auto;
  }
}
</style>
