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
    <div className={`${depth > 0 ? "ml-6 border-l-4 border-black dark:border-white pl-6 my-2" : ""}`}>
      <div className="py-4 border-b-2 border-black/10 dark:border-white/10 group">
        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          {comment.is_developer_reply && (
            <span className="px-2 py-0.5 bg-neo text-black text-[10px] font-black uppercase border border-black shadow-brutal-xs rotate-[-2deg]">
              Core Dev
            </span>
          )}
          <span className="text-[10px] font-black uppercase opacity-40 tracking-widest">
            {new Date(comment.created_at).toLocaleDateString()}
          </span>
        </div>

        {/* Content */}
        <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-3 leading-relaxed">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-6">
          <button
            onClick={() => onVote(comment.id, "upvote")}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase text-gray-500 hover:text-neo transition-colors"
          >
            <span className="bg-black text-white px-1 border border-black group-hover:bg-neo group-hover:text-black">▲</span> {comment.upvotes}
          </button>
          <button
            onClick={() => onVote(comment.id, "downvote")}
            className="flex items-center gap-1.5 text-[11px] font-black uppercase text-gray-500 hover:text-brutal-red transition-colors"
          >
            <span className="bg-black text-white px-1 border border-black group-hover:bg-brutal-red group-hover:text-black">▼</span> {comment.downvotes}
          </button>
          {depth < maxDepth && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="text-[11px] font-black uppercase text-gray-500 hover:text-black dark:hover:text-white underline decoration-2 underline-offset-4"
            >
              Reply
            </button>
          )}
          {comment.reply_count > 0 && replies.length === 0 && (
            <button
              onClick={handleLoadReplies}
              className="text-[11px] font-black uppercase text-neo bg-black px-2 py-0.5 border border-black hover:bg-neo hover:text-black transition-all"
              disabled={loadingReplies}
            >
              {loadingReplies ? "Connecting..." : `${comment.reply_count} Nested Threads`}
            </button>
          )}
        </div>
      </div>

      {/* Reply Form */}
      {showReplyForm && (
        <div className="mt-4 mb-6 p-4 bg-brutal-yellow/10 border-4 border-black dark:border-white shadow-brutal-sm rotate-1">
          <textarea
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Contribute to the consensus..."
            className="w-full border-2 border-black dark:border-white p-3 text-sm font-bold bg-white dark:bg-black text-gray-900 dark:text-gray-100 placeholder:opacity-30"
            rows={2}
            maxLength={2000}
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={handleSubmitReply}
              className="px-4 py-2 bg-neo text-black border-2 border-black font-black uppercase text-xs shadow-brutal-xs hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              Broadcast
            </button>
            <button
              onClick={() => setShowReplyForm(false)}
              className="px-4 py-2 bg-white text-black border-2 border-black font-black uppercase text-xs shadow-brutal-xs hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
            >
              Abort
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
