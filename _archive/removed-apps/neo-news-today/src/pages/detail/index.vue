<template>
  <div class="detail-container">
    <ResponsiveLayout :desktop-breakpoint="1024" :title="t('articleDetail')" :show-back="true">
      <web-view :src="url" class="webview" />
    </ResponsiveLayout>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { onMounted } from "vue"; // replaced onLoad
import { ResponsiveLayout } from "@shared/components";
import { createUseI18n } from "@shared/composables/useI18n";
import { messages } from "@/locale/messages";

const { t } = createUseI18n(messages)();
const url = ref("");

onMounted(() => { /* route params via URL query */ }); // was onLoad((options) => {
  if (options && options.url) {
    url.value = decodeURIComponent(options.url);
  }
});
</script>

<style lang="scss" scoped>
.detail-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.webview {
  flex: 1;
  width: 100%;
  height: 100%;
}
</style>
