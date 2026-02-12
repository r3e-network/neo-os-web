<template>
  <view class="theme-neo-news">
    <MiniAppTemplate :config="templateConfig" :state="appState" :t="t" @tab-change="activeTab = $event">
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <view class="nnt-container">
          <!-- Loading State -->
          <view v-if="loading" class="nnt-loading">
            <view class="nnt-spinner" />
            <text class="nnt-loading-text">{{ t("loading") }}</text>
          </view>

          <!-- Articles List -->
          <view v-else class="nnt-articles">
            <NeoCard v-if="errorMessage" variant="danger" class="nnt-empty-card">
              <text class="nnt-empty-text">{{ errorMessage }}</text>
            </NeoCard>
            <template v-else>
              <NeoCard
                v-for="article in articles"
                :key="article.id"
                variant="erobo"
                class="nnt-article-card"
                @click="openArticle(article)"
              >
                <view class="article-inner">
                  <image
                    v-if="article.image"
                    :src="article.image"
                    class="nnt-article-image"
                    mode="aspectFill"
                    :alt="article.title || t('articleImage')"
                  />
                  <view class="nnt-article-content">
                    <text class="nnt-article-title-glass">{{ article.title }}</text>
                    <view class="nnt-meta mb-2">
                      <text class="nnt-article-date-glass">{{ formatDate(article.date) }}</text>
                    </view>
                    <text class="nnt-article-excerpt-glass">{{ article.excerpt }}</text>
                    <view class="read-more mt-3">
                      <text class="read-more-text">{{ t("readMore") }} →</text>
                    </view>
                  </view>
                </view>
              </NeoCard>
              <NeoCard v-if="articles.length === 0" variant="erobo" class="nnt-empty-card">
                <text class="nnt-empty-text">{{ t("noArticles") }}</text>
              </NeoCard>
            </template>
          </view>
        </view>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { MiniAppTemplate, NeoCard, SidebarPanel } from "@shared/components";
import type { MiniAppTemplateConfig } from "@shared/types/template-config";
import { useI18n } from "@/composables/useI18n";
import { useNewsData } from "./composables/useNewsData";

const { t } = useI18n();
const { loading, articles, errorMessage, fetchArticles, formatDate, openArticle } = useNewsData(t);

const templateConfig: MiniAppTemplateConfig = {
  contentType: "market-list",
  tabs: [
    { key: "news", labelKey: "news", icon: "📰", default: true },
    { key: "docs", labelKey: "docs", icon: "📖" },
  ],
  features: {
    chainWarning: true,
    statusMessages: true,
    docs: {
      titleKey: "title",
      subtitleKey: "docSubtitle",
      descriptionKey: "docDescription",
      stepKeys: ["step1", "step2", "step3", "step4"],
      featureKeys: [
        { nameKey: "feature1Name", descKey: "feature1Desc" },
        { nameKey: "feature2Name", descKey: "feature2Desc" },
      ],
    },
  },
};
const activeTab = ref("news");
const appState = computed(() => ({
  articleCount: articles.value.length,
  loading: loading.value,
}));

const sidebarItems = computed(() => [
  { label: t("articles"), value: articles.value.length },
  { label: t("latest"), value: articles.value.length > 0 ? formatDate(articles.value[0].date) : "—" },
  { label: t("status"), value: loading.value ? t("loading") : t("ready") },
]);

onMounted(async () => {
  await fetchArticles();
});
</script>

<style lang="scss" scoped>
@import "./_neo-news-components.scss";
</style>
