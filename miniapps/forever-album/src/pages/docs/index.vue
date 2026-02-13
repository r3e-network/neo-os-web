<template>
  <NeoDoc
    :title="t('docTitle')"
    :subtitle="t('docSubtitle')"
    :description="t('docDescription')"
    :steps="docSteps"
    :features="docFeatures"
  />
</template>

<script setup lang="ts">
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import NeoDoc from "@shared/components/NeoDoc.vue";
import { computed } from "vue";

const { t } = createUseI18n(messages)();

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);

const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
  { name: t("feature3Name"), desc: t("feature3Desc") },
]);
</script>
