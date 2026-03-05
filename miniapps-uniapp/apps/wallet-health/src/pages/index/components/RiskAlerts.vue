<template>
  <view class="risk-alerts">
    <view v-if="isUnsupported" class="mb-4">
      <NeoCard variant="danger">
        <view class="flex flex-col items-center gap-2 py-1">
          <text class="text-center font-bold text-red-400">{{ t("wrongChain") }}</text>
          <text class="text-center text-xs text-white opacity-80">{{ t("wrongChainMessage") }}</text>
          <NeoButton size="sm" variant="secondary" class="mt-2" @click="$emit('switchChain')">
            {{ t("switchToNeo") }}
          </NeoButton>
        </view>
      </NeoCard>
    </view>

    <NeoCard v-if="status" :variant="status.type === 'error' ? 'danger' : 'success'" class="mb-4 text-center">
      <text class="font-bold">{{ status.msg }}</text>
    </NeoCard>

    <NeoCard variant="erobo" class="risk-card">
      <view class="risk-pill" :class="riskClass">
        <AppIcon :name="riskIcon" :size="14" />
        <text>{{ riskLabel }}</text>
      </view>
    </NeoCard>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, AppIcon } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

interface Status {
  msg: string;
  type: "success" | "error";
}

defineProps<{
  isUnsupported: boolean;
  status: Status | null;
  riskLabel: string;
  riskClass: string;
  riskIcon: string;
}>();

const { t } = createUseI18n(messages)();

defineEmits(["switchChain"]);
</script>

<style lang="scss" scoped>
.risk-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.risk-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.risk-pill.risk-low {
  background: rgba(34, 197, 94, 0.2);
  color: var(--health-success);
}

.risk-pill.risk-medium {
  background: rgba(251, 191, 36, 0.2);
  color: var(--health-warning);
}

.risk-pill.risk-high {
  background: rgba(248, 113, 113, 0.2);
  color: var(--health-danger);
}

.mb-4 {
  margin-bottom: 16px;
}
</style>
