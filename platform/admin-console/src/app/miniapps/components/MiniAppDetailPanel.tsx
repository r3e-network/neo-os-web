"use client";

import type { ReactNode } from "react";
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
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{selectedApp.app_id}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={onExportJson}>
              Export JSON
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
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
