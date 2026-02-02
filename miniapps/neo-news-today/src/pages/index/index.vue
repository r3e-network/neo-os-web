<template>
  <ResponsiveLayout :desktop-breakpoint="1024" :tabs="navTabs" :active-tab="activeTab" @tab-change="activeTab = $event"

      <!-- Desktop Sidebar -->
      <template #desktop-sidebar>
        <view class="desktop-sidebar">
          <text class="sidebar-title">{{ t('overview') }}</text>
        </view>
      </template>
>
    <!-- Chain Warning - Framework Component -->
    <ChainWarning :title="t('wrongChain')" :message="t('wrongChainMessage')" :button-text="t('switchToNeo')" />

    <!-- News Tab -->
    <view v-if="activeTab === 'news'" class="nnt-container theme-neo-news">
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
              <image v-if="article.image" :src="article.image" class="nnt-article-image" mode="aspectFill" :alt="article.title || t('articleImage')" />
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

    <!-- Docs Tab -->
    <view v-if="activeTab === 'docs'" class="tab-content scrollable">
      <NeoDoc
        :title="t('title')"
        :subtitle="t('docSubtitle')"
        :description="t('docDescription')"
        :steps="docSteps"
        :features="docFeatures"
      />
    </view>
  </ResponsiveLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from "vue";

// Responsive state
const windowWidth = ref(window.innerWidth);
const isMobile = computed(() => windowWidth.value < 768);
const isDesktop = computed(() => windowWidth.value >= 1024);
const handleResize = () => { windowWidth.value = window.innerWidth; };

onMounted(() => window.addEventListener('resize', handleResize));
onUnmounted(() => window.removeEventListener('resize', handleResize));
import { ResponsiveLayout, NeoCard, NeoDoc, ChainWarning } from "@shared/components";
import { useI18n } from "@/composables/useI18n";
import type { NavTab } from "@shared/components/NavBar.vue";

const { t } = useI18n();

const navTabs = computed<NavTab[]>(() => [
  { id: "news", icon: "news", label: t("news") },
  { id: "docs", icon: "book", label: t("docs") },
]);
const activeTab = ref("news");

const docSteps = computed(() => [t("step1"), t("step2"), t("step3"), t("step4")]);
const docFeatures = computed(() => [
  { name: t("feature1Name"), desc: t("feature1Desc") },
  { name: t("feature2Name"), desc: t("feature2Desc") },
]);

interface Article {
  id: string;
  title: string;
  excerpt: string;
  date: string;
  image?: string;
  url: string;
}

const loading = ref(true);
const articles = ref<Article[]>([]);
const errorMessage = ref("");

onMounted(async () => {
  await fetchArticles();
});

async function fetchArticles() {
  loading.value = true;
  errorMessage.value = "";
  try {
    // Fetch from NNT RSS or API
    const res = await fetch("/api/nnt-news?limit=20");
    if (!res.ok) {
      throw new Error(t("loadFailed"));
    }
    const data = await res.json();
    const rawArticles = Array.isArray(data.articles) ? data.articles : [];
    articles.value = rawArticles
      .map((article: any) => ({
        id: String(article.id || ""),
        title: String(article.title || ""),
        excerpt: String(article.summary || article.excerpt || ""),
        date: String(article.pubDate || article.date || ""),
        image: article.imageUrl || article.image || undefined,
        url: String(article.link || article.url || ""),
      }))
      .filter((article: Article) => article.id && article.title && article.url);
  } catch (err) {
    articles.value = [];
    errorMessage.value = t("loadFailed");
  } finally {
    loading.value = false;
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function openArticle(article: Article) {
  const url = article.url;
  if (!url) return;

  uni.navigateTo({
    url: `/pages/detail/index?url=${encodeURIComponent(url)}`,
  });
}
</script>

<style lang="scss" scoped>
@use "@shared/styles/tokens.scss" as *;
@use "@shared/styles/variables.scss" as *;

@import url("https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;0,900;1,300;1,400;1,700;1,900&family=Oswald:wght@200..700&display=swap");
@import "./neo-news-today-theme.scss";

:global(page) {
  background: var(--bg-primary);
}

.nnt-container {
  padding: 16px;
  padding-bottom: 80px;
  background-color: var(--news-bg);
  min-height: 100vh;
  /* Dot Matrix Pattern */
  background-image: radial-gradient(var(--news-dot) 1px, transparent 1px);
  background-size: 20px 20px;
}

/* Newsroom Component Overrides */
.theme-neo-news :deep(.neo-card) {
  background: var(--news-paper) !important;
  border: 1px solid var(--news-border) !important;
  border-left: 4px solid var(--news-accent) !important;
  border-radius: 2px !important;
  box-shadow: var(--news-shadow) !important;
  color: var(--news-ink) !important;

  &.variant-danger {
    border-color: var(--news-accent) !important;
    background: var(--news-accent-soft) !important;
  }
}

.theme-neo-news :deep(.neo-button) {
  border-radius: 2px !important;
  text-transform: uppercase;
  font-weight: 800 !important;
  font-family: "Oswald", sans-serif !important;
  letter-spacing: 0.05em;

  &.variant-primary {
    background: var(--news-accent) !important;
    color: var(--news-date-text) !important;
    border: none !important;

    &:active {
      background: var(--news-accent-strong) !important;
    }
  }

  &.variant-secondary {
    background: var(--news-paper) !important;
    border: 1px solid var(--news-border) !important;
    color: var(--news-ink) !important;
  }
}

.nnt-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px;
}

.nnt-spinner {
  width: 32px;
  height: 32px;
  border: 4px solid var(--news-border);
  border-top-color: var(--news-accent);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.nnt-loading-text {
  margin-top: 12px;
  color: var(--news-subtle);
  font-size: 12px;
  text-transform: uppercase;
  font-weight: bold;
}

.nnt-articles {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.nnt-empty-card {
  text-align: center;
  padding: 32px;
}
.nnt-empty-text {
  font-size: 14px;
  color: var(--news-subtle);
  font-style: italic;
}

.nnt-article-card {
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  &:active {
    transform: translateY(2px);
    box-shadow: var(--news-shadow-press) !important;
  }
}

.article-inner {
  display: flex;
  flex-direction: column;
}

.nnt-article-image {
  width: 100%;
  height: 180px;
  margin-bottom: 16px;
  border-radius: 2px;
  filter: contrast(1.1) saturate(0.9);
}

.nnt-article-content {
  display: flex;
  flex-direction: column;
}

.nnt-article-title-glass {
  font-size: 20px;
  font-weight: 800;
  color: var(--news-ink);
  margin-bottom: 8px;
  line-height: 1.25;
  font-family: "Merriweather", serif;
}

.nnt-meta {
  display: flex;
  align-items: center;
}

.nnt-article-date-glass {
  font-size: 10px;
  color: var(--news-date-text);
  text-transform: uppercase;
  font-weight: 700;
  background: var(--news-accent);
  padding: 2px 6px;
  border-radius: 2px;
}

.nnt-article-excerpt-glass {
  font-size: 14px;
  color: var(--news-muted);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-family: "Georgia", serif;
}

.read-more {
  display: flex;
  justify-content: flex-end;
  border-top: 1px dashed var(--news-border);
  padding-top: 12px;
}
.read-more-text {
  font-size: 12px;
  font-weight: 700;
  color: var(--news-link);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  &:hover {
    text-decoration: underline;
  }
}

.tab-content {
  padding: 16px;
  padding-bottom: 80px;
}
.scrollable {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

/* Mobile-specific styles */
@media (max-width: 767px) {
  .nnt-container {
    padding: 12px;
    padding-bottom: 60px;
  }
  .nnt-article-image {
    height: 140px;
  }
  .nnt-article-title-glass {
    font-size: 16px;
  }
  .tab-content {
    padding: 12px;
    padding-bottom: 60px;
  }
}

/* Desktop styles */
@media (min-width: 1024px) {
  .nnt-container {
    padding: 24px;
    max-width: 900px;
    margin: 0 auto;
  }
  .nnt-article-image {
    height: 220px;
  }
}


// Desktop sidebar
.desktop-sidebar {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3, 12px);
}

.sidebar-title {
  font-size: var(--font-size-sm, 13px);
  font-weight: 600;
  color: var(--text-secondary, rgba(248, 250, 252, 0.7));
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
