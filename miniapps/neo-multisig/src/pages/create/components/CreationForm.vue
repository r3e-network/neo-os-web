<template>
  <NeoCard class="creation-form">
    <text class="form-section-title">{{ title }}</text>
    <text class="form-section-desc">{{ description }}</text>

    <SignerList
      :signers="signers"
      :t="t"
      @add="$emit('addSigner')"
      @remove="$emit('removeSigner', $event)"
      @update="$emit('updateSigner', $event)"
    />

    <view class="actions">
      <NeoButton variant="primary" block @click="$emit('next')" :disabled="!isValid">
        {{ nextLabel }}
      </NeoButton>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import SignerList from "./SignerList.vue";

defineProps<{
  title: string;
  description: string;
  signers: string[];
  isValid: boolean;
  nextLabel: string;
  t: (key: string) => string;
}>();

defineEmits(["addSigner", "removeSigner", "updateSigner", "next"]);
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.creation-form {
  padding: 24px;
  margin-bottom: 24px;
}

.form-section-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 8px;
  display: block;
  color: var(--multisig-accent);
}

.form-section-desc {
  font-size: 14px;
  color: var(--text-secondary);
  margin-bottom: 24px;
  display: block;
}

.actions {
  margin-top: 24px;
}
</style>
