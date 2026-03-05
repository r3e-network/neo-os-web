<template>
  <FormCard :submit-label="t('common.confirm')" @submit="$emit('save')">
    <view class="form-group">
      <text class="label">{{ t("settings.network") }}</text>
      <picker
        mode="selector"
        :value="currentChainIndex"
        :range="chainOptions"
        range-key="name"
        @change="$emit('chain-change', $event)"
      >
        <view class="picker-view">
          {{ selectedChainName || t("settings.select_network") }}
        </view>
      </picker>
    </view>

    <view class="form-group">
      <text class="label">{{ t("settings.alchemy_key") }}</text>
      <input
        class="input-field"
        type="password"
        v-model="form.alchemyApiKey"
        :placeholder="t('settings.alchemy_placeholder')"
        placeholder-class="placeholder"
      />
    </view>

    <view class="form-group">
      <text class="label">{{ t("settings.walletconnect") }}</text>
      <input
        class="input-field"
        v-model="form.walletConnectProjectId"
        :placeholder="t('settings.walletconnect_placeholder')"
        placeholder-class="placeholder"
      />
    </view>

    <view class="form-group">
      <text class="label">{{ t("settings.contract_address") }}</text>
      <input class="input-field" v-model="form.contractAddress" placeholder="0x..." placeholder-class="placeholder" />
    </view>
  </FormCard>
</template>

<script setup lang="ts">
export interface SettingsFormData {
  chainId: number;
  alchemyApiKey: string;
  walletConnectProjectId: string;
  contractAddress: string;
}

export interface ChainOption {
  id: number;
  name: string;
  shortName?: string;
}

import { FormCard } from "@shared/components";

defineProps<{
  form: SettingsFormData;
  chainOptions: ChainOption[];
  currentChainIndex: number;
  selectedChainName: string;
  t: (key: string, params?: Record<string, string | number>) => string;
}>();

defineEmits<{
  "chain-change": [e: { detail: { value: number } }];
  save: [];
}>();
</script>

<style scoped lang="scss">
@use "@shared/styles/tokens.scss" as *;

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 20px;
}

.label {
  font-size: 13px;
  font-weight: 600;
  opacity: 0.8;
}

.input-field {
  background: var(--piggy-input-bg);
  border: 1px solid var(--piggy-input-border);
  border-radius: 10px;
  padding: 12px;
  color: var(--piggy-input-text);
  font-size: 14px;
}

.picker-view {
  border: 1px solid var(--piggy-input-border);
  border-radius: 10px;
  padding: 12px;
  background: var(--piggy-input-bg);
  font-size: 14px;
}
</style>
