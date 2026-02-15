<template>
  <NeoCard class="signers-card">
    <text class="card-title">{{ t("signersTitle") }}</text>
    <ItemList
      :items="signers as unknown as Record<string, unknown>[]"
      item-key="publicKey"
      :aria-label="t('ariaSigners')"
    >
      <template #item="{ item }">
        <view class="signer-info">
          <text class="signer-key">{{ shorten((item as unknown as SignerEntry).publicKey) }}</text>
          <text class="signer-address">{{ shorten((item as unknown as SignerEntry).address) }}</text>
          <text v-if="hasSigned((item as unknown as SignerEntry).publicKey)" class="badge signed">{{
            t("badgeSigned")
          }}</text>
          <text v-else class="badge pending">{{ t("badgePending") }}</text>
        </view>
      </template>
    </ItemList>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, ItemList } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

interface SignerEntry {
  publicKey: string;
  address: string;
}

defineProps<{
  signers: SignerEntry[];
  hasSigned: (publicKey: string) => boolean;
}>();

const { t } = createUseI18n(messages)();

const shorten = (str: string) => (str ? str.slice(0, 6) + "..." + str.slice(-4) : "");
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;

.signers-card {
  margin-bottom: 24px;
  padding: 24px;
}

.card-title {
  font-size: 16px;
  font-weight: 700;
  margin-bottom: 16px;
  display: block;
}

.signer-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
  padding: 12px;
  background: var(--multisig-surface);
  border-radius: 8px;
}

.signer-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.signer-key {
  font-family: $font-mono;
  font-size: 12px;
}

.signer-address {
  font-size: 11px;
  color: var(--text-secondary);
}

.badge {
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 6px;

  &.signed {
    background: var(--multisig-accent-strong);
    color: var(--multisig-accent-text);
  }
  &.pending {
    background: var(--multisig-surface-strong);
    color: var(--text-secondary);
  }
}
</style>
