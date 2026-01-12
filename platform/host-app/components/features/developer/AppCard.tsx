/**
 * Developer App Card - Display app info with status badge
 */

import Link from "next/link";
import { Package, Clock, CheckCircle, AlertCircle, Eye, EyeOff } from "lucide-react";

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

const statusConfig: Record<string, { color: string; icon: typeof Clock; label: string }> = {
  draft: { color: "bg-gray-500", icon: Clock, label: "Draft" },
  pending_review: { color: "bg-yellow-500", icon: Clock, label: "In Review" },
  approved: { color: "bg-blue-500", icon: CheckCircle, label: "Approved" },
  published: { color: "bg-green-500", icon: CheckCircle, label: "Published" },
  suspended: { color: "bg-red-500", icon: AlertCircle, label: "Suspended" },
};

export function AppCard({ app }: AppCardProps) {
  const status = statusConfig[app.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <Link href={`/developer/apps/${app.app_id}`}>
      <div className="group rounded-2xl p-6 bg-white dark:bg-[#080808]/80 border border-gray-200 dark:border-white/10 hover:border-neo/40 hover:shadow-lg transition-all cursor-pointer">
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
              <h3 className="font-bold text-gray-900 dark:text-white truncate">{app.name}</h3>
              <span className={`px-2 py-0.5 rounded-full text-xs text-white ${status.color} flex items-center gap-1`}>
                <StatusIcon size={12} />
                {status.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{app.description}</p>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="capitalize">{app.category}</span>
              <span>•</span>
              {app.visibility === "public" ? (
                <span className="flex items-center gap-1">
                  <Eye size={12} /> Public
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <EyeOff size={12} /> Private
                </span>
              )}
              <span>•</span>
              <span>Updated {new Date(app.updated_at).toLocaleDateString()}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
