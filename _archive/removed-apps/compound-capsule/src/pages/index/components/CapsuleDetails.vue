<template>
  <NeoCard variant="erobo" class="vault-card">
    <div class="capsule-container-glass">
      <div class="capsule-visual">
        <div class="capsule-body-glass">
          <div class="capsule-fill-glass" :style="{ height: fillPercentage + '%' }">
            <div class="capsule-shimmer"></div>
          </div>
          <div class="capsule-label">
            <span class="capsule-apy">{{ fmt(vault.totalLocked, 0) }}</span>
            <span class="capsule-apy-label">{{ t("totalLocked") }}</span>
          </div>
        </div>
      </div>
      <div class="vault-stats-grid">
        <div class="stat-item-glass">
          <span class="stat-label">{{ t("totalLocked") }}</span>
          <span class="stat-value tvl">{{ fmt(vault.totalLocked, 0) }}</span>
          <span class="stat-unit">NEO</span>
        </div>
        <div class="stat-item-glass">
          <span class="stat-label">{{ t("totalCapsules") }}</span>
          <span class="stat-value freq">{{ vault.totalCapsules }}</span>
        </div>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatNumber } from "@shared/utils/format";

const props = defineProps<{
  vault: {
    totalLocked: number;
    totalCapsules: number;
  };
}>();

const { t } = createUseI18n(messages)();
const fmt = (n: number, d = 2) => formatNumber(n, d);
const fillPercentage = computed(() => (props.vault.totalLocked > 0 ? 100 : 0));
</script>
