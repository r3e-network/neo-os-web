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
      <div v-if="loading" class="nnt-loading" role="status" aria-live="polite">
        <div class="nnt-spinner" aria-hidden="true" />
        <span class="nnt-loading-text">{{ t("loading") }}</span>
      </div>

      <!-- Articles List -->
      <div v-else class="nnt-articles">
        <NeoCard v-if="errorMessage" variant="danger" class="nnt-empty-card" role="alert" aria-live="assertive">
          <span class="nnt-empty-text">{{ errorMessage }}</span>
        </NeoCard>
        <template v-else>
          <NeoCard
            v-for="article in articles"
            :key="article.id"
            variant="erobo"
            class="nnt-article-card"
            @click="openArticle(article)"
          >
            <div class="article-inner">
              <img
                v-if="article.image"
                :src="article.image"
                class="nnt-article-image"
                mode="aspectFill"
                :alt="article.title || t('articleImage')"
              />
              <div class="nnt-article-content">
                <span class="nnt-article-title-glass">{{ article.title }}</span>
                <div class="nnt-meta mb-2">
                  <span class="nnt-article-date-glass">{{ formatDate(article.date) }}</span>
                </div>
                <span class="nnt-article-excerpt-glass">{{ article.excerpt }}</span>
                <div class="read-more mt-3">
                  <span class="read-more-text">{{ t("readMore") }} →</span>
                </div>
              </div>
            </div>
          </NeoCard>
          <NeoCard v-if="articles.length === 0" variant="erobo" class="nnt-empty-card">
            <span class="nnt-empty-text">{{ t("noArticles") }}</span>
          </NeoCard>
        </template>
      </div>
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
