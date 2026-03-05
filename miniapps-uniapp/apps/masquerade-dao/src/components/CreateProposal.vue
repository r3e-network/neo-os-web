<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
      <view class="input-group">
        <text class="input-label">{{ t("identitySeed") }}</text>
        <NeoInput v-model="modelValue.identitySeed" :placeholder="t('identityPlaceholder')" />
      </view>
      <view class="input-group">
        <text class="input-label">{{ t("maskTypeLabel") }}</text>
        <view class="mask-type-actions">
          <NeoButton
            size="sm"
            :variant="modelValue.maskType === 1 ? 'primary' : 'secondary'"
            @click="modelValue.maskType = 1"
          >
            {{ t("maskTypeBasic") }}
          </NeoButton>
          <NeoButton
            size="sm"
            :variant="modelValue.maskType === 2 ? 'primary' : 'secondary'"
            @click="modelValue.maskType = 2"
          >
            {{ t("maskTypeCipher") }}
          </NeoButton>
          <NeoButton
            size="sm"
            :variant="modelValue.maskType === 3 ? 'primary' : 'secondary'"
            @click="modelValue.maskType = 3"
          >
            {{ t("maskTypePhantom") }}
          </NeoButton>
        </view>
      </view>

      <view v-if="identityHash" class="hash-preview">
        <text class="hash-label">{{ t("hashPreview") }}</text>
        <text class="hash-value">{{ identityHash }}</text>
      </view>

      <NeoButton
        variant="primary"
        block
        :loading="isLoading"
        :disabled="!canCreate || isLoading"
        @click="$emit('create')"
      >
        {{ isLoading ? t("creatingMask") : t("createNewMask") }}
      </NeoButton>
      <text class="helper-text">{{ t("maskFeeNote") }}</text>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();

interface FormData {
  identitySeed: string;
  maskType: number;
}

interface Props {
  modelValue: FormData;
  identityHash: string;
  canCreate: boolean;
  isLoading: boolean;
}

defineProps<Props>();

defineEmits<{
  create: [];
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

.mask-type-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.input-label {
  @include stat-label;
  color: var(--mask-muted);
  margin-left: 4px;
}

.helper-text {
  font-size: 11px;
  color: var(--mask-subtle);
  text-align: center;
  font-style: italic;
}

.hash-preview {
  padding: 16px;
  border: 1px dashed var(--mask-dash-border);
  border-radius: 8px;
  background: var(--mask-highlight-bg);
}

.hash-label {
  @include stat-label;
  display: block;
  font-size: 10px;
  margin-bottom: 6px;
  color: var(--mask-purple);
}

.hash-value {
  font-family: "Fira Code", monospace;
  font-size: 11px;
  word-break: break-all;
  color: var(--mask-text);
}
</style>
