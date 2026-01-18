"use client";

import React, { useEffect, useState } from "react";
import { MessageSquare, Plus, Pin, Lock, Bug, Lightbulb, HelpCircle } from "lucide-react";
import { useForum } from "./useForum";
import { useWalletStore } from "@/lib/wallet/store";
import { useTranslation } from "@/lib/i18n/react";
import { formatTimeAgoShort } from "@/lib/utils";
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
  general: "bg-gray-100 text-gray-700",
  bug: "bg-red-100 text-red-700",
  feature: "bg-purple-100 text-purple-700",
  help: "bg-blue-100 text-blue-700",
};

export function ForumTab({ appId }: ForumTabProps) {
  const { address: walletAddress } = useWalletStore();
  const { threads, loading, fetchThreads, createThread } = useForum({ appId, walletAddress });
  const [showNewThread, setShowNewThread] = useState(false);
  const [selectedThread, setSelectedThread] = useState<ForumThread | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const { t } = useTranslation("host");
  const { t: tCommon } = useTranslation("common");

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
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{t("forum.title")}</h3>
        {walletAddress && (
          <button
            onClick={() => setShowNewThread(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 text-white rounded-lg text-sm hover:bg-emerald-600"
          >
            <Plus size={16} />
            {t("forum.newThread")}
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {["all", "general", "bug", "feature", "help"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`px-3 py-1 text-xs rounded-full capitalize ${
              filter === cat
                ? "bg-emerald-500 text-white"
                : "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400"
            }`}
          >
            {t(`forum.filters.${cat}`)}
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
          <div className="text-center py-8 text-gray-500">{tCommon("actions.loading")}</div>
        ) : threads.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-50" />
            <p>{t("forum.empty")}</p>
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

function ThreadItem({ thread, onClick }: { thread: ForumThread; onClick: () => void }) {
  const Icon = categoryIcons[thread.category] || MessageSquare;
  const { t } = useTranslation("host");
  const { t: tCommon, locale } = useTranslation("common");

  return (
    <div
      onClick={onClick}
      className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-emerald-500 cursor-pointer transition-colors"
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${categoryColors[thread.category]}`}>
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {thread.is_pinned && <Pin size={12} className="text-amber-500" />}
            {thread.is_locked && <Lock size={12} className="text-gray-400" />}
            <h4 className="font-medium text-gray-900 dark:text-white truncate">{thread.title}</h4>
          </div>
          <p className="text-sm text-gray-500 truncate mt-1">{thread.content}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-400">
            <span>{thread.author_name}</span>
            <span>{t("forum.repliesCount", { count: thread.reply_count })}</span>
            <span>{formatTimeAgoShort(thread.created_at, { t: tCommon, locale })}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  const { t } = useTranslation("host");
  const { t: tCommon } = useTranslation("common");

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
        placeholder={t("forum.threadTitlePlaceholder")}
        className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        maxLength={200}
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={t("forum.threadBodyPlaceholder")}
        className="w-full px-3 py-2 mb-3 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
        rows={4}
        maxLength={5000}
      />
      <div className="flex items-center justify-between">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
        >
          <option value="general">{t("forum.filters.general")}</option>
          <option value="bug">{t("forum.filters.bug")}</option>
          <option value="feature">{t("forum.filters.feature")}</option>
          <option value="help">{t("forum.filters.help")}</option>
        </select>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400">
            {tCommon("actions.cancel")}
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="px-4 py-1.5 bg-emerald-500 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {submitting ? t("forum.posting") : t("forum.post")}
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
  const { t } = useTranslation("host");
  const { t: tCommon, locale } = useTranslation("common");

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
      <button onClick={onBack} className="text-sm text-emerald-500 hover:underline">
        ← {t("forum.backToDiscussions")}
      </button>

      <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{thread.title}</h2>
        <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
          <span>{thread.author_name}</span>
          <span>•</span>
          <span>{formatTimeAgoShort(thread.created_at, { t: tCommon, locale })}</span>
        </div>
        <p className="mt-4 text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{thread.content}</p>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-medium text-gray-500">{t("forum.repliesTitle", { count: replies.length })}</h3>
        {replies.map((reply) => (
          <div key={reply.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
              <span className="font-medium text-gray-700 dark:text-gray-300">{reply.author_name}</span>
              <span>•</span>
              <span>{formatTimeAgoShort(reply.created_at, { t: tCommon, locale })}</span>
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
            placeholder={t("forum.writeReplyPlaceholder")}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 text-sm"
            maxLength={2000}
          />
          <button
            onClick={handleReply}
            disabled={submitting || !replyContent.trim()}
            className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {t("forum.reply")}
          </button>
        </div>
      )}
    </div>
  );
}
