import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Wallet,
  Database,
  Dice1,
  Bell,
  Lock,
  Eye,
  Zap,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/react";

export interface MiniAppPermissions {
  payments?: boolean;
  rng?: boolean;
  datafeed?: boolean;
  notifications?: boolean;
  confidential?: boolean;
  storage?: boolean;
  analytics?: boolean;
  automation?: boolean;
  [key: string]: boolean | undefined;
}

interface PermissionsCardProps {
  permissions: MiniAppPermissions;
  className?: string;
  compact?: boolean;
}

interface PermissionInfo {
  key: string;
  icon: React.ElementType;
  label: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
}

const getPermissionInfo = (t: (key: string) => string): PermissionInfo[] => [
  {
    key: "payments",
    icon: Wallet,
    label: t("permissions.payments.label") || "Payments",
    description: t("permissions.payments.desc") || "Can request payment transactions",
    riskLevel: "high",
  },
  {
    key: "rng",
    icon: Dice1,
    label: t("permissions.rng.label") || "Random Numbers",
    description: t("permissions.rng.desc") || "Access to verifiable random number generation",
    riskLevel: "low",
  },
  {
    key: "datafeed",
    icon: Database,
    label: t("permissions.datafeed.label") || "Data Feeds",
    description: t("permissions.datafeed.desc") || "Access to oracle price feeds and external data",
    riskLevel: "low",
  },
  {
    key: "notifications",
    icon: Bell,
    label: t("permissions.notifications.label") || "Notifications",
    description: t("permissions.notifications.desc") || "Can send push notifications",
    riskLevel: "low",
  },
  {
    key: "confidential",
    icon: Lock,
    label: t("permissions.confidential.label") || "Confidential Computing",
    description: t("permissions.confidential.desc") || "Uses TEE for secure computation",
    riskLevel: "medium",
  },
  {
    key: "storage",
    icon: Database,
    label: t("permissions.storage.label") || "Storage",
    description: t("permissions.storage.desc") || "Can store data on-chain or off-chain",
    riskLevel: "low",
  },
  {
    key: "analytics",
    icon: Eye,
    label: t("permissions.analytics.label") || "Analytics",
    description: t("permissions.analytics.desc") || "Collects usage analytics",
    riskLevel: "low",
  },
  {
    key: "automation",
    icon: Zap,
    label: t("permissions.automation.label") || "Automation",
    description: t("permissions.automation.desc") || "Can schedule automated tasks",
    riskLevel: "medium",
  },
];

const getRiskColor = (level: string) => {
  switch (level) {
    case "high":
      return "text-red-500 bg-red-500/10 border-red-500/30";
    case "medium":
      return "text-amber-500 bg-amber-500/10 border-amber-500/30";
    default:
      return "text-neo bg-neo/10 border-neo/30";
  }
};

export function PermissionsCard({ permissions, className, compact = false }: PermissionsCardProps) {
  const { t } = useTranslation("host");
  const [expanded, setExpanded] = useState(!compact);
  const [hoveredPermission, setHoveredPermission] = useState<string | null>(null);

  const permissionInfoList = getPermissionInfo(t);
  const enabledPermissions = permissionInfoList.filter((p) => permissions[p.key]);
  const disabledPermissions = permissionInfoList.filter((p) => !permissions[p.key]);

  const highRiskCount = enabledPermissions.filter((p) => p.riskLevel === "high").length;
  const mediumRiskCount = enabledPermissions.filter((p) => p.riskLevel === "medium").length;

  return (
    <div className={cn("rounded-xl border bg-white/70 dark:bg-white/5 border-white/60 dark:border-white/10", className)}>
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-erobo-purple/10 flex items-center justify-center">
            <Shield size={16} className="text-erobo-purple" />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-erobo-ink dark:text-white text-sm">
              {t("detail.permissions") || "Permissions"}
            </h3>
            <p className="text-xs text-erobo-ink-soft/60 dark:text-gray-500">
              {enabledPermissions.length} of {permissionInfoList.length} enabled
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Risk Summary */}
          {highRiskCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/30">
              {highRiskCount} High
            </span>
          )}
          {mediumRiskCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
              {mediumRiskCount} Medium
            </span>
          )}
          {expanded ? (
            <ChevronUp size={16} className="text-erobo-ink-soft/60" />
          ) : (
            <ChevronDown size={16} className="text-erobo-ink-soft/60" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 border-t border-white/60 dark:border-white/10">
              {/* Enabled Permissions */}
              {enabledPermissions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-erobo-ink-soft/60 dark:text-gray-500 uppercase tracking-wider mb-3">
                    Enabled
                  </h4>
                  <div className="space-y-2">
                    {enabledPermissions.map((perm) => (
                      <div
                        key={perm.key}
                        className="relative"
                        onMouseEnter={() => setHoveredPermission(perm.key)}
                        onMouseLeave={() => setHoveredPermission(null)}
                      >
                        <div className={cn(
                          "flex items-center gap-3 p-2 rounded-lg border transition-all",
                          getRiskColor(perm.riskLevel)
                        )}>
                          <perm.icon size={16} />
                          <span className="flex-1 text-sm font-medium text-erobo-ink dark:text-white">
                            {perm.label}
                          </span>
                          <CheckCircle size={14} className="text-neo" />
                        </div>
                        
                        {/* Tooltip */}
                        <AnimatePresence>
                          {hoveredPermission === perm.key && (
                            <motion.div
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: 5 }}
                              className="absolute left-0 right-0 top-full mt-1 z-10 p-3 rounded-lg bg-erobo-ink/95 dark:bg-black/95 border border-white/10 shadow-xl"
                            >
                              <p className="text-xs text-white/80">{perm.description}</p>
                              <div className="flex items-center gap-1 mt-2">
                                <Info size={10} className="text-white/50" />
                                <span className="text-[10px] text-white/50 uppercase">
                                  Risk Level: {perm.riskLevel}
                                </span>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Disabled Permissions */}
              {disabledPermissions.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-xs font-bold text-erobo-ink-soft/60 dark:text-gray-500 uppercase tracking-wider mb-3">
                    Not Requested
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {disabledPermissions.map((perm) => (
                      <div
                        key={perm.key}
                        className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/50 dark:bg-white/5 border border-white/60 dark:border-white/10 text-erobo-ink-soft/50 dark:text-gray-500"
                      >
                        <perm.icon size={12} />
                        <span className="text-xs">{perm.label}</span>
                        <XCircle size={10} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Security Note */}
              <div className="mt-4 p-3 rounded-lg bg-erobo-purple/5 border border-erobo-purple/20">
                <div className="flex items-start gap-2">
                  <Shield size={14} className="text-erobo-purple mt-0.5" />
                  <p className="text-xs text-erobo-ink-soft/70 dark:text-gray-400">
                    {t("detail.permissionsNote") || "All permissions are enforced by the platform. MiniApps cannot access features without explicit permission."}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
