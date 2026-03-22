<template>
  <div class="template-card">
    <div class="template-card__header">
      <div>
        <span class="template-title">{{ template.name || `#${template.id}` }}</span>
        <span class="template-subtitle">{{ template.issuerName || addressShort(template.issuer) }}</span>
      </div>
      <span :class="['status-pill', template.active ? 'active' : 'inactive']">
        {{ template.active ? t("statusActive") : t("statusInactive") }}
      </span>
    </div>

    <div class="template-meta">
      <span class="meta-label">{{ t("category") }}</span>
      <span class="meta-value">{{ template.category || t("notAvailable") }}</span>
    </div>

    <div class="template-metrics">
      <div>
        <span class="metric-label">{{ t("issued") }}</span>
        <span class="metric-value">{{ template.issued.toString() }}</span>
      </div>
      <div>
        <span class="metric-label">{{ t("supply") }}</span>
        <span class="metric-value">{{ template.maxSupply.toString() }}</span>
      </div>
    </div>

    <span class="template-desc">{{ template.description || t("notAvailable") }}</span>

    <div class="template-actions">
      <NeoButton
        size="sm"
        variant="primary"
        type="button"
        :disabled="!template.active || template.issued >= template.maxSupply"
        :aria-label="template.issued >= template.maxSupply ? t('soldOut') : t('issueCertificate')"
        @click="$emit('issue', template)"
      >
        {{ template.issued >= template.maxSupply ? t("soldOut") : t("issueCertificate") }}
      </NeoButton>
      <NeoButton size="sm" variant="secondary" type="button" :loading="togglingId === template.id" :aria-label="template.active ? t('deactivate') : t('activate')" @click="$emit('toggle', template)">
        {{ template.active ? t("deactivate") : t("activate") }}
      </NeoButton>
    </div>
  </div>
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
  if (!trimmed) return t("notAvailable");
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
