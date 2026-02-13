<template>
  <NeoCard variant="erobo" class="template-list">
    <view class="templates-header">
      <text class="section-title">{{ t("yourTemplates") }}</text>
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

    <view v-else-if="templates.length === 0" class="empty-state">
      <NeoCard variant="erobo" class="p-6 text-center opacity-70">
        <text class="text-xs">{{ t("emptyTemplates") }}</text>
      </NeoCard>
    </view>

    <view v-else class="template-cards">
      <TemplateCard
        v-for="template in templates"
        :key="`template-${template.id}`"
        :template="template"
        :toggling-id="togglingId"
        @issue="$emit('issue', $event)"
        @toggle="$emit('toggle', $event)"
      />
    </view>
  </NeoCard>
</template>

<script setup lang="ts">
import { NeoCard, NeoButton } from "@shared/components";
import TemplateCard from "./TemplateCard.vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import type { TemplateItem } from "@/types";

defineProps<{
  templates: TemplateItem[];
  refreshing: boolean;
  togglingId: string | null;
  hasAddress: boolean;
}>();

defineEmits<{
  refresh: [];
  connect: [];
  issue: [template: TemplateItem];
  toggle: [template: TemplateItem];
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

.template-cards {
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
