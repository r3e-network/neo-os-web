"use client";

import { Button } from "@/components/ui/Button";
import type { PublishRequestStatus } from "../types";

type Props = {
  publishRequestStatus: PublishRequestStatus;
  onPublishRequestStatusChange: (value: PublishRequestStatus) => void;
  onExportPublishRequestsCsv: () => void;
  onVerifyPublishAudit: () => void;
  verifyPublishAuditPending: boolean;
  onTriggerPublishReminders: (dryRun: boolean) => void;
  triggerPublishRemindersPending: boolean;
};

export function PublishRequestsToolbar({
  publishRequestStatus,
  onPublishRequestStatusChange,
  onExportPublishRequestsCsv,
  onVerifyPublishAudit,
  verifyPublishAuditPending,
  onTriggerPublishReminders,
  triggerPublishRemindersPending,
}: Props) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Publish Requests</h4>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onExportPublishRequestsCsv}>
          Export Requests CSV
        </Button>
        <Button size="sm" variant="ghost" onClick={onVerifyPublishAudit} disabled={verifyPublishAuditPending}>
          Verify Audit Chain
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onTriggerPublishReminders(true)}
          disabled={triggerPublishRemindersPending}
        >
          Dry-Run Remind
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => onTriggerPublishReminders(false)}
          disabled={triggerPublishRemindersPending}
        >
          Send Reminders
        </Button>
        <select
          className="cursor-pointer rounded-md border border-gray-300 p-1.5 text-xs transition-colors dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100"
          value={publishRequestStatus}
          onChange={(event) => onPublishRequestStatusChange(event.target.value as PublishRequestStatus)}
          aria-label="Publish request status filter"
        >
          <option value="pending">Pending</option>
          <option value="all">All</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="applied">Applied</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>
    </div>
  );
}
