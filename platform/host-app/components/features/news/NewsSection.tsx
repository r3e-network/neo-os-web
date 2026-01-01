"use client";

import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Newspaper, TrendingUp, Zap, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch news from API or use mock data
    const mockNews: NewsItem[] = [
      {
        id: "1",
        title: "Neo N3 Testnet Phase II Now Live",
        summary: "Experience the latest features including enhanced TEE support and improved oracle integration.",
        category: "announcement",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "2",
        title: "New MiniApps: Candidate Vote & NeoBurger",
        summary: "Two new MiniApps have been deployed to the platform. Try them out now!",
        category: "update",
        timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "3",
        title: "Community Hackathon Starting Soon",
        summary: "Join our upcoming hackathon with 50,000 GAS in prizes. Registration opens next week.",
        category: "event",
        timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: "4",
        title: "Flash Loan MiniApp Trending",
        summary: "Flash Loan has reached 1,000+ users this week. Check out the most popular DeFi app.",
        category: "trending",
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ];

    setTimeout(() => {
      setNews(mockNews);
      setLoading(false);
    }, 500);
  }, []);

  const formatTimeAgo = (timestamp: string) => {
    const seconds = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

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
        <h3 className="font-bold text-gray-900 dark:text-white">Latest News</h3>
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
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatTimeAgo(item.timestamp)}</span>
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
