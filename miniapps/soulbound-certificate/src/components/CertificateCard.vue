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
import type { CertificateItem } from "@/types";

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

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@import "../pages/index/soulbound-certificate-theme.scss";

.template-card__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.template-title {
  font-size: 15px;
  font-weight: 700;
}

.template-subtitle {
  display: block;
  font-size: 11px;
  color: var(--soul-muted);
  margin-top: 2px;
}

.certificate-body {
  display: grid;
  grid-template-columns: 110px 1fr;
  gap: 14px;
  align-items: center;
}

.certificate-qr {
  width: 110px;
  height: 110px;
  border-radius: 14px;
  background: rgba(0, 0, 0, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
}

.certificate-qr__img {
  width: 100px;
  height: 100px;
}

.certificate-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  font-size: 12px;
  color: var(--soul-muted);
}

.copy-btn {
  align-self: flex-start;
}

.status-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  background: rgba(16, 185, 129, 0.2);
  color: var(--soul-accent);

  &.revoked {
    background: rgba(239, 68, 68, 0.2);
    color: var(--soul-danger);
  }
}
</style>
