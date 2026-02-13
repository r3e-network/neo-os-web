<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :tabs="tabs" :active-tab="activeTab" @tab-change="handleTabChange">
    <view class="page-container">
      <NeoDoc
        :title="t('docTitle')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";
import { ResponsiveLayout } from "@shared/components";
import NeoDoc from "@shared/components/NeoDoc.vue";

const { t } = createUseI18n(messages)();
const tabs = computed(() => [
  { id: "home", label: t('tabHome'), icon: "home" },
  { id: "docs", label: t('tabDocs'), icon: "info" },
]);
const activeTab = "docs";

const docSteps = computed(() => [t('docStep1'), t('docStep2'), t('docStep3'), t('docStep4')]);
const docFeatures = computed(() => [
  { name: t('docFeature1Name'), desc: t('docFeature1Desc') },
  { name: t('docFeature2Name'), desc: t('docFeature2Desc') },
  { name: t('docFeature3Name'), desc: t('docFeature3Desc') },
]);

const handleTabChange = (tabId: string) => {
  if (tabId === "home") {
    uni.navigateTo({ url: "/pages/index/index" });
  }
};
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100%;
  background: var(--bg-body);
}
</style>
