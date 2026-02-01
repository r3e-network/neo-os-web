// =============================================================================
// Build Trigger Component
// Manually triggers build for an approved submission
// =============================================================================

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface BuildTriggerProps {
  submissionId: string;
  onSuccess?: () => void;
}

export function BuildTrigger({ submissionId, onSuccess }: BuildTriggerProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleBuild = async () => {
    if (!confirm("Start build for this submission?")) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch("/api/admin/miniapps/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ submission_id: submissionId }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || result.details || "Build trigger failed");
      }

      if (!result.success) {
        throw new Error(result.error || "Build failed to start");
      }

      setSuccess(result.message || "Build triggered successfully");

      setTimeout(() => {
        setSuccess(null);
        if (onSuccess) onSuccess();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <Button size="sm" onClick={handleBuild} disabled={loading}>
        {loading ? "Triggering..." : "Build"}
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
    </div>
  );
}
