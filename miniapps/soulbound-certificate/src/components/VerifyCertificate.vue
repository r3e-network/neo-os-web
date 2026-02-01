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

const emit = defineEmits<{
  lookup: [tokenId: string];
  revoke: [tokenId: string];
}>();

const props = defineProps<{
  lookingUp: boolean;
  revoking: boolean;
  result: CertificateItem | null;
}>();

const { t } = useI18n();

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
