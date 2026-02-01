<template>
  <view class="certificate-card">
    <view class="template-card__header">
      <view>
        <text class="template-title">{{ cert.templateName || `#${cert.templateId}` }}</text>
        <text class="template-subtitle">{{ cert.issuerName || addressShort(cert.owner) }}</text>
      </view>
      <text :class="['status-pill', cert.revoked ? 'revoked' : 'active']">
        {{ cert.revoked ? t("certificateRevoked") : t("certificateValid") }}
      </text>
    </view>

    <view class="certificate-body">
      <view class="certificate-qr" v-if="qrCode">
        <image :src="qrCode" class="certificate-qr__img" mode="aspectFit" :alt="t('certificateQrCode')" />
      </view>
      <view class="certificate-details">
        <text class="detail-row">{{ t("recipientName") }}: {{ cert.recipientName || "--" }}</text>
        <text class="detail-row">{{ t("achievement") }}: {{ cert.achievement || "--" }}</text>
        <text class="detail-row">{{ t("tokenId") }}: {{ cert.tokenId }}</text>
        <NeoButton size="sm" variant="secondary" class="copy-btn" @click="$emit('copy', cert.tokenId)">
          {{ t("copyTokenId") }}
        </NeoButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";
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
  cert: CertificateItem;
  qrCode?: string;
}>();

defineEmits<{
  copy: [tokenId: string];
}>();

const { t } = useI18n();

const addressShort = (value: string) => {
  const trimmed = String(value || "");
  if (!trimmed) return "--";
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
};
</script>
