"use client";

import { useState, useCallback } from "react";
import type { ForumThread, ForumReply } from "./types";

interface UseForumOptions {
  appId: string;
  walletAddress?: string;
}

export function useForum({ appId, walletAddress }: UseForumOptions) {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchThreads = useCallback(
    async (category?: string) => {
      setLoading(true);
      try {
        const url = `/api/miniapps/${appId}/forum/threads${category ? `?category=${category}` : ""}`;
        const res = await fetch(url);
        if (res.ok) {
          const data = await res.json();
          setThreads(data.threads);
          setHasMore(data.hasMore);
        }
      } catch {
        // Silent fail
      } finally {
        setLoading(false);
      }
    },
    [appId],
  );

  const createThread = useCallback(
    async (title: string, content: string, category: string): Promise<ForumThread | null> => {
      if (!walletAddress) return null;
      try {
        const res = await fetch(`/api/miniapps/${appId}/forum/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, title, content, category }),
        });
        if (res.ok) {
          const data = await res.json();
          setThreads((prev) => [data.thread, ...prev]);
          return data.thread;
        }
      } catch {
        // Silent fail
      }
      return null;
    },
    [appId, walletAddress],
  );

  const fetchReplies = useCallback(
    async (threadId: string): Promise<ForumReply[]> => {
      try {
        const res = await fetch(`/api/miniapps/${appId}/forum/${threadId}/replies`);
        if (res.ok) {
          const data = await res.json();
          return data.replies;
        }
      } catch {
        // Silent fail
      }
      return [];
    },
    [appId],
  );

  const createReply = useCallback(
    async (threadId: string, content: string): Promise<ForumReply | null> => {
      if (!walletAddress) return null;
      try {
        const res = await fetch(`/api/miniapps/${appId}/forum/${threadId}/replies`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, content }),
        });
        if (res.ok) {
          const data = await res.json();
          return data.reply;
        }
      } catch {
        // Silent fail
      }
      return null;
    },
    [appId, walletAddress],
  );

  return { threads, loading, hasMore, fetchThreads, createThread, fetchReplies, createReply };
}
