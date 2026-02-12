/**
 * Developer App Card - Display app info with status badge
 */

import Link from "next/link";
import { Package, Clock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "@/lib/i18n/react";

interface AppCardProps {
  app: {
    app_id: string;
    name: string;
    description: string;
    category: string;
    status: string;
    visibility: string;
    icon_url?: string;
    updated_at: string;
  };
}

const statusConfig: Record<string, { color: string; icon: typeof Clock; labelKey: string }> = {
  draft: { color: "bg-erobo-purple/50", icon: Clock, labelKey: "developer.status.draft" },
  pending_review: { color: "bg-yellow-500", icon: Clock, labelKey: "developer.status.inReview" },
  approved: { color: "bg-erobo-purple", icon: CheckCircle, labelKey: "developer.status.approved" },
  published: { color: "bg-green-500", icon: CheckCircle, labelKey: "developer.status.published" },
  suspended: { color: "bg-red-500", icon: AlertCircle, labelKey: "developer.status.suspended" },
};

export function AppCard({ app }: AppCardProps) {
  const { t, locale } = useTranslation("host");
  const status = statusConfig[app.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <Link href={`/developer/apps/${app.app_id}`}>
      <div className="group rounded-2xl p-6 bg-white dark:bg-erobo-bg-surface/80 border border-erobo-purple/10 dark:border-white/10 hover:border-neo/40 hover:shadow-lg transition-all cursor-pointer">
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-erobo-purple/20 to-erobo-pink/20 flex items-center justify-center flex-shrink-0">
            {app.icon_url ? (
              <img src={app.icon_url} alt={app.name} className="w-12 h-12 rounded-lg" />
            ) : (
              <Package className="text-erobo-purple" size={28} />
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="font-bold text-erobo-ink dark:text-white truncate">{app.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs text-white ${status.color} flex items-center gap-1`}>
                <StatusIcon size={12} />
                {t(status.labelKey)}
              </span>
            </div>
            <p className="text-sm text-erobo-ink-soft dark:text-slate-400 line-clamp-2 mb-2">{app.description}</p>
            <div className="flex items-center gap-3 text-xs text-erobo-ink-soft/60">
              <span className="capitalize">{t(`categories.${app.category}`)}</span>
              <span>•</span>
              {app.visibility === "public" ? (
                <span className="flex items-center gap-1">
                  <Eye size={12} /> {t("developer.visibility.public")}
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <EyeOff size={12} /> {t("developer.visibility.private")}
                </span>
              )}
              <span>•</span>
              <span>{t("developer.updated", { date: new Date(app.updated_at).toLocaleDateString(locale) })}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
