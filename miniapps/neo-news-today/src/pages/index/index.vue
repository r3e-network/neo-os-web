<template>
  <view class="theme-neo-news">
    <MiniAppTemplate
      :config="templateConfig"
      :state="appState"
      :t="t"
      :status-message="status"
      @tab-change="activeTab = $event"
    >
      <template #desktop-sidebar>
        <SidebarPanel :title="t('overview')" :items="sidebarItems" />
      </template>

      <template #content>
        <ErrorBoundary @error="handleBoundaryError" @retry="resetAndReload" :fallback-message="t('errorFallback')">
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
        </ErrorBoundary>
      </template>

      <template #operation>
        <NeoCard variant="erobo" :title="t('feedStatus')">
          <NeoStats :stats="opStats" />
          <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="fetchArticles">
            {{ t("refreshFeed") }}
          </NeoButton>
        </NeoCard>
      </template>
    </MiniAppTemplate>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { MiniAppTemplate, NeoCard, NeoButton, NeoStats, SidebarPanel, ErrorBoundary } from "@shared/components";
import { useStatusMessage } from "@shared/composables/useStatusMessage";
import { useHandleBoundaryError } from "@shared/composables/useHandleBoundaryError";
import { createUseI18n } from "@shared/composables/useI18n";
import { createTemplateConfig, createSidebarItems } from "@shared/utils";
import { messages } from "@/locale/messages";
import { useNewsData } from "./composables/useNewsData";

const { t } = createUseI18n(messages)();
const { status } = useStatusMessage();
const { loading, articles, errorMessage, fetchArticles, formatDate, openArticle } = useNewsData(t);

const templateConfig = createTemplateConfig({
  tabs: [{ key: "news", labelKey: "news", icon: "📰", default: true }],
});
const activeTab = ref("news");
const appState = computed(() => ({
  articleCount: articles.value.length,
  loading: loading.value,
}));

const sidebarItems = createSidebarItems(t, [
  { labelKey: "articles", value: () => articles.value.length },
  { labelKey: "latest", value: () => (articles.value.length > 0 ? formatDate(articles.value[0].date) : "—") },
  { labelKey: "status", value: () => (loading.value ? t("loading") : t("ready")) },
]);

const opStats = computed(() => [
  { label: t("articles"), value: articles.value.length },
  { label: t("latest"), value: articles.value.length > 0 ? formatDate(articles.value[0].date) : "—" },
  { label: t("status"), value: loading.value ? t("loading") : t("ready") },
]);

onMounted(async () => {
  await fetchArticles();
});

const { handleBoundaryError } = useHandleBoundaryError("neo-news-today");
const resetAndReload = async () => {
  await fetchArticles();
};
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./_neo-news-components.scss";

.op-btn {
  width: 100%;
}
</style>
