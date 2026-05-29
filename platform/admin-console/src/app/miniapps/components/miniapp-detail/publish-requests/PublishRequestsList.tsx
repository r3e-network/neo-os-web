"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import type { MiniAppPublishRequest } from "@/lib/hooks/useMiniApps";
import { formatDate, truncate } from "@/lib/utils";
import type { PublishRequestsQueryLike } from "../types";

type Props = {
  publishRequestsQuery: PublishRequestsQueryLike;
  onViewPublishRequest: (requestId: string) => void;
  onApprovePublishRequest: (request: MiniAppPublishRequest) => void;
  onRejectPublishRequest: (request: MiniAppPublishRequest) => void;
  reviewPublishRequestPending: boolean;
  publishDetailRequestId: string | null;
  selectedPublishRequest: MiniAppPublishRequest | null;
  onClosePublishRequestDiff: () => void;
  publishRequestDiffContent: ReactNode;
};

function renderTimingBadge(request: MiniAppPublishRequest) {
  const timing = request.timing;
  if (!timing) return null;
  if (timing.isEscalated) {
    return <Badge variant="danger">Escalated ({timing.ageMinutes}m)</Badge>;
  }
  if (timing.isSlaBreached) {
    return <Badge variant="warning">SLA Breach ({timing.ageMinutes}m)</Badge>;
  }
  return <Badge variant="default">Age {timing.ageMinutes}m</Badge>;
}

export function PublishRequestsList({
  publishRequestsQuery,
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
    <>
      {publishRequestsQuery.isLoading ? (
        <Spinner />
      ) : publishRequestsQuery.isError ? (
        <p className="text-xs text-danger-600">
          {publishRequestsQuery.error instanceof Error
            ? publishRequestsQuery.error.message
            : "Failed to load publish requests"}
        </p>
      ) : !publishRequestsQuery.data?.requests.length ? (
        <p className="text-xs text-gray-500">No publish requests.</p>
      ) : (
        <div className="divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
          {publishRequestsQuery.data.requests.map((request) => (
            <div
              key={request.id}
              className="flex flex-col gap-2 px-3 py-3 text-xs sm:flex-row sm:items-center"
            >
              <span className="font-mono text-[10px] text-gray-500">
                {truncate(request.id, 14)}
              </span>
              <span className="font-medium">
                v{request.requested_version_no ?? "-"}
              </span>
              <Badge
                variant={
                  request.status === "pending"
                    ? "warning"
                    : request.status === "applied"
                      ? "success"
                      : "default"
                }
              >
                {request.status}
              </Badge>
              <span className="text-gray-500">
                {formatDate(request.requested_at)}
              </span>
              {renderTimingBadge(request)}
              <span className="flex flex-wrap items-center gap-1 sm:ml-auto">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewPublishRequest(request.id)}
                >
                  View Diff
                </Button>
                {request.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onApprovePublishRequest(request)}
                      disabled={reviewPublishRequestPending}
                    >
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onRejectPublishRequest(request)}
                      disabled={reviewPublishRequestPending}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {publishDetailRequestId && selectedPublishRequest && (
        <div className="mt-2">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold text-gray-700">
              Request {truncate(selectedPublishRequest.id, 20)}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={onClosePublishRequestDiff}
            >
              Close Request Diff
            </Button>
          </div>
          {publishRequestDiffContent}
        </div>
      )}
    </>
  );
}
