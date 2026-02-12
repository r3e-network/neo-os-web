import { ref } from "vue";
import type { Article } from "@/types";

const LOCAL_NEWS_MOCK = {
  articles: [
    {
      id: "nnt-001",
      title: "Neo Council Publishes Q1 Ecosystem Priorities",
      summary: "A new roadmap highlights grants, infrastructure reliability, and developer onboarding improvements.",
      pubDate: "2026-02-06T15:00:00.000Z",
      imageUrl: "",
      link: "https://neonewstoday.com/general/neo-council-q1-priorities",
    },
    {
      id: "nnt-002",
      title: "GrantShares Community Roundup: February",
      summary: "An overview of active proposals, voting outcomes, and upcoming DAO milestones.",
      pubDate: "2026-02-05T12:30:00.000Z",
      imageUrl: "",
      link: "https://neonewstoday.com/general/grantshares-roundup-february",
    },
    {
      id: "nnt-003",
      title: "Tooling Updates Improve Smart Contract Testing",
      summary: "New updates streamline local testing workflows and improve transaction trace visibility.",
      pubDate: "2026-02-03T09:20:00.000Z",
      imageUrl: "",
      link: "https://neonewstoday.com/development/tooling-updates-testing",
    },
  ],
};

const isLocalPreview =
  typeof window !== "undefined" && ["127.0.0.1", "localhost"].includes(window.location.hostname);

export function useNewsData(t: (key: string) => string) {
  const loading = ref(true);
  const articles = ref<Article[]>([]);
  const errorMessage = ref("");

  async function fetchArticles() {
    loading.value = true;
    errorMessage.value = "";
    try {
      let data: Record<string, unknown> | null = null;

      if (isLocalPreview) {
        data = LOCAL_NEWS_MOCK;
      } else {
        const res = await fetch("/api/nnt-news?limit=20");
        if (!res.ok) {
          throw new Error(t("loadFailed"));
        }
        data = await res.json();
      }
      const rawArticles = Array.isArray(data.articles) ? data.articles : [];
      articles.value = rawArticles
        .map((article: Record<string, unknown>) => ({
          id: String(article.id || ""),
          title: String(article.title || ""),
          excerpt: String(article.summary || article.excerpt || ""),
          date: String(article.pubDate || article.date || ""),
          image: article.imageUrl || article.image || undefined,
          url: String(article.link || article.url || ""),
        }))
        .filter((article: Article) => article.id && article.title && article.url);
    } catch (_err: unknown) {
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

  return {
    loading,
    articles,
    errorMessage,
    fetchArticles,
    formatDate,
    openArticle,
  };
}
