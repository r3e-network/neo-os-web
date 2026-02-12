// =============================================================================
// Approval Actions Component
// Approve, reject, or request changes for a submission
// =============================================================================

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ApprovalAction } from "./types";

interface ApprovalActionsProps {
  submissionId: string;
  onSuccess?: () => void;
}

export function ApprovalActions({ submissionId, onSuccess }: ApprovalActionsProps) {
  const [action, setAction] = useState<ApprovalAction | null>(null);
  const [notes, setNotes] = useState("");
  const [triggerBuild, setTriggerBuild] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async () => {
    if (!action) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/miniapps/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission_id: submissionId,
          action,
          trigger_build: triggerBuild,
          review_notes: notes || undefined,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Action failed");
      }

      // Reset form
      setAction(null);
      setNotes("");
      setTriggerBuild(false);

      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setAction(null);
    setNotes("");
    setTriggerBuild(false);
    setError(null);
  };

  if (action) {
    return (
      <div className="bg-muted/30 flex flex-col gap-2 rounded p-3">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={action === "approve" ? "primary" : "ghost"}
            onClick={() => setAction("approve")}
            disabled={loading}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant={action === "reject" ? "danger" : "ghost"}
            onClick={() => setAction("reject")}
            disabled={loading}
          >
            Reject
          </Button>
          <Button
            size="sm"
            variant={action === "request_changes" ? "secondary" : "ghost"}
            onClick={() => setAction("request_changes")}
            disabled={loading}
          >
            Request Changes
          </Button>
        </div>

        {action === "approve" && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={triggerBuild}
              onChange={(e) => setTriggerBuild(e.target.checked)}
              disabled={loading}
            />
            Trigger build immediately
          </label>
        )}

        <Input
          placeholder="Review notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
        />

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2">
          <Button size="sm" onClick={handleAction} disabled={loading}>
            {loading ? "Processing..." : "Confirm"}
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancel} disabled={loading}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button size="sm" onClick={() => setAction("approve")}>
      Review
    </Button>
  );
}
