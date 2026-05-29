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
    <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <h4 className="text-sm font-semibold text-gray-700">Publish Requests</h4>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onExportPublishRequestsCsv}>
          Export Requests CSV
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={onVerifyPublishAudit}
          disabled={verifyPublishAuditPending}
        >
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
          id="publish-request-status-filter"
          className="cursor-pointer rounded-xl border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 transition-colors focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-100"
          value={publishRequestStatus}
          onChange={(event) =>
            onPublishRequestStatusChange(
              event.target.value as PublishRequestStatus,
            )
          }
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
