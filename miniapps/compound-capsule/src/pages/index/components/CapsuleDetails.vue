<template>
  <NeoCard variant="erobo" class="vault-card">
    <view class="capsule-container-glass">
      <view class="capsule-visual">
        <view class="capsule-body-glass">
          <view class="capsule-fill-glass" :style="{ height: fillPercentage + '%' }">
            <view class="capsule-shimmer"></view>
          </view>
          <view class="capsule-label">
            <text class="capsule-apy">{{ fmt(vault.totalLocked, 0) }}</text>
            <text class="capsule-apy-label">{{ t("totalLocked") }}</text>
          </view>
        </view>
      </view>
      <view class="vault-stats-grid">
        <view class="stat-item-glass">
          <text class="stat-label">{{ t("totalLocked") }}</text>
          <text class="stat-value tvl">{{ fmt(vault.totalLocked, 0) }}</text>
          <text class="stat-unit">NEO</text>
        </view>
        <view class="stat-item-glass">
          <text class="stat-label">{{ t("totalCapsules") }}</text>
          <text class="stat-value freq">{{ vault.totalCapsules }}</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import { formatNumber } from "@shared/utils/format";

const props = defineProps<{
  vault: {
    totalLocked: number;
    totalCapsules: number;
  };
}>();

const { t } = useI18n();
const fmt = (n: number, d = 2) => formatNumber(n, d);
const fillPercentage = computed(() => (props.vault.totalLocked > 0 ? 100 : 0));
</script>
