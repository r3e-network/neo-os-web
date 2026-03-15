<template>
  <NeoCard class="creation-form">
    <span class="form-section-title">{{ title }}</span>
    <span class="form-section-desc">{{ description }}</span>

    <SignerList
      :signers="signers"
      @add="$emit('addSigner')"
      @remove="$emit('removeSigner', $event)"
      @update="$emit('updateSigner', $event)"
    />

    <div class="actions">
      <NeoButton variant="primary" block @click="$emit('next')" :disabled="!isValid">
        {{ nextLabel }}
      </NeoButton>
    </div>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import SignerList from "./SignerList.vue";

defineProps<{
  title: string;
  description: string;
  signers: string[];
  isValid: boolean;
  nextLabel: string;
}>();

const { t } = createUseI18n(messages)();

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
