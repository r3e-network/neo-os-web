<template>
  <NeoCard class="policies-card" variant="erobo">
    <view class="policies-grid">
      <view v-for="policy in policies" :key="policy.id" class="policy-item-glass" :class="[policy.level, { disabled: !policy.active }]">
        <view class="level-stripe" :class="policy.level"></view>

        <view class="policy-content">
          <view class="policy-header">
            <text class="policy-name">{{ policy.name }}</text>
            <view class="level-badge" :class="policy.level">{{ getLevelText(policy.level) }}</view>
            <view class="status-badge" :class="{ active: policy.active, claimed: policy.claimed }">
              {{ policy.claimed ? t("claimed") : policy.active ? t("active") : t("expired") }}
            </view>
          </view>
          <text class="policy-desc">{{ policy.description }}</text>
        </view>

        <view class="policy-action">
          <NeoButton
            v-if="policy.active && !policy.claimed"
            variant="primary"
            size="sm"
            class="claim-btn"
            @click="$emit('claim', policy.id)"
          >
            {{ t("requestClaim") }}
          </NeoButton>
          <text v-else class="policy-status">{{ policy.claimed ? t("claimed") : t("expired") }}</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";

const LEVELS = ["low", "medium", "high", "critical"] as const;
export type Level = (typeof LEVELS)[number];

export interface Policy {
  id: string;
  name: string;
  description: string;
  active: boolean;
  claimed: boolean;
  level: Level;
  coverageValue?: number;
}

const props = defineProps<{
  policies: Policy[];
  t: (key: string) => string;
}>();

defineEmits(["claim"]);

const getLevelText = (level: string) => {
  const levelMap: Record<string, string> = {
    low: props.t("levelLow"),
    medium: props.t("levelMedium"),
    high: props.t("levelHigh"),
    critical: props.t("levelCritical"),
  };
  return levelMap[level] || level;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

.policies-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.policy-item-glass {
  display: flex;
  align-items: center;
  position: relative;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
  padding: 16px;
  padding-left: 20px; /* Space for stripe */
  gap: 16px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    background: rgba(255, 255, 255, 0.06);
    transform: translateX(4px);
  }
  
  &.disabled {
    opacity: 0.6;
    background: rgba(0, 0, 0, 0.2);
    .level-stripe { background: rgba(255, 255, 255, 0.2); box-shadow: none; }
  }
}

.level-stripe {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  width: 4px;
  
  &.low { background: #94a3b8; }
  &.medium { background: #00e599; box-shadow: 0 0 10px rgba(0, 229, 153, 0.3); }
  &.high { background: #f59e0b; box-shadow: 0 0 10px rgba(245, 158, 11, 0.3); }
  &.critical { background: #ef4444; box-shadow: 0 0 10px rgba(239, 68, 68, 0.3); }
}

.policy-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.policy-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.policy-name {
  font-weight: 700;
  font-size: 14px;
  color: var(--text-primary);
}

.level-badge {
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 4px;
  letter-spacing: 0.05em;
  
  &.low { background: rgba(255, 255, 255, 0.1); color: var(--text-primary); }
  &.medium { background: rgba(0, 229, 153, 0.1); color: #00e599; }
  &.high { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
  &.critical { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
}

.policy-desc {
  font-size: 11px;
  color: var(--text-secondary);
  font-weight: 500;
}

.status-badge {
  margin-left: auto;
  font-size: 9px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);

  &.active {
    background: rgba(0, 229, 153, 0.12);
    color: #00e599;
  }
  &.claimed {
    background: rgba(59, 130, 246, 0.12);
    color: #3b82f6;
  }
}

.claim-btn {
  min-width: 90px;
}

.policy-status {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
}
</style>
