<template>
  <MiniAppPage
    name="neo-news-today"
    :config="templateConfig"
    :state="appState"
    :t="t"
    :status-message="status"
    :sidebar-items="sidebarItems"
    :sidebar-title="sidebarTitle"
    :fallback-message="fallbackMessage"
    :on-boundary-error="handleBoundaryError"
    :on-boundary-retry="loadArticles"
  >
    <template #content>
      <!-- Loading State -->
      <view v-if="loading" class="nnt-loading" role="status" aria-live="polite">
        <view class="nnt-spinner" aria-hidden="true" />
        <text class="nnt-loading-text">{{ t("loading") }}</text>
      </view>

      <!-- Articles List -->
      <view v-else class="nnt-articles">
        <NeoCard v-if="errorMessage" variant="danger" class="nnt-empty-card" role="alert" aria-live="assertive">
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
    </template>

    <template #operation>
      <NeoCard variant="erobo" :title="t('feedStatus')">
        <NeoButton size="sm" variant="primary" class="op-btn" :disabled="loading" @click="loadArticles">
          {{ t("refreshFeed") }}
        </NeoButton>
        <StatsDisplay :items="opStats" layout="rows" />
      </NeoCard>
    </template>
  </MiniAppPage>
</template>

<script setup lang="ts">
import { onMounted, computed } from "vue";
import { MiniAppPage, NeoCard } from "@shared/components";
import { messages } from "@/locale/messages";
import { createMiniApp } from "@shared/utils/createMiniApp";
import { useNewsData } from "./composables/useNewsData";

const { t, templateConfig, sidebarItems, sidebarTitle, fallbackMessage, status, handleBoundaryError } = createMiniApp({
  name: "neo-news-today",
  messages,
  template: {
    tabs: [{ key: "news", labelKey: "news", icon: "📰", default: true }],
  },
  sidebarItems: [
    { labelKey: "articles", value: () => articles.value.length },
    { labelKey: "latest", value: () => (articles.value.length > 0 ? formatDate(articles.value[0].date) : "—") },
    { labelKey: "status", value: () => (loading.value ? t("loading") : t("ready")) },
  ],
});

const { loading, articles, errorMessage, loadArticles, formatDate, openArticle } = useNewsData(t);

const appState = computed(() => ({
  articleCount: articles.value.length,
  loading: loading.value,
}));
onMounted(async () => {
  await loadArticles();
});
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;
@import "./_neo-news-components.scss";

.op-btn {
  width: 100%;
}
</style>
