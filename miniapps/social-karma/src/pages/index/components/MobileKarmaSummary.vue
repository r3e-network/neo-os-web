<template>
  <view class="karma-summary-card">
    <view class="karma-info">
      <text class="karma-label">{{ t("totalKarma") }}</text>
      <text class="karma-value">{{ karma }}</text>
    </view>
    <view class="karma-divider" />
    <view class="karma-info">
      <text class="karma-label">{{ t("yourRank") }}</text>
      <text class="karma-value rank">#{{ rank || "-" }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";

defineProps<{
  karma: number;
  rank: number | null;
}>();

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.karma-summary-card {
  display: flex;
  background: linear-gradient(135deg, var(--karma-primary), var(--karma-secondary));
  border-radius: 16px;
  padding: 20px;
  
  .karma-info {
    flex: 1;
    text-align: center;
    
    &:first-child {
      border-right: 1px solid rgba(255, 255, 255, 0.2);
    }
  }
  
  .karma-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: block;
    margin-bottom: 4px;
  }
  
  .karma-value {
    font-size: 28px;
    font-weight: 700;
    color: white;
    
    &.rank {
      font-size: 24px;
    }
  }
}
</style>
