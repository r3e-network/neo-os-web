// =============================================================================
// Internal Sync Component
// Triggers sync of internal miniapps from repository
// =============================================================================

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

interface InternalSyncProps {
  onSuccess?: () => void;
}

export function InternalSync({ onSuccess }: InternalSyncProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<{ synced: number; updated: number; failed: number } | null>(null);

  const handleSync = async () => {
    if (!confirm("Sync internal miniapps from repository?")) return;

    setLoading(true);
    setError(null);
    setSuccess(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/miniapps/internal", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || "Sync failed");
      }

      setResult({
        synced: data.synced,
        updated: data.updated,
        failed: data.failed,
      });
      setSuccess(`Synced ${data.synced} new, updated ${data.updated}, ${data.failed} failed`);

      setTimeout(() => {
        setSuccess(null);
        setResult(null);
        if (onSuccess) onSuccess();
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Button size="sm" onClick={handleSync} disabled={loading}>
        {loading ? "Syncing..." : "Sync"}
      </Button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-sm text-green-600 dark:text-green-400">{success}</p>}
      {result && (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          {result.synced > 0 && <span>+{result.synced} new </span>}
          {result.updated > 0 && <span>~{result.updated} updated </span>}
          {result.failed > 0 && <span className="text-red-600">!{result.failed} failed</span>}
        </div>
      )}
    </div>
  );
}
