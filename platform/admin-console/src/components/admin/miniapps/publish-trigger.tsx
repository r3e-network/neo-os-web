// =============================================================================
// Publish Trigger Component
// Publishes an approved submission after manual CDN upload
// =============================================================================

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

interface PublishTriggerProps {
  submissionId: string;
  onSuccess?: () => void;
}

export function PublishTrigger({ submissionId, onSuccess }: PublishTriggerProps) {
  const [entryUrl, setEntryUrl] = useState("");
  const [cdnBaseUrl, setCdnBaseUrl] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [bannerUrl, setBannerUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handlePublish = async () => {
    if (!entryUrl || !cdnBaseUrl) {
      setError("Entry URL and CDN base URL are required");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    const payload: {
      submission_id: string;
      entry_url: string;
      cdn_base_url: string;
      assets_selected?: { icon?: string; banner?: string };
    } = {
      submission_id: submissionId,
      entry_url: entryUrl,
      cdn_base_url: cdnBaseUrl,
    };

    if (iconUrl || bannerUrl) {
      payload.assets_selected = {
        ...(iconUrl ? { icon: iconUrl } : {}),
        ...(bannerUrl ? { banner: bannerUrl } : {}),
      };
    }

    try {
      const response = await fetch("/api/admin/miniapps/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || result.details || "Publish failed");
      }

      setSuccess("Published");
      setTimeout(() => {
        setSuccess(null);
        onSuccess?.();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <Input
        label="Entry URL"
        value={entryUrl}
        onChange={(e) => setEntryUrl(e.target.value)}
        aria-label="Entry URL"
        placeholder="https://cdn.example.com/miniapps/app-id/version/index.html"
      />
      <Input
        label="CDN Base URL"
        value={cdnBaseUrl}
        onChange={(e) => setCdnBaseUrl(e.target.value)}
        aria-label="CDN Base URL"
        placeholder="https://cdn.example.com"
      />
      <Input
        label="Icon URL (optional)"
        value={iconUrl}
        onChange={(e) => setIconUrl(e.target.value)}
        aria-label="Icon URL"
      />
      <Input
        label="Banner URL (optional)"
        value={bannerUrl}
        onChange={(e) => setBannerUrl(e.target.value)}
        aria-label="Banner URL"
      />
      <Button size="sm" onClick={handlePublish} disabled={loading}>
        {loading ? "Publishing..." : "Publish"}
      </Button>
      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-600 dark:text-green-400">{success}</p>}
    </div>
  );
}
