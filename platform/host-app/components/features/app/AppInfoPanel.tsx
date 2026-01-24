"use client";

import React, { useState } from "react";
import { MiniAppInfo, MiniAppStats, MiniAppNotification } from "../../types";
import { ReviewsTab } from "../reviews";
import { ForumTab } from "../forum";
import { useI18n, useTranslation } from "@/lib/i18n/react";
import { MiniAppLogo } from "../miniapp/MiniAppLogo";
import { Badge } from "@/components/ui/badge";
import { getLocalizedField } from "@neo/shared/i18n";

interface AppInfoPanelProps {
  app: MiniAppInfo;
  stats?: MiniAppStats | null;
  notifications?: MiniAppNotification[];
  walletConnected?: boolean;
  walletAddress?: string;
}

type TabType = "overview" | "reviews" | "forum" | "news";

function isImageUrl(value?: string | null): boolean {
  if (!value) return false;
  return value.startsWith("/") || value.startsWith("http") || value.endsWith(".png") || value.endsWith(".svg");
}

export function AppInfoPanel({
  app,
  stats,
  notifications = [],
  walletConnected = false,
  walletAddress = "",
}: AppInfoPanelProps) {
  const { locale } = useI18n();
  const { t } = useTranslation("host");
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const appName = getLocalizedField(app, "name", locale);
  const appDescription = getLocalizedField(app, "description", locale);

  let statusKey: "active" | "inactive" | "online" | "maintenance" | "pending" = stats?.last_activity_at
    ? "active"
    : "inactive";
  if (app.status === "active") {
    statusKey = "online";
  } else if (app.status === "disabled") {
    statusKey = "maintenance";
  } else if (app.status === "pending") {
    statusKey = "pending";
  }
  const statusLabel = t(`detail.status.${statusKey}`);
  const hasBanner = isImageUrl(app.banner);

  const tabs: { id: TabType; label: string; icon?: string }[] = [
    { id: "overview", label: t("detail.overview") || "Overview" },
    { id: "reviews", label: t("detail.reviews") || "Reviews", icon: "⭐" },
    { id: "forum", label: t("detail.forum") || "Forum", icon: "💬" },
    { id: "news", label: `${t("detail.news") || "News"} (${notifications.length})` },
  ];

  return (
    <div className="flex flex-col h-full text-foreground">
      {/* Header */}
      <header className="border-b border-border">
        {hasBanner && (
          <div className="relative w-full h-32 overflow-hidden">
            <img src={app.banner} alt={`${appName} banner`} className="w-full h-full object-cover" loading="lazy" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
          </div>
        )}

        <div className={`px-4 pb-4 relative ${hasBanner ? "-mt-8" : "pt-4"}`}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md border border-border bg-background">
              {isImageUrl(app.icon) ? (
                <MiniAppLogo
                  appId={app.app_id}
                  category={app.category}
                  size="md"
                  iconUrl={app.icon}
                  className="w-full h-full rounded-xl"
                />
              ) : (
                <span className="text-3xl">{app.icon}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold truncate">{appName}</h1>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider border ${statusKey === "online"
                ? "bg-neo/10 text-neo border-neo/30"
                : statusKey === "maintenance"
                  ? "bg-orange-100 text-orange-700 border-orange-200"
                  : "bg-muted/40 text-muted-foreground border-border"
                }`}
            >
              {statusLabel}
            </span>
          </div>

          {appDescription && (
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">{appDescription}</p>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <Badge
              variant="secondary"
              className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-neo/10 text-neo border border-neo/30"
            >
              {app.category}
            </Badge>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-3">
            <span className={`w-2 h-2 rounded-full ${walletConnected ? "bg-emerald-500" : "bg-red-500"}`} />
            <span>{walletConnected ? `${walletAddress.slice(0, 8)}...` : t("notConnected")}</span>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <nav className="flex border-b border-border px-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
              ? "border-neo text-neo"
              : "border-transparent text-muted-foreground hover:text-foreground"
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
      <div className="bg-muted/40 rounded-lg p-3">
        <h3 className="text-sm font-semibold mb-2">{t("detail.permissions") || "Permissions"}</h3>
        <div className="flex flex-wrap gap-2">
          {Object.entries(app.permissions || {}).map(([key, value]) =>
            value ? (
              <span key={key} className="text-xs px-2 py-1 bg-neo/10 text-neo rounded">
                ✓ {key}
              </span>
            ) : null,
          )}
        </div>
      </div>

      {/* App ID */}
      <div className="text-xs text-muted-foreground">
        <span>App ID: </span>
        <code className="bg-muted px-1 rounded">{app.app_id}</code>
      </div>
    </div>
  );
}

// Stat card component
function StatCard({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

// News tab content
function NewsContent({ notifications }: { notifications: MiniAppNotification[] }) {
  const { t } = useTranslation("host");
  if (notifications.length === 0) {
    return <p className="text-muted-foreground text-center py-8">{t("detail.noNews")}</p>;
  }

  return (
    <div className="space-y-3">
      {notifications.map((n, i) => (
        <div key={i} className="bg-muted/40 rounded-lg p-3">
          <h4 className="font-medium text-sm">{n.title}</h4>
          <p className="text-muted-foreground text-xs mt-1">{n.content}</p>
        </div>
      ))}
    </div>
  );
}
