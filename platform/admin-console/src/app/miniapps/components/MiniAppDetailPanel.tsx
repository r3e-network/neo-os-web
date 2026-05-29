"use client";

import type { ReactNode } from "react";
import {
  AppWindow,
  FileJson2,
  Link2,
  ShieldCheck,
  Tags,
  X,
  type LucideIcon,
} from "lucide-react";
import { Badge, type BadgeProps } from "@/components/ui/Badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import type {
  MiniAppPublishAuditVerifyResult,
  MiniAppPublishReminderResult,
  MiniAppPublishRequest,
  MiniAppVersionSummary,
} from "@/lib/hooks/useMiniApps";
import type { VersionDiffEntry } from "@/lib/version-diff";
import type { MiniApp } from "@/types";
import { MiniAppManifestSection } from "./miniapp-detail/MiniAppManifestSection";
import { MiniAppPublishRequestsSection } from "./miniapp-detail/MiniAppPublishRequestsSection";
import { MiniAppVersionHistorySection } from "./miniapp-detail/MiniAppVersionHistorySection";
import type {
  DiffScope,
  DiffSummary,
  PublishRequestStatus,
  PublishRequestsQueryLike,
  VersionChannel,
  VersionsQueryLike,
} from "./miniapp-detail/types";

type Props = {
  selectedApp: MiniApp;
  onExportJson: () => void;
  onClose: () => void;
  versionChannel: VersionChannel;
  onVersionChannelChange: (value: VersionChannel) => void;
  versionError: string;
  versionsQuery: VersionsQueryLike;
  selectedDiffVersion: MiniAppVersionSummary | null;
  previousDiffVersion: MiniAppVersionSummary | null;
  diffScope: DiffScope;
  onDiffScopeChange: (value: DiffScope) => void;
  diffSummary: DiffSummary;
  diffEntries: VersionDiffEntry[];
  onExportCurrentDiffCsv: () => void;
  onCloseDiff: () => void;
  onSelectDiffVersion: (versionId: string) => void;
  onRollbackVersion: (version: MiniAppVersionSummary) => void;
  rollbackPending: boolean;
  publishRequestStatus: PublishRequestStatus;
  onPublishRequestStatusChange: (value: PublishRequestStatus) => void;
  publishReviewError: string;
  publishReminderResult: MiniAppPublishReminderResult | null;
  publishAuditVerifyResult: MiniAppPublishAuditVerifyResult | null;
  publishRequestsQuery: PublishRequestsQueryLike;
  onExportPublishRequestsCsv: () => void;
  onVerifyPublishAudit: () => void;
  verifyPublishAuditPending: boolean;
  onTriggerPublishReminders: (dryRun: boolean) => void;
  triggerPublishRemindersPending: boolean;
  onViewPublishRequest: (requestId: string) => void;
  onApprovePublishRequest: (request: MiniAppPublishRequest) => void;
  onRejectPublishRequest: (request: MiniAppPublishRequest) => void;
  reviewPublishRequestPending: boolean;
  publishDetailRequestId: string | null;
  selectedPublishRequest: MiniAppPublishRequest | null;
  onClosePublishRequestDiff: () => void;
  publishRequestDiffContent: ReactNode;
};

type DetailSummaryItem = {
  label: string;
  value: string;
  description: string;
  icon: LucideIcon;
  valueClassName?: string;
};

function getEnabledPermissions(permissions: MiniApp["permissions"]) {
  return (
    Object.entries(permissions || {})
      .filter(([, value]) => Boolean(value))
      .map(([key]) => key)
      .join(", ") || "none"
  );
}

function getManifestContent(manifest: MiniApp["manifest"]) {
  return manifest?.content && typeof manifest.content === "object"
    ? (manifest.content as Record<string, unknown>)
    : null;
}

function getMiniAppCategory(selectedApp: MiniApp) {
  const content = getManifestContent(selectedApp.manifest);
  if (typeof selectedApp.category === "string" && selectedApp.category.trim()) {
    return selectedApp.category;
  }
  if (typeof content?.category === "string" && content.category.trim()) {
    return content.category;
  }
  return "Uncategorized";
}

function getStatusVariant(status: MiniApp["status"]): BadgeProps["variant"] {
  if (status === "active") {
    return "success";
  }
  if (status === "pending") {
    return "warning";
  }
  if (status === "beta") {
    return "info";
  }
  return "danger";
}

export function MiniAppDetailPanel({
  selectedApp,
  onExportJson,
  onClose,
  versionChannel,
  onVersionChannelChange,
  versionError,
  versionsQuery,
  selectedDiffVersion,
  previousDiffVersion,
  diffScope,
  onDiffScopeChange,
  diffSummary,
  diffEntries,
  onExportCurrentDiffCsv,
  onCloseDiff,
  onSelectDiffVersion,
  onRollbackVersion,
  rollbackPending,
  publishRequestStatus,
  onPublishRequestStatusChange,
  publishReviewError,
  publishReminderResult,
  publishAuditVerifyResult,
  publishRequestsQuery,
  onExportPublishRequestsCsv,
  onVerifyPublishAudit,
  verifyPublishAuditPending,
  onTriggerPublishReminders,
  triggerPublishRemindersPending,
  onViewPublishRequest,
  onApprovePublishRequest,
  onRejectPublishRequest,
  reviewPublishRequestPending,
  publishDetailRequestId,
  selectedPublishRequest,
  onClosePublishRequestDiff,
  publishRequestDiffContent,
}: Props) {
  const summaryItems: DetailSummaryItem[] = [
    {
      label: "Status",
      value: selectedApp.status,
      description: "Registry state",
      icon: ShieldCheck,
    },
    {
      label: "Entry",
      value: selectedApp.entry_url,
      description: "Runtime surface",
      icon: Link2,
      valueClassName: "font-mono text-xs break-all",
    },
    {
      label: "Permissions",
      value: getEnabledPermissions(selectedApp.permissions),
      description: "Enabled capabilities",
      icon: ShieldCheck,
    },
    {
      label: "Category",
      value: getMiniAppCategory(selectedApp),
      description: "Manifest group",
      icon: Tags,
    },
  ];

  return (
    <Card
      className="miniapp-detail-panel miniapp-detail-shell overflow-hidden"
      variant="default"
    >
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary-100 bg-primary-50 text-primary-700">
              <AppWindow className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="min-w-0 break-all">
                  {selectedApp.app_id}
                </CardTitle>
                <Badge variant={getStatusVariant(selectedApp.status)}>
                  {selectedApp.status}
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-sm text-gray-500">
                Review manifest, version history, and publish controls before
                changing fleet state.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={onExportJson}>
              <FileJson2 className="mr-2 h-4 w-4" aria-hidden="true" />
              Export JSON
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              <X className="mr-2 h-4 w-4" aria-hidden="true" />
              Close
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6 bg-gray-50">
        <div
          aria-label="MiniApp detail summary"
          className="grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          {summaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.label}
                className="rounded-xl border border-gray-200 bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-gray-50 text-gray-700">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase text-gray-500">
                      {item.label}
                    </p>
                    <p
                      className={`mt-1 text-sm font-semibold text-gray-900 ${
                        item.valueClassName || ""
                      }`}
                    >
                      {item.value}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {item.description}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <MiniAppManifestSection selectedApp={selectedApp} />

        <MiniAppVersionHistorySection
          versionChannel={versionChannel}
          onVersionChannelChange={onVersionChannelChange}
          versionError={versionError}
          versionsQuery={versionsQuery}
          selectedDiffVersion={selectedDiffVersion}
          previousDiffVersion={previousDiffVersion}
          diffScope={diffScope}
          onDiffScopeChange={onDiffScopeChange}
          diffSummary={diffSummary}
          diffEntries={diffEntries}
          onExportCurrentDiffCsv={onExportCurrentDiffCsv}
          onCloseDiff={onCloseDiff}
          onSelectDiffVersion={onSelectDiffVersion}
          onRollbackVersion={onRollbackVersion}
          rollbackPending={rollbackPending}
        />

        <MiniAppPublishRequestsSection
          publishRequestStatus={publishRequestStatus}
          onPublishRequestStatusChange={onPublishRequestStatusChange}
          publishReviewError={publishReviewError}
          publishReminderResult={publishReminderResult}
          publishAuditVerifyResult={publishAuditVerifyResult}
          publishRequestsQuery={publishRequestsQuery}
          onExportPublishRequestsCsv={onExportPublishRequestsCsv}
          onVerifyPublishAudit={onVerifyPublishAudit}
          verifyPublishAuditPending={verifyPublishAuditPending}
          onTriggerPublishReminders={onTriggerPublishReminders}
          triggerPublishRemindersPending={triggerPublishRemindersPending}
          onViewPublishRequest={onViewPublishRequest}
          onApprovePublishRequest={onApprovePublishRequest}
          onRejectPublishRequest={onRejectPublishRequest}
          reviewPublishRequestPending={reviewPublishRequestPending}
          publishDetailRequestId={publishDetailRequestId}
          selectedPublishRequest={selectedPublishRequest}
          onClosePublishRequestDiff={onClosePublishRequestDiff}
          publishRequestDiffContent={publishRequestDiffContent}
        />
      </CardContent>
    </Card>
  );
}
