<template>
  <view class="signer-list">
    <view v-for="(signer, index) in signers" :key="index" class="signer-row">
      <text class="index">{{ index + 1 }}</text>
      <input
        class="input"
        :value="signer"
        @input="$emit('update', { index, value: $event.target.value })"
        :placeholder="t('signerPlaceholder')"
      />
      <text class="remove-btn" @click="$emit('remove', index)" v-if="signers.length > 1">×</text>
    </view>

    <NeoButton variant="secondary" size="sm" @click="$emit('add')" class="add-btn">
      {{ t("addSigner") }}
    </NeoButton>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";

defineProps<{
  signers: string[];
  t: (key: string) => string;
}>();

defineEmits(["add", "remove", "update"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.signer-list {
  display: flex;
  flex-direction: column;
}

.signer-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.index {
  font-size: 12px;
  color: var(--text-secondary);
  width: 18px;
  text-align: center;
}

.input {
  flex: 1;
  background: var(--multisig-input-bg);
  border: 1px solid var(--multisig-border);
  border-radius: 8px;
  padding: 12px;
  color: var(--multisig-input-text);
  font-size: 12px;
  font-family: $font-mono;
}

.remove-btn {
  font-size: 20px;
  color: var(--multisig-remove);
}

.add-btn {
  margin-top: 12px;
}
</style>
