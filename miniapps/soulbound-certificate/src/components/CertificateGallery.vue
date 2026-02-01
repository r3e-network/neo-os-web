<template>
  <view>
    <view class="templates-header">
      <text class="section-title">{{ t("certificatesTab") }}</text>
      <NeoButton size="sm" variant="secondary" :loading="refreshing" @click="$emit('refresh')">
        {{ t("refresh") }}
      </NeoButton>
    </view>

    <view v-if="!hasAddress" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center">
        <text class="text-sm block mb-3">{{ t("walletNotConnected") }}</text>
        <NeoButton size="sm" variant="primary" @click="$emit('connect')">
          {{ t("connectWallet") }}
        </NeoButton>
      </NeoCard>
    </view>

    <view v-else-if="certificates.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <text class="text-xs">{{ t("emptyCertificates") }}</text>
      </NeoCard>
    </view>

    <view v-else class="certificate-grid">
      <CertificateCard
        v-for="cert in certificates"
        :key="`cert-${cert.tokenId}`"
        :cert="cert"
        :qr-code="certQrs[cert.tokenId]"
        @copy="$emit('copy-token-id', $event)"
      />
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import CertificateCard from "./CertificateCard.vue";
import { useI18n } from "@/composables/useI18n";

interface CertificateItem {
  tokenId: string;
  templateId: string;
  owner: string;
  templateName: string;
  issuerName: string;
  category: string;
  description: string;
  recipientName: string;
  achievement: string;
  memo: string;
  issuedTime: number;
  revoked: boolean;
  revokedTime: number;
}

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

const { t } = useI18n();
</script>
