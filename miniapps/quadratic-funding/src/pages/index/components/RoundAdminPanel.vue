<template>
  <NeoCard variant="erobo-neo" class="admin-card">
    <view class="admin-header">
      <text class="section-title">{{ t("adminTools") }}</text>
      <text class="admin-subtitle">#{{ round.id }} · {{ round.assetSymbol }}</text>
    </view>

    <view class="form-group">
      <NeoInput
        v-model="matchingAmount"
        type="number"
        :label="t('addMatching')"
        :placeholder="t('addMatchingPlaceholder')"
        :suffix="round.assetSymbol"
      />
      <NeoButton
        size="sm"
        variant="secondary"
        :loading="isAddingMatching"
        :disabled="!canManage"
        @click="emitAddMatching"
      >
        {{ isAddingMatching ? t("addingMatching") : t("addMatching") }}
      </NeoButton>
    </view>

    <view class="admin-divider" />

    <view class="form-group">
      <NeoInput
        v-model="projectIds"
        :label="t('finalizeProjectsJson')"
        :placeholder="t('finalizeProjectsPlaceholder')"
      />
      <NeoInput
        v-model="matchedAmounts"
        :label="t('finalizeMatchesJson')"
        :placeholder="t('finalizeMatchesPlaceholder')"
      />
      <text class="hint-text">{{ t("finalizeHint") }}</text>
      <NeoButton
        size="sm"
        variant="primary"
        :loading="isFinalizing"
        :disabled="!canFinalize"
        @click="emitFinalize"
      >
        {{ isFinalizing ? t("finalizing") : t("finalizeRound") }}
      </NeoButton>
    </view>

    <view class="admin-divider" />

    <NeoButton
      size="sm"
      variant="secondary"
      :loading="isClaimingUnused"
      :disabled="!canClaimUnused"
      @click="emitClaimUnused"
    >
      {{ isClaimingUnused ? t("claimingUnused") : t("claimUnused") }}
    </NeoButton>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoInput, NeoButton, NeoCard } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import type { RoundItem } from "./RoundList.vue";

const props = defineProps<{
  round: RoundItem;
  canManage: boolean;
  canFinalize: boolean;
  canClaimUnused: boolean;
  isAddingMatching: boolean;
  isFinalizing: boolean;
  isClaimingUnused: boolean;
}>();

const emit = defineEmits<{
  (e: "addMatching", amount: string): void;
  (e: "finalize", projectIds: string, matchedAmounts: string): void;
  (e: "claimUnused"): void;
}>();

const { t } = useI18n();
const matchingAmount = ref("");
const projectIds = ref("");
const matchedAmounts = ref("");

const emitAddMatching = () => emit("addMatching", matchingAmount.value);
const emitFinalize = () => emit("finalize", projectIds.value, matchedAmounts.value);
const emitClaimUnused = () => emit("claimUnused");
</script>

<style lang="scss" scoped>
.admin-card {
  background: var(--qf-card-bg);
  border: 1px solid var(--qf-card-border);
  border-radius: 18px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.admin-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.admin-subtitle {
  font-size: 11px;
  color: var(--qf-muted);
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.admin-divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 6px 0;
}

.hint-text {
  font-size: 11px;
  color: var(--qf-muted);
}
</style>
