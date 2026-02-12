<template>
  <NeoCard class="signers-card">
    <text class="card-title">{{ t("signersTitle") }}</text>
    <view class="signer-list">
      <view v-for="signer in signers" :key="signer.publicKey" class="signer-row">
        <view class="signer-info">
          <text class="signer-key">{{ shorten(signer.publicKey) }}</text>
          <text class="signer-address">{{ shorten(signer.address) }}</text>
          <text v-if="hasSigned(signer.publicKey)" class="badge signed">{{ t("badgeSigned") }}</text>
          <text v-else class="badge pending">{{ t("badgePending") }}</text>
        </view>
      </view>
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard } from "@shared/components";

defineProps<{
  t: (key: string) => string;
  signers: { publicKey: string; address: string }[];
  hasSigned: (publicKey: string) => boolean;
}>();

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
