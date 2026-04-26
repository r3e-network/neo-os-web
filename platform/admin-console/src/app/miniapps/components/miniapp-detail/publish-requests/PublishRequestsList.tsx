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
        <p className="text-xs text-danger-600 dark:text-danger-400">
          {publishRequestsQuery.error instanceof Error
            ? publishRequestsQuery.error.message
            : "Failed to load publish requests"}
        </p>
      ) : !publishRequestsQuery.data?.requests.length ? (
        <p className="text-xs text-gray-500 dark:text-gray-400">
          No publish requests.
        </p>
      ) : (
        <div className="divide-y rounded-lg border border-gray-200 dark:divide-gray-700 dark:border-gray-700">
          {publishRequestsQuery.data.requests.map((request) => (
            <div
              key={request.id}
              className="flex items-center gap-3 px-3 py-2 text-xs"
            >
              <span className="font-mono text-[10px] text-gray-500 dark:text-gray-400">
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
              <span className="text-gray-500 dark:text-gray-400">
                {formatDate(request.requested_at)}
              </span>
              {renderTimingBadge(request)}
              <span className="ml-auto flex items-center gap-1">
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
          <div className="mb-1 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-600 dark:text-gray-300">
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
