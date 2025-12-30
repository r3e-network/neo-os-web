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
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Content */}
        <p className="text-gray-800 dark:text-gray-200 mb-2">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-4 text-sm">
          <button
            onClick={() => onVote(comment.id, "upvote")}
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400"
          >
            ▲ {comment.upvotes}
          </button>
          <button
            onClick={() => onVote(comment.id, "downvote")}
            className="flex items-center gap-1 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400"
          >
            ▼ {comment.downvotes}
          </button>
          {depth < maxDepth && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
            >
              Reply
            </button>
          )}
          {comment.reply_count > 0 && replies.length === 0 && (
            <button onClick={handleLoadReplies} className="text-blue-600 dark:text-blue-400" disabled={loadingReplies}>
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
            className="w-full border border-gray-300 dark:border-gray-600 rounded p-2 text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            rows={2}
            maxLength={2000}
          />
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleSubmitReply}
              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            >
              Submit
            </button>
            <button
              onClick={() => setShowReplyForm(false)}
              className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm text-gray-700 dark:text-gray-300"
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
