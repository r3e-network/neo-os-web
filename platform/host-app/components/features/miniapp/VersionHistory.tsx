import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Clock, Tag, Download, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";

export interface VersionInfo {
  version: string;
  releaseDate: string;
  changelog?: string[];
  size?: string;
  status?: "stable" | "beta" | "deprecated";
  downloadUrl?: string;
  isLatest?: boolean;
}

interface VersionHistoryProps {
  versions: VersionInfo[];
  currentVersion?: string;
  className?: string;
  maxVisible?: number;
}

export function VersionHistory({ versions, currentVersion, className, maxVisible = 3 }: VersionHistoryProps) {
  const { t } = useTranslation("host");
  const [expanded, setExpanded] = useState(false);
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  if (!versions || versions.length === 0) {
    return null;
  }

  const displayVersions = expanded ? versions : versions.slice(0, maxVisible);
  const hasMore = versions.length > maxVisible;

  const getStatusBadge = (status?: string, isLatest?: boolean) => {
    if (isLatest) {
      return (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-erobo-purple/10 text-erobo-purple border border-erobo-purple/30">
          Latest
        </span>
      );
    }
    switch (status) {
      case "stable":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-neo/10 text-neo border border-neo/30">
            Stable
          </span>
        );
      case "beta":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-500 border border-amber-500/30">
            Beta
          </span>
        );
      case "deprecated":
        return (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-500/10 text-red-500 border border-red-500/30">
            Deprecated
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={cn("", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-erobo-ink dark:text-white flex items-center gap-2">
          <Clock size={18} className="text-erobo-purple" />
          {t("detail.versionHistory") || "Version History"}
        </h3>
        {currentVersion && (
          <span className="text-xs text-erobo-ink-soft/60 dark:text-gray-500">
            Current: v{currentVersion}
          </span>
        )}
      </div>

      <div className="space-y-3">
        {displayVersions.map((version, index) => {
          const isExpanded = expandedVersion === version.version;
          const isCurrent = version.version === currentVersion;

          return (
            <motion.div
              key={version.version}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "rounded-xl border transition-all",
                isCurrent
                  ? "bg-erobo-purple/5 border-erobo-purple/30"
                  : "bg-white/70 dark:bg-white/5 border-white/60 dark:border-white/10 hover:border-erobo-purple/30"
              )}
            >
              <button
                onClick={() => setExpandedVersion(isExpanded ? null : version.version)}
                className="w-full px-4 py-3 flex items-center justify-between text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-erobo-purple" />
                    <span className="font-bold text-erobo-ink dark:text-white">
                      v{version.version}
                    </span>
                  </div>
                  {getStatusBadge(version.status, version.isLatest)}
                  {isCurrent && (
                    <CheckCircle size={14} className="text-neo" />
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-erobo-ink-soft/60 dark:text-gray-500">
                    {formatDate(version.releaseDate)}
                  </span>
                  {version.changelog && version.changelog.length > 0 && (
                    isExpanded ? (
                      <ChevronUp size={16} className="text-erobo-ink-soft/60" />
                    ) : (
                      <ChevronDown size={16} className="text-erobo-ink-soft/60" />
                    )
                  )}
                </div>
              </button>

              <AnimatePresence>
                {isExpanded && version.changelog && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-1 border-t border-white/60 dark:border-white/10">
                      <ul className="space-y-2 mt-3">
                        {version.changelog.map((change, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-sm text-erobo-ink-soft/80 dark:text-gray-400">
                            <span className="text-erobo-purple mt-1">•</span>
                            {change}
                          </li>
                        ))}
                      </ul>
                      <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/40 dark:border-white/5">
                        {version.size && (
                          <span className="text-xs text-erobo-ink-soft/50 dark:text-gray-500">
                            Size: {version.size}
                          </span>
                        )}
                        {version.downloadUrl && (
                          <a
                            href={version.downloadUrl}
                            className="flex items-center gap-1.5 text-xs font-medium text-erobo-purple hover:underline"
                          >
                            <Download size={12} />
                            Download
                          </a>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-4 py-2 text-sm font-medium text-erobo-purple hover:text-erobo-purple-dark transition-colors flex items-center justify-center gap-1"
        >
          {expanded ? (
            <>
              Show Less <ChevronUp size={16} />
            </>
          ) : (
            <>
              Show {versions.length - maxVisible} More <ChevronDown size={16} />
            </>
          )}
        </button>
      )}
    </div>
  );
}
