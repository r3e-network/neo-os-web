/**
 * Version List - Display app versions with publish actions
 */

import { useState } from "react";
import { Clock, CheckCircle, Upload, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/react";

interface Version {
  id: string;
  version: string;
  version_code: number;
  status: string;
  is_current: boolean;
  release_notes?: string;
  created_at: string;
  published_at?: string;
}

interface VersionListProps {
  appId: string;
  versions: Version[];
  onPublish: (versionId: string) => Promise<void>;
}

const statusConfig: Record<string, { color: string; labelKey: string }> = {
  draft: { color: "text-gray-500", labelKey: "developer.status.draft" },
  pending_review: { color: "text-yellow-500", labelKey: "developer.status.inReview" },
  approved: { color: "text-blue-500", labelKey: "developer.status.approved" },
  published: { color: "text-green-500", labelKey: "developer.status.published" },
  deprecated: { color: "text-red-500", labelKey: "developer.status.deprecated" },
};

export function VersionList({ versions, onPublish }: VersionListProps) {
  const { t, locale } = useTranslation("host");
  const [publishing, setPublishing] = useState<string | null>(null);

  const handlePublish = async (versionId: string) => {
    setPublishing(versionId);
    try {
      await onPublish(versionId);
    } finally {
      setPublishing(null);
    }
  };

  if (versions.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <Upload size={48} className="mx-auto mb-4 opacity-50" />
        <p>
          {t("developer.noVersionsTitle")} {t("developer.noVersionsSubtitle")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {versions.map((v) => {
        const status = statusConfig[v.status] || statusConfig.draft;
        return (
          <div
            key={v.id}
            className={`rounded-xl p-4 border ${
              v.is_current ? "bg-neo/5 border-neo/30" : "bg-white dark:bg-white/5 border-gray-200 dark:border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="font-mono font-bold text-lg text-gray-900 dark:text-white">v{v.version}</div>
                {v.is_current && (
                  <span className="px-2 py-0.5 rounded-full text-xs bg-neo text-white">
                    {t("developer.current")}
                  </span>
                )}
                <span className={`text-sm ${status.color}`}>{t(status.labelKey)}</span>
              </div>

              <div className="flex items-center gap-2">
                {v.status === "approved" && !v.is_current && (
                  <Button
                    size="sm"
                    onClick={() => handlePublish(v.id)}
                    disabled={publishing === v.id}
                    className="bg-neo text-white hover:bg-neo/90"
                  >
                    {publishing === v.id ? (
                      <span className="flex items-center gap-1">
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        {t("developer.publishing")}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Rocket size={14} /> {t("developer.publish")}
                      </span>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {v.release_notes && <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{v.release_notes}</p>}

            <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Clock size={12} />
                {t("developer.created", { date: new Date(v.created_at).toLocaleDateString(locale) })}
              </span>
              {v.published_at && (
                <span className="flex items-center gap-1">
                  <CheckCircle size={12} />
                  {t("developer.publishedAt", { date: new Date(v.published_at).toLocaleDateString(locale) })}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
