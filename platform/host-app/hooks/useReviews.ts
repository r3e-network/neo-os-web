"use client";

import { useState, useCallback } from "react";
import type { SocialRating, SocialComment, VoteType } from "@/components/types";

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
      const url = `/api/miniapps/${appId}/reviews/ratings${walletAddress ? `?wallet=${walletAddress}` : ""}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setRating(data.rating);
      }
    } catch (err) {
      console.warn("fetchRating failed:", err);
    }
  }, [appId, walletAddress]);

  const fetchComments = useCallback(
    async (offset = 0) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/miniapps/${appId}/reviews/comments?limit=20&offset=${offset}`);
        if (res.ok) {
          const data = await res.json();
          if (offset === 0) {
            setComments(data.comments);
          } else {
            setComments((prev) => [...prev, ...data.comments]);
          }
          setHasMore(data.hasMore);
        }
      } catch {
        setError("Failed to load comments");
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
        const res = await fetch(`/api/miniapps/${appId}/reviews/ratings`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, value, review }),
        });
        if (res.ok) {
          await fetchRating();
          return true;
        }
      } catch {
        setError("Failed to submit rating");
      }
      return false;
    },
    [appId, walletAddress, fetchRating],
  );

  const createComment = useCallback(
    async (content: string): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        const res = await fetch(`/api/miniapps/${appId}/reviews/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, content }),
        });
        if (res.ok) {
          await fetchComments(0);
          return true;
        }
      } catch {
        setError("Failed to post comment");
      }
      return false;
    },
    [appId, walletAddress, fetchComments],
  );

  const voteComment = useCallback(
    async (commentId: string, voteType: VoteType): Promise<boolean> => {
      if (!walletAddress) return false;
      try {
        const res = await fetch(`/api/miniapps/${appId}/reviews/${commentId}/vote`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, vote_type: voteType }),
        });
        return res.ok;
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
        const res = await fetch(`/api/miniapps/${appId}/reviews/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallet: walletAddress, content, parent_id: parentId }),
        });
        return res.ok;
      } catch {
        return false;
      }
    },
    [appId, walletAddress],
  );

  const loadReplies = useCallback(
    async (parentId: string): Promise<SocialComment[]> => {
      try {
        const res = await fetch(`/api/miniapps/${appId}/reviews/comments?parent_id=${parentId}`);
        if (res.ok) {
          const data = await res.json();
          return data.comments;
        }
      } catch (err) {
        console.warn("fetchReplies failed:", err);
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
