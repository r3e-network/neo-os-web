import React, { useState } from "react";
import type { SocialComment, VoteType } from "./types";

interface CommentItemProps {
  comment: SocialComment;
  onVote: (commentId: string, voteType: VoteType) => Promise<boolean | void>;
  onReply: (parentId: string, content: string) => Promise<boolean | void>;
  onLoadReplies?: (parentId: string) => Promise<SocialComment[]>;
  depth?: number;
}

const CommentItem: React.FC<CommentItemProps> = ({ comment, onVote, onReply, onLoadReplies, depth = 0 }) => {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState("");
  const [replies, setReplies] = useState<SocialComment[]>([]);
  const [loadingReplies, setLoadingReplies] = useState(false);

  const handleLoadReplies = async () => {
    if (!onLoadReplies || loadingReplies) return;
    setLoadingReplies(true);
    const data = await onLoadReplies(comment.id);
    setReplies(data);
    setLoadingReplies(false);
  };

  const handleSubmitReply = async () => {
    if (!replyContent.trim()) return;
    await onReply(comment.id, replyContent);
    setReplyContent("");
    setShowReplyForm(false);
    if (onLoadReplies) handleLoadReplies();
  };

  const maxDepth = 3;

  return (
    <div className={`${depth > 0 ? "ml-6 border-l-2 border-gray-200 dark:border-gray-700 pl-4" : ""}`}>
      <div className="py-3">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1">
          {comment.is_developer_reply && (
            <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs rounded">
              Developer
            </span>
          )}
          <span className="text-sm text-gray-500 dark:text-gray-400">{new Date(comment.created_at).toLocaleDateString()}</span>
        </div>

        {/* Content */}
        <p className="text-gray-800 dark:text-gray-200 mb-2">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-4 text-sm">
          <button
            type="button"
            onClick={() => onVote(comment.id, "upvote")}
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400 transition-colors"
          >
            ▲ {comment.upvotes}
          </button>
          <button
            type="button"
            onClick={() => onVote(comment.id, "downvote")}
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          >
            ▼ {comment.downvotes}
          </button>
          {depth < maxDepth && (
            <button
              type="button"
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-gray-500 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
            >
              Reply
            </button>
          )}
          {comment.reply_count > 0 && replies.length === 0 && (
            <button type="button" onClick={handleLoadReplies} className="text-emerald-600 dark:text-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed" disabled={loadingReplies}>
              {loadingReplies ? "Loading..." : `${comment.reply_count} replies`}
            </button>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {showReplyForm && (
        <div className="ml-6 mb-3">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            className="w-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded p-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            rows={2}
            maxLength={2000}
          />
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={handleSubmitReply} className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-sm transition-colors">
              Submit
            </button>
            <button
              type="button"
              onClick={() => setShowReplyForm(false)}
              className="px-3 py-1 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Nested Replies */}
      {replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          onVote={onVote}
          onReply={onReply}
          onLoadReplies={onLoadReplies}
          depth={depth + 1}
        />
      ))}
    </div>
  );
};

export default CommentItem;
