"use client";

import { useState, useCallback } from "react";
import type { SocialRating, SocialComment, VoteType } from "@/components/types";
import { logger } from "@/lib/logger";
import { fetchJSON, fetchOK, toApiError } from "@/lib/fetch-client";

interface UseReviewsOptions {
  appId: string;
  walletAddress?: string;
}

export function useReviews({ appId, walletAddress }: UseReviewsOptions) {
  const [rating, setRating] = useState<SocialRating | null>(null);
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const fetchRating = useCallback(async () => {
    try {
      const url = `/api/miniapps/${encodeURIComponent(appId)}/reviews/ratings${walletAddress ? `?wallet=${encodeURIComponent(walletAddress)}` : ""}`;
      const data = await fetchJSON<{ rating?: SocialRating }>(url);
      setRating(data.rating ?? null);
    } catch (err) {
      logger.warn("Failed to fetch rating:", err);
    }
  }, [appId, walletAddress]);

  const fetchComments = useCallback(
    async (offset = 0) => {
      setLoading(true);
      try {
        const data = await fetchJSON<{ comments?: SocialComment[]; hasMore?: boolean }>(
          `/api/miniapps/${encodeURIComponent(appId)}/reviews/comments?limit=20&offset=${offset}`,
        );
        if (offset === 0) {
          setComments(data.comments || []);
        } else {
          setComments((prev) => [...prev, ...(data.comments || [])]);
        }
        setHasMore(Boolean(data.hasMore));
      } catch (err) {
        setError(toApiError(err).message);
      } finally {
        setLoading(false);
      }
    },
    [appId],
  );

  const submitRating = useCallback(
    async (value: number, review?: string): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        await fetchOK(`/api/miniapps/${encodeURIComponent(appId)}/reviews/ratings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, value, review }),
        });
        await fetchRating();
        return true;
      } catch (err) {
        setError(toApiError(err).message);
      }
      return false;
    },
    [appId, walletAddress, fetchRating],
  );

  const createComment = useCallback(
    async (content: string): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        await fetchOK(`/api/miniapps/${encodeURIComponent(appId)}/reviews/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, content }),
        });
        await fetchComments(0);
        return true;
      } catch (err) {
        setError(toApiError(err).message);
      }
      return false;
    },
    [appId, walletAddress, fetchComments],
  );

  const voteComment = useCallback(
    async (commentId: string, voteType: VoteType): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        await fetchOK(`/api/miniapps/${encodeURIComponent(appId)}/reviews/${encodeURIComponent(commentId)}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, vote_type: voteType }),
        });
        return true;
      } catch {
        return false;
      }
    },
    [appId, walletAddress],
  );

  const replyComment = useCallback(
    async (parentId: string, content: string): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        await fetchOK(`/api/miniapps/${encodeURIComponent(appId)}/reviews/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, content, parent_id: parentId }),
        });
        return true;
      } catch {
        return false;
      }
    },
    [appId, walletAddress],
  );

  const loadReplies = useCallback(
    async (parentId: string): Promise<SocialComment[]> => {
      try {
        const data = await fetchJSON<{ comments?: SocialComment[] }>(
          `/api/miniapps/${encodeURIComponent(appId)}/reviews/comments?parent_id=${encodeURIComponent(parentId)}`,
        );
        return data.comments || [];
      } catch (err) {
        logger.warn("Failed to load replies:", err);
      }
      return [];
    },
    [appId],
  );

  const loadMore = useCallback(async () => {
    await fetchComments(comments.length);
  }, [fetchComments, comments.length]);

  const clearError = useCallback(() => setError(null), []);

  return {
    rating,
    comments,
    loading,
    error,
    hasMore,
    fetchRating,
    fetchComments,
    submitRating,
    createComment,
    voteComment,
    replyComment,
    loadReplies,
    loadMore,
    clearError,
  };
}
