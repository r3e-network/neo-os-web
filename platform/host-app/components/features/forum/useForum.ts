"use client";

import { useState, useCallback } from "react";
import type { ForumThread, ForumReply } from "./types";
import { logger } from "@/lib/logger";
import { fetchJSON } from "@/lib/fetch-client";

interface UseForumOptions {
  appId: string;
  walletAddress?: string;
}

type ThreadsResponse = {
  threads?: ForumThread[];
  hasMore?: boolean;
};

type ThreadResponse = {
  thread?: ForumThread;
};

type RepliesResponse = {
  replies?: ForumReply[];
};

type ReplyResponse = {
  reply?: ForumReply;
};

export function useForum({ appId, walletAddress }: UseForumOptions) {
  const [threads, setThreads] = useState<ForumThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const fetchThreads = useCallback(
    async (category?: string) => {
      setLoading(true);
      try {
        const url = `/api/miniapps/${encodeURIComponent(appId)}/forum/threads${category ? `?category=${encodeURIComponent(category)}` : ""}`;
        const data = await fetchJSON<ThreadsResponse>(url);
        setThreads(data.threads || []);
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        logger.warn("Failed to fetch forum threads:", err);
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
        const data = await fetchJSON<ThreadResponse>(`/api/miniapps/${encodeURIComponent(appId)}/forum/threads`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, title, content, category }),
        });
        if (data.thread) {
          const thread = data.thread;
          setThreads((prev) => [thread, ...prev]);
          return thread;
        }
      } catch (err) {
        logger.warn("Failed to create forum thread:", err);
      }
      return null;
    },
    [appId, walletAddress],
  );

  const fetchReplies = useCallback(
    async (threadId: string): Promise<ForumReply[]> => {
      try {
        const data = await fetchJSON<RepliesResponse>(
          `/api/miniapps/${encodeURIComponent(appId)}/forum/${encodeURIComponent(threadId)}/replies`,
        );
        return data.replies || [];
      } catch (err) {
        logger.warn("Failed to fetch forum replies:", err);
      }
      return [];
    },
    [appId],
  );

  const createReply = useCallback(
    async (threadId: string, content: string): Promise<ForumReply | null> => {
      if (!walletAddress) return null;
      try {
        const data = await fetchJSON<ReplyResponse>(
          `/api/miniapps/${encodeURIComponent(appId)}/forum/${encodeURIComponent(threadId)}/replies`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ wallet: walletAddress, content }),
          },
        );
        return data.reply || null;
      } catch (err) {
        logger.warn("Failed to create forum reply:", err);
      }
      return null;
    },
    [appId, walletAddress],
  );

  return { threads, loading, hasMore, fetchThreads, createThread, fetchReplies, createReply };
}
