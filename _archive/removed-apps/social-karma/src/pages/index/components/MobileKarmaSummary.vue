<template>
  <div class="karma-summary-card">
    <div class="karma-info">
      <span class="karma-label">{{ t("totalKarma") }}</span>
      <span class="karma-value">{{ karma }}</span>
    </div>
    <div class="karma-divider" />
    <div class="karma-info">
      <span class="karma-label">{{ t("yourRank") }}</span>
      <span class="karma-value rank">#{{ rank || "-" }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

defineProps<{
  karma: number;
  rank: number | null;
}>();

const { t } = createUseI18n(messages)();
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
