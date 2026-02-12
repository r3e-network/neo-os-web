import React, { useState } from "react";
import type { SocialComment, VoteType } from "./types";
import CommentItem from "./SocialCommentItem";
import { MessageSquare, AlertCircle } from "lucide-react";

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
    <div className="bg-white/80 dark:bg-white/5 backdrop-blur-md border border-erobo-purple/10 dark:border-white/10 shadow-sm rounded-2xl overflow-hidden">
      <div className="p-4 border-b border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5/50 dark:bg-white/5 flex items-center gap-2">
        <MessageSquare size={18} className="text-erobo-ink-soft" />
        <h3 className="text-sm font-bold text-erobo-ink dark:text-white uppercase tracking-wide">Consensus Feed ({comments.length})</h3>
      </div>

      {/* Error Display */}
      {displayError && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border-b border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium flex items-center gap-2">
              <AlertCircle size={16} />
              {displayError}
            </span>
            <button
              onClick={() => {
                setLocalError(null);
                onClearError?.();
              }}
              className="text-xs font-bold hover:underline"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* New Comment Form */}
      {canComment && (
        <div className="p-6 border-b border-erobo-purple/10 dark:border-white/10 bg-white dark:bg-transparent">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Share your perspective with the network..."
            className="w-full p-4 bg-erobo-purple/5 dark:bg-black/20 text-erobo-ink dark:text-white border border-erobo-purple/10 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-neo/20 focus:border-neo outline-none transition-all placeholder-erobo-ink-soft/50 min-h-[100px]"
            rows={3}
            maxLength={2000}
          />
          <div className="flex justify-end mt-3">
            <button
              onClick={handleSubmit}
              disabled={submitting || !newComment.trim()}
              className="px-6 py-2 bg-neo text-black font-bold text-sm rounded-lg hover:bg-neo-dark disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
            >
              {submitting ? "Posting..." : "Post Comment"}
            </button>
          </div>
        </div>
      )}

      {!canComment && (
        <div className="p-6 border-b border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5 dark:bg-white/5 text-erobo-ink-soft dark:text-slate-400 font-medium text-center text-sm">
          Please connect your wallet to join the conversation.
        </div>
      )}

      {/* Comments List */}
      <div className="divide-y divide-erobo-purple/5 dark:divide-white/5">
        {comments.map((comment) => (
          <div key={comment.id} className="px-6 py-2">
            <CommentItem comment={comment} onVote={onVote} onReply={onReply} onLoadReplies={onLoadReplies} />
          </div>
        ))}
      </div>

      {/* Load More */}
      {hasMore && (
        <div className="p-4 text-center border-t border-erobo-purple/10 dark:border-white/10 bg-erobo-purple/5/50 dark:bg-white/5">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="text-xs font-bold uppercase tracking-wider text-erobo-ink-soft hover:text-neo transition-colors"
          >
            {loading ? "Loading..." : "Load Older Comments"}
          </button>
        </div>
      )}

      {comments.length === 0 && (
        <div className="p-12 text-center text-sm text-erobo-ink-soft/60 dark:text-slate-500 font-medium">
          No comments yet. Be the first to share your thoughts.
        </div>
      )}
    </div>
  );
};

export default SocialCommentThread;
