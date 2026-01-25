// =============================================================================
// Submission Card Component
// Displays a single miniapp submission with detected info
// =============================================================================

"use client";

import { useState } from "react";
import { MiniAppSubmission, SubmissionStatus } from "./types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ApprovalActions } from "./approval-actions";
import { PublishTrigger } from "./publish-trigger";

interface SubmissionCardProps {
  submission: MiniAppSubmission;
  onRefresh?: () => void;
}

const STATUS_COLORS: Record<SubmissionStatus, string> = {
  pending_review: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400",
  approved: "bg-blue-500/20 text-blue-700 dark:text-blue-400",
  rejected: "bg-red-500/20 text-red-700 dark:text-red-400",
  update_requested: "bg-orange-500/20 text-orange-700 dark:text-orange-400",
  building: "bg-purple-500/20 text-purple-700 dark:text-purple-400",
  published: "bg-green-500/20 text-green-700 dark:text-green-400",
  build_failed: "bg-red-600/20 text-red-800 dark:text-red-500",
};

const STATUS_LABELS: Record<SubmissionStatus, string> = {
  pending_review: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  update_requested: "Update Requested",
  building: "Building",
  published: "Published",
  build_failed: "Build Failed",
};

export function SubmissionCard({ submission, onRefresh }: SubmissionCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const canApprove = submission.status === "pending_review";
  const canPublish = submission.status === "approved";

  const formatDate = (date: string | null) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleString();
  };

  const getBuildTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      vite: "Vite",
      webpack: "Webpack",
      uniapp: "uni-app",
      nextjs: "Next.js",
      vanilla: "Vanilla",
      unknown: "Unknown",
    };
    return labels[type] || type;
  };

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-3">
            <h3 className="text-lg font-semibold">{submission.app_id}</h3>
            <Badge className={STATUS_COLORS[submission.status]}>{STATUS_LABELS[submission.status]}</Badge>
            {submission.error_count > 0 && <Badge variant="danger">{submission.error_count} errors</Badge>}
          </div>

          <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400">
            <p>
              <span className="font-medium">Repository:</span>{" "}
              <a
                href={submission.git_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline dark:text-blue-400"
              >
                {submission.repo_owner}/{submission.repo_name}
              </a>
              {submission.subfolder && <span className="text-gray-500"> ({submission.subfolder})</span>}
            </p>
            <p>
              <span className="font-medium">Branch:</span> {submission.branch}
            </p>
            <p>
              <span className="font-medium">Commit:</span> {submission.git_commit_sha?.slice(0, 8) || "N/A"}
            </p>
            <p>
              <span className="font-medium">Build Type:</span> {getBuildTypeLabel(submission.build_config.type)} (
              {submission.build_config.packageManager})
            </p>
            <p>
              <span className="font-medium">Submitted:</span> {formatDate(submission.submitted_at)}
            </p>
          </div>

          {showDetails && (
            <div className="mt-4 space-y-2 rounded bg-gray-50 p-3 text-sm dark:bg-gray-800">
              <div>
                <span className="font-medium">Manifest:</span>{" "}
                {submission.assets_detected.manifest ? (
                  <Badge variant="success">Found</Badge>
                ) : (
                  <Badge variant="danger">Missing</Badge>
                )}
              </div>
              <div>
                <span className="font-medium">Icon:</span>{" "}
                {submission.assets_detected.icon?.length ? (
                  <span className="text-green-600 dark:text-green-400">
                    {submission.assets_detected.icon.join(", ")}
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">Not found</span>
                )}
              </div>
              <div>
                <span className="font-medium">Banner:</span>{" "}
                {submission.assets_detected.banner?.length ? (
                  <span className="text-green-600 dark:text-green-400">
                    {submission.assets_detected.banner.join(", ")}
                  </span>
                ) : (
                  <span className="text-red-600 dark:text-red-400">Not found</span>
                )}
              </div>
              {submission.last_error && (
                <div>
                  <span className="font-medium text-red-600 dark:text-red-400">Last Error:</span>{" "}
                  <span className="text-red-600 dark:text-red-400">{submission.last_error}</span>
                </div>
              )}
              {submission.review_notes && (
                <div>
                  <span className="font-medium">Review Notes:</span> <span>{submission.review_notes}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ml-4 flex flex-col gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? "Hide" : "Details"}
          </Button>

          {canApprove && <ApprovalActions submissionId={submission.id} onSuccess={onRefresh} />}

          {canPublish && <PublishTrigger submissionId={submission.id} onSuccess={onRefresh} />}

          {submission.git_url && (
            <Button variant="ghost" size="sm" onClick={() => window.open(submission.git_url, "_blank")}>
              View Repo
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}
