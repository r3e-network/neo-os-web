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
    <div className={`${depth > 0 ? "ml-6 pl-6 border-l border-gray-200 dark:border-white/10 my-2" : ""}`}>
      <div className="py-4 border-b border-gray-100 dark:border-white/5 group relative">
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          {comment.is_developer_reply && (
            <span className="px-2 py-0.5 bg-neo/10 text-neo text-[10px] font-bold uppercase rounded-full border border-neo/20">
              Core Dev
            </span>
          )}
          <span className="text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-gray-50 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden h-8">
            <button
              onClick={() => onVote(comment.id, "upvote")}
              className="px-2 h-full flex items-center justify-center text-gray-500 hover:text-neo hover:bg-white dark:hover:bg-white/10 transition-colors"
            >
              ▲
            </button>
            <span className="text-xs font-bold px-1 text-gray-700 dark:text-gray-300">{comment.upvotes}</span>
            <div className="w-px h-4 bg-gray-200 dark:bg-white/10 mx-1" />
            <span className="text-xs font-bold px-1 text-gray-700 dark:text-gray-300">{comment.downvotes}</span>
            <button
              onClick={() => onVote(comment.id, "downvote")}
              className="px-2 h-full flex items-center justify-center text-gray-500 hover:text-red-500 hover:bg-white dark:hover:bg-white/10 transition-colors"
            >
              ▼
            </button>
          </div>

          {depth < maxDepth && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Reply
            </button>
          )}

          {comment.reply_count > 0 && replies.length === 0 && (
            <button
              onClick={handleLoadReplies}
              className="text-xs font-bold text-neo hover:underline decoration-neo underline-offset-4 disabled:opacity-50"
              disabled={loadingReplies}
            >
              {loadingReplies ? "Loading..." : `${comment.reply_count} replies`}
            </button>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {showReplyForm && (
        <div className="mt-4 mb-6 p-4 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write your reply..."
            className="w-full p-3 text-sm bg-white dark:bg-black/20 border border-gray-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-neo/20 focus:border-neo outline-none text-gray-900 dark:text-white placeholder-gray-400 min-h-[80px]"
            maxLength={2000}
          />
          <div className="flex gap-3 mt-3 justify-end">
            <button
              onClick={() => setShowReplyForm(false)}
              className="px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitReply}
              className="px-4 py-2 bg-neo text-black font-bold text-xs rounded-lg hover:bg-neo-dark transition-colors shadow-sm"
            >
              Reply
            </button>
          </div>
        </div>
      )}

      {/* Nested Replies */}
      <div className="mt-2">
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
    </div>
  );
};

export default CommentItem;
