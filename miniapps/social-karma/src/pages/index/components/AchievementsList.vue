<template>
  <view class="achievements-section">
    <view class="content-card">
      <text class="card-title">{{ t("achievements") }}</text>
      <view class="achievements-list">
        <view
          v-for="achievement in achievements"
          :key="achievement.id"
          class="achievement-item"
          :class="{ unlocked: achievement.unlocked }"
        >
          <view class="achievement-left">
            <text class="achievement-icon">{{ achievement.unlocked ? '🏆' : '🔒' }}</text>
            <view class="achievement-info">
              <text class="achievement-name">{{ achievement.name }}</text>
              <view class="progress-bar">
                <view class="progress-fill" :style="{ width: achievement.percent + '%' }" />
              </view>
            </view>
          </view>
          <text class="achievement-progress">{{ achievement.progress }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";

export interface Achievement {
  id: string;
  name: string;
  progress: string;
  percent: number;
  unlocked: boolean;
}

const props = defineProps<{
  achievements: Achievement[];
}>();

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.achievements-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.content-card {
  background: var(--karma-card-bg);
  border: 1px solid var(--karma-border);
  border-radius: 16px;
  padding: 20px;
  backdrop-filter: blur(10px);
}

.card-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--karma-text);
  display: block;
  margin-bottom: 16px;
}

.achievements-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.achievement-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  transition: all 0.2s;
  
  &.unlocked {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }
}

.achievement-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.achievement-icon {
  font-size: 20px;
}

.achievement-info {
  flex: 1;
}

.achievement-name {
  font-size: 14px;
  color: var(--karma-text);
  font-weight: 600;
  display: block;
  margin-bottom: 6px;
}

.progress-bar {
  height: 4px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--karma-primary), var(--karma-secondary));
  transition: width 0.3s ease;
}

.achievement-progress {
  font-size: 13px;
  color: var(--karma-text-secondary);
  font-weight: 600;
}
</style>
