<template>
  <NeoCard variant="erobo" class="capsules-card">
    <view v-for="(capsule, idx) in capsules" :key="idx" class="capsule-item-glass">
      <view class="capsule-header">
        <view class="capsule-icon">💊</view>
        <view class="capsule-info">
          <text class="capsule-amount">{{ fmt(capsule.amount, 0) }} NEO</text>
          <text class="capsule-period">{{ capsule.unlockDate }}</text>
        </view>
        <view class="capsule-actions">
          <view class="capsule-status">
            <view class="status-badge" :class="capsule.status === 'Ready' ? 'ready' : 'locked'">
              <text class="status-badge-text">{{ capsule.status === "Ready" ? t("ready") : t("locked") }}</text>
            </view>
          </view>
          <NeoButton
            v-if="capsule.status === 'Ready'"
            size="sm"
            variant="primary"
            :loading="isLoading"
            @click="$emit('unlock', capsule.id)"
          >
            {{ t("unlock") }}
          </NeoButton>
        </view>
      </view>
      <view class="capsule-progress">
        <view class="progress-bar-glass">
          <view class="progress-fill-glass" :style="{ width: capsule.status === 'Ready' ? '100%' : '0%' }"></view>
        </view>
        <text class="progress-text">{{ capsule.status === "Ready" ? t("ready") : t("locked") }}</text>
      </view>
      <view class="capsule-footer">
        <view class="countdown">
          <text class="countdown-label">{{ t("maturesIn") }}</text>
          <text class="countdown-value">{{ capsule.remaining }}</text>
        </view>
        <view class="rewards">
          <text class="rewards-label">{{ t("rewards") }}</text>
          <text class="rewards-value">+{{ fmt(capsule.compound, 4) }} GAS</text>
        </view>
      </view>
    </view>
    <text v-if="capsules.length === 0" class="empty-text">{{ t("noCapsules") }}</text>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { formatNumber } from "@shared/utils/format";

interface Capsule {
  id: string;
  amount: number;
  unlockDate: string;
  remaining: string;
  compound: number;
  status: "Ready" | "Locked";
}

const props = defineProps<{
  capsules: Capsule[];
  isLoading: boolean;
}>();

const emit = defineEmits<{
  (e: "unlock", id: string): void;
}>();

const { t } = createUseI18n(messages)();
const fmt = (n: number, d = 2) => formatNumber(n, d);
</script>
