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
    <div className="bg-white dark:bg-black border-4 border-black dark:border-white shadow-brutal-md">
      <div className="p-4 border-b-4 border-black dark:border-white bg-neo text-black">
        <h3 className="text-lg font-black uppercase tracking-tighter italic">Consensus Feed ({comments.length})</h3>
      </div>

      {/* Error Display */}
      {displayError && (
        <div className="p-4 bg-brutal-red text-white border-b-4 border-black">
          <div className="flex items-center justify-between">
            <span className="text-sm font-black uppercase">{displayError}</span>
            <button
              onClick={() => {
                setLocalError(null);
                onClearError?.();
              }}
              className="bg-black text-white px-3 py-1 border-2 border-white text-xs font-black uppercase shadow-brutal-xs"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* New Comment Form */}
      {canComment && (
        <div className="p-6 border-b-4 border-black dark:border-white bg-gray-50 dark:bg-gray-900">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your perspective with the network..."
            className="w-full border-4 border-black dark:border-white p-4 bg-white dark:bg-black text-gray-900 dark:text-gray-100 font-bold placeholder:opacity-30 focus:shadow-brutal-sm transition-shadow"
            rows={3}
            maxLength={2000}
          />
          <button
            onClick={handleSubmit}
            disabled={submitting || !newComment.trim()}
            className="mt-4 px-6 py-3 bg-black text-white border-4 border-black font-black uppercase italic shadow-brutal-sm hover:translate-x-1 hover:translate-y-1 hover:shadow-none disabled:opacity-50 transition-all"
          >
            {submitting ? "Processing..." : "Commit Comment"}
          </button>
        </div>
      )}

      {!canComment && (
        <div className="p-6 border-b-4 border-black dark:border-white bg-brutal-yellow text-black font-black uppercase text-center text-sm shadow-inner">
          Authentication Required to Commmit Comments
        </div>
      )}

      {/* Comments List */}
      <div className="divide-y-4 divide-black dark:divide-white">
        {comments.map((comment) => (
          <div key={comment.id} className="px-6 py-4">
            <CommentItem comment={comment} onVote={onVote} onReply={onReply} onLoadReplies={onLoadReplies} />
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="p-6 text-center border-t-4 border-black dark:border-white bg-gray-100 dark:bg-gray-800">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="text-sm font-black uppercase underline decoration-4 underline-offset-8 hover:text-neo transition-colors"
          >
            {loading ? "Decrypting More Data..." : "Retrieve Earlier Threads"}
          </button>
        </div>
      )}

      {comments.length === 0 && (
        <div className="p-12 text-center text-xs font-black uppercase opacity-30 border-t-4 border-black border-dashed">
          The void is silent. Start the conversation.
        </div>
      )}
    </div>
  );
};

export default SocialCommentThread;
