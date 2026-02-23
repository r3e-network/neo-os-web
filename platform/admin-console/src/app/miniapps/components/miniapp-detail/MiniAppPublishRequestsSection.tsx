"use client";

import type { ReactNode } from "react";
import type {
  MiniAppPublishAuditVerifyResult,
  MiniAppPublishReminderResult,
  MiniAppPublishRequest,
} from "@/lib/hooks/useMiniApps";
import { PublishRequestsList } from "./publish-requests/PublishRequestsList";
import { PublishRequestsStatusSummary } from "./publish-requests/PublishRequestsStatusSummary";
import { PublishRequestsToolbar } from "./publish-requests/PublishRequestsToolbar";
import type { PublishRequestStatus, PublishRequestsQueryLike } from "./types";

type Props = {
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

export function MiniAppPublishRequestsSection({
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
    <div>
      <PublishRequestsToolbar
        publishRequestStatus={publishRequestStatus}
        onPublishRequestStatusChange={onPublishRequestStatusChange}
        onExportPublishRequestsCsv={onExportPublishRequestsCsv}
        onVerifyPublishAudit={onVerifyPublishAudit}
        verifyPublishAuditPending={verifyPublishAuditPending}
        onTriggerPublishReminders={onTriggerPublishReminders}
        triggerPublishRemindersPending={triggerPublishRemindersPending}
      />

      <PublishRequestsStatusSummary
        publishReviewError={publishReviewError}
        publishReminderResult={publishReminderResult}
        publishAuditVerifyResult={publishAuditVerifyResult}
        sla={publishRequestsQuery.data?.sla}
      />

      <PublishRequestsList
        publishRequestsQuery={publishRequestsQuery}
        onViewPublishRequest={onViewPublishRequest}
        onApprovePublishRequest={onApprovePublishRequest}
        onRejectPublishRequest={onRejectPublishRequest}
        reviewPublishRequestPending={reviewPublishRequestPending}
        publishDetailRequestId={publishDetailRequestId}
        selectedPublishRequest={selectedPublishRequest}
        onClosePublishRequestDiff={onClosePublishRequestDiff}
        publishRequestDiffContent={publishRequestDiffContent}
      />
    </div>
  );
}
