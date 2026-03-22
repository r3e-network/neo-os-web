import { useState, useEffect } from "react";
import { Twitter } from "lucide-react";
import { logger } from "@/lib/logger";
import { fetchJSON } from "@/lib/fetch-client";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author: string;
  url: string;
}

type TwitterFeedResponse = {
  tweets?: Tweet[];
};

export function TwitterFeed() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const loadTweets = async () => {
      try {
        const data = await fetchJSON<TwitterFeedResponse>("/api/twitter-feed");
        if (!active) return;
        setTweets(data.tweets || []);
      } catch (err) {
        if (active) { logger.warn("Failed to fetch tweets:", err); setError("Failed to load tweets"); }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadTweets();
    return () => {
      active = false;
    };
  }, []);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return "Just now";
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-gray-200 dark:bg-gray-700" />
        ))}
      </div>
    );
  }

  if (tweets.length === 0) {
    return (
      <div className="py-8 text-center">
        {error ? (
          <p className="text-red-500 dark:text-red-400">{error}</p>
        ) : (
          <p className="text-gray-500 dark:text-gray-400">No tweets available</p>
        )}
      </div>
    );
  }

  return (
    <ul className="space-y-4">
      {tweets.map((tweet) => (
        <li key={tweet.id}>
          <a
            href={tweet.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 transition-colors hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 text-white">N</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-900 dark:text-white">{tweet.author}</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">@Neo_Blockchain</span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">· {formatTime(tweet.created_at)}</span>
                </div>
                <p className="mt-1 text-gray-700 dark:text-gray-300">{tweet.text}</p>
              </div>
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
