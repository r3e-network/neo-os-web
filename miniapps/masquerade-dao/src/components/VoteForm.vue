<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
      <view class="input-group">
        <text class="input-label">{{ t("proposalId") }}</text>
        <NeoInput v-model="modelValue.proposalId" type="number" :placeholder="t('proposalPlaceholder')" />
      </view>

      <view class="input-group">
        <text class="input-label">{{ t("selectMask") }}</text>
        <view class="mask-picker">
          <view
            v-for="mask in masks"
            :key="mask.id"
            :class="['mask-chip', selectedMaskId === mask.id && 'active']"
            @click="$emit('update:selectedMaskId', mask.id)"
          >
            #{{ mask.id }}
          </view>
        </view>
      </view>

      <view class="vote-actions">
        <NeoButton variant="primary" size="lg" :disabled="!canVote" @click="$emit('vote', 1)">
          {{ t("for") }}
        </NeoButton>
        <NeoButton variant="danger" size="lg" :disabled="!canVote" @click="$emit('vote', 2)">
          {{ t("against") }}
        </NeoButton>
        <NeoButton variant="secondary" size="lg" :disabled="!canVote" @click="$emit('vote', 3)">
          {{ t("abstain") }}
        </NeoButton>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";
import type { Mask } from "../composables/useMasqueradeProposals";

const { t } = createUseI18n(messages)();

interface FormData {
  proposalId: string;
}

interface Props {
  modelValue: FormData;
  masks: Mask[];
  selectedMaskId: string | null;
  canVote: boolean;
}

defineProps<Props>();

defineEmits<{
  "update:selectedMaskId": [id: string];
  vote: [choice: number];
}>();
</script>

<style lang="scss" scoped>
@use "@shared/styles/mixins.scss" as *;

.form-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.input-label {
  @include stat-label;
  color: var(--mask-muted);
  margin-left: 4px;
}

.mask-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 8px;
  background: var(--mask-panel-bg);
  border-radius: 8px;
}

.mask-chip {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid var(--mask-chip-border);
  background: var(--mask-chip-bg);
  font-size: 11px;
  cursor: pointer;
  color: var(--mask-chip-text);
  font-family: "Cinzel", serif;

  &.active {
    border-color: var(--mask-purple);
    background: var(--mask-chip-active-bg);
    color: var(--mask-chip-active-text);
    box-shadow: var(--mask-chip-active-shadow);
  }
}

.vote-actions {
  display: flex;
  gap: 12px;
  margin-top: 8px;
}
</style>
