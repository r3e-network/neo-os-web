<template>
  <NeoCard variant="erobo">
    <view v-for="dev in developers" :key="dev.id" class="dev-card-glass" @click="$emit('select', dev)">
      <view class="dev-card-header">
        <view class="dev-avatar-glass">
          <text class="avatar-emoji">👨‍💻</text>
          <view class="avatar-badge-glass">{{ dev.rank }}</view>
        </view>
        <view class="dev-info">
          <text class="dev-name-glass">{{ dev.name }}</text>
          <text class="dev-projects-glass">
            <text class="project-icon">🧩</text>
            {{ dev.role }}
          </text>
          <text class="dev-contributions-glass">{{ dev.tipCount }} {{ t("tipsCount") }}</text>
        </view>
      </view>
      <view class="dev-card-footer-glass">
        <view class="tip-stats">
          <text class="tip-label-glass">{{ t("totalTips") }}</text>
          <text class="tip-amount-glass">{{ formatNum(dev.totalTips) }} GAS</text>
        </view>
        <view class="tip-action">
          <text class="tip-icon text-glass">💚</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";
import type { Developer } from "../composables/useDevTippingStats";

interface Props {
  developers: Developer[];
  formatNum: (n: number) => string;
  t: Function;
}

defineProps<Props>();

defineEmits<{
  select: [dev: Developer];
}>();
</script>

<style lang="scss" scoped>
.dev-card-glass {
  background: var(--cafe-panel-weak);
  padding: 16px;
  border-radius: 12px;
  border: 1px solid var(--cafe-panel-border);
  margin-bottom: 16px;
  cursor: pointer;
  transition: all 0.2s;

  &:active {
    background: var(--cafe-panel-hover);
  }
}

.dev-card-header {
  display: flex;
  gap: 16px;
  align-items: center;
}

.dev-avatar-glass {
  width: 56px;
  height: 56px;
  background: var(--cafe-avatar-bg);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--cafe-neon);
  font-size: 28px;
  position: relative;
}

.avatar-badge-glass {
  position: absolute;
  bottom: -6px;
  right: -6px;
  background: var(--cafe-neon);
  color: var(--cafe-badge-text);
  font-size: 10px;
  font-weight: bold;
  padding: 2px 6px;
  border-radius: 4px;
  box-shadow: var(--cafe-badge-shadow);
}

.dev-info {
  flex: 1;
}

.dev-name-glass {
  font-size: 16px;
  font-weight: 800;
  color: var(--cafe-text-strong);
  font-family: "JetBrains Mono", monospace;
  display: block;
}

.dev-projects-glass {
  font-size: 10px;
  color: var(--cafe-neon);
  border: 1px solid var(--cafe-secondary-border);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
  margin-top: 4px;
  font-weight: bold;
  text-transform: uppercase;
}

.dev-contributions-glass {
  font-size: 10px;
  color: var(--cafe-muted);
  display: block;
  margin-top: 4px;
}

.dev-card-footer-glass {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--cafe-dash-border);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
}

.tip-label-glass {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--cafe-muted);
}

.tip-amount-glass {
  font-family: "JetBrains Mono", monospace;
  font-size: 18px;
  color: var(--cafe-neon);
  font-weight: bold;
  text-shadow: var(--cafe-neon-glow);
}
</style>
