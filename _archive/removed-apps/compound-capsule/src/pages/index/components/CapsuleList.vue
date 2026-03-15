<template>
  <NeoCard variant="erobo" class="capsules-card">
    <ItemList
      :items="capsules as unknown as Record<string, unknown>[]"
      :empty-text="t('noCapsules')"
      :aria-label="t('ariaCapsules')"
    >
      <template #item="{ item }">
        <div class="capsule-header">
          <div class="capsule-icon">💊</div>
          <div class="capsule-info">
            <span class="capsule-amount">{{ fmt((item as unknown as Capsule).amount, 0) }} NEO</span>
            <span class="capsule-period">{{ (item as unknown as Capsule).unlockDate }}</span>
          </div>
          <div class="capsule-actions">
            <div class="capsule-status">
              <StatusBadge
                :status="(item as unknown as Capsule).status === 'Ready' ? 'ready' : 'inactive'"
                :label="(item as unknown as Capsule).status === 'Ready' ? t('ready') : t('locked')"
              />
            </div>
            <NeoButton
              v-if="(item as unknown as Capsule).status === 'Ready'"
              size="sm"
              variant="primary"
              :loading="isLoading"
              @click="$emit('unlock', (item as unknown as Capsule).id)"
            >
              {{ t("unlock") }}
            </NeoButton>
          </div>
        </div>
        <div class="capsule-progress">
          <div class="progress-bar-glass">
            <div
              class="progress-fill-glass"
              :style="{ width: (item as unknown as Capsule).status === 'Ready' ? '100%' : '0%' }"
            ></div>
          </div>
          <span class="progress-text">{{
            (item as unknown as Capsule).status === "Ready" ? t("ready") : t("locked")
          }}</span>
        </div>
        <div class="capsule-footer">
          <div class="countdown">
            <span class="countdown-label">{{ t("maturesIn") }}</span>
            <span class="countdown-value">{{ (item as unknown as Capsule).remaining }}</span>
          </div>
          <div class="rewards">
            <span class="rewards-label">{{ t("rewards") }}</span>
            <span class="rewards-value">+{{ fmt((item as unknown as Capsule).compound, 4) }} GAS</span>
          </div>
        </div>
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
