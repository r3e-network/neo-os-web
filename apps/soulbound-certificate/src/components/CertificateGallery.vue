<template>
  <div>
    <div class="templates-header">
      <span class="section-title">{{ t("certificatesTab") }}</span>
      <NeoButton size="sm" variant="secondary" :loading="refreshing" @click="$emit('refresh')">
        {{ t("refresh") }}
      </NeoButton>
    </div>

    <div v-if="!hasAddress" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center">
        <span class="text-sm block mb-3">{{ t("walletNotConnected") }}</span>
        <NeoButton size="sm" variant="primary" @click="$emit('connect')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </div>

    <div v-else-if="certificates.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <span class="text-xs">{{ t("emptyCertificates") }}</span>
      </NeoCard>
    </div>

    <div v-else class="certificate-grid">
      <CertificateCard
        v-for="cert in certificates"
        :key="`cert-${cert.tokenId}`"
        :cert="cert"
        :qr-code="certQrs[cert.tokenId]"
        @copy="$emit('copy-token-id', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import CertificateCard from "./CertificateCard.vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { CertificateItem } from "@/types";

defineProps<{
  certificates: CertificateItem[];
  certQrs: Record<string, string>;
  refreshing: boolean;
  hasAddress: boolean;
}>();

defineEmits<{
  refresh: [];
  connect: [];
  "copy-token-id": [tokenId: string];
}>();

const { t } = createUseI18n(messages)();
</script>

<style lang="scss" scoped>
.templates-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 18px;
  font-weight: 700;
}

.certificate-grid {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
