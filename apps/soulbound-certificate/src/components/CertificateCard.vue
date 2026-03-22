<template>
  <div class="certificate-card">
    <div class="template-card__header">
      <div>
        <span class="template-title">{{ cert.templateName || `#${cert.templateId}` }}</span>
        <span class="template-subtitle">{{ cert.issuerName || addressShort(cert.owner) }}</span>
      </div>
      <StatusBadge
        :status="cert.revoked ? 'error' : 'success'"
        :label="cert.revoked ? t('certificateRevoked') : t('certificateValid')"
      />
    </div>

    <div class="certificate-body">
      <div class="certificate-qr" v-if="qrCode">
        <img :src="qrCode" class="certificate-qr__img" mode="aspectFit" :alt="t('certificateQrCode')" />
      </div>
      <div class="certificate-details">
        <span class="detail-row">{{ t("recipientName") }}{{ t("detailSeparator") }}{{ cert.recipientName || t("notAvailable") }}</span>
        <span class="detail-row">{{ t("achievement") }}{{ t("detailSeparator") }}{{ cert.achievement || t("notAvailable") }}</span>
        <span class="detail-row">{{ t("tokenId") }}{{ t("detailSeparator") }}{{ cert.tokenId }}</span>
        <NeoButton size="sm" variant="secondary" type="button" class="copy-btn" :aria-label="t('copyTokenId')" @click="$emit('copy', cert.tokenId)">
          {{ t("copyTokenId") }}
        </NeoButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { NeoButton, StatusBadge } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { CertificateItem } from "@/types";

defineProps<{
  cert: CertificateItem;
  qrCode?: string;
}>();

defineEmits<{
  copy: [tokenId: string];
}>();

const { t } = createUseI18n(messages)();

const addressShort = (value: string) => {
  const trimmed = String(value || "");
  if (!trimmed) return t("notAvailable");
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
</style>
