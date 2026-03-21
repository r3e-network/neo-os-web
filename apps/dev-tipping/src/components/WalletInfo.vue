<template>
  <NeoCard variant="erobo">
    <div class="stats-grid-neo">
      <div class="stat-item-neo">
        <span class="stat-label-neo">{{ t("totalDonated") }}</span>
        <span class="stat-value-neo">{{ formatNum(totalDonated) }} {{ t("tokenGas") }}</span>
      </div>
    </div>
  </NeoCard>

  <NeoCard v-if="recentTips.length > 0" variant="erobo-neo">
    <div class="recent-tips-glass">
      <div v-for="tip in recentTips" :key="tip.id" class="recent-tip-item-glass">
        <span class="recent-tip-emoji" aria-hidden="true">✨</span>
        <div class="recent-tip-info">
          <span class="recent-tip-to-glass">{{ tip.to }}</span>
          <span class="recent-tip-time-glass">{{ tip.time }}</span>
        </div>
        <span class="recent-tip-amount-glass">{{ tip.amount }} {{ t("tokenGas") }}</span>
      </div>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { RecentTip } from "../composables/useDevTippingStats";

const { t } = createUseI18n(messages)();

interface Props {
  totalDonated: number;
  recentTips: RecentTip[];
  formatNum: (n: number) => string;
}

defineProps<Props>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.stats-grid-neo {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

.stat-item-neo {
  text-align: center;
}

.stat-label-neo {
  @include stat-label;
  color: var(--cafe-muted);
}

.stat-value-neo {
  @include mono-number(28px);
  color: var(--cafe-neon);
  text-shadow: var(--cafe-neon-glow-strong);
}

.recent-tips-glass {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.recent-tip-item-glass {
  background: var(--cafe-input-bg);
  padding: 12px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 2px solid var(--cafe-neon);
}

.recent-tip-to-glass {
  color: var(--cafe-text-strong);
  font-weight: bold;
  font-size: 14px;
}

.recent-tip-time-glass {
  color: var(--cafe-muted);
  font-size: 10px;
}

.recent-tip-amount-glass {
  @include mono-number;
  margin-left: auto;
  color: var(--cafe-neon);
}
</style>
