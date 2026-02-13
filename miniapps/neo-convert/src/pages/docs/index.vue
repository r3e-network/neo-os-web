<template>
  <view class="page-container">
    <NeoDoc
      :title="t('docTitle')"
      :subtitle="t('docSubtitle')"
      :description="t('docDescription')"
      :steps="docSteps"
      :features="docFeatures"
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import NeoDoc from "@shared/components/NeoDoc.vue";

const { t } = createUseI18n(messages)();

const docSteps = computed(() => [t("docStep1"), t("docStep2"), t("docStep3"), t("docStep4")]);
const docFeatures = computed(() => [
  { name: t("docFeature1Name"), desc: t("docFeature1Desc") },
  { name: t("docFeature2Name"), desc: t("docFeature2Desc") },
  { name: t("docFeature3Name"), desc: t("docFeature3Desc") },
  { name: t("docFeature4Name"), desc: t("docFeature4Desc") },
]);
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: var(--bg-body);
}
</style>
