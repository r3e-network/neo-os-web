<template>
  <view class="sidebar-karma-card">
    <text class="sidebar-karma-label">{{ t("yourKarma") }}</text>
    <text class="sidebar-karma-value">{{ karma }}</text>
    <text class="sidebar-karma-rank">{{ t("rank") }} #{{ rank || "-" }}</text>
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
.sidebar-karma-card {
  background: linear-gradient(135deg, var(--karma-primary), var(--karma-secondary));
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  text-align: center;
  
  .sidebar-karma-label {
    font-size: 12px;
    color: rgba(255, 255, 255, 0.8);
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: block;
  }
  
  .sidebar-karma-value {
    font-size: 36px;
    font-weight: 700;
    color: white;
    margin: 8px 0;
  }
  
  .sidebar-karma-rank {
    font-size: 14px;
    color: rgba(255, 255, 255, 0.9);
  }
}
</style>
