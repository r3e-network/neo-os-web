<template>
  <view class="badges-section">
    <view class="content-card">
      <text class="card-title">{{ t("yourBadges") }}</text>
      <view class="badges-grid">
        <view
          v-for="badge in badges"
          :key="badge.id"
          class="badge-item"
          :class="{ unlocked: badge.unlocked, locked: !badge.unlocked }"
        >
          <view class="badge-icon-wrapper">
            <text class="badge-icon">{{ badge.icon }}</text>
            <view v-if="badge.unlocked" class="badge-check">✓</view>
          </view>
          <text class="badge-name">{{ badge.name }}</text>
          <text v-if="!badge.unlocked" class="badge-hint">{{ badge.hint }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

export interface Badge {
  id: string;
  icon: string;
  name: string;
  unlocked: boolean;
  hint?: string;
}

const props = defineProps<{
  badges: Badge[];
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;
.badges-section {
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

.badges-grid {
  @include grid-layout(4, 12px);
}

.badge-item {
  text-align: center;
  padding: 16px 8px;
  background: rgba(255, 255, 255, 0.03);
  border-radius: 12px;
  transition: all 0.2s;

  &.unlocked {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  &.locked {
    opacity: 0.5;
    filter: grayscale(0.5);
  }
}

.badge-icon-wrapper {
  position: relative;
  display: inline-block;
  margin-bottom: 8px;
}

.badge-icon {
  font-size: 32px;
}

.badge-check {
  position: absolute;
  bottom: -4px;
  right: -4px;
  width: 18px;
  height: 18px;
  background: var(--karma-success);
  border-radius: 50%;
  font-size: 10px;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-name {
  font-size: 11px;
  color: var(--karma-text);
  font-weight: 600;
  display: block;
  margin-bottom: 4px;
}

.badge-hint {
  font-size: 10px;
  color: var(--karma-text-muted);
}
</style>
