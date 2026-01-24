/**
 * Create Version Form - Upload new app version
 */

import { useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CreateVersionFormProps {
  appId: string;
  onSubmit: (data: { version: string; release_notes: string; entry_url: string; build_url?: string }) => Promise<void>;
  onCancel: () => void;
}

export function CreateVersionForm({ onSubmit, onCancel }: CreateVersionFormProps) {
  const [version, setVersion] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [entryUrl, setEntryUrl] = useState("");
  const [buildUrl, setBuildUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        version,
        release_notes: releaseNotes,
        entry_url: entryUrl,
        build_url: buildUrl.trim() ? buildUrl.trim() : undefined,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-2xl p-6 bg-white dark:bg-[#080808] border border-gray-200 dark:border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white">Create New Version</h3>
        <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-white/10 rounded-lg">
          <X size={20} className="text-gray-500" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Version Number <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            placeholder="1.0.0"
            value={version}
            onChange={(e) => setVersion(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Entry URL <span className="text-red-500">*</span>
          </label>
          <input
            type="url"
            required
            placeholder="https://your-app.com/index.html"
            value={entryUrl}
            onChange={(e) => setEntryUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Build Artifact URL
          </label>
          <input
            type="url"
            placeholder="https://your-cdn.com/builds/app-v1.zip"
            value={buildUrl}
            onChange={(e) => setBuildUrl(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo text-gray-900 dark:text-white"
          />
          <p className="mt-2 text-xs text-gray-500">
            Optional: link to a downloadable build package for admin review.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Release Notes</label>
          <textarea
            rows={4}
            placeholder="What's new in this version..."
            value={releaseNotes}
            onChange={(e) => setReleaseNotes(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 focus:border-neo focus:ring-1 focus:ring-neo text-gray-900 dark:text-white resize-none"
          />
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="flex-1 bg-neo text-white hover:bg-neo/90">
            {submitting ? "Creating..." : "Create Version"}
          </Button>
        </div>
      </form>
    </div>
  );
}
