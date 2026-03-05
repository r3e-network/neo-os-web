<template>
  <NeoCard variant="erobo-neo">
    <view class="form-group">
      <NeoInput
        :model-value="localTokenId"
        @update:model-value="localTokenId = $event"
        :label="t('verifyTokenId')"
        :placeholder="t('verifyTokenIdPlaceholder')"
      />
      <view class="verify-actions">
        <NeoButton size="sm" variant="secondary" :loading="lookingUp" @click="handleLookup">
          {{ lookingUp ? t("lookingUp") : t("lookup") }}
        </NeoButton>
        <NeoButton size="sm" variant="primary" :loading="revoking" @click="handleRevoke">
          {{ revoking ? t("revoking") : t("revoke") }}
        </NeoButton>
      </view>
    </view>
  </NeoCard>

  <NeoCard v-if="result" variant="erobo" class="lookup-card">
    <view class="template-card__header">
      <view>
        <text class="template-title">{{ result.templateName || `#${result.templateId}` }}</text>
        <text class="template-subtitle">{{ result.issuerName || addressShort(result.owner) }}</text>
      </view>
      <text :class="['status-pill', result.revoked ? 'revoked' : 'active']">
        {{ result.revoked ? t("certificateRevoked") : t("certificateValid") }}
      </text>
    </view>
    <text class="detail-row">{{ t("recipientName") }}: {{ result.recipientName || "--" }}</text>
    <text class="detail-row">{{ t("achievement") }}: {{ result.achievement || "--" }}</text>
    <text class="detail-row">{{ t("tokenId") }}: {{ result.tokenId }}</text>
  </NeoCard>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { NeoCard, NeoButton, NeoInput } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { CertificateItem } from "@/types";

const emit = defineEmits<{
  lookup: [tokenId: string];
  revoke: [tokenId: string];
}>();

const props = defineProps<{
  lookingUp: boolean;
  revoking: boolean;
  result: CertificateItem | null;
}>();

const { t } = createUseI18n(messages)();

const localTokenId = ref("");

const handleLookup = () => {
  if (localTokenId.value.trim()) {
    emit("lookup", localTokenId.value.trim());
  }
};

const handleRevoke = () => {
  if (localTokenId.value.trim()) {
    emit("revoke", localTokenId.value.trim());
  }
};

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

.detail-row {
  font-size: 12px;
  color: var(--soul-muted);
}

.verify-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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
