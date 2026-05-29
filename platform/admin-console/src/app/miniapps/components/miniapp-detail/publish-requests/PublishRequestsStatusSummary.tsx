"use client";

import type {
  MiniAppPublishAuditVerifyResult,
  MiniAppPublishReminderResult,
} from "@/lib/hooks/useMiniApps";
import type { PublishRequestsSla } from "../types";

type Props = {
  publishReviewError: string;
  publishReminderResult: MiniAppPublishReminderResult | null;
  publishAuditVerifyResult: MiniAppPublishAuditVerifyResult | null;
  sla: PublishRequestsSla | undefined;
};

export function PublishRequestsStatusSummary({
  publishReviewError,
  publishReminderResult,
  publishAuditVerifyResult,
  sla,
}: Props) {
  return (
    <>
      {publishReviewError && (
        <p className="mb-2 text-xs text-danger-600">{publishReviewError}</p>
      )}

      {publishReminderResult && (
        <p className="mb-2 text-xs text-gray-600">
          Reminder {publishReminderResult.dry_run ? "dry-run" : "sent"}:{" "}
          {publishReminderResult.sent} items ({publishReminderResult.channel})
        </p>
      )}

      {publishAuditVerifyResult && (
        <p
          className={`mb-2 text-xs ${publishAuditVerifyResult.ok ? "text-success-600" : "text-danger-600"}`}
        >
          Audit chain {publishAuditVerifyResult.ok ? "OK" : "FAILED"} | Events{" "}
          {publishAuditVerifyResult.total_events} | Invalid{" "}
          {publishAuditVerifyResult.invalid_hash_events} | Breaks{" "}
          {publishAuditVerifyResult.chain_break_events}
        </p>
      )}

      {sla && (
        <div className="mb-2 rounded-xl border border-gray-200 bg-gray-50 p-3 text-[11px] text-gray-600">
          SLA {sla.minutes}m / Escalation {sla.escalation_minutes}m | Pending{" "}
          {sla.pending} | Breached {sla.sla_breached} | Escalated{" "}
          {sla.escalated}
        </div>
      )}
    </>
  );
}
