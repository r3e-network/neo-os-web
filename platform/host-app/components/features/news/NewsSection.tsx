"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, TrendingUp, Zap, Calendar } from "lucide-react";
import { cn, formatTimeAgoShort } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  category: "announcement" | "update" | "event" | "trending";
  timestamp: string;
  link?: string;
}

const categoryConfig = {
  announcement: { icon: Newspaper, color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400" },
  update: { icon: Zap, color: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400" },
  event: { icon: Calendar, color: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400" },
  trending: { icon: TrendingUp, color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400" },
};

export function NewsSection() {
  const { t } = useTranslation("host");
  const { t: tCommon, locale } = useTranslation("common");
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch news from API
    async function fetchNews() {
      try {
        const res = await fetch("/api/news");
        if (res.ok) {
          const data = await res.json();
          setNews(data.news || []);
        }
      } catch (err) {
        console.error("Failed to fetch news:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchNews();
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <Newspaper size={20} className="text-gray-700 dark:text-gray-300" />
        <h3 className="font-bold text-gray-900 dark:text-white">{t("news.latestNews")}</h3>
      </div>

      {news.map((item) => {
        const config = categoryConfig[item.category];
        const Icon = config.icon;

        return (
          <Card
            key={item.id}
            className="p-4 hover:shadow-md transition-shadow cursor-pointer border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900"
          >
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-lg", config.color)}>
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-gray-900 dark:text-white line-clamp-1">{item.title}</h4>
                  <span className="text-xs text-gray-500 whitespace-nowrap">
                    {formatTimeAgoShort(item.timestamp, { t: tCommon, locale })}
                  </span>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{item.summary}</p>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
