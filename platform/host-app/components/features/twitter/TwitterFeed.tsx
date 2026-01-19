import { useState, useEffect } from "react";

interface Tweet {
  id: string;
  text: string;
  created_at: string;
  author: string;
  url: string;
}

export function TwitterFeed() {
  const [tweets, setTweets] = useState<Tweet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/twitter-feed")
      .then((res) => res.json())
      .then((data) => {
        setTweets(data.tweets || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
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
          <div key={i} className="h-24 rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tweets.map((tweet) => (
        <a
          key={tweet.id}
          href={tweet.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block rounded-lg border border-gray-200 bg-white p-4 transition hover:border-blue-300 hover:shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500 text-white">N</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-gray-900">{tweet.author}</span>
                <span className="text-sm text-gray-500">@Neo_Blockchain</span>
                <span suppressHydrationWarning className="text-sm text-gray-400">· {formatTime(tweet.created_at)}</span>
              </div>
              <p className="mt-1 text-gray-700">{tweet.text}</p>
            </div>
          </div>
        </a>
      ))}
    </div>
  );
}
