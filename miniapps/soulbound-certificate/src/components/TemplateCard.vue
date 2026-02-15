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
      <NeoButton size="sm" variant="secondary" :loading="togglingId === template.id" @click="$emit('toggle', template)">
        {{ template.active ? t("deactivate") : t("activate") }}
      </NeoButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { NeoButton } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { TemplateItem } from "@/types";

defineProps<{
  template: TemplateItem;
  togglingId: string | null;
}>();

defineEmits<{
  issue: [template: TemplateItem];
  toggle: [template: TemplateItem];
}>();

const { t } = createUseI18n(messages)();

const addressShort = (value: string) => {
  const trimmed = String(value || "");
  if (!trimmed) return "--";
  if (trimmed.length <= 12) return trimmed;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/mixins.scss" as *;
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

.template-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.meta-label {
  @include stat-label;
  font-size: 10px;
  letter-spacing: 0.08em;
  color: var(--soul-muted);
}

.meta-value {
  font-size: 12px;
}

.template-metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 12px;
}

.metric-label {
  @include stat-label;
  font-size: 10px;
  color: var(--soul-muted);
  letter-spacing: 0.08em;
}

.metric-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--soul-accent-strong);
}

.template-desc {
  font-size: 12px;
  color: var(--soul-muted);
}

.template-actions {
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

  &.inactive {
    background: rgba(148, 163, 184, 0.2);
    color: var(--soul-inactive);
  }
}
</style>
