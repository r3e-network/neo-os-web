<template>
  <view class="template-card">
    <view class="template-card__header">
      <view>
        <text class="template-title">{{ template.name || `#${template.id}` }}</text>
        <text class="template-subtitle">{{ template.issuerName || addressShort(template.issuer) }}</text>
      </view>
      <text :class="['status-pill', template.active ? 'active' : 'inactive']">
        {{ template.active ? t("statusActive") : t("statusInactive") }}
      </text>
    </view>

    <view class="template-meta">
      <text class="meta-label">{{ t("category") }}</text>
      <text class="meta-value">{{ template.category || "--" }}</text>
    </view>

    <view class="template-metrics">
      <view>
        <text class="metric-label">{{ t("issued") }}</text>
        <text class="metric-value">{{ template.issued.toString() }}</text>
      </view>
      <view>
        <text class="metric-label">{{ t("supply") }}</text>
        <text class="metric-value">{{ template.maxSupply.toString() }}</text>
      </view>
    </view>

    <text class="template-desc">{{ template.description || "--" }}</text>

    <view class="template-actions">
      <NeoButton
        size="sm"
        variant="primary"
        :disabled="!template.active || template.issued >= template.maxSupply"
        @click="$emit('issue', template)"
      >
        {{ template.issued >= template.maxSupply ? t("soldOut") : t("issueCertificate") }}
      </NeoButton>
      <NeoButton
        size="sm"
        variant="secondary"
        :loading="togglingId === template.id"
        @click="$emit('toggle', template)"
      >
        {{ template.active ? t("deactivate") : t("activate") }}
      </NeoButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";
import { useI18n } from "@/composables/useI18n";

interface TemplateItem {
  id: string;
  issuer: string;
  name: string;
  issuerName: string;
  category: string;
  maxSupply: bigint;
  issued: bigint;
  description: string;
  active: boolean;
}

defineProps<{
  template: TemplateItem;
  togglingId: string | null;
}>();

defineEmits<{
  issue: [template: TemplateItem];
  toggle: [template: TemplateItem];
}>();

const { t } = useI18n();

const addressShort = (value: string) => {
  const trimmed = String(value || "");
  if (!trimmed) return "--";
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
};
</script>
