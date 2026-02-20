"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Plus, Pin, Lock, Bug, Lightbulb, HelpCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useForum } from "./useForum";
import { useWalletStore } from "@/lib/wallet/store";
import type { ForumThread } from "./types";

interface ForumTabProps {
  appId: string;
}

const categoryIcons = {
  general: MessageSquare,
  bug: Bug,
  feature: Lightbulb,
  help: HelpCircle,
};

const categoryColors = {
  general: "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300",
  bug: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400",
  feature: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  help: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
};

export function ForumTab({ appId }: ForumTabProps) {
  const { address: walletAddress } = useWalletStore();
  const { threads, loading, fetchThreads, createThread } = useForum({ appId, walletAddress });
  const [showNewThread, setShowNewThread] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    fetchThreads(filter === "all" ? undefined : filter);
  }, [fetchThreads, filter]);

  if (selectedThread) {
    return (
      <ThreadDetail
        thread={selectedThread}
        appId={appId}
        walletAddress={walletAddress}
        onBack={() => setSelectedThread(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Discussions</h3>
        {walletAddress && (
          <button
            type="button"
            onClick={() => setShowNewThread(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          >
            <Plus size={16} />
            New Thread
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "general", "bug", "feature", "help"].map((cat) => (
          <button
            type="button"
            key={cat}
            onClick={() => setFilter(cat)}
            aria-pressed={filter === cat}
            className={`px-3 py-1 text-xs rounded-full capitalize transition-colors ${
              filter === cat
                ? "bg-emerald-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700"
            } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* New Thread Form */}
      {showNewThread && (
        <NewThreadForm
          onSubmit={async (title, content, category) => {
            await createThread(title, content, category);
            setShowNewThread(false);
          }}
          onCancel={() => setShowNewThread(false)}
        />
      )}

      {/* Thread List */}
      <div className="space-y-2">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="p-4 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="flex items-start gap-3">
                  <Skeleton className="h-8 w-8 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-3 w-1/3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>No discussions yet</p>
          </div>
        ) : (
          threads.map((thread) => (
            <ThreadItem key={thread.id} thread={thread} onClick={() => setSelectedThread(thread)} />
          ))
        )}
      </div>
    </div>
  );
}

const ThreadItem = React.memo(function ThreadItem({ thread, onClick }: { thread: ForumThread; onClick: () => void }) {
  const Icon = categoryIcons[thread.category] || MessageSquare;

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-500 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${categoryColors[thread.category]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {thread.is_pinned && <Pin size={12} className="text-amber-500" />}
            {thread.is_locked && <Lock size={12} className="text-gray-400" />}
            <h4 className="font-semibold text-gray-900 dark:text-white truncate">{thread.title}</h4>
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate mt-1">{thread.content}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500 dark:text-gray-400">
            <span>{thread.author_name}</span>
            <span>{thread.reply_count} replies</span>
            <span>{formatTimeAgo(thread.created_at)}</span>
          </div>
        </div>
      </div>
    </button>
  );
});

function NewThreadForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string, content: string, category: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("general");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    await onSubmit(title, content, category);
    setSubmitting(false);
  };

  return (
    <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Thread title..."
        aria-label="Thread title"
        className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white dark:placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        maxLength={200}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="What's on your mind?"
        aria-label="Thread content"
        className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white dark:placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        rows={4}
        maxLength={5000}
      />
      <div className="flex items-center justify-between">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Thread category"
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
        >
          <option value="general">General</option>
          <option value="bug">Bug Report</option>
          <option value="feature">Feature Request</option>
          <option value="help">Help</option>
        </select>
        <div className="flex gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-emerald-600 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          >
            {submitting ? "Posting..." : "Post"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ThreadDetail({
  thread,
  appId,
  walletAddress,
  onBack,
}: {
  thread: ForumThread;
  appId: string;
  walletAddress?: string;
  onBack: () => void;
}) {
  const { fetchReplies, createReply } = useForum({ appId, walletAddress });
  const [replies, setReplies] = useState<import("./types").ForumReply[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchReplies(thread.id).then(setReplies);
  }, [fetchReplies, thread.id]);

  const handleReply = async () => {
    if (!replyContent.trim()) return;
    setSubmitting(true);
    const reply = await createReply(thread.id, replyContent);
    if (reply) {
      setReplies((prev) => [...prev, reply]);
      setReplyContent("");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-emerald-500 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50 rounded"
      >
        ← Back to discussions
      </button>

      <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">{thread.title}</h2>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
          <span>{thread.author_name}</span>
          <span>•</span>
          <span>{formatTimeAgo(thread.created_at)}</span>
        </div>
        <p className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{thread.content}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400">{replies.length} Replies</h3>
        {replies.map((reply) => (
          <div key={reply.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">{reply.author_name}</span>
              <span>•</span>
              <span>{formatTimeAgo(reply.created_at)}</span>
            </div>
            <p className="text-sm text-gray-700 dark:text-gray-300">{reply.content}</p>
          </div>
        ))}
      </div>

      {walletAddress && !thread.is_locked && (
        <div className="flex gap-2">
          <input
            type="text"
            value={replyContent}
            onChange={(e) => setReplyContent(e.target.value)}
            placeholder="Write a reply..."
            aria-label="Reply"
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white dark:placeholder-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
            maxLength={2000}
          />
          <button
            type="button"
            onClick={handleReply}
            disabled={submitting || !replyContent.trim()}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors hover:bg-emerald-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neo/50"
          >
            Reply
          </button>
        </div>
      )}
    </div>
  );
}

function formatTimeAgo(date: string): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
