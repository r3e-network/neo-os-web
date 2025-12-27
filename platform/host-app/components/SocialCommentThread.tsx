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
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b">
        <h3 className="font-semibold">Comments ({comments.length})</h3>
      </div>

      {/* Error Display */}
      {displayError && (
        <div className="p-4 bg-red-50 border-b border-red-200">
          <div className="flex items-center justify-between">
            <span className="text-red-700 text-sm">{displayError}</span>
            <button
              onClick={() => {
                setLocalError(null);
                onClearError?.();
              }}
              className="text-red-500 hover:text-red-700 text-sm"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* New Comment Form */}
      {canComment && (
        <div className="p-4 border-b">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment..."
            className="w-full border rounded p-3"
            rows={3}
            maxLength={2000}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="mt-2 px-4 py-2 bg-blue-600 text-white rounded"
          >
            {submitting ? "Posting..." : "Post Comment"}
          </button>
        </div>
      )}

      {!canComment && <div className="p-4 border-b text-gray-500 text-sm">Use this app to leave comments</div>}

      {/* Comments List */}
      <div className="divide-y">
        {comments.map((comment) => (
          <div key={comment.id} className="px-4">
            <CommentItem comment={comment} onVote={onVote} onReply={onReply} onLoadReplies={onLoadReplies} />
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="p-4 text-center">
          <button onClick={onLoadMore} disabled={loading} className="text-blue-600">
            {loading ? "Loading..." : "Load more comments"}
          </button>
        </div>
      )}

      {comments.length === 0 && <div className="p-8 text-center text-gray-500">No comments yet</div>}
    </div>
  );
};

export default SocialCommentThread;
