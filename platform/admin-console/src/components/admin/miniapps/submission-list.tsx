// =============================================================================
// Submission List Component
// Lists external submissions with filtering
// =============================================================================

"use client";

import { useEffect, useState } from "react";
import { MiniAppSubmission, SubmissionStatus, SubmissionsListResponse } from "./types";
import { SubmissionCard } from "./submission-card";
import { Spinner } from "@/components/ui/Spinner";
import { Button } from "@/components/ui/Button";

interface SubmissionListProps {
  statusFilter?: SubmissionStatus | "all";
}

const STATUS_OPTIONS: Array<{ value: SubmissionStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending_review", label: "Pending Review" },
  { value: "approved", label: "Approved" },
  { value: "building", label: "Building" },
  { value: "published", label: "Published" },
  { value: "rejected", label: "Rejected" },
  { value: "update_requested", label: "Update Requested" },
  { value: "build_failed", label: "Build Failed" },
];

export function SubmissionList({ statusFilter = "all" }: SubmissionListProps) {
  const [submissions, setSubmissions] = useState<MiniAppSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<SubmissionStatus | "all">(statusFilter);
  const [total, setTotal] = useState(0);

  const fetchSubmissions = async () => {
    setLoading(true);
    setError(null);

    try {
      const statusParam = filter === "all" ? "" : `&status=${filter}`;
      const response = await fetch(`/api/admin/miniapps/submissions?limit=50${statusParam}`);

      if (!response.ok) {
        throw new Error("Failed to load submissions");
      }

      const data: SubmissionsListResponse = await response.json();
      setSubmissions(data.apps);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 dark:text-red-400">{error}</p>
        <Button className="mt-4" onClick={fetchSubmissions}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">External Submissions</h2>
        <div className="flex items-center gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as SubmissionStatus | "all")}
            className="rounded border border-gray-300 bg-white px-3 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label} (
                {option.value === "all" ? total : submissions.filter((s) => s.status === option.value).length})
              </option>
            ))}
          </select>
          <Button size="sm" onClick={fetchSubmissions}>
            Refresh
          </Button>
        </div>
      </div>

      {submissions.length === 0 ? (
        <div className="p-8 text-center text-gray-500 dark:text-gray-400">No submissions found for this filter.</div>
      ) : (
        <div className="space-y-4">
          {submissions.map((submission) => (
            <SubmissionCard key={submission.id} submission={submission} onRefresh={fetchSubmissions} />
          ))}
        </div>
      )}
    </div>
  );
}
