<template>
  <NeoCard class="policies-card" variant="erobo">
    <ItemList :items="policies" item-key="id">
      <template #item="{ item: policy }">
        <view class="policy-item-glass" :class="[policy.level, { disabled: !policy.active }]">
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
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

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

defineProps<{
  policies: Policy[];
}>();

defineEmits(["claim"]);

const { t } = createUseI18n(messages)();

const getLevelText = (level: string) => {
  const levelMap: Record<string, string> = {
    low: t("levelLow"),
    medium: t("levelMedium"),
    high: t("levelHigh"),
    critical: t("levelCritical"),
  };
  return levelMap[level] || level;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@use "@shared/styles/mixins.scss" as *;

.policies-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.policy-item-glass {
  @include card-base(12px, 16px);
  display: flex;
  align-items: center;
  position: relative;
  overflow: hidden;
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
    .level-stripe {
      background: rgba(255, 255, 255, 0.2);
      box-shadow: none;
    }
  }
}

.level-stripe {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 4px;

  &.low {
    background: var(--ops-muted);
  }
  &.medium {
    background: var(--ops-success);
    box-shadow: 0 0 10px rgba(0, 229, 153, 0.3);
  }
  &.high {
    background: var(--ops-warning);
    box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);
  }
  &.critical {
    background: var(--ops-danger);
    box-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
  }
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

  &.low {
    background: rgba(255, 255, 255, 0.1);
    color: var(--text-primary);
  }
  &.medium {
    background: rgba(0, 229, 153, 0.1);
    color: var(--ops-success);
  }
  &.high {
    background: rgba(245, 158, 11, 0.1);
    color: var(--ops-warning);
  }
  &.critical {
    background: rgba(239, 68, 68, 0.1);
    color: var(--ops-danger);
  }
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
    color: var(--ops-success);
  }
  &.claimed {
    background: rgba(59, 130, 246, 0.12);
    color: var(--ops-blue);
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
