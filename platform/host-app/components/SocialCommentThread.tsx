import React, { useState } from "react";
import type { SocialComment, VoteType } from "./types";
import CommentItem from "./SocialCommentItem";

interface CommentThreadProps {
  appId: string;
  comments: SocialComment[];
  canComment: boolean;
  onCreateComment: (content: string) => Promise<boolean>;
  onVote: (commentId: string, voteType: VoteType) => Promise<boolean>;
  onReply: (parentId: string, content: string) => Promise<boolean>;
  onLoadReplies: (parentId: string) => Promise<SocialComment[]>;
  onLoadMore?: () => Promise<void>;
  hasMore?: boolean;
  loading?: boolean;
  error?: { message: string; code?: string } | null;
  onClearError?: () => void;
}

export const SocialCommentThread: React.FC<CommentThreadProps> = ({
  comments,
  canComment,
  onCreateComment,
  onVote,
  onReply,
  onLoadReplies,
  onLoadMore,
  hasMore = false,
  loading = false,
  error = null,
  onClearError,
}) => {
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!newComment.trim() || submitting) return;
    setSubmitting(true);
    setLocalError(null);
    const success = await onCreateComment(newComment.trim());
    if (success) {
      setNewComment("");
    } else {
      setLocalError("Failed to post comment. Please try again.");
    }
    setSubmitting(false);
  };

  const displayError = error?.message || localError;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Comments ({comments.length})</h3>
      </div>

      {/* Error Display */}
      {displayError && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border-b border-red-200 dark:border-red-800">
          <div className="flex items-center justify-between">
            <span className="text-red-600 dark:text-red-400 text-sm">{displayError}</span>
            <button
              type="button"
              onClick={() => {
                setLocalError(null);
                onClearError?.();
              }}
              className="text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50 rounded"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* New Comment Form */}
      {canComment && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            aria-label="Write a comment"
            className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white dark:placeholder-gray-400 rounded p-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
            rows={3}
            maxLength={2000}
          />
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="mt-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50"
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      )}

      {!canComment && <div className="p-4 border-b border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400 text-sm">Use this app to leave comments</div>}

      {/* Comments List */}
      {comments.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">No comments yet</div>
      ) : (
        <>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {comments.map((comment) => (
              <div key={comment.id} className="px-4">
                <CommentItem comment={comment} onVote={onVote} onReply={onReply} onLoadReplies={onLoadReplies} />
              </div>
            ))}
          </div>
          {hasMore && (
            <div className="p-4 text-center">
              <button type="button" onClick={onLoadMore} disabled={loading} className="text-emerald-600 dark:text-emerald-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:text-emerald-700 dark:hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 rounded">
                {loading ? "Loading..." : "Load more comments"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
