"use client";

import React, { useEffect } from "react";
import { SocialRatingWidget } from "@/components/SocialRatingWidget";
import { SocialCommentThread } from "@/components/SocialCommentThread";
import { useReviews } from "@/hooks/useReviews";
import { useWalletStore } from "@/lib/wallet/store";

interface ReviewsTabProps {
  appId: string;
}

export function ReviewsTab({ appId }: ReviewsTabProps) {
  const { address: walletAddress } = useWalletStore();
  const {
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
  } = useReviews({ appId, walletAddress });

  useEffect(() => {
    fetchRating();
    fetchComments(0);
  }, [fetchRating, fetchComments]);

  const canInteract = Boolean(walletAddress);

  // Default rating if none exists
  const displayRating = rating || {
    app_id: appId,
    avg_rating: 0,
    weighted_score: 0,
    total_ratings: 0,
    distribution: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 },
  };

  return (
    <div className="space-y-6">
      {/* Rating Widget */}
      <SocialRatingWidget
        rating={displayRating}
        onSubmit={submitRating}
        canRate={canInteract}
        loading={loading}
        error={error ? { message: error } : null}
        onClearError={clearError}
      />

      {/* Comments Thread */}
      <SocialCommentThread
        appId={appId}
        comments={comments}
        canComment={canInteract}
        onCreateComment={createComment}
        onVote={voteComment}
        onReply={replyComment}
        onLoadReplies={loadReplies}
        onLoadMore={loadMore}
        hasMore={hasMore}
        loading={loading}
        error={error ? { message: error } : null}
        onClearError={clearError}
      />
    </div>
  );
}

export default ReviewsTab;
