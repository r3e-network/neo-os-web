import { useState, useCallback, useMemo } from "react";
import type { SocialComment, SocialRating, ProofOfInteraction, VoteType } from "../components/types";
import { fetchJSON, fetchOK, toApiError, type ApiError } from "@/lib/fetch-client";

const API_BASE = (process.env.NEXT_PUBLIC_SUPABASE_URL || "") + "/functions/v1";

interface UseCommunityOptions {
  appId: string;
  token?: string;
}

type CommunityError = ApiError;

export function useCommunity({ appId, token }: UseCommunityOptions) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [rating, setRating] = useState<SocialRating | null>(null);
  const [proof, setProof] = useState<ProofOfInteraction | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<CommunityError | null>(null);
  const [hasMore, setHasMore] = useState(false);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }, [token]);

  // Fetch comments with error handling
  const fetchComments = useCallback(
    async (offset = 0) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchJSON<{ comments?: SocialComment[]; has_more?: boolean }>(
          `${API_BASE}/social-comments?app_id=${encodeURIComponent(appId)}&limit=20&offset=${offset}&parent_id=null`,
          { headers },
        );
        if (offset === 0) {
          setComments(data.comments || []);
        } else {
          setComments((prev) => [...prev, ...(data.comments || [])]);
        }
        setHasMore(data.has_more || false);
      } catch (err) {
        setError(toApiError(err));
      } finally {
        setLoading(false);
      }
    },
    [appId, headers],
  );

  // Fetch rating with error handling
  const fetchRating = useCallback(async () => {
    setError(null);
    try {
      const data = await fetchJSON<SocialRating>(`${API_BASE}/social-ratings?app_id=${encodeURIComponent(appId)}`, { headers });
      setRating(data);
    } catch (err) {
      setError(toApiError(err));
    }
  }, [appId, headers]);

  // Verify proof with error handling
  const verifyProof = useCallback(async () => {
    if (!token) return;
    setError(null);
    try {
      const data = await fetchJSON<ProofOfInteraction>(`${API_BASE}/social-proof-verify`, {
        method: "POST",
        headers,
        body: JSON.stringify({ app_id: appId }),
      });
      setProof(data);
    } catch (err) {
      setError(toApiError(err));
    }
  }, [appId, token, headers]);

  // Create comment
  const createComment = useCallback(
    async (content: string, parentId?: string): Promise<boolean> => {
      if (!token) {
        setError({ message: "Authentication required", code: "AUTH_REQUIRED" });
        return false;
      }
      setSubmitting(true);
      setError(null);
      try {
        const data = await fetchJSON<{ comment?: SocialComment }>(`${API_BASE}/social-comment-create`, {
          method: "POST",
          headers,
          body: JSON.stringify({ app_id: appId, content, parent_id: parentId }),
        });
        const createdComment = data.comment;
        if (!parentId && createdComment) {
          setComments((prev) => [createdComment, ...prev]);
        }
        return true;
      } catch (err) {
        setError(toApiError(err));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [appId, token, headers],
  );

  // Vote on comment
  const voteComment = useCallback(
    async (commentId: string, voteType: VoteType): Promise<boolean> => {
      if (!token) {
        setError({ message: "Authentication required", code: "AUTH_REQUIRED" });
        return false;
      }
      setError(null);
      try {
        const data = await fetchJSON<{ upvotes: number; downvotes: number }>(`${API_BASE}/social-comment-vote`, {
          method: "POST",
          headers,
          body: JSON.stringify({ comment_id: commentId, vote_type: voteType }),
        });
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, upvotes: data.upvotes, downvotes: data.downvotes } : c)),
        );
        return true;
      } catch (err) {
        setError(toApiError(err));
        return false;
      }
    },
    [token, headers],
  );

  // Submit rating
  const submitRating = useCallback(
    async (value: number, reviewText?: string): Promise<boolean> => {
      if (!token) {
        setError({ message: "Authentication required", code: "AUTH_REQUIRED" });
        return false;
      }
      setSubmitting(true);
      setError(null);
      try {
        await fetchOK(`${API_BASE}/social-rating-submit`, {
          method: "POST",
          headers,
          body: JSON.stringify({ app_id: appId, rating_value: value, review_text: reviewText }),
        });
        await fetchRating();
        return true;
      } catch (err) {
        setError(toApiError(err));
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [appId, token, headers, fetchRating],
  );

  // Load replies for a comment
  const loadReplies = useCallback(
    async (parentId: string): Promise<SocialComment[]> => {
      setError(null);
      try {
        const data = await fetchJSON<{ comments?: SocialComment[] }>(
          `${API_BASE}/social-comments?app_id=${encodeURIComponent(appId)}&parent_id=${encodeURIComponent(parentId)}&limit=50`,
          { headers },
        );
        return data.comments || [];
      } catch (err) {
        setError(toApiError(err));
        return [];
      }
    },
    [appId, headers],
  );

  // Delete comment
  const deleteComment = useCallback(
    async (commentId: string): Promise<boolean> => {
      if (!token) {
        setError({ message: "Authentication required", code: "AUTH_REQUIRED" });
        return false;
      }
      setError(null);
      try {
        await fetchOK(`${API_BASE}/social-comment-delete`, {
          method: "POST",
          headers,
          body: JSON.stringify({ comment_id: commentId }),
        });
        setComments((prev) => prev.filter((c) => c.id !== commentId));
        return true;
      } catch (err) {
        setError(toApiError(err));
        return false;
      }
    },
    [token, headers],
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    comments,
    rating,
    proof,
    loading,
    submitting,
    error,
    hasMore,
    fetchComments,
    fetchRating,
    verifyProof,
    createComment,
    voteComment,
    submitRating,
    loadReplies,
    deleteComment,
    clearError,
    setComments,
  };
}
