<template>
  <view class="page-container">
    <NeoDoc
      :title="t('title')"
      :subtitle="t('docSubtitle')"
      :description="t('docDescription')"
      :steps="[t('step1'), t('step2'), t('step3'), t('step4')]"
      :features="[
        { name: t('feature1Name'), desc: t('feature1Desc') },
        { name: t('feature2Name'), desc: t('feature2Desc') },
        { name: t('feature3Name'), desc: t('feature3Desc') },
      ]"
    />
  </view>
</template>

<script setup lang="ts">
import { useI18n } from "@/composables/useI18n";
import NeoDoc from "@shared/components/NeoDoc.vue";

const { t } = useI18n();
</script>

<style lang="scss" scoped>
.page-container {
  min-height: 100vh;
  background: var(--bg-body);
}
</style>
