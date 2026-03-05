<template>
  <NeoCard variant="erobo" class="capsules-card">
    <ItemList
      :items="capsules as unknown as Record<string, unknown>[]"
      :empty-text="t('noCapsules')"
      :aria-label="t('ariaCapsules')"
    >
      <template #item="{ item }">
        <view class="capsule-header">
          <view class="capsule-icon">💊</view>
          <view class="capsule-info">
            <text class="capsule-amount">{{ fmt((item as unknown as Capsule).amount, 0) }} NEO</text>
            <text class="capsule-period">{{ (item as unknown as Capsule).unlockDate }}</text>
          </view>
          <view class="capsule-actions">
            <view class="capsule-status">
              <StatusBadge
                :status="(item as unknown as Capsule).status === 'Ready' ? 'ready' : 'inactive'"
                :label="(item as unknown as Capsule).status === 'Ready' ? t('ready') : t('locked')"
              />
            </view>
            <NeoButton
              v-if="(item as unknown as Capsule).status === 'Ready'"
              size="sm"
              variant="primary"
              :loading="isLoading"
              @click="$emit('unlock', (item as unknown as Capsule).id)"
            >
              {{ t("unlock") }}
            </NeoButton>
          </view>
        </view>
        <view class="capsule-progress">
          <view class="progress-bar-glass">
            <view
              class="progress-fill-glass"
              :style="{ width: (item as unknown as Capsule).status === 'Ready' ? '100%' : '0%' }"
            ></view>
          </view>
          <text class="progress-text">{{
            (item as unknown as Capsule).status === "Ready" ? t("ready") : t("locked")
          }}</text>
        </view>
        <view class="capsule-footer">
          <view class="countdown">
            <text class="countdown-label">{{ t("maturesIn") }}</text>
            <text class="countdown-value">{{ (item as unknown as Capsule).remaining }}</text>
          </view>
          <view class="rewards">
            <text class="rewards-label">{{ t("rewards") }}</text>
            <text class="rewards-value">+{{ fmt((item as unknown as Capsule).compound, 4) }} GAS</text>
          </view>
        </view>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, ItemList, StatusBadge } from "@shared/components";
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
