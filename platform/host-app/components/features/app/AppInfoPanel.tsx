"use client";

import React, { useState } from "react";
import { MiniAppInfo, MiniAppStats, MiniAppNotification } from "../../types";
import { ReviewsTab } from "../reviews";
import { ForumTab } from "../forum";
import { useTranslation } from "@/lib/i18n/react";

interface AppInfoPanelProps {
  app: MiniAppInfo;
  stats?: MiniAppStats | null;
  notifications?: MiniAppNotification[];
  walletConnected?: boolean;
  walletAddress?: string;
}

type TabType = "overview" | "reviews" | "forum" | "news";

export function AppInfoPanel({
  app,
  stats,
  notifications = [],
  walletConnected = false,
  walletAddress = "",
}: AppInfoPanelProps) {
  const { t } = useTranslation("host");
  const [activeTab, setActiveTab] = useState<TabType>("overview");

  const tabs: { id: TabType; label: string; icon?: string }[] = [
    { id: "overview", label: t("detail.overview") || "Overview" },
    { id: "reviews", label: t("detail.reviews") || "Reviews", icon: "⭐" },
    { id: "forum", label: t("detail.forum") || "Forum", icon: "💬" },
    { id: "news", label: `${t("detail.news") || "News"} (${notifications.length})` },
  ];

  return (
    <div className="flex flex-col h-full text-white">
      {/* Header */}
      <header className="p-4 border-b border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <span className="text-4xl">{app.icon}</span>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold truncate">{app.name}</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase">
              {app.category}
            </span>
          </div>
        </div>

        {/* Wallet Status */}
        <div className="flex items-center gap-2 text-sm">
          <span className={`w-2 h-2 rounded-full ${walletConnected ? "bg-emerald-500" : "bg-red-500"}`} />
          <span className="text-white/60">{walletConnected ? `${walletAddress.slice(0, 8)}...` : "Not Connected"}</span>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-white/10 px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-white/60 hover:text-white"
            }`}
          >
            {tab.icon && <span className="mr-1">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === "overview" && <OverviewContent app={app} stats={stats} t={t} />}
        {activeTab === "reviews" && <ReviewsTab appId={app.app_id} />}
        {activeTab === "forum" && <ForumTab appId={app.app_id} />}
        {activeTab === "news" && <NewsContent notifications={notifications} />}
      </div>
    </div>
  );
}

// Overview tab content
function OverviewContent({
  app,
  stats,
  t,
}: {
  app: MiniAppInfo;
  stats?: MiniAppStats | null;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-white/70 text-sm leading-relaxed">{app.description}</p>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 gap-2">
          {stats.total_transactions != null && (
            <StatCard
              icon="📊"
              label={t("detail.totalTxs") || "Transactions"}
              value={stats.total_transactions.toLocaleString()}
            />
          )}
          {stats.total_users != null && (
            <StatCard icon="👥" label={t("detail.totalUsers") || "Users"} value={stats.total_users.toLocaleString()} />
          )}
        </div>
      )}

      {/* Permissions */}
      <div className="bg-white/5 rounded-lg p-3">
        <h3 className="text-sm font-semibold mb-2">{t("detail.permissions") || "Permissions"}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(app.permissions || {}).map(([key, value]) =>
            value ? (
              <span key={key} className="text-xs px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded">
                ✓ {key}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* App ID */}
      <div className="text-xs text-white/40">
        <span>App ID: </span>
        <code className="bg-white/10 px-1 rounded">{app.app_id}</code>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-white/5 rounded-lg p-3">
      <div className="flex items-center gap-2 text-white/60 text-xs mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

// News tab content
function NewsContent({ notifications }: { notifications: MiniAppNotification[] }) {
  if (notifications.length === 0) {
    return <p className="text-white/40 text-center py-8">No news yet</p>;
  }

  return (
    <div className="space-y-3">
      {notifications.map((n, i) => (
        <div key={i} className="bg-white/5 rounded-lg p-3">
          <h4 className="font-medium text-sm">{n.title}</h4>
          <p className="text-white/60 text-xs mt-1">{n.content}</p>
        </div>
      ))}
    </div>
  );
}
