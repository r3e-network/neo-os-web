/**
 * Version List - Display app versions with publish actions
 */

import { useState } from "react";
import { Clock, CheckCircle, Upload, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "text-gray-500", label: "Draft" },
  pending_review: { color: "text-yellow-500", label: "In Review" },
  approved: { color: "text-blue-500", label: "Approved" },
  published: { color: "text-green-500", label: "Published" },
  deprecated: { color: "text-red-500", label: "Deprecated" },
};

export function VersionList({ versions, onPublish }: VersionListProps) {
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
        <p>No versions yet. Create your first version to get started.</p>
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
                {v.is_current && <span className="px-2 py-0.5 rounded-full text-xs bg-neo text-white">Current</span>}
                <span className={`text-sm ${status.color}`}>{status.label}</span>
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
                        Publishing...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <Rocket size={14} /> Publish
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
                Created {new Date(v.created_at).toLocaleDateString()}
              </span>
              {v.published_at && (
                <span className="flex items-center gap-1">
                  <CheckCircle size={12} />
                  Published {new Date(v.published_at).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
