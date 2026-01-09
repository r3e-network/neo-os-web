/**
 * Component: NNTNewsFeed
 * Displays Neo News Today articles in a feed format
 */
import { FC } from "react";
import { useRouter } from "next/router";
import { useNNTNews, type NNTArticle } from "@/hooks/useNNTNews";
import { useTranslation } from "@/lib/i18n/react";
import { cn } from "@/lib/utils";
import { ExternalLink, Newspaper, Clock } from "lucide-react";

interface NNTNewsFeedProps {
  limit?: number;
  className?: string;
  onArticleClick?: (article: NNTArticle) => void;
}

function formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);

  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

export const NNTNewsFeed: FC<NNTNewsFeedProps> = ({ limit = 5, className, onArticleClick }) => {
  const { t } = useTranslation("host");
  const router = useRouter();
  const { articles, loading, error } = useNNTNews({ limit });

  const handleArticleClick = (article: NNTArticle) => {
    if (onArticleClick) {
      onArticleClick(article);
    } else {
      // Navigate to NNT miniapp with article URL
      router.push(`/miniapps/miniapp-neo-news-today?article=${encodeURIComponent(article.link)}`);
    }
  };

  if (loading) {
    return (
      <div className={cn("animate-pulse space-y-3", className)}>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 dark:bg-white/5 rounded-xl" />
        ))}
      </div>
    );
  }

  if (error || articles.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-2 mb-3">
        <div className="flex items-center gap-2">
          <Newspaper size={16} className="text-neo" />
          <span className="text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
            {t("news.latestNews") || "Latest News"}
          </span>
        </div>
        <a
          href="https://neonewstoday.com"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-gray-500 dark:text-white/50 hover:text-neo flex items-center gap-1"
        >
          NNT <ExternalLink size={10} />
        </a>
      </div>

      {/* Articles */}
      <div className="space-y-2">
        {articles.map((article) => (
          <NNTArticleItem key={article.id} article={article} onClick={() => handleArticleClick(article)} />
        ))}
      </div>
    </div>
  );
};

const NNTArticleItem: FC<{ article: NNTArticle; onClick: () => void }> = ({ article, onClick }) => {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left p-3 rounded-xl border transition-all",
        "bg-white/80 dark:bg-white/5 border-gray-200 dark:border-white/10",
        "hover:bg-gray-50 dark:hover:bg-white/10 hover:border-neo/30",
        "cursor-pointer group",
      )}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        {article.imageUrl && (
          <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-gray-100 dark:bg-white/5">
            <img src={article.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
          </div>
        )}

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-2 group-hover:text-neo transition-colors">
            {article.title}
          </h4>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[10px] font-medium text-neo bg-neo/10 px-1.5 py-0.5 rounded">{article.category}</span>
            <span className="text-[10px] text-gray-400 dark:text-white/40 flex items-center gap-1">
              <Clock size={10} />
              {formatTimeAgo(article.pubDate)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
};

export default NNTNewsFeed;
