<template>
  <view class="page-shell docs-shell">
    <view class="page-hero fade-up">
      <text class="page-hero-title">{{ t("docsTitle") }}</text>
      <text class="page-hero-subtitle">{{ t("docsSubtitle") }}</text>
    </view>
    <NeoDoc
      :title="t('title')"
      :subtitle="t('docSubtitle')"
      :description="t('docDescription')"
      :steps="docSteps"
      :features="docFeatures"
    />
    <view class="card doc-link-card fade-up delay-1">
      <text class="section-title">{{ t("docsLinkTitle") }}</text>
      <text class="section-text">{{ t("docsLinkText") }}</text>
      <text class="doc-link" role="link" tabindex="0" :aria-label="t('docsLinkTitle')" @click="emit('openDocs', t('docsUrl'))">{{ t("docsUrl") }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { NeoDoc } from "@shared/components";

const { t } = createUseI18n(messages)();

const emit = defineEmits<{
  (e: "openDocs", url: string): void;
}>();

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);

const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);
</script>

<style lang="scss" scoped>
.page-shell {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.page-hero {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-hero-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 32px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-hero-subtitle {
  font-size: 12px;
  color: var(--burger-text-muted);
}

.card {
  background: var(--burger-surface);
  border-radius: 20px;
  padding: 18px;
  border: 1px solid var(--burger-border);
  box-shadow: var(--burger-card-shadow);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.doc-link-card {
  text-align: center;
  gap: 10px;
}

.section-title {
  font-family: "Bebas Neue", "Manrope", sans-serif;
  font-size: 28px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.section-text {
  font-size: 13px;
  line-height: 1.6;
  color: var(--burger-text-soft);
}

.doc-link {
  font-weight: 700;
  font-size: 13px;
  color: var(--burger-accent-deep);
  cursor: pointer;
}

.fade-up {
  animation: fadeUp 0.8s ease both;
}

.delay-1 {
  animation-delay: 0.1s;
}

@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(14px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
